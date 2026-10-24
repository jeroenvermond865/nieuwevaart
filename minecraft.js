/* =====================================================================
   INSTELLINGEN Minecraft-server: pas deze drie waarden aan
   ===================================================================== */
var INSTELLINGEN = {
  serverAdres: 'kleinevaart.nl',               // het adres dat spelers in Minecraft invullen
  kaartUrl: 'https://kleinevaart.nl/kaart/',   // waar de live kaart (dynmap) te vinden is
  statusTonen: true                            // live serverstatus tonen via api.mcstatus.io (true of false)
};

(function () {
  'use strict';
  if (!document.getElementById('minecraft')) return;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };

  /* ---------- Minecraft ---------- */
  $$('[data-serveradres]').forEach(function (el) { el.textContent = INSTELLINGEN.serverAdres; });
  $('#kaart-link').setAttribute('href', INSTELLINGEN.kaartUrl);

  var kopieer = $('#kopieer');
  var melding = $('#kopieer-melding');
  var meldingTimer;
  kopieer.addEventListener('click', function () {
    clearTimeout(meldingTimer);
    var klaar = function (tekst) {
      melding.textContent = tekst;
      meldingTimer = setTimeout(function () { melding.textContent = ''; }, 4000);
    };
    var selecteer = function () {
      var r = document.createRange();
      r.selectNodeContents($('#server-adres'));
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      klaar('Adres geselecteerd. Kopieer het met Ctrl+C of Cmd+C.');
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(INSTELLINGEN.serverAdres)
        .then(function () { klaar('Serveradres gekopieerd'); })
        .catch(selecteer);
    } else {
      selecteer();
    }
  });

  var kaartKnop = $('#kaart-knop');
  var kaartVak = $('#kaart-vak');
  kaartKnop.addEventListener('click', function () {
    var open = kaartKnop.getAttribute('aria-expanded') === 'true';
    if (!open && !kaartVak.querySelector('iframe')) {
      var f = document.createElement('iframe');
      f.src = INSTELLINGEN.kaartUrl;
      f.title = 'Live kaart van de Minecraft-wereld';
      f.loading = 'lazy';
      kaartVak.appendChild(f);
    }
    kaartVak.hidden = open;
    kaartKnop.setAttribute('aria-expanded', String(!open));
    kaartKnop.textContent = open ? 'Toon de kaart hier' : 'Verberg de kaart';
  });

  var status = $('#status');
  var statusTekst = $('#status-tekst');
  var spelers = $('#status-spelers');
  var versie = $('#status-versie');
  var zet = function (staat, tekst, detail, ver) {
    status.setAttribute('data-staat', staat);
    statusTekst.textContent = tekst;
    spelers.textContent = detail || '';
    versie.textContent = ver || '';
  };
  var haalStatus = function () {
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    fetch('https://api.mcstatus.io/v2/status/java/' + encodeURIComponent(INSTELLINGEN.serverAdres), ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        if (d.online) {
          var n = d.players && typeof d.players.online === 'number' ? d.players.online : 0;
          var max = d.players && d.players.max ? d.players.max : null;
          var ver = d.version && d.version.name_clean ? 'Versie ' + d.version.name_clean : '';
          zet('online', 'Online', max ? n + ' van ' + max + ' spelers online' : n + ' spelers online', ver);
        } else {
          zet('offline', 'Offline', 'De server is op dit moment niet bereikbaar.');
        }
      })
      .catch(function () {
        zet('onbekend', 'Status onbekend', 'De status kon niet worden opgehaald. Probeer het later nog eens.');
      })
      .then(function () { clearTimeout(timer); });
  };
  if (INSTELLINGEN.statusTonen) {
    haalStatus();
    setInterval(function () { if (!document.hidden) haalStatus(); }, 60000);
  } else {
    status.hidden = true;
  }
})();
