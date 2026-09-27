# Fakturasystem

Fakturasystem for små bedrifter og frilansere – web og mobil. «Fakturasystem» er et arbeidsnavn inntil produktet har fått navn.

## Status

**Leveranse 1 – grunnmur (denne):** flere bedrifter i samme løsning med vanntette skott i databasen, innlogging med engangskode på e-post og tofaktor, registrering av bedrift med oppslag i Brønnøysundregistrene, firmaopplysninger, brukere og roller, og revisjonslogg.

**Neste leveranser:** kunder og fakturaer med mva og PDF → nummerserie, KID og kreditnota → innbetalinger fra bank → purring → EHF, integrasjoner og betaling for abonnement. Se `docs/strategi.md` og `docs/overlevering.md`.

## Teknologi

Samme oppbygging som ATAK-systemet: Next.js 16, React 19, TypeScript, Drizzle ORM og PostgreSQL 16 med Row Level Security, Zod, Tailwind 4, Vitest og Playwright.

## Kjøre lokalt

```
docker compose up -d                 # Postgres med roller (docker/init-db.sql)
cp .env.example .env                 # fyll inn APP_SECRET; FAKTURA_TEST_MODE=true for testene
npm install
npm run db:migrate
npm run dev
```

## Tester

```
npm run lint && npm run typecheck && npm run test:unit   # enhetstester og skott i databasen
cd testsuite && npm install && npx playwright test       # API og skjermtester mot kjørende app
```

Kontrakten testene bygger på står i `testsuite/KONTRAKT.md`.
