/* =====================================================================
   WIKI-INSTELLINGEN: welke pagina's van wiki.vadedo.nl op de site komen.
   De site haalt ze live op; wat op de wiki verandert, verandert hier mee.
   Pagina toevoegen? Zet de exacte paginatitel (zoals in de wiki-link) in een groep.
   ===================================================================== */
(function (wortel) {
  var WIKI = {
    basis: 'https://wiki.vadedo.nl',
    // Pagina's die op een vaste plek op de site staan
    vloot: 'Vloot',             // WSA (CWO): onze vloot
    kaagcup: 'Kaagcup',         // Kampen: VaDeDo in de prijzen
    geschiedenis: 'Algemeen',   // Lid worden: over VaDeDo
    eigenOnderdeel: 'Nieuwe Vaart',
    // Pagina Voor leiding
    leiding: [
      { titel: 'Kamp', paginas: ['Kampmateriaal Checklist', 'Persoonlijke Bagage Checklist', 'Receptenboek Bewust Eten'] },
      { titel: 'Spellen', categorie: 'Spel' },
      { titel: 'Boten en onderhoud', paginas: ['Vletbeheer', 'Boten uit het water', 'Winteronderhoud planning boten', 'Winteronderhoud planning houtwerk', '2K Verf', 'Bouwtekeningen'] },
      { titel: 'Zeilles', paginas: ['CWO Eisen', 'Lesprogramma BPR'] }
    ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = WIKI;
  else wortel.WIKI = WIKI;
})(this);
