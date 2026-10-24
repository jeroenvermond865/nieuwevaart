/* Agenda op de site: haalt de agenda's live op, en valt terug op agenda.json
   (die GitHub elk uur ververst) als dat niet lukt. */
(function () {
  'use strict';
  var lijst = document.getElementById('agenda-lijst');
  var kort = document.getElementById('binnenkort-lijst');
  if (!lijst && !kort) return;
  if (!window.AGENDAS || !window.AgendaICS) return;

  // Knoppen "Kopieer link" bij In je eigen agenda
  var aboMelding = document.getElementById('abo-melding');
  Array.prototype.forEach.call(document.querySelectorAll('[data-kopieer]'), function (knop) {
    knop.addEventListener('click', function () {
      var url = knop.getAttribute('data-kopieer');
      var klaar = function (ok) {
        if (aboMelding) aboMelding.textContent = ok ? 'Link gekopieerd. Plak hem in je agenda-app bij "Agenda toevoegen via URL".' : 'Kopiëren lukte niet. Link: ' + url;
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { klaar(true); }, function () { klaar(false); });
      else klaar(false);
    });
  });

  var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var DG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  var NAAM = {};
  window.AGENDAS.forEach(function (a) { NAAM[a.cat] = a.naam; });

  function el(tag, cls, tekst) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (tekst != null) e.textContent = tekst;
    return e;
  }
  function delen(s) { // "2026-10-31T12:00" -> {j,m,d,tijd}
    return { j: +s.slice(0, 4), m: +s.slice(5, 7) - 1, d: +s.slice(8, 10), tijd: s.length > 10 ? s.slice(11, 16) : null };
  }
  function weekdag(p) { return new Date(Date.UTC(p.j, p.m, p.d)).getUTCDay(); }
  function wanneer(item) {
    var s = delen(item.start), e = item.eind ? delen(item.eind) : null;
    var zelfdeDag = !e || item.start.slice(0, 10) === item.eind.slice(0, 10);
    if (zelfdeDag) {
      if (item.heleDag) return 'Hele dag';
      return e && e.tijd ? s.tijd + ' – ' + e.tijd + ' uur' : s.tijd + ' uur';
    }
    var tot = DAGEN[weekdag(e)] + ' ' + e.d + ' ' + MAANDEN[e.m] + (e.tijd && !item.heleDag ? ' ' + e.tijd : '');
    return (item.heleDag ? 'T/m ' : s.tijd + ' uur, t/m ') + tot;
  }

  function vandaag() { return window.AgendaICS.nlNuTekst().slice(0, 10); }
  function toekomst(items) {
    var nu = vandaag();
    return items.filter(function (i) { return (i.eind || i.start).slice(0, 10) >= nu; });
  }

  function haalLive(a) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 7000);
    return fetch(a.url, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) {
        clearTimeout(timer);
        if (t.indexOf('BEGIN:VCALENDAR') === -1) throw new Error('geen agenda');
        return window.AgendaICS.lees(t, a.cat, { dagenTerug: 7 });
      });
  }
  function haalKopie() {
    return fetch('agenda.json?v=' + Math.floor(Date.now() / 6e5))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  function laad() {
    var uitkomst = window.AGENDAS.map(function (a) {
      return haalLive(a).then(function (items) { return { cat: a.cat, items: items }; }, function () { return { cat: a.cat, mislukt: true }; });
    });
    return Promise.all(uitkomst).then(function (res) {
      var mislukt = res.filter(function (r) { return r.mislukt; }).map(function (r) { return r.cat; });
      var items = [];
      res.forEach(function (r) { if (!r.mislukt) items = items.concat(r.items); });
      if (!mislukt.length) return { items: items, live: true };
      return haalKopie().then(function (kopie) {
        (kopie.items || []).forEach(function (i) { if (mislukt.indexOf(i.cat) !== -1) items.push(i); });
        return { items: items, live: false, bijgewerkt: kopie.bijgewerkt };
      }, function () { return { items: items, live: false, leeg: mislukt.length === window.AGENDAS.length }; });
    }).then(function (data) {
      data.items.sort(function (x, y) { return x.start < y.start ? -1 : x.start > y.start ? 1 : 0; });
      return data;
    });
  }

  function itemKaart(item, compact) {
    var p = delen(item.start);
    var li = el('li', 'agenda-item agenda-item--' + item.cat);
    var datum = el('div', 'agenda-item__datum');
    datum.setAttribute('aria-hidden', 'true');
    datum.appendChild(el('span', 'agenda-item__dag', DG[weekdag(p)]));
    datum.appendChild(el('span', 'agenda-item__nr', String(p.d)));
    datum.appendChild(el('span', 'agenda-item__mnd', MND[p.m]));
    li.appendChild(datum);
    var tekst = el('div', 'agenda-item__tekst');
    tekst.appendChild(el('span', 'agenda-item__soort', NAAM[item.cat] || ''));
    tekst.appendChild(el('h3', 'agenda-item__titel', item.titel));
    var meta = el('p', 'agenda-item__meta');
    meta.appendChild(el('span', 'sr-only', DAGEN[weekdag(p)] + ' ' + p.d + ' ' + MAANDEN[p.m] + ', '));
    meta.appendChild(document.createTextNode(wanneer(item)));
    if (item.plek) { meta.appendChild(el('span', 'agenda-item__punt', ' · ')); meta.appendChild(document.createTextNode(item.plek)); }
    tekst.appendChild(meta);
    if (item.info && !compact) {
      var det = el('details', 'agenda-item__info');
      det.appendChild(el('summary', null, 'Meer informatie'));
      item.info.split(/\n+/).forEach(function (r) { if (r.trim()) det.appendChild(el('p', null, r)); });
      tekst.appendChild(det);
    }
    li.appendChild(tekst);
    return li;
  }

  function melding(doel, tekst) {
    doel.innerHTML = '';
    doel.appendChild(el('p', 'agenda-leeg', tekst));
  }

  // ---------- Agendapagina ----------
  var filter = 'alles', alleItems = [];
  function tekenLijst() {
    lijst.innerHTML = '';
    var items = toekomst(alleItems).filter(function (i) { return filter === 'alles' || i.cat === filter; });
    if (!items.length) {
      melding(lijst, filter === 'alles' ? 'Er staat op dit moment niets in de agenda.' : 'Hier staat op dit moment niets gepland.');
      return;
    }
    var maand = null, ul = null;
    items.forEach(function (i) {
      var p = delen(i.start), sleutel = p.j + '-' + p.m;
      if (sleutel !== maand) {
        maand = sleutel;
        var kop = el('h2', 'agenda-maand', MAANDEN[p.m] + ' ' + p.j);
        lijst.appendChild(kop);
        ul = el('ul', 'agenda-items');
        lijst.appendChild(ul);
      }
      ul.appendChild(itemKaart(i, false));
    });
  }

  if (lijst) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-agenda-filter]'), function (knop) {
      knop.addEventListener('click', function () {
        filter = knop.getAttribute('data-agenda-filter');
        Array.prototype.forEach.call(document.querySelectorAll('[data-agenda-filter]'), function (k) {
          k.setAttribute('aria-pressed', String(k === knop));
        });
        tekenLijst();
      });
    });
  }

  laad().then(function (data) {
    alleItems = data.items;
    var bron = document.getElementById('agenda-bron');
    if (bron && !data.live && data.bijgewerkt) {
      var d = new Date(data.bijgewerkt);
      bron.textContent = 'Agenda bijgewerkt op ' + d.toLocaleString('nl-NL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) + '.';
    }
    if (lijst) {
      if (data.leeg) melding(lijst, 'De agenda kon niet worden geladen. Probeer het later nog eens, of zet de agenda in je eigen agenda met de knoppen hieronder.');
      else tekenLijst();
    }
    if (kort) {
      var volgende = toekomst(data.items).slice(0, 3);
      kort.innerHTML = '';
      if (data.leeg) melding(kort, 'De agenda kon niet worden geladen.');
      else if (!volgende.length) melding(kort, 'Er staat op dit moment niets in de agenda.');
      else {
        var ul = el('ul', 'agenda-items agenda-items--kort');
        volgende.forEach(function (i) { ul.appendChild(itemKaart(i, true)); });
        kort.appendChild(ul);
      }
    }
  });
})();
