# De Nieuwe Vaart

Website van de Nieuwe Vaart, waterscouting voor meiden van 11 tot en met 14 jaar bij Scouting VaDeDo in Leiderdorp.
Gehost als Static Site op Render (nieuwevaart.onrender.com). Losse pagina's (index, spullen, kampen, paklijst, zeilen, lid-worden, contact) met gedeelde style.css en script.js.

## Agenda
De agenda's (Socie, iCal) staan in `agenda-instellingen.js`. De site haalt ze live op; lukt dat niet,
dan gebruikt hij `agenda.json`. Die wordt elk uur ververst door de GitHub-workflow
`.github/workflows/agenda.yml` (handmatig starten kan via Actions > Agenda verversen > Run workflow).
