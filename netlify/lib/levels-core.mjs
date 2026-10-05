// Calcul des niveaux ICT à partir de bougies horaires (heure de New York).
// Pur et sans réseau : testé séparément (netlify/lib/levels-core.test.mjs).
//
// Journée de trading CME : 18:00 la veille à 17:00 (heure de New York).
// Asie : 20:00 à 00:00 · Londres : 02:00 à 05:00 · NWOG : clôture du vendredi 17:00 contre ouverture du dimanche 18:00.

const NY = 'America/New_York';
const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: NY, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
});

export function nyParts(ms) {
  const o = {};
  for (const p of fmt.formatToParts(new Date(ms))) o[p.type] = p.value;
  const h = Number(o.hour) % 24;
  return { y: Number(o.year), m: Number(o.month), d: Number(o.day), h, mi: Number(o.minute), wd: o.weekday };
}
function ymd(y, m, d) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
function weekdayOf(key) { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
// Lundi de la semaine d'une journée de trading
function weekKey(key) { const wd = weekdayOf(key); return addDays(key, -((wd + 6) % 7)); }

// Journée de trading d'une bougie qui commence à ms
export function tradingDayOf(ms) {
  const p = nyParts(ms);
  const key = ymd(p.y, p.m, p.d);
  return p.h >= 18 ? addDays(key, 1) : key;
}

// ── Contrat actif (sans appel réseau) ───────────────────────────────────────
const MONTH_CODE = { 1: 'F', 2: 'G', 3: 'H', 4: 'J', 5: 'K', 6: 'M', 7: 'N', 8: 'Q', 9: 'U', 10: 'V', 11: 'X', 12: 'Z' };
function thirdFriday(y, m) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const offset = (5 - first + 7) % 7; // premier vendredi
  return ymd(y, m, 1 + offset + 14);
}
function lastBusinessDay(y, m) {
  const t = new Date(Date.UTC(y, m, 0)); // dernier jour du mois m
  while (t.getUTCDay() === 0 || t.getUTCDay() === 6) t.setUTCDate(t.getUTCDate() - 1);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
// Indices (MNQ, MES, MYM) : trimestriels, bascule 8 jours avant l'échéance (3e vendredi).
// Or (MGC) : février, avril, juin, août, décembre ; bascule environ une semaine avant le dernier jour ouvré du mois précédent (premier avis de livraison).
export function activeContract(root, todayKey) {
  const [y0, m0] = todayKey.split('-').map(Number);
  const gold = root === 'MGC' || root === 'GC';
  const months = gold ? [2, 4, 6, 8, 12] : [3, 6, 9, 12];
  for (let k = 0; k < 24; k++) {
    const y = y0 + Math.floor((m0 - 1 + k) / 12), m = ((m0 - 1 + k) % 12) + 1;
    if (!months.includes(m)) continue;
    const roll = gold
      ? addDays(lastBusinessDay(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1), -6)
      : addDays(thirdFriday(y, m), -8);
    if (todayKey < roll) return `${root}${MONTH_CODE[m]}${String(y).slice(-1)}`;
  }
  return null;
}

// ── Niveaux ────────────────────────────────────────────────────────────────
// bars : [{t: ms début de bougie, o, h, l, c}] en bougies d'une heure, triées
export function computeLevels(bars, opt = {}) {
  const tick = opt.tick || 0.25;
  const now = opt.now || Date.now();
  const B = bars.filter((b) => b && isFinite(b.t) && isFinite(b.h) && isFinite(b.l)).sort((a, b) => a.t - b.t)
    .map((b) => ({ ...b, day: tradingDayOf(b.t), p: nyParts(b.t) }));
  if (!B.length) return { levels: [], dataUntil: null, note: 'aucune donnée' };
  const last = B[B.length - 1];
  const dataUntil = new Date(last.t + 3600000).toISOString();
  const byDay = new Map();
  for (const b of B) { if (!byDay.has(b.day)) byDay.set(b.day, []); byDay.get(b.day).push(b); }
  const days = [...byDay.keys()].sort();
  const complete = (k) => (byDay.get(k) || []).some((b) => b.p.h === 16); // la bougie 16:00 à 17:00 clôt la journée
  const hi = (arr) => Math.max(...arr.map((b) => b.h));
  const lo = (arr) => Math.min(...arr.map((b) => b.l));
  const after = (t) => B.filter((b) => b.t >= t);
  const etat = (price, side, t) => {
    const rest = after(t);
    if (!rest.length) return 'intact';
    return side === 'haut' ? (hi(rest) > price ? 'pris' : 'intact') : (lo(rest) < price ? 'pris' : 'intact');
  };
  const endOf = (arr) => arr[arr.length - 1].t + 3600000;
  const L = [];
  const push = (type, prix, tf, side, t, extra) => L.push({ type, prix: round(prix, tick), tf, etat: side ? etat(prix, side, t) : 'intact', ...extra });

  // Veille (dernière journée complète)
  const doneDays = days.filter(complete);
  const pd = doneDays[doneDays.length - 1];
  if (pd) {
    const arr = byDay.get(pd);
    push('PDH', hi(arr), 'D1', 'haut', endOf(arr), { jour: pd });
    push('PDL', lo(arr), 'D1', 'bas', endOf(arr), { jour: pd });
  }
  // Semaine précédente complète
  const curWeek = weekKey(tradingDayOf(now));
  const weeks = [...new Set(days.map(weekKey))].filter((w) => w < curWeek).sort();
  const pw = weeks[weeks.length - 1];
  if (pw) {
    const arr = B.filter((b) => weekKey(b.day) === pw);
    push('PWH', hi(arr), 'W1', 'haut', endOf(arr), { semaine: pw });
    push('PWL', lo(arr), 'W1', 'bas', endOf(arr), { semaine: pw });
  }
  // Asie et Londres : dernière séance complète
  const sessionOf = (hours, label, tf) => {
    for (let i = days.length - 1; i >= 0; i--) {
      const arr = byDay.get(days[i]).filter((b) => hours.includes(b.p.h));
      if (hours.every((h) => arr.some((b) => b.p.h === h))) {
        push(`${label} haut`, hi(arr), tf, 'haut', endOf(arr), { jour: days[i] });
        push(`${label} bas`, lo(arr), tf, 'bas', endOf(arr), { jour: days[i] });
        return days[i];
      }
    }
    return null;
  };
  sessionOf([20, 21, 22, 23], 'Asie', 'H1');
  sessionOf([2, 3, 4], 'Londres', 'H1');
  // NWOG : dernière clôture du vendredi et première ouverture du dimanche qui suit
  for (let i = B.length - 1; i > 0; i--) {
    const b = B[i];
    if (b.p.wd === 'Sun' && b.p.h === 18) {
      const prev = B.slice(0, i).reverse().find((x) => x.p.wd === 'Fri' && x.p.h === 16);
      if (prev) {
        const a = Math.min(prev.c, b.o), z = Math.max(prev.c, b.o);
        L.push({ type: 'NWOG', prix: `${fmtP(round(a, tick))} à ${fmtP(round(z, tick))}`, bas: round(a, tick), haut: round(z, tick), tf: 'W1', etat: 'zone', jour: b.day });
      }
      break;
    }
  }
  // EQH / EQL : deux sommets (ou creux) horaires quasi égaux sur les 5 dernières journées, encore intacts
  const recent = B.filter((b) => days.slice(-5).includes(b.day));
  const tol = Math.max(tick * 4, (last.c || last.h) * 0.0002);
  const swings = (side) => recent.filter((b, i) => i >= 2 && i < recent.length - 2 && (side === 'haut'
    ? b.h > recent[i - 1].h && b.h > recent[i - 2].h && b.h >= recent[i + 1].h && b.h >= recent[i + 2].h
    : b.l < recent[i - 1].l && b.l < recent[i - 2].l && b.l <= recent[i + 1].l && b.l <= recent[i + 2].l));
  for (const side of ['haut', 'bas']) {
    const S = swings(side), key = side === 'haut' ? 'h' : 'l', seen = new Set();
    for (let i = S.length - 1; i >= 0 && seen.size < 2; i--) {
      for (let j = i - 1; j >= 0; j--) {
        if (Math.abs(S[i][key] - S[j][key]) <= tol && S[i].t - S[j].t >= 3 * 3600000) {
          const price = side === 'haut' ? Math.max(S[i].h, S[j].h) : Math.min(S[i].l, S[j].l);
          const st = etat(price, side, S[i].t + 3600000);
          const id = round(price, tick);
          if (st === 'intact' && !seen.has(id)) { seen.add(id); push(side === 'haut' ? 'EQH' : 'EQL', price, 'H1', side, S[i].t + 3600000); }
          break;
        }
      }
    }
  }
  return { levels: L, dataUntil };
}
function round(x, tick) { return Math.round(x / tick) * tick; }
function fmtP(x) { return String(x); }
