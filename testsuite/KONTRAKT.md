# Testkontrakt for Fakturasystem

Løsningen må oppfylle denne kontrakten for at testsuiten skal kunne kjøre. Den beskriver test-endepunkter, API og feilkoder. Alle JSON-felt er camelCase. Datoer er `YYYY-MM-DD`, tidspunkt ISO 8601. Testene endres ikke for å bli grønne; avvik skrives i `docs/AVVIK-I-TESTENE.md`.

## 1. Testmodus

Alle `/api/test/*`-endepunkter finnes **bare** når `FAKTURA_TEST_MODE=true`. Ellers gir de 404, og løsningen nekter å starte med testmodus hvis `NODE_ENV=production` og databasen ikke er merket som testdatabase.

| Endepunkt | Inn | Ut |
| --- | --- | --- |
| `GET /api/test/health` | – | `200 {"testMode": true}` |
| `POST /api/test/reset` | `{fixture}` = `fixtures/seed.json` | `204`. Tømmer alle tabeller og laster fixturen. |
| `POST /api/test/login` | `{userId, mfa?, orgId?}` eller `{newUserEmail}` | `200 {"csrfToken"}` + session-cookie. `mfa:false` gir en økt uten tofaktor. |
| `GET /api/test/outbox` | – | `[{channel, to, replyTo, subject, body, orgId, invoiceId, hasAttachment}]` – e-post sendes ikke ut i testmodus |
| `POST /api/test/clock` | `{now}` eller `{now: "reset"}` | `204` |
| `POST /api/test/run-jobs` | – | `204` |

I testmodus svarer oppslag i Enhetsregisteret med faste, oppdiktede data (org.nr. `923609016`).

**Testsiden** `GET /test/koder` finnes bare når `TEST_PAGE_PASSWORD` er satt (uavhengig av testmodus), og krever det passordet med HTTP Basic (brukernavn kan være hva som helst): ellers `404`, eller `401` uten riktig passord. Den viser innloggingskoder og e-post fra utboksen (siste døgn), gjeldende tofaktor-kode for hver bruker, og `GET /test/koder?pdf=<nr>` gir PDF-en til en faktura-e-post. Testene for den kjøres når `FAKTURA_TESTSIDE_PASSORD` er satt.

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

## 5. Kunder

Krever rollen eier, administrator eller fakturering for å endre; lesetilgang kan bare se.

| Kall | Svar |
| --- | --- |
| `GET /api/customers?q=` | `[{id, customerNumber, name, orgNumber, email, phone, address, postalCode, city}]`, sortert på navn. `q` søker i navn, org.nr. og kundenummer. |
| `POST /api/customers` | `201`. Kundenummeret er fortløpende per bedrift (1, 2, 3 …). `422` ved manglende navn, ugyldig org.nr. (MOD11), e-post eller postnummer. |
| `GET /api/customers/:id` | Kunden, eller `404` (også for kunder i en annen bedrift) |
| `PUT /api/customers/:id` | Samme felt som ved opprettelse. Kundenummeret endres ikke. |
| `DELETE /api/customers/:id` | `204`, eller `409 {code: "kunde_har_fakturaer"}` |

## 6. Produkter

Faste varer og tjenester som kan velges på fakturalinjer. Samme rolleregler som kunder.

| Kall | Svar |
| --- | --- |
| `GET /api/products` | `[{id, name, unit, unitPrice, vatRate}]` – `unitPrice` i øre eks. mva |
| `POST /api/products` | `201`. `vatRate` er 25, 15, 12 eller 0. `422` ved manglende navn, ugyldig pris eller sats. |
| `PUT /api/products/:id`, `DELETE /api/products/:id` | `200` / `204`. Fakturalinjer beholder tekst og pris om produktet endres eller slettes. |

## 7. Fakturaer (utkast)

| Kall | Svar |
| --- | --- |
| `POST /api/invoices` | `{customerId, theirReference?, note?, lines: [{description, quantity, unit?, unitPrice, vatRate, productId?}]}` → `201` med fakturaen (se under) |
| `GET /api/invoices?customerId=&status=` | `[{id, kind, status, overdue, number, customerId, customerName, customerNumber, gross, issueDate, dueDate, createdAt, updatedAt}]`. Utkast først, deretter høyeste nummer først. `status` er `utkast`, `ubetalt` (sendt, også forfalte), `forfalt`, `betalt` eller `kreditert`. |
| `GET /api/invoices/:id` | `{id, kind, status, overdue, number, kid, issueDate, dueDate, delivery, sentTo, sentAt, paidDate, creditOf, creditedBy, customer: {…}, theirReference, note, lines: [{id, description, quantity, unit, unitPrice, vatRate, productId, net}], totals: {net, vat, gross, vatBreakdown: [{rate, base, vat}]}, vatRegistered, createdAt, updatedAt}` |
| `PUT /api/invoices/:id` | Samme felt som ved opprettelse; linjene erstattes. Bare utkast: ellers `409 {code: "faktura_sendt"}` |
| `DELETE /api/invoices/:id` | `204`. Bare utkast: ellers `409 {code: "faktura_sendt"}` |
| `GET /api/invoices/:id/pdf` | `application/pdf`. Utkast er merket «UTKAST»; sendte fakturaer har nummer, KID og forfallsdato. |

