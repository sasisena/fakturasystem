# Overlevering: nytt webbasert fakturasystem

Til Claude i den nye økten. Dette er skrevet av Claude i økten som bygger ATAK medlemssystem (`sasisena/foreningssystem`). Les hele teksten før du fortsetter. Har du allerede begynt ut fra notatene fra den tidligere samtalen, så sammenlign med punktene under og si fra hvor planen din avviker.

## Om eieren

- Eieren er ikke teknisk. Forklar på enkel norsk bokmål, uten fagord der det går an. Ikke nevn filnavn, kommandoer eller interne detaljer uten grunn.
- Eieren vil ha jevn fremdrift uten mange spørsmål. Spør bare når valget er hans å ta. Ellers velger du et fornuftig standardvalg, sier hvilket, og fortsetter.
- Endringer flettes bare når eieren skriver «ja, flett». Lag PR, kjør CI, send skjermbilder og vent.
- Eieren eier all kildekode selv, også `foreningssystem`. Fakturasystemet er hans eget produkt, og han vil på sikt ta betalt for det. Det skal kunne selges til mange kunder.
- Personopplysninger og hemmeligheter skal aldri legges i repoet. Testdata skal være oppdiktet.

## Hva som kan gjenbrukes fra `sasisena/foreningssystem`

Legg repoet til i økten med lesetilgang (`add_repo`, access `read`) og hent koden derfra. Kopier og tilpass, ikke lag avhengighet til repoet.

| Fil | Innhold | Hva må endres |
| --- | --- | --- |
| `src/server/billing.ts` | KID med mod10 (`mod10`, `kidFor`). Fakturanummer uten hull og dubletter: serien låses med `SELECT … FOR UPDATE` for hele runden (`lockSeries`, `takeNumber`). Kreditnota i stedet for sletting (`creditInvoice`). Matching av bankens OCR-linjer (KID, beløp, dato) mot fakturaer, med avvik ved manglende treff (`registerPayments`). Forhåndsvisning før utsending (`previewRound`). | Knyttet til familier, barn, søskenmoderasjon og kontingentrunder. Gjør det generelt: kunder, produkter, fakturalinjer, mva og rabatter. |
| `src/server/numbers.ts` | Nummermønstre som `F{n}` eller `{nnnn}`, kapasitet og kontroll av endring av mønster. | Kan brukes nesten som det er. |
| `src/server/accounting.ts` | Grensesnittet `AccountingProvider` med en loggende utgave som skriver til tabellen `accounting_log`. | Gjør det til utgangspunkt for integrasjoner (Fiken, Tripletex, SAF-T-eksport). |
| `src/server/pdf.ts` | Liten PDF-generator uten avhengigheter (tekst, rammer, linjer; WinAnsi-koding). | Holder for enkle fakturaer. Vurder et skikkelig PDF-bibliotek for logo og layout. |
| `src/server/messaging.ts`, `src/server/delivery.ts` | Utboks: meldinger lagres i samme transaksjon og sendes av en jobb (SMTP og SMS). I testmodus sendes ingenting. | Kan brukes som det er. |
| `src/server/router.ts`, `src/server/db.ts`, `src/server/access.ts`, `drizzle/0001_rls.sql` | Én API-rute (`src/app/api/[...path]/route.ts`), én transaksjon per kall og Postgres Row Level Security (FORCE) med omfang per forespørsel. Tilgang med `require(modul, nivå, avdeling)`: 404 for ressurser brukeren ikke har tilgang til, 403 for moduler uten rettighet. CSRF og Origin-sjekk. | Bytt «avdeling» med «organisasjon» (tenant). Det gir isolasjon mellom kunder i databasen. |
| `src/server/audit.ts`, `src/server/crypto.ts`, `src/server/validation.ts` | Revisjonslogg. Kryptering (AES-256-GCM) og tokens. Kontonummer med mod11, telefon og e-post. | Kan brukes som det er. |
| `src/server/routes/auth.ts` | Innlogging med engangskode på e-post, TOTP-tofaktor og struping av forsøk. | Kan brukes som det er. |
| `src/app/admin/faktura/`, `src/app/admin/faktura/ny/` | Fakturaliste, kreditering, innlesing av innbetalinger og veiviser i fire steg for utsending (valg, mottakere, kontroll, fullført). | Mønster for grensesnittet. |
| `design/tokens.css`, `src/components/ui/`, `docs/DESIGNGUIDE.md` | Material Design 3-tokens, knapper, kort, statuschips, trinnviser (`Stepper`) og nøkkeltallsbokser (`StatCard`). | Eget merke og egne farger for fakturaproduktet. |
| `deploy/upcloud/`, `Dockerfile`, `.github/workflows/ci.yml` | Testmiljø på én UpCloud-server (Docker Compose, Caddy med HTTPS, automatisk oppdatering fra `main`), standalone-bygg og CI med gitleaks. | Kan kopieres. |

