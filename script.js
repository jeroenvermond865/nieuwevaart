(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };

  // Jaartal in de voet
  var jaartal = $('#jaartal');
  if (jaartal) jaartal.textContent = String(new Date().getFullYear());

  // Kopbalk: lijntje zodra je scrolt
  var kop = $('#kop');
  var opScroll = function () { kop.classList.toggle('is-gescrold', window.scrollY > 8); };
  opScroll();
  window.addEventListener('scroll', opScroll, { passive: true });

  // Menu op kleine schermen
  var menuknop = $('.menuknop');
  var zetMenu = function (open) {
    kop.classList.toggle('is-open', open);
    menuknop.setAttribute('aria-expanded', String(open));
  };
  menuknop.addEventListener('click', function () {
    zetMenu(menuknop.getAttribute('aria-expanded') !== 'true');
  });
  $$('#hoofdmenu a').forEach(function (a) {
    a.addEventListener('click', function () { zetMenu(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && kop.classList.contains('is-open')) { zetMenu(false); menuknop.focus(); }
  });

  /* ---------- Paklijsten ---------- */
  var OPSLAG = 'nieuwevaart-paklijst';
  var vinkjes = {};
  try { vinkjes = JSON.parse(localStorage.getItem(OPSLAG) || '{}') || {}; } catch (e) { vinkjes = {}; }
  var bewaar = function () { try { localStorage.setItem(OPSLAG, JSON.stringify(vinkjes)); } catch (e) { /* geen opslag beschikbaar */ } };
  var tabs = $$('.tab');
  var lijsten = $$('.paklijst');

  var tel = function (lijst) {
    var alle = $$('input[type="checkbox"]', lijst);
    var aan = alle.filter(function (cb) { return cb.checked; });
    var teller = lijst.querySelector('.paklijst__teller');
    if (teller) teller.textContent = aan.length + ' van ' + alle.length + ' ingepakt';
  };

  lijsten.forEach(function (lijst) {
    var id = lijst.getAttribute('data-lijst');
    var bewaard = vinkjes[id] || [];
    $$('input[type="checkbox"]', lijst).forEach(function (cb) {
      cb.checked = bewaard.indexOf(cb.value) !== -1;
      cb.addEventListener('change', function () {
        var nu = $$('input[type="checkbox"]', lijst).filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
        vinkjes[id] = nu;
        bewaar();
        tel(lijst);
      });
    });
    tel(lijst);
    var wis = lijst.querySelector('[data-actie="wis"]');
    if (wis) wis.addEventListener('click', function () {
      $$('input[type="checkbox"]', lijst).forEach(function (cb) { cb.checked = false; });
      vinkjes[id] = [];
      bewaar();
      tel(lijst);
    });
    var print = lijst.querySelector('[data-actie="print"]');
    if (print) print.addEventListener('click', function () {
      lijst.classList.add('is-print');
      document.body.classList.add('print-paklijst');
      window.print();
    });
  });
  window.addEventListener('afterprint', function () {
    document.body.classList.remove('print-paklijst');
    lijsten.forEach(function (l) { l.classList.remove('is-print'); });
  });

  var kies = function (id, focus) {
    if (!lijsten.some(function (l) { return l.getAttribute('data-lijst') === id; })) return;
    tabs.forEach(function (t) {
      var actief = t.getAttribute('data-lijst') === id;
      t.setAttribute('aria-selected', String(actief));
      t.tabIndex = actief ? 0 : -1;
      if (actief && focus) t.focus();
    });
    lijsten.forEach(function (l) { l.hidden = l.getAttribute('data-lijst') !== id; });
  };
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { kies(t.getAttribute('data-lijst')); });
    t.addEventListener('keydown', function (e) {
      var nieuw = null;
      if (e.key === 'ArrowRight') nieuw = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') nieuw = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') nieuw = tabs[0];
      if (e.key === 'End') nieuw = tabs[tabs.length - 1];
      if (nieuw) { e.preventDefault(); kies(nieuw.getAttribute('data-lijst'), true); }
    });
  });

  // Standaard: de paklijst van het eerstvolgende kamp
  var eerstvolgende = function () {
    var d = new Date(), m = d.getMonth(), dag = d.getDate();
    if (m === 9 && dag > 25) return 'winterkamp';
    if (m >= 7 && m <= 9) return 'herfstkamp';
    if (m >= 10 || m <= 1) return 'winterkamp';
    if (m >= 2 && m <= 4) return 'kaagcup';
    return 'zomerkamp';
  };
  var uitHash = function () {
    var h = window.location.hash.replace('#lijst-', '');
    return window.location.hash.indexOf('#lijst-') === 0 ? h : null;
  };
  if (tabs.length) kies(uitHash() || eerstvolgende());
  window.addEventListener('hashchange', function () { var h = uitHash(); if (h) kies(h); });

  // Knoppen bij de kampen openen de juiste paklijst
  $$('[data-paklijst]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      kies(a.getAttribute('data-paklijst'));
      var doel = $('#paklijst');
      if (doel) doel.scrollIntoView();
      var tab = $('.tab[aria-selected="true"]');
      if (tab) tab.focus({ preventScroll: true });
    });
  });

  // Uitklapmenu achter de drie streepjes
  var meer = $('.meer'), meerKnop = $('.meer__knop');
  if (meer && meerKnop) {
    var zetMeer = function (open) {
      meer.classList.toggle('is-open', open);
      meerKnop.setAttribute('aria-expanded', String(open));
    };
    meerKnop.addEventListener('click', function (e) {
      e.stopPropagation();
      zetMeer(meerKnop.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('click', function (e) { if (!meer.contains(e.target)) zetMeer(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && meer.classList.contains('is-open')) { zetMeer(false); meerKnop.focus(); }
    });
  }
})();
