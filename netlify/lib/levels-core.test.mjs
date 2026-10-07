// node netlify/lib/levels-core.test.mjs
import assert from 'node:assert/strict';
import { activeContract, computeLevels, tradingDayOf } from './levels-core.mjs';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('ok ·', name); };

// Contrats actifs
ok('MNQ le 05/10/2026 = décembre (MNQZ6)', () => assert.equal(activeContract('MNQ', '2026-10-05'), 'MNQZ6'));
ok('MNQ le 10/12/2026 = mars 2027 (bascule 8 jours avant le 18/12)', () => assert.equal(activeContract('MNQ', '2026-12-10'), 'MNQH7'));
ok('MNQ le 09/12/2026 = encore décembre', () => assert.equal(activeContract('MNQ', '2026-12-09'), 'MNQZ6'));
ok('MGC le 05/10/2026 = décembre (MGCZ6)', () => assert.equal(activeContract('MGC', '2026-10-05'), 'MGCZ6'));
ok('MGC le 26/11/2026 = février 2027', () => assert.equal(activeContract('MGC', '2026-11-26'), 'MGCG7'));

// Journée de trading : 18:00 New York = journée suivante
const nyMs = (iso) => Date.parse(iso); // les ISO ci-dessous portent le décalage de New York (-04:00 en octobre)
ok('Bougie du dimanche 18:00 = journée du lundi', () => assert.equal(tradingDayOf(nyMs('2026-10-04T18:00:00-04:00')), '2026-10-05'));
ok('Bougie du lundi 10:00 = journée du lundi', () => assert.equal(tradingDayOf(nyMs('2026-10-05T10:00:00-04:00')), '2026-10-05'));

// Série synthétique : semaine du 28/09 au 02/10 puis lundi 05/10, prix autour de 25 000
const bars = [];
function day(dateKey, base, hiHour, hiVal, loHour, loVal) {
  // de 18:00 la veille à 16:00 le jour même
  const [y, m, d] = dateKey.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  const pk = prev.toISOString().slice(0, 10);
  const hours = [18, 19, 20, 21, 22, 23].map((h) => [pk, h]).concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((h) => [dateKey, h]));
  for (const [k, h] of hours) {
    const t = Date.parse(`${k}T${String(h).padStart(2, '0')}:00:00-04:00`);
    let hv = base + 10, lv = base - 10;
    if (h === hiHour) hv = hiVal; if (h === loHour) lv = loVal;
    bars.push({ t, o: base, h: hv, l: lv, c: base });
  }
}
day('2026-09-28', 25000, 10, 25150, 3, 24900);
day('2026-09-29', 25000, 11, 25120, 4, 24920);
day('2026-09-30', 25000, 10, 25300, 2, 24950); // plus haut de la semaine 25 300
day('2026-10-01', 25000, 9, 25100, 14, 24700); // plus bas de la semaine 24 700
day('2026-10-02', 25050, 21, 25080, 22, 24980); // vendredi : Asie 20-23 h la veille au soir
// lundi 05/10 : bougies du dimanche 18:00 à lundi 08:00 (retard de 8 h)
const monday = [];
for (const [k, h] of [['2026-10-04', 18], ['2026-10-04', 19], ['2026-10-04', 20], ['2026-10-04', 21], ['2026-10-04', 22], ['2026-10-04', 23], ['2026-10-05', 0], ['2026-10-05', 1], ['2026-10-05', 2], ['2026-10-05', 3], ['2026-10-05', 4], ['2026-10-05', 5], ['2026-10-05', 6], ['2026-10-05', 7]]) {
  const t = Date.parse(`${k}T${String(h).padStart(2, '0')}:00:00-04:00`);
  const o = h === 18 && k === '2026-10-04' ? 25070 : 25060;
  monday.push({ t, o, h: h === 21 ? 25095 : 25070, l: h === 3 ? 25010 : 25040, c: 25060 });
}
const all = bars.concat(monday);
const now = Date.parse('2026-10-05T08:05:00-04:00');
const R = computeLevels(all, { tick: 0.25, now });
const get = (t) => R.levels.find((x) => x.type === t);

ok('PDH et PDL = vendredi 02/10 (25 080 et 24 980)', () => { assert.equal(get('PDH').prix, 25080); assert.equal(get('PDL').prix, 24980); });
ok('PWH et PWL = semaine du 28/09 (25 300 et 24 700)', () => { assert.equal(get('PWH').prix, 25300); assert.equal(get('PWL').prix, 24700); });
ok('Asie du lundi = 20:00 à 00:00 dimanche soir (haut 25 095, bas 25 040)', () => { assert.equal(get('Asie haut').prix, 25095); assert.equal(get('Asie bas').prix, 25040); assert.equal(get('Asie haut').jour, '2026-10-05'); });
ok('Londres du lundi = 02:00 à 05:00 (bas 25 010)', () => { assert.equal(get('Londres bas').prix, 25010); assert.equal(get('Londres bas').jour, '2026-10-05'); });
ok('NWOG = clôture vendredi 25 050, ouverture dimanche 25 070', () => { const g = get('NWOG'); assert.equal(g.bas, 25050); assert.equal(g.haut, 25070); });
ok('PDH 25 080 pris dans la nuit (plus haut Asie 25 095)', () => assert.equal(get('PDH').etat, 'pris'));
ok('PWH 25 300 intact', () => assert.equal(get('PWH').etat, 'intact'));
ok('dataUntil = fin de la dernière bougie (08:00 New York)', () => assert.equal(R.dataUntil, new Date(Date.parse('2026-10-05T08:00:00-04:00')).toISOString()));
// Or (tick 0,1) : 4130.9 ne doit jamais devenir 4130.900000000001
const gold = all.map((b) => ({ t: b.t, o: b.o / 6.07, h: b.h / 6.07, l: b.l / 6.07, c: b.c / 6.07 }));
const G = computeLevels(gold, { tick: 0.1, now });
ok('Or : prix arrondis à 0,1 sans décimales parasites', () => {
  for (const l of G.levels) {
    for (const v of [l.prix, l.bas, l.haut].filter((x) => x !== undefined)) assert.match(String(v), /^\d+(\.\d)?$|^\d+(\.\d)? à \d+(\.\d)?$/, `${l.type} : ${v}`);
  }
});
ok('Dernier prix = clôture de la dernière bougie, arrondie au tick', () => { assert.equal(R.dernier.prix, all[all.length - 1].c); assert.equal(R.dernier.a, R.dataUntil); assert.match(String(G.dernier.prix), /^\d+(\.\d)?$/); });
console.log(`\n${n} tests passés`);
