# Testmiljø på UpCloud

Testmiljøet kjører på én server hos UpCloud, som er et finsk selskap med datasentre i EU. Serveren har fire deler:

- databasen
- appen
- en jobb som sender e-post hvert 15. sekund
- Caddy, som ordner HTTPS

Serveren sjekker `main` hvert 5. minutt og bygger på nytt når noe er flettet inn.

Du logger inn med en engangskode, som i ATAK-systemet. Koden leser du av på en **passordbeskyttet testside**, `https://<adressen>/test/koder`. Testsiden viser også tofaktor-koden til hver bruker, så du trenger ikke en app. Fakturaer som «sendes», vises der med lenke til PDF-en.

E-post er valgfritt. Legger du inn SMTP-opplysninger (for eksempel fra Mailtrap Sandbox), sendes e-posten i tillegg. Testsiden viser da om utsendingen feilet, og hvorfor.

Testmiljøet kjører ellers som den ekte løsningen: oppslag i Brønnøysundregistrene er ekte, og testsuitens endepunkter (`/api/test/*`) finnes ikke.

Oppsettet ligger i `deploy/upcloud/`:

| Fil | Hva |
| --- | --- |
| `installer.sh` | Kjøres én gang på en ny server. Installerer Docker, brannmur og swap, lager hemmeligheter og starter testmiljøet |
| `compose.yml` | Database, app, e-postjobb og Caddy |
| `init-db.sh` | Lager databaserollene med tilfeldige passord (appen er underlagt skottene mellom bedriftene) |
| `oppdater.sh` | Henter siste `main` og bygger på nytt. Kjøres hvert 5. minutt |

## Sett det opp (én gang, ca. 30 minutter)

### 1. Lag en lesenøkkel i GitHub

Repoet er privat, så serveren trenger en nøkkel for å hente koden. Nøkkelen kan bare lese dette ene repoet.

1. Gå til https://github.com/settings/personal-access-tokens/new
2. **Token name:** `fakturasystem-testserver`. **Expiration:** 1 år (eller det du ønsker).
3. **Repository access:** *Only select repositories* → `sasisena/fakturasystem`.
4. **Permissions → Repository permissions → Contents:** *Read-only*. Ikke gi andre rettigheter.
5. Trykk **Generate token** og kopier nøkkelen. Den begynner med `github_pat_`. Nøkkelen vises bare én gang.

### 2. Opprett serveren i UpCloud

I UpCloud-panelet velger du **Servers → Deploy server**:

- **Location:** et datasenter i Norden, for eksempel Stockholm eller Helsinki.
- **Plan:** minst **2 GB minne**.
- **Operating system:** **Ubuntu Server 24.04 LTS**.
- **SSH keys:** du kan bruke den samme offentlige nøkkelen som for ATAK-serveren.
- **Initialization script:** lim inn skriptet under. Bytt ut de to verdiene øverst først:

```bash
#!/bin/bash
GITHUB_TOKEN='lim-inn-nøkkelen-fra-steg-1'
export TESTSIDE_PASSORD='velg-et-langt-passord'
apt-get update -q && apt-get install -y -q git
git clone "https://faktura:${GITHUB_TOKEN}@github.com/sasisena/fakturasystem.git" /opt/faktura
bash /opt/faktura/deploy/upcloud/installer.sh
```

Passordet til testsiden må ha minst 12 tegn. Bruk bare bokstavene a–z, tall, punktum, bindestrek og understrek, for eksempel `faktura-test-2026-blaa-fjell`.

**Vil du også ha e-post** (valgfritt), legger du til disse linjene før `apt-get`-linjen. Verdiene finner du i Mailtrap under **Email Testing → Inboxes →** innboksen **→ Integration → SMTP**:

```bash
export SMTP_VERT='sandbox.smtp.mailtrap.io'
export SMTP_PORT='2525'
export SMTP_BRUKER='username-fra-mailtrap'
export SMTP_PASSORD='password-fra-mailtrap'
export AVSENDER='faktura@eksempel.no'
```