Regler:

- Alle beløp er heltall i øre. `quantity` er større enn 0 med høyst tre desimaler. `unitPrice` kan være negativ (rabatt), men summen av fakturaen kan ikke være negativ.
- Mva beregnes per sats på summert grunnlag og rundes til hele øre. `vatBreakdown` er sortert fra høyeste sats.
- Er bedriften ikke registrert i Merverdiavgiftsregisteret, lagres alle linjer med sats 0 og fakturaen har ingen mva.
- `customerId` eller `productId` som ikke finnes i bedriften, gir `422` med feltet `customerId` eller `lines.N.productId` (det avsløres ikke om den finnes i en annen bedrift).
- Høyst 200 linjer. Minst én linje.

## 8. Utsending, fakturanummer, KID, betaling og kreditnota

| Kall | Svar |
| --- | --- |
| `POST /api/invoices/:id/send` | `{delivery: "epost" \| "manuell"}` → `200` med fakturaen, nå `status: "sendt"`. `epost` legger en e-post med PDF-en i utboksen til kundens e-postadresse; `manuell` betyr at brukeren sender PDF-en selv. |
| `POST /api/invoices/:id/mark-paid` | `{paidDate?}` (standard i dag) → `status: "betalt"`. Bare fakturaer med status `sendt`. |
| `POST /api/invoices/:id/mark-unpaid` | Tilbake til `sendt`. |
| `POST /api/invoices/:id/credit` | `{delivery?: "epost" \| "manuell"}` → `201` med kreditnotaen. Fakturaen får `status: "kreditert"`. |
| `GET /api/organizations/current` | Har i tillegg `nextInvoiceNumber`. |
| `PUT /api/organizations/current/invoice-number` | `{nextInvoiceNumber, reason}` → `200`. Krever eier eller administrator. Kan bare økes (`422` ellers) og krever begrunnelse. Logges som `fakturaserie_endret`. |
| `GET /api/dashboard` | `{outstanding, outstandingCount, overdue, overdueCount, paidThisMonth, draftCount}` – beløp i øre, bare fakturaer (ikke kreditnotaer) |

Regler:

- **Fakturanummer** tildeles ved utsending: neste nummer i bedriftens serie (standard fra 1). Fakturaer og kreditnotaer deler serien. Serien har aldri hull eller dubletter, heller ikke når to sendes samtidig eller en utsending feiler.
- **KID** (bare fakturaer): kundenummer med 5 siffer + fakturanummer med 7 siffer + kontrollsiffer (MOD10), til sammen 13 siffer.
- **Datoer:** fakturadato er dagens dato (norsk tid). Forfallsdato er fakturadato + bedriftens betalingsfrist.
- **Før utsending** må bedriften ha organisasjonsnummer, adresse og kontonummer: ellers `409 {code: "mangler_firmaopplysninger", missing: [...]}`. `epost` krever at kunden har e-postadresse: ellers `409 {code: "kunde_mangler_epost"}`. Ingenting endres når utsendingen avvises (heller ikke nummerserien).
- **Etter utsending** er selger- og kundeopplysningene frosset: endringer på kunden eller firmaet senere endrer ikke fakturaen eller PDF-en. En sendt faktura kan aldri endres eller slettes; den rettes med kreditnota. Databasen håndhever dette i tillegg til API-et.
- **Forfalt:** `overdue` er `true` når status er `sendt` og forfallsdatoen er passert (norsk tid).
- **Kreditnota:** krediterer hele fakturaen med de samme linjene med negativt antall, får neste nummer, dagens dato og ingen KID eller forfall. En faktura kan bare krediteres én gang (`409 {code: "allerede_kreditert"}`), og bare når den er sendt eller betalt. Kreditnotaen har `creditOf`; fakturaen har `creditedBy`.
- **E-posten** har emnet «Faktura <nummer> fra <bedrift>» (eller «Kreditnota …»), svar-til bedriftens e-post, og PDF-en som vedlegg. Testutboksen viser `invoiceId` og `hasAttachment: true`.
- **Revisjonslogg:** `faktura_sendt`, `faktura_betalt`, `faktura_ubetalt`, `faktura_kreditert`, `fakturaserie_endret`.
- Rollen lesetilgang kan ikke sende, merke som betalt eller kreditere (`403`).
