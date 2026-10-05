// Calendrier économique de la semaine pour le journal (garde-fou news).
// Source : flux public Forex Factory (non officiel, sans clé). Le navigateur ne peut pas
// le lire directement (pas d'en-tête CORS) : cette fonction le relaie sur le même domaine
// que le journal et le garde en cache pour ne pas solliciter la source à chaque visite.

const SOURCE = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const FRESH_MS = 15 * 60 * 1000;
let memo = { at: 0, body: null };

function json(body, status, extra) {
  return new Response(body, {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, extra || {})
  });
}

export default async () => {
  const now = Date.now();
  if (!memo.body || now - memo.at > FRESH_MS) {
    try {
      const r = await fetch(SOURCE, { headers: { 'User-Agent': 'journal-trading-calendar' } });
      if (!r.ok) throw new Error('source HTTP ' + r.status);
      const raw = await r.json();
      if (!Array.isArray(raw)) throw new Error('format inattendu');
      const events = raw
        .filter((e) => e && e.title && e.date)
        .map((e) => ({ t: String(e.title), c: String(e.country || ''), d: String(e.date), i: String(e.impact || ''), f: String(e.forecast || ''), p: String(e.previous || '') }));
      memo = { at: now, body: JSON.stringify({ ok: true, source: 'forexfactory', fetchedAt: new Date(now).toISOString(), events }) };
    } catch (err) {
      // Source indisponible : on sert la dernière version connue si on en a une
      if (!memo.body) {
        return json(JSON.stringify({ ok: false, error: String((err && err.message) || err) }), 502, { 'Cache-Control': 'no-store' });
      }
    }
  }
  return json(memo.body, 200, {
    'Cache-Control': 'public, max-age=300',
    'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=1800, stale-while-revalidate=3600'
  });
};

export const config = { path: '/api/calendar' };