Trykk **Deploy**.

Skriptet med nøklene blir liggende i UpCloud-panelet for serveren. Det er greit for et testmiljø, men ikke del skjermbilder av det.

### 3. Vent 15–20 minutter og åpne testmiljøet

Første bygg tar tid. Adressen lages ut fra serverens offentlige IPv4-adresse, som står i serveroversikten i UpCloud. Punktumene byttes med bindestreker:

> IP `94.237.10.20` → **https://94-237-10-20.sslip.io**

## Slik prøver du det

1. Åpne testsiden `https://<adressen>/test/koder` i én fane. Brukernavnet kan være hva som helst; passordet er det du valgte.
2. Åpne `https://<adressen>` i en annen fane og trykk **Kom i gang gratis**.
3. Skriv en e-postadresse og trykk **Send kode**. Les av koden på testsiden (den oppdaterer seg hvert 15. sekund).
4. Registrer bedriften med organisasjonsnummeret. Navn og adresse hentes fra Brønnøysundregistrene.
5. Tofaktor: skann QR-koden med en app, eller les av koden i brukerlisten på testsiden.
6. Lag en kunde og en faktura, og send den på e-post. Den dukker opp under «Fakturaer og andre e-poster» på testsiden, med lenke til PDF-en.

Bruk bare deg selv og oppdiktede kunder. Testmiljøet har ikke sikkerhetskopier og er ikke satt opp for ekte kundedata.

## Godt å vite

- **Kostnad:** serveren koster det samme per måned uansett trafikk.
- **Oppdatering:** innen 5 minutter etter at noe er flettet inn i `main` begynner serveren å bygge. Bygget tar 5–10 minutter. Dataene blir liggende.
- **Hvem som helst som finner adressen, kan registrere seg.** Det er derfor ikke lurt å dele adressen offentlig ennå.
- **Den som kjenner passordet til testsiden, kan logge inn som hvilken som helst bruker.** Del det bare med dem som skal teste. Testsiden skal aldri slås på i produksjon.
- **GitHub-nøkkelen utløper** på datoen du valgte. Deretter slutter serveren å oppdatere seg, men den fortsetter å kjøre.
- **sslip.io** er en gratis navnetjeneste som gjør IP-adressen om til et navn, slik at vi kan få HTTPS-sertifikat uten eget domene.

## Vedlikehold (krever innlogging på serveren)

Logg inn med `ssh root@<IP>`.

| Hva | Kommando |
| --- | --- |
| Se hva installasjonen gjorde | `cat /var/log/faktura-installer.log` |
| Se siste oppdateringer | `journalctl -u faktura-oppdater -n 50` |
| Bygg på nytt nå | `bash /opt/faktura/deploy/upcloud/oppdater.sh --tving` |
| Se loggen til appen | `docker logs faktura-test-app-1 --tail 100` |
| Se om e-post blir sendt | `docker logs faktura-test-jobber-1 --tail 20` (feilmeldinger vises også på testsiden) |
| Slå på testsiden på en server som ble satt opp før den fantes | `echo 'TESTSIDE_PASSORD=velg-et-langt-passord' >> /etc/faktura/test.env && bash /opt/faktura/deploy/upcloud/oppdater.sh --tving` |
| Ny GitHub-nøkkel | `git -C /opt/faktura remote set-url origin https://faktura:<ny-nøkkel>@github.com/sasisena/fakturasystem.git` |

Hemmelighetene (passord og nøkler) ligger i `/etc/faktura/test.env`, som bare root kan lese.

## Produksjon

Produksjon skal ikke settes opp med disse filene. Den krever:

- sikkerhetskopier i EU/EØS
- databehandleravtale med UpCloud
- en e-posttjeneste som sender ekte e-post fra eget domene (for eksempel Mailtrap Email Sending), slik at fakturaene ikke havner i søppelposten
- eget domene
