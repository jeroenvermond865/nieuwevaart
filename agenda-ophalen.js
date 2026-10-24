// Haalt de agenda's op en schrijft agenda.json (draait elk uur via GitHub Actions).
// Gebruik: node agenda-ophalen.js
const fs = require('fs');
const AGENDAS = require('./agenda-instellingen.js');
const { lees } = require('./agenda-ics.js');

(async () => {
  let oud = { items: [] };
  try { oud = JSON.parse(fs.readFileSync('agenda.json', 'utf8')); } catch (e) { /* eerste keer */ }

  const items = [];
  const status = {};
  for (const a of AGENDAS) {
    try {
      const res = await fetch(a.url, { headers: { 'User-Agent': 'nieuwevaart.nl agenda' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const tekst = await res.text();
      if (!tekst.includes('BEGIN:VCALENDAR')) throw new Error('geen iCal-agenda');
      const gelezen = lees(tekst, a.cat, { dagenTerug: 7, dagenVooruit: 400 });
      items.push(...gelezen);
      status[a.cat] = { ok: true, aantal: gelezen.length };
    } catch (e) {
      // ophalen mislukt: vorige versie van deze agenda bewaren
      const vorige = (oud.items || []).filter((i) => i.cat === a.cat);
      items.push(...vorige);
      status[a.cat] = { ok: false, fout: String(e.message || e), bewaard: vorige.length };
    }
  }
  items.sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));

  const nieuwInhoud = JSON.stringify(items);
  if (nieuwInhoud === JSON.stringify(oud.items || []) && oud.bijgewerkt) {
    console.log('Geen wijzigingen.', JSON.stringify(status));
    return;
  }
  fs.writeFileSync('agenda.json', JSON.stringify({ bijgewerkt: new Date().toISOString(), status, items }, null, 1) + '\n');
  console.log('agenda.json bijgewerkt:', items.length, 'items', JSON.stringify(status));
})();
