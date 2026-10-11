# Avvik i testene

Her skrives det ned hvis løsningen bevisst avviker fra testkontrakten (`testsuite/KONTRAKT.md`). Testene endres ikke for å bli grønne.

Ingen avvik fra kontrakten.

## Ustabil test (ikke et avvik, men verdt å vite)

`tests/e2e/kom-i-gang.spec.ts` leser innloggingskoden fra testutboksen rett etter at den trykker «Send kode», uten å vente på at forespørselen er ferdig. Av og til leser testen utboksen før koden er lagret, og feiler med «Fant ingen innloggingskode». Feilen kom omtrent én gang per fem kjøringer av hele testsuiten lokalt (oktober 2026).

Appen gjør det den skal: koden lagres og «Vi har sendt en kode» vises. Testen er ikke endret. En mulig retting i testen er å vente på teksten «Vi har sendt en kode» før koden leses. Det må eieren godkjenne.

Knappene «Send kode», «Bekreft» og «Registrer bedriften» er nå inaktive til siden er ferdig lastet. Før kunne et trykk komme før skjemaet virket, og da skjedde ingenting.
