// Niveaux ICT automatiques pour MNQ, MES, MYM et MGC (top-down du journal et rapports pré-session).
// Source : Massive (ex-Polygon), offre Futures gratuite, bougies d'une heure avec 8 h de retard.
// La clé reste côté serveur (variable d'environnement Netlify MASSIVE_API_KEY), jamais dans la page.

import { activeContract, computeLevels, tradingDayOf } from '../lib/levels-core.mjs';

const ROOTS = { MNQ: 0.25, MES: 0.25, MYM: 1, MGC: 0.1 };
const FRESH_MS = 15 * 60 * 1000;
let memo = { at: 0, body: null };

function json(body, status, extra) {
  return new Response(body, { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, extra || {}) });
}

async function fetchBars(ticker, key, fromKey) {
  const url = `https://api.massive.com/futures/v1/aggs/${ticker}?resolution=1hour&window_start.gte=${fromKey}&limit=50000&sort=window_start.asc&apiKey=${encodeURIComponent(key)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Massive HTTP ${r.status}`);
  const j = await r.json();
  return (j.results || []).map((b) => ({ t: Math.round(Number(b.window_start) / 1e6), o: b.open, h: b.high, l: b.low, c: b.close }));
}

export default async () => {
  const key = process.env.MASSIVE_API_KEY;
  if (!key) return json(JSON.stringify({ ok: false, error: 'Clé MASSIVE_API_KEY absente dans Netlify' }), 503, { 'Cache-Control': 'no-store' });
  const now = Date.now();
  if (!memo.body || now - memo.at > FRESH_MS) {
    const today = tradingDayOf(now);
    const from = new Date(now - 16 * 86400000).toISOString().slice(0, 10);
    const symbols = [];
    for (const root of Object.keys(ROOTS)) {
      const contract = activeContract(root, today);
      try {
        const bars = await fetchBars(contract, key, from);
        const r = computeLevels(bars, { tick: ROOTS[root], now });
        symbols.push({ symbol: root, contract, dataUntil: r.dataUntil, dernier: r.dernier, levels: r.levels });
      } catch (err) {
        symbols.push({ symbol: root, contract, error: String((err && err.message) || err), levels: [] });
      }
    }
    memo = { at: now, body: JSON.stringify({ ok: true, source: 'massive', delay: 'données retardées de 8 h (offre gratuite)', generatedAt: new Date(now).toISOString(), journee: today, symbols }) };
  }
  return json(memo.body, 200, { 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=900, stale-while-revalidate=1800' });
};

export const config = { path: '/api/levels' };
