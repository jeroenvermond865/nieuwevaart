// Haalt de wiki-pagina's op en schrijft wiki.json (terugval als live ophalen niet lukt).
// Draait elk uur via GitHub Actions. Gebruik: node wiki-ophalen.js
const fs = require('fs');
const WIKI = require('./wiki-instellingen.js');
const API = WIKI.basis + '/api.php';

async function api(params) {
  const url = API + '?' + new URLSearchParams(Object.assign({ format: 'json', formatversion: '2' }, params));
  const res = await fetch(url, { headers: { 'User-Agent': 'nieuwevaart.nl wiki-koppeling' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

(async () => {
  let oud = { paginas: {}, categorieen: {} };
  try { oud = JSON.parse(fs.readFileSync('wiki.json', 'utf8')); } catch (e) { /* eerste keer */ }

  const categorieen = {};
  const titels = new Set([WIKI.vloot, WIKI.kaagcup, WIKI.geschiedenis]);
  for (const groep of WIKI.leiding) {
    (groep.paginas || []).forEach((t) => titels.add(t));
    if (groep.categorie) {
      try {
        const r = await api({ action: 'query', list: 'categorymembers', cmtitle: 'Categorie:' + groep.categorie, cmlimit: '200', cmtype: 'page' });
        categorieen[groep.categorie] = r.query.categorymembers.map((m) => m.title).sort((a, b) => a.localeCompare(b, 'nl'));
      } catch (e) {
        categorieen[groep.categorie] = (oud.categorieen || {})[groep.categorie] || [];
      }
      categorieen[groep.categorie].forEach((t) => titels.add(t));
    }
  }

  const paginas = {};
  const status = {};
  for (const titel of titels) {
    try {
      const r = await api({ action: 'parse', page: titel, prop: 'text|revid', disabletoc: '1', disableeditsection: '1', redirects: '1' });
      if (r.error) throw new Error(r.error.code);
      paginas[titel] = { html: r.parse.text, revid: r.parse.revid };
      status[titel] = 'ok';
    } catch (e) {
      if ((oud.paginas || {})[titel]) paginas[titel] = oud.paginas[titel];
      status[titel] = String(e.message || e);
    }
  }

  const nieuw = JSON.stringify({ paginas, categorieen });
  if (oud.bijgewerkt && nieuw === JSON.stringify({ paginas: oud.paginas, categorieen: oud.categorieen })) {
    console.log('Geen wijzigingen.', JSON.stringify(status));
    return;
  }
  fs.writeFileSync('wiki.json', JSON.stringify({ bijgewerkt: new Date().toISOString(), status, categorieen, paginas }) + '\n');
  console.log('wiki.json bijgewerkt:', Object.keys(paginas).length, "pagina's", JSON.stringify(status));
})();
