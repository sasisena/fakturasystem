# Fakturasystem

Prototype av kjerneflyten «lag faktura → send → få betalt», for web og mobil (installerbar app).

**Status:** klikkbar prototype for én bedrift. Ikke klar for ekte kunder — se «Ikke med ennå».

## Hva som virker

- Firmaopplysninger og kunder, med automatisk utfylling fra Brønnøysundregistrene
- Faktura med mva (25/15/12/0 %), eller uten mva for bedrifter som ikke er mva-registrert
- Fortløpende fakturanummer uten hull, KID (MOD10), kontroll av kontonummer og org.nr. (MOD11)
- PDF med de opplysningene bokføringsforskriften krever, sendt på e-post eller delt fra telefonen
- Merk som betalt, angre, og kreditnota i stedet for sletting
- Oversikt over utestående, forfalt og betalt

## Ikke med ennå

Innlogging og flere kunder (organisasjoner) i samme løsning, innbetalinger fra bank, purring, EHF/Peppol, Vipps.

## Kjøre lokalt

Krever Node.js 22.18 eller nyere.

```
npm install
npm run dev        # API på :3000 og web på :5173
npm test           # tester
npm run typecheck
```

Bakgrunn og strategi: [docs/strategi.md](docs/strategi.md).
