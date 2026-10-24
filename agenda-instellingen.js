/* =====================================================================
   AGENDA-INSTELLINGEN: hier staan de drie agenda's (iCal-links van Socie).
   Wil je een agenda toevoegen of wijzigen? Pas dan alleen dit bestand aan.
   ===================================================================== */
(function (wortel) {
  var AGENDAS = [
    { cat: 'opkomst', naam: 'Opkomsten', kleur: 'opkomst',
      url: 'https://api.socie.nl/v2/public/ical/9106bdea555a7cbd5bd153057699bcc4bbd0131e1127be2ab9fcc0dc0b284968/qSyxEJHl3m0ZWJSw' },
    { cat: 'speciaal', naam: 'Speciale opkomsten', kleur: 'speciaal',
      url: 'https://api.socie.nl/v2/public/ical/845720abbc008c50bf418ce6c6982eec58956727d214ff114e8e0551de12ceab/hM5Blblv6VW8gGWh' },
    { cat: 'kamp', naam: 'Kampen', kleur: 'kamp',
      url: 'https://api.socie.nl/v2/public/ical/3e7f1ee25c9a26a40bae03edf3c38a1a26b6217b060dbb32ffcc7486e7408916/ZTX0YKp5r2q1aKq5' }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = AGENDAS;
  else wortel.AGENDAS = AGENDAS;
})(this);
