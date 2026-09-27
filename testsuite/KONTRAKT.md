# Testkontrakt for Fakturasystem

Løsningen må oppfylle denne kontrakten for at testsuiten skal kunne kjøre. Den beskriver test-endepunkter, API og feilkoder. Alle JSON-felt er camelCase. Datoer er `YYYY-MM-DD`, tidspunkt ISO 8601. Testene endres ikke for å bli grønne; avvik skrives i `docs/AVVIK-I-TESTENE.md`.

## 1. Testmodus

Alle `/api/test/*`-endepunkter finnes **bare** når `FAKTURA_TEST_MODE=true`. Ellers gir de 404, og løsningen nekter å starte med testmodus hvis `NODE_ENV=production` og databasen ikke er merket som testdatabase.

| Endepunkt | Inn | Ut |
| --- | --- | --- |
| `GET /api/test/health` | – | `200 {"testMode": true}` |
| `POST /api/test/reset` | `{fixture}` = `fixtures/seed.json` | `204`. Tømmer alle tabeller og laster fixturen. |
| `POST /api/test/login` | `{userId, mfa?, orgId?}` eller `{newUserEmail}` | `200 {"csrfToken"}` + session-cookie. `mfa:false` gir en økt uten tofaktor. |
| `GET /api/test/outbox` | – | `[{channel, to, subject, body, orgId}]` – e-post sendes ikke ut i testmodus |
| `POST /api/test/clock` | `{now}` eller `{now: "reset"}` | `204` |
| `POST /api/test/run-jobs` | – | `204` |

I testmodus svarer oppslag i Enhetsregisteret med faste, oppdiktede data (org.nr. `923609016`).

## 2. Innlogging og sikkerhet

- `POST /api/auth/otp/request {email}` → alltid `202`, også for ukjent e-post. Koden sendes på e-post.
- `POST /api/auth/otp/verify {email, code}` → `200 {csrfToken, requiresMfa, mfaConfigured, hasOrganization}`, `401` ved feil kode, `429` senest ved 11. forsøk innen 15 minutter. Ny e-post gir ny bruker.
- `POST /api/auth/mfa/setup` → `{secret, otpauthUri}`. `POST /api/auth/mfa/verify {code}` → `200`, eller `401` ved feil kode.
- Tofaktor kreves for alle som er med i en bedrift. Uten fullført tofaktor i økten → `403 {"code": "mfa_kreves"}` på alle bedriftsendepunkter.
- Alle endrende kall krever header `X-CSRF-Token` og avviser fremmed `Origin` → `403`.
- Session-cookie: navnet inneholder `session`, `HttpOnly`, `SameSite=Lax`, `Secure` på https.
- Alle API-svar har `Content-Security-Policy` (med `frame-ancestors`), `X-Content-Type-Options: nosniff` og `Referrer-Policy`.
- Uinnlogget → `401`. Handlinger rollen ikke gir → `403`. Ressurser i en annen bedrift → `404`.
- Feilsvar inneholder aldri stack trace, SQL, filstier eller databasenavn.

## 3. Bedrifter (organisasjoner) og skott

Hver bedrift er en kunde av systemet. Data fra én bedrift skal aldri kunne leses eller endres fra en annen, heller ikke ved feil i koden: databasen håndhever det med Row Level Security.

| Kall | Svar |
| --- | --- |
| `POST /api/organizations` | `{name, orgNumber?, organizationForm?, vatRegistered?, address?, postalCode?, city?, email?, phone?, accountNumber?, paymentTermsDays?}` → `201 {id, …, role: "eier"}`. Brukeren blir eier og jobber i den nye bedriften. `422 {errors: [{field, message}]}` ved ugyldig org.nr. (MOD11), kontonummer (MOD11), e-post, postnummer eller frist. |
| `GET /api/organizations` | `[{id, name, role, current}]` – bare bedriftene brukeren er med i |
| `POST /api/session/organization {orgId}` | `200`. Bytter bedrift. `404` for bedrifter brukeren ikke er med i. |
| `GET /api/organizations/current` | `{id, name, orgNumber, …, role, missingForInvoicing: string[]}` |
| `PUT /api/organizations/current` | Samme felt som ved opprettelse. Krever eier eller administrator. Logges som `firma_endret`. |
| `GET /api/lookup/:orgNumber` | `{orgNumber, name, organizationForm, address, postalCode, city, vatRegistered}` eller `404` |

## 4. Brukere og roller

Roller per bedrift: `eier` (alt), `administrator` (alt unntatt å endre eiere), `fakturering` (kunder og fakturaer), `lesetilgang` (se alt, endre ingenting).

| Kall | Svar |
| --- | --- |
| `GET /api/team` | `[{userId, name, email, role, roleLabel, mfaEnabled, invited}]` |
| `POST /api/team {email, role}` | `201`. Krever eier eller administrator; bare eier kan gi rollen `eier`. Sender e-post til personen. `409 allerede_medlem`. |
| `PATCH /api/team/:userId {role}` | `200`. Bare eier kan gi eller ta fra eierrollen. `409 siste_eier` hvis bedriften ville stått uten eier. |
| `DELETE /api/team/:userId` | `204`. Alle kan fjerne seg selv. `409 siste_eier`. |
| `GET /api/audit-log` | Siste 200 hendelser i bedriften. Krever eier, administrator eller lesetilgang. |