Teknologi i `foreningssystem`: Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript, Drizzle ORM og PostgreSQL 16, Zod 4, Tailwind 4, Radix, Lucide, Vitest og Playwright. Les `AGENTS.md` der: Next 16 har endringer som bryter med eldre kunnskap.

## Anbefalinger fra denne økten

1. **Flerkundeløsning fra dag én.** Hver kunde er en organisasjon. Isoler kundene med RLS (`app.org`), ikke bare med filtre i koden. Dette er vanskelig å legge til senere.
2. **Norske krav før lansering:**
   - Bokføringsloven og bokføringsforskriften: organisasjonsnummer, mva-spesifikasjon, fortløpende fakturanummer, forfallsdato og oppbevaring i 5 år.
   - Kreditnota i stedet for sletting.
3. **Betaling:**
   - KID og OCR krever avtale med banken.
   - Deretter kommer Vipps og kort.
   - eFaktura og AvtaleGiro krever avtale med Mastercard Payment Services (Nets) og bankene.
4. **EHF og Peppol:** påkrevd mot det offentlige, og krav om elektronisk faktura mellom bedrifter er på vei. Det gjøres via en tilgangspunkt-leverandør.
5. **Purring og inkasso:** følg inkassolovens regler for gebyrer og frister.
6. **Betaling for eget abonnement** (for eksempel Stripe), databehandleravtale, sikkerhetskopier i EU/EØS og brukerstøtte.
7. **Marked:** Fiken, Tripletex, Conta og Folio dominerer vanlig fakturering. En mulig nisje er **foreninger og lag** med medlemsregister, kontingent, søskenmoderasjon og flere språk. Der er konkurrentene Spond, Hoopit og Rubic. La eieren velge målgruppe for første versjon.
8. **Rekkefølge:**
   1. Grunnmur og flerkundeløsning.
   2. Kunder, produkter, faktura med mva og PDF.
   3. Nummerserie, KID og kreditnota.
   4. Innbetalinger fra bank.
   5. Purring.
   6. Integrasjoner, EHF og betaling for abonnement.

## Hvordan vi har jobbet (og som fungerte)

- Skriv en testkontrakt først, med API-tester (Playwright) som beskriver oppførselen. Løsningen er ferdig når testene består, og testene endres ikke for å bli grønne.
- Før commit: lint, typesjekk og enhetstester. Kjør hele testsuiten før PR.
- Én PR per avgrenset leveranse, med skjermbilder til eieren. Følg med på CI, og flett først når eieren skriver «ja, flett».
- Alle tekster til brukerne er på norsk bokmål. Datoer skrives dd.mm.åååå, og beløp som «1 200 kr».

## Spør eieren om dette først

1. **Navn på produktet og repoet,** hvis det ikke er bestemt.
2. **Målgruppe for første versjon:** foreninger og lag, eller små bedrifter generelt.
3. **Hva som skal være med i første salgbare versjon,** og hva som kan vente, for eksempel EHF og eFaktura.
4. **Om ATAK-systemet skal bli første kunde** og sende fakturagrunnlag til det nye systemet, eller om det skal holdes helt adskilt inntil videre.
