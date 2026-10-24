/* =====================================================================
   Wiki-koppeling: haalt pagina's live van wiki.vadedo.nl (MediaWiki-API)
   en toont ze in de opmaak van deze site. Lukt live ophalen niet, dan
   gebruikt de site wiki.json (die GitHub elk uur ververst).
   ===================================================================== */
(function () {
  'use strict';
  var W = window.WIKI;
  if (!W || !window.DOMParser) return;
  var API = W.basis + '/api.php';
  var vlootVak = document.getElementById('vloot-wiki');
  var kaagVak = document.getElementById('kaagcup-wiki');
  var geschVak = document.getElementById('geschiedenis-wiki');
  var leidingVak = document.getElementById('leiding-wiki');
  if (!vlootVak && !kaagVak && !geschVak && !leidingVak) return;

  /* ---------- Ophalen ---------- */
  var kopie = null;
  function haalKopie() {
    if (!kopie) kopie = fetch('wiki.json?v=' + Math.floor(Date.now() / 6e5))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    return kopie;
  }
  function metTijdslimiet(belofte, ms) {
    return Promise.race([belofte, new Promise(function (_, nee) { setTimeout(function () { nee(new Error('te traag')); }, ms); })]);
  }
  function apiUrl(params) {
    var q = 'format=json&formatversion=2&origin=*';
    Object.keys(params).forEach(function (k) { q += '&' + k + '=' + encodeURIComponent(params[k]); });
    return API + '?' + q;
  }
  var paginaCache = {};
  function haalPagina(titel) {
    if (paginaCache[titel]) return paginaCache[titel];
    var live = metTijdslimiet(fetch(apiUrl({ action: 'parse', page: titel, prop: 'text|revid', disabletoc: 1, disableeditsection: 1, redirects: 1 }))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { if (j.error) throw new Error(j.error.code); return j.parse.text; }), 8000);
    paginaCache[titel] = live.catch(function () {
      return haalKopie().then(function (k) {
        var p = (k.paginas || {})[titel];
        if (!p) throw new Error('niet gevonden');
        return p.html;
      });
    });
    return paginaCache[titel];
  }
  function haalCategorie(naam) {
    var live = metTijdslimiet(fetch(apiUrl({ action: 'query', list: 'categorymembers', cmtitle: 'Categorie:' + naam, cmlimit: 200, cmtype: 'page' }))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { return j.query.categorymembers.map(function (m) { return m.title; }); }), 8000);
    return live.catch(function () {
      return haalKopie().then(function (k) { return (k.categorieen || {})[naam] || []; });
    }).then(function (lijst) { return lijst.slice().sort(function (a, b) { return a.localeCompare(b, 'nl'); }); });
  }

  /* ---------- Hulpjes ---------- */
  function el(tag, cls, tekst) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (tekst != null) e.textContent = tekst;
    return e;
  }
  function schoneTekst(node) { return (node.textContent || '').replace(/\s+/g, ' ').trim(); }
  function slug(t) { return 'wiki-' + t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function wikiLink(titel) { return W.basis + '/wiki/' + encodeURIComponent(titel.replace(/ /g, '_')).replace(/%2F/g, '/'); }
  function lees(html) { return new DOMParser().parseFromString(html, 'text/html'); }
  function titelUitHref(href) {
    var m = /^\/wiki\/([^?#]+)/.exec(href) || /[?&]title=([^&#]+)/.exec(href);
    if (!m) return null;
    try { return decodeURIComponent(m[1]).replace(/_/g, ' '); } catch (e) { return m[1].replace(/_/g, ' '); }
  }

  // Tabellen uit een wiki-pagina, met de titel die erboven staat
  function tabellen(doc) {
    return Array.prototype.map.call(doc.querySelectorAll('table'), function (t) {
      var kop = '', v = t.previousElementSibling;
      while (v && !kop) { kop = schoneTekst(v); v = v.previousElementSibling; }
      var rijen = Array.prototype.map.call(t.querySelectorAll('tr'), function (tr) {
        return Array.prototype.map.call(tr.children, function (c) { return schoneTekst(c); });
      });
      var koppen = (rijen.shift() || []).map(function (k) { return k.toLowerCase(); });
      return { titel: kop.toLowerCase(), koppen: koppen, rijen: rijen };
    });
  }
  function kolom(tabel, zoek) {
    for (var i = 0; i < tabel.koppen.length; i++) if (tabel.koppen[i].indexOf(zoek) !== -1) return i;
    return -1;
  }
  function veld(rij, i) { return i >= 0 && rij[i] ? rij[i] : ''; }
  function leeg(w) { return !w || /^n\.?v\.?t\.?$/i.test(w) || w === '-'; }

  /* ---------- Opschonen van wiki-HTML naar sitestijl ---------- */
  var TOEGESTAAN = 'P UL OL LI TABLE THEAD TBODY TFOOT TR TH TD CAPTION B STRONG I EM U A BR IMG CODE PRE BLOCKQUOTE DL DT DD HR SUP SUB S DEL H1 H2 H3 H4 H5 H6'.split(' ');
  function schoon(html, opties) {
    opties = opties || {};
    var doc = lees(html);
    var wortel = doc.querySelector('.mw-parser-output') || doc.body;
    Array.prototype.forEach.call(wortel.querySelectorAll('script,style,.mw-editsection,.toc,#toc,.mw-empty-elt,link,meta'), function (n) { n.remove(); });
    // kopniveaus: hoogste kop in de pagina wordt h3
    var niveaus = [];
    Array.prototype.forEach.call(wortel.querySelectorAll('h1,h2,h3,h4,h5,h6'), function (h) {
      var n = +h.tagName[1]; if (niveaus.indexOf(n) === -1) niveaus.push(n);
    });
    niveaus.sort();
    var uit = document.createDocumentFragment();
    function kopieer(bron, doel) {
      Array.prototype.forEach.call(bron.childNodes, function (n) {
        if (n.nodeType === 3) { doel.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;
        var tag = n.tagName;
        if (TOEGESTAAN.indexOf(tag) === -1) { kopieer(n, doel); return; }
        if (tag === 'A' && /(^|\s)new(\s|$)/.test(n.className)) { kopieer(n, doel); return; } // rode link: alleen tekst
        var nieuwTag = tag;
        if (/^H[1-6]$/.test(tag)) nieuwTag = 'H' + Math.min(3 + niveaus.indexOf(+tag[1]), 5);
        var e = document.createElement(nieuwTag);
        if (tag === 'A') {
          var href = n.getAttribute('href') || '';
          var titel = titelUitHref(href);
          if (titel && opties.intern && opties.intern[titel]) {
            e.setAttribute('href', '#' + slug(titel));
            e.setAttribute('data-wiki-open', slug(titel));
          } else {
            if (href.charAt(0) === '/') href = W.basis + href;
            if (!/^(https?:|mailto:)/i.test(href)) { kopieer(n, doel); return; }
            e.setAttribute('href', href);
            e.setAttribute('target', '_blank');
            e.setAttribute('rel', 'noopener');
          }
        } else if (tag === 'IMG') {
          var src = n.getAttribute('src') || '';
          if (src.charAt(0) === '/') src = W.basis + src;
          if (!/^https?:/i.test(src)) return;
          e.setAttribute('src', src);
          e.setAttribute('alt', n.getAttribute('alt') || '');
          e.setAttribute('loading', 'lazy');
          ['width', 'height'].forEach(function (a) { if (n.getAttribute(a)) e.setAttribute(a, n.getAttribute(a)); });
        } else if (tag === 'TD' || tag === 'TH') {
          ['colspan', 'rowspan'].forEach(function (a) { if (n.getAttribute(a)) e.setAttribute(a, n.getAttribute(a)); });
        }
        kopieer(n, e);
        if (tag === 'TABLE') {
          var wrap = el('div', 'wiki-tabel');
          wrap.appendChild(e);
          doel.appendChild(wrap);
        } else doel.appendChild(e);
      });
    }
    kopieer(wortel, uit);
    // lege alinea's weghalen
    Array.prototype.forEach.call(uit.querySelectorAll('p'), function (p) { if (!p.textContent.trim() && !p.querySelector('img')) p.remove(); });
    return uit;
  }
  function inhoud(frag) { var d = el('div', 'wiki-inhoud'); d.appendChild(frag); return d; }
  function bron(titel, tekst) {
    var p = el('p', 'wiki-bron');
    p.appendChild(document.createTextNode(tekst || 'Bron: '));
    var a = el('a', null, 'VaDeDo-wiki');
    a.href = wikiLink(titel); a.target = '_blank'; a.rel = 'noopener';
    p.appendChild(a);
    return p;
  }

  /* ---------- Vloot (WSA-pagina) ---------- */
  var vlootData = null;
  function leesVloot() {
    if (vlootData) return vlootData;
    vlootData = haalPagina(W.vloot).then(function (html) {
      var data = { vletten: [], slepers: [], pont: [], schouwen: [], namen: {} };
      tabellen(lees(html)).forEach(function (t) {
        var iNr = kolom(t, 'nummer'), iNaam = kolom(t, 'naam'), iJaar = kolom(t, 'bouwjaar'), iOnd = kolom(t, 'onderdeel'), iVerk = kolom(t, 'verkocht');
        t.rijen.forEach(function (r) {
          var b = { nr: veld(r, iNr), naam: veld(r, iNaam), jaar: veld(r, iJaar), onderdeel: veld(r, iOnd).split('//')[0].trim() };
          if (!b.naam) return;
          if (b.nr) data.namen[b.nr] = b.naam;
          if (t.titel.indexOf('sleper') !== -1) data.slepers.push(b);
          else if (t.titel.indexOf('pont') !== -1) data.pont.push(b);
          else if (t.titel.indexOf('schouw') !== -1) { if (leeg(veld(r, iVerk))) data.schouwen.push(b); }
          else if (!leeg(b.onderdeel)) data.vletten.push(b);
        });
      });
      return data;
    });
    return vlootData;
  }
  function isEigen(onderdeel) { return onderdeel.toLowerCase() === W.eigenOnderdeel.toLowerCase(); }
  function groepNaam(o) { return /^vaart$/i.test(o) ? 'De Vaart' : o; }

  function tekenVloot() {
    leesVloot().then(function (d) {
      var frag = document.createDocumentFragment();
      frag.appendChild(el('h3', 'vloot__kop', 'Boten van de ' + W.eigenOnderdeel));
      var ul = el('ul', 'vloot vloot--eigen');
      ul.setAttribute('aria-label', 'Lelievletten van de ' + W.eigenOnderdeel + ', met zeilnummer en bouwjaar');
      d.vletten.filter(function (b) { return isEigen(b.onderdeel); }).forEach(function (b) {
        var li = el('li');
        li.appendChild(el('span', 'vloot__nr', b.nr));
        var naam = el('span', 'vloot__naam');
        if (/^Onver/.test(b.naam)) { naam.appendChild(el('span', 'vloot__onver', 'Onver')); naam.appendChild(document.createTextNode(b.naam.slice(5))); }
        else naam.textContent = b.naam;
        li.appendChild(naam);
        if (b.jaar) li.appendChild(el('span', 'vloot__jaar', 'Bouwjaar ' + b.jaar));
        ul.appendChild(li);
      });
      frag.appendChild(ul);
      var eigenSleper = d.slepers.filter(function (b) { return isEigen(b.onderdeel); })[0];
      if (eigenSleper) {
        var p = el('p', 'vloot__sleper');
        p.appendChild(document.createTextNode('Daarnaast hebben we een eigen sleper: de '));
        p.appendChild(el('strong', null, eigenSleper.naam));
        p.appendChild(document.createTextNode(eigenSleper.jaar ? ', uit ' + eigenSleper.jaar + '.' : '.'));
        frag.appendChild(p);
      }
      // de rest, per onderdeel
      var volgorde = ['Kleine Vaart', 'De Vaart', 'Wilde Vaart', 'Waterwerk'], groepen = {};
      function voegToe(o, nr, tekst, sleper) {
        var g = groepNaam(o);
        if (!groepen[g]) { groepen[g] = []; if (volgorde.indexOf(g) === -1) volgorde.push(g); }
        groepen[g].push({ nr: nr, tekst: tekst, sleper: sleper });
      }
      d.vletten.forEach(function (b) { if (!isEigen(b.onderdeel)) voegToe(b.onderdeel, b.nr, b.naam); });
      d.schouwen.forEach(function (b) { if (!isEigen(b.onderdeel)) voegToe(b.onderdeel, b.nr, 'Schouw ' + b.naam); });
      d.slepers.forEach(function (b) { if (!isEigen(b.onderdeel)) voegToe(b.onderdeel, '', 'Sleper ' + b.naam, true); });
      frag.appendChild(el('h3', 'vloot__kop vloot__kop--rest', 'De rest van de VaDeDo-vloot'));
      var rest = el('div', 'vloot-rest');
      volgorde.forEach(function (g) {
        if (!groepen[g]) return;
        var div = el('div', 'vloot-rest__groep');
        div.appendChild(el('h4', null, g));
        var l = el('ul');
        groepen[g].forEach(function (x) {
          var li = el('li', x.sleper ? 'vloot-rest__sleper' : null);
          if (x.nr) { li.appendChild(el('span', null, x.nr)); li.appendChild(document.createTextNode(' ')); }
          li.appendChild(document.createTextNode(x.tekst));
          l.appendChild(li);
        });
        div.appendChild(l);
        rest.appendChild(div);
      });
      if (d.pont.length) {
        var div = el('div', 'vloot-rest__groep');
        div.appendChild(el('h4', null, 'Voor de hele groep'));
        var l = el('ul');
        d.pont.forEach(function (b) { l.appendChild(el('li', null, 'Pont ' + b.naam)); });
        div.appendChild(l);
        rest.appendChild(div);
      }
      frag.appendChild(rest);
      vlootVak.innerHTML = '';
      vlootVak.appendChild(frag);
    }).catch(function () { /* statische versie blijft staan */ });
  }

  /* ---------- Kaagcup (Kampen-pagina) ---------- */
  function tekenKaagcup() {
    Promise.all([haalPagina(W.kaagcup), leesVloot().catch(function () { return { namen: {}, vletten: [] }; })]).then(function (res) {
      var doc = lees(res[0]), vloot = res[1];
      var eigen = {};
      vloot.vletten.forEach(function (b) { if (isEigen(b.onderdeel)) eigen[b.nr] = true; });
      var t = tabellen(doc)[0];
      if (!t) throw new Error('geen tabel');
      var iJ = kolom(t, 'jaar'), iB = kolom(t, 'boot'), iP = kolom(t, 'prijs'), iR = kolom(t, 'roer');
      if (iR < 0) iR = kolom(t, 'stuur');
      var rijen = t.rijen.map(function (r) {
        return { jaar: veld(r, iJ), boot: veld(r, iB), prijs: veld(r, iP), wie: veld(r, iR) };
      }).filter(function (r) { return r.jaar; });
      rijen.sort(function (a, b) { return (+b.jaar - +a.jaar) || (+a.prijs - +b.prijs); });
      var aantalEigen = rijen.filter(function (r) { return eigen[r.boot]; }).length;

      var frag = document.createDocumentFragment();
      var intro = el('p', 'intro');
      intro.textContent = 'Sinds 1998 viel VaDeDo ' + rijen.length + ' keer in de prijzen bij de Kaagcup' +
        (aantalEigen ? ', waarvan ' + aantalEigen + ' keer met een boot van de ' + W.eigenOnderdeel + '.' : '.');
      frag.appendChild(intro);
      var knoppen = el('div', 'agenda-filters');
      knoppen.setAttribute('role', 'group'); knoppen.setAttribute('aria-label', 'Laat zien');
      var alle = el('button', 'tab', 'Alle prijzen'), wij = el('button', 'tab', W.eigenOnderdeel);
      [alle, wij].forEach(function (k, i) { k.type = 'button'; k.setAttribute('aria-pressed', String(i === 0)); knoppen.appendChild(k); });
      frag.appendChild(knoppen);
      var wrap = el('div', 'wiki-tabel kaag-tabel');
      var tabel = el('table');
      var thead = el('thead'), kop = el('tr');
      ['Jaar', 'Boot', 'Prijs', 'Roerganger'].forEach(function (k) { var th = el('th', null, k); th.scope = 'col'; kop.appendChild(th); });
      thead.appendChild(kop); tabel.appendChild(thead);
      var tbody = el('tbody');
      rijen.forEach(function (r) {
        var tr = el('tr', eigen[r.boot] ? 'is-eigen' : null);
        tr.appendChild(el('td', 'kaag-jaar', r.jaar));
        var tdB = el('td');
        tdB.appendChild(el('span', 'kaag-nr', r.boot));
        if (vloot.namen[r.boot]) tdB.appendChild(document.createTextNode(' ' + vloot.namen[r.boot]));
        if (eigen[r.boot]) tdB.appendChild(el('span', 'kaag-wij', W.eigenOnderdeel));
        tr.appendChild(tdB);
        var tdP = el('td');
        var medaille = el('span', 'medaille medaille--' + (r.prijs || 'x'), r.prijs ? r.prijs + 'e' : '?');
        tdP.appendChild(medaille);
        tdP.appendChild(el('span', 'sr-only', ' prijs'));
        tr.appendChild(tdP);
        tr.appendChild(el('td', null, r.wie));
        tbody.appendChild(tr);
      });
      tabel.appendChild(tbody);
      wrap.appendChild(tabel);
      frag.appendChild(wrap);
      function kies(alleenWij) {
        alle.setAttribute('aria-pressed', String(!alleenWij)); wij.setAttribute('aria-pressed', String(alleenWij));
        Array.prototype.forEach.call(tbody.children, function (tr) { tr.hidden = alleenWij && !tr.classList.contains('is-eigen'); });
      }
      alle.addEventListener('click', function () { kies(false); });
      wij.addEventListener('click', function () { kies(true); });
      frag.appendChild(bron(W.kaagcup, 'Weet je een prijs die hier niet staat? Zet hem op de '));
      kaagVak.innerHTML = '';
      kaagVak.appendChild(frag);
    }).catch(function () {
      kaagVak.innerHTML = '';
      kaagVak.appendChild(el('p', 'agenda-leeg', 'De uitslagen konden niet worden geladen.'));
      kaagVak.appendChild(bron(W.kaagcup, 'Bekijk ze op de '));
    });
  }

  /* ---------- Geschiedenis (Lid worden) ---------- */
  function tekenGeschiedenis() {
    haalPagina(W.geschiedenis).then(function (html) {
      var doc = lees(html);
      var kop = doc.getElementById('Geschiedenis');
      var stuk = html;
      if (kop) {
        var h = kop.closest('h1,h2,h3,h4') || kop;
        var bak = doc.createElement('div'), n = h.nextElementSibling;
        while (n && !/^H[1-4]$/.test(n.tagName)) { bak.appendChild(n.cloneNode(true)); n = n.nextElementSibling; }
        stuk = bak.innerHTML;
      }
      geschVak.innerHTML = '';
      geschVak.appendChild(inhoud(schoon(stuk)));
      geschVak.appendChild(bron(W.geschiedenis));
    }).catch(function () { /* statische tekst blijft staan */ });
  }

  /* ---------- Voor leiding ---------- */
  function tekenLeiding() {
    var groepen = W.leiding.map(function (g) {
      if (!g.categorie) return Promise.resolve({ titel: g.titel, paginas: g.paginas });
      return haalCategorie(g.categorie).then(function (l) { return { titel: g.titel, paginas: l }; }, function () { return { titel: g.titel, paginas: [] }; });
    });
    Promise.all(groepen).then(function (gs) {
      var intern = {};
      gs.forEach(function (g) { g.paginas.forEach(function (p) { intern[p] = true; }); });
      leidingVak.innerHTML = '';
      var inhoudsopgave = el('nav', 'leiding-index');
      inhoudsopgave.setAttribute('aria-label', 'Onderwerpen');
      leidingVak.appendChild(inhoudsopgave);
      gs.forEach(function (g) {
        if (!g.paginas.length) return;
        var idG = slug('groep ' + g.titel);
        var a = el('a', null, g.titel); a.href = '#' + idG; inhoudsopgave.appendChild(a);
        var sec = el('section', 'leiding-groep');
        sec.id = idG;
        sec.appendChild(el('h2', null, g.titel));
        g.paginas.forEach(function (titel) {
          var det = el('details', 'wiki-blok');
          det.id = slug(titel);
          var sum = el('summary');
          sum.appendChild(el('span', 'wiki-blok__titel', titel));
          det.appendChild(sum);
          var body = el('div', 'wiki-blok__body');
          body.appendChild(el('p', 'agenda-leeg', 'Laden…'));
          det.appendChild(body);
          var geladen = false;
          det.addEventListener('toggle', function () {
            if (!det.open || geladen) return;
            geladen = true;
            haalPagina(titel).then(function (html) {
              var frag = schoon(html, { intern: intern });
              // eerste regel weglaten als die alleen de paginatitel herhaalt
              var eerste = frag.firstElementChild;
              if (eerste && eerste.textContent.trim().toLowerCase() === titel.toLowerCase()) eerste.remove();
              body.innerHTML = '';
              if (!frag.textContent.trim() && !frag.querySelector('img')) {
                body.appendChild(el('p', 'agenda-leeg', 'Deze pagina is nog leeg op de wiki.'));
              } else body.appendChild(inhoud(frag));
              body.appendChild(bron(titel, 'Aanpassen? Dat kan op de '));
            }, function () {
              geladen = false;
              body.innerHTML = '';
              body.appendChild(el('p', 'agenda-leeg', 'Deze pagina kon niet worden geladen.'));
              body.appendChild(bron(titel, 'Bekijk hem op de '));
            });
          });
          sec.appendChild(det);
        });
        leidingVak.appendChild(sec);
      });
      // links tussen wiki-pagina's openen het juiste blok
      leidingVak.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('[data-wiki-open]');
        if (!a) return;
        var doel = document.getElementById(a.getAttribute('data-wiki-open'));
        if (doel) { e.preventDefault(); doel.open = true; doel.scrollIntoView(); history.replaceState(null, '', '#' + doel.id); }
      });
      // direct openen via het adres (bijv. voor-leiding.html#wiki-vletbeheer)
      var hash = location.hash.slice(1);
      var start = hash && document.getElementById(hash);
      if (start && start.tagName === 'DETAILS') { start.open = true; start.scrollIntoView(); }
    });
  }

  if (vlootVak) tekenVloot();
  if (kaagVak) tekenKaagcup();
  if (geschVak) tekenGeschiedenis();
  if (leidingVak) tekenLeiding();
})();
