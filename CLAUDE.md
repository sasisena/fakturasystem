@AGENTS.md

# Fakturasystem – notater for Claude

- Eieren er ikke teknisk. Svar på enkel norsk bokmål uten fagord der det går an. Alle brukertekster er på bokmål; datoer dd.mm.åååå, beløp som «1 200 kr».
- Grunnmuren er hentet fra ATAK-systemet (`sasisena/foreningssystem`), men «avdeling» er byttet med «organisasjon» (bedrift = kunde av systemet). Ingen avhengighet til det repoet.
- Flerkundeløsning: alle bedriftsdata har `org_id` og Row Level Security (`drizzle/0001_rls.sql`, `app.org`). Nye tabeller med `org_id` MÅ få samme regel – `tests/unit/rls.test.ts` feiler ellers.
- API-et går gjennom `src/server/router.ts` (én transaksjon per kall med RLS-omfang). Nye ruter i `src/server/routes/`, importeres i `routes/index.ts`.
- Tilgang: `c.access.require(handling)` (se `src/server/access.ts`). Ressurser i en annen bedrift gir 404, handlinger rollen ikke gir 403.
- Løsningen er ferdig når testsuiten i `testsuite/` består (kontrakt: `testsuite/KONTRAKT.md`). **Endre aldri testene** for å få dem grønne; skriv avvik i `docs/AVVIK-I-TESTENE.md`.
- Kjør lokalt: `docker compose up -d`, kopier `.env.example` til `.env` (sett `FAKTURA_TEST_MODE=true` for testene), `npm run db:migrate`, `npm run dev`. Testsuiten: `cd testsuite && npx playwright test`.
- Før commit: `npm run lint && npm run typecheck && npm run test:unit`.
- Én PR per avgrenset leveranse, med skjermbilder. Flett bare når eieren skriver «ja, flett».
- Personopplysninger og hemmeligheter skal aldri i repoet. Testdata er oppdiktet (`.example`-adresser).
