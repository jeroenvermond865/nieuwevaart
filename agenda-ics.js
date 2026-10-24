/* =====================================================================
   Agenda-lezer voor iCal-feeds (Socie). Werkt in de browser en in Node.
   Alle tijden worden omgezet naar Nederlandse tijd (Europe/Amsterdam)
   en bewaard als tekst: "2026-10-31T12:00" of, voor hele dagen, "2026-10-31".
   ===================================================================== */
(function (wortel) {
  'use strict';

  var TZ = 'Europe/Amsterdam';
  var fmt = null;
  function nlTijd(datum) {
    if (!fmt) fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    var d = {};
    fmt.formatToParts(datum).forEach(function (p) { d[p.type] = p.value; });
    return Date.UTC(+d.year, +d.month - 1, +d.day, +d.hour % 24, +d.minute);
  }

  // "Naieve" tijd: de Nederlandse kloktijd opgeslagen in UTC-velden, zodat rekenen geen zomertijdgedoe geeft
  function leesDatum(waarde, params) {
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(waarde.trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2] - 1, d = +m[3];
    if (!m[4] || (params && /VALUE=DATE(?!-)/.test(params))) return { t: Date.UTC(y, mo, d), heleDag: true };
    var t = Date.UTC(y, mo, d, +m[4], +m[5]);
    if (m[7]) t = nlTijd(new Date(t));                    // UTC -> Nederlandse tijd
    else if (params && /TZID=/.test(params) && !/Amsterdam|Brussels|Berlin|Paris/.test(params)) {
      // andere tijdzone: zo goed mogelijk benaderen via de browser/Node
      try {
        var tz = /TZID=([^;:]+)/.exec(params)[1];
        var guess = new Date(t);
        var inTz = Date.UTC.apply(null, (function () {
          var f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
          var p = {}; f.formatToParts(guess).forEach(function (x) { p[x.type] = x.value; });
          return [+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute];
        })());
        t = nlTijd(new Date(t - (inTz - t)));
      } catch (e) { /* laat staan */ }
    }
    return { t: t, heleDag: false };
  }

  function tekst(t, heleDag) {
    var d = new Date(t);
    var s = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    return heleDag ? s : s + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function ontsnap(s) {
    return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
  }

  var DAGEN = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  var DAG = 864e5;

  // Herhalingen uitrekenen binnen [van, tot]
  function herhaal(start, regel, van, tot, max) {
    var r = {};
    regel.split(';').forEach(function (kv) { var p = kv.split('='); r[p[0]] = p[1]; });
    var freq = r.FREQ, interval = +(r.INTERVAL || 1), count = r.COUNT ? +r.COUNT : Infinity;
    var until = r.UNTIL ? leesDatum(r.UNTIL).t : Infinity;
    var dagen = r.BYDAY ? r.BYDAY.split(',').map(function (x) { return DAGEN[x.slice(-2)]; }) : null;
    var uit = [], n = 0, i = 0;
    var tijdVanDag = start % DAG;
    var grens = Math.min(tot, until);
    if (freq === 'WEEKLY') {
      var weekStart = start - ((new Date(start).getUTCDay() + 6) % 7) * DAG - tijdVanDag; // maandag 00:00
      var wd = dagen || [new Date(start).getUTCDay()];
      wd = wd.slice().sort(function (a, b) { return ((a + 6) % 7) - ((b + 6) % 7); });
      for (var w = 0; i < 2000; w += interval) {
        for (var k = 0; k < wd.length; k++) {
          var t = weekStart + w * 7 * DAG + ((wd[k] + 6) % 7) * DAG + tijdVanDag;
          if (t < start) continue;
          if (t > grens || n >= count) return uit;
          n++; i++;
          if (t >= van) { uit.push(t); if (uit.length >= max) return uit; }
        }
        if (weekStart + w * 7 * DAG > grens) return uit;
      }
      return uit;
    }
    var d = new Date(start);
    for (var j = 0; j < 2000; j++) {
      var tt;
      if (freq === 'DAILY') tt = start + j * interval * DAG;
      else if (freq === 'MONTHLY') tt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + j * interval, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
      else if (freq === 'YEARLY') tt = Date.UTC(d.getUTCFullYear() + j * interval, d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
      else return [start];
      if (tt > grens || n >= count) break;
      n++;
      if (tt >= van) { uit.push(tt); if (uit.length >= max) break; }
    }
    return uit;
  }

  function lees(ics, categorie, opties) {
    opties = opties || {};
    var nu = opties.nu || Date.now();
    var van = nlTijd(new Date(nu)) - (opties.dagenTerug || 31) * DAG;
    var tot = nlTijd(new Date(nu)) + (opties.dagenVooruit || 400) * DAG;

    var regels = ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
    var blokken = [], huidig = null;
    regels.forEach(function (regel) {
      if (regel === 'BEGIN:VEVENT') { huidig = { props: {}, exdate: [] }; return; }
      if (regel === 'END:VEVENT') { if (huidig) blokken.push(huidig); huidig = null; return; }
      if (!huidig) return;
      var dp = regel.indexOf(':'); if (dp < 0) return;
      var kop = regel.slice(0, dp), waarde = regel.slice(dp + 1);
      var naam = kop.split(';')[0].toUpperCase(), params = kop.slice(naam.length);
      if (naam === 'EXDATE') { waarde.split(',').forEach(function (v) { var x = leesDatum(v, params); if (x) huidig.exdate.push(x.t); }); return; }
      huidig.props[naam] = { waarde: waarde, params: params };
    });

    var vervangen = {};
    blokken.forEach(function (b) {
      if (b.props['RECURRENCE-ID']) {
        var x = leesDatum(b.props['RECURRENCE-ID'].waarde, b.props['RECURRENCE-ID'].params);
        if (x) vervangen[(b.props.UID || {}).waarde + '|' + x.t] = true;
      }
    });

    var items = [];
    blokken.forEach(function (b) {
      var p = b.props;
      if (!p.DTSTART) return;
      if (p.STATUS && /CANCELLED/i.test(p.STATUS.waarde)) return;
      var s = leesDatum(p.DTSTART.waarde, p.DTSTART.params); if (!s) return;
      var e = p.DTEND ? leesDatum(p.DTEND.waarde, p.DTEND.params) : null;
      var duur = e ? e.t - s.t : (s.heleDag ? DAG : 0);
      var uid = p.UID ? p.UID.waarde : '';
      var starts = (p.RRULE && !p['RECURRENCE-ID']) ? herhaal(s.t, p.RRULE.waarde, van, tot, 400) : [s.t];
      starts.forEach(function (t) {
        if (b.exdate.indexOf(t) !== -1) return;
        if (p.RRULE && !p['RECURRENCE-ID'] && vervangen[uid + '|' + t]) return;
        if (t + duur < van || t > tot) return;
        var eind = t + duur;
        if (s.heleDag && duur >= DAG) eind -= DAG;            // iCal-einddatum is exclusief
        items.push({
          id: uid + '|' + t,
          cat: categorie,
          titel: p.SUMMARY ? ontsnap(p.SUMMARY.waarde) : '(zonder titel)',
          start: tekst(t, s.heleDag),
          eind: duur ? tekst(eind, s.heleDag) : null,
          heleDag: s.heleDag,
          plek: p.LOCATION ? ontsnap(p.LOCATION.waarde) : '',
          info: p.DESCRIPTION ? ontsnap(p.DESCRIPTION.waarde).slice(0, 600) : ''
        });
      });
    });
    items.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
    return items;
  }

  var api = { lees: lees, nlNuTekst: function () { return tekst(nlTijd(new Date()), false); } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else wortel.AgendaICS = api;
})(this);
