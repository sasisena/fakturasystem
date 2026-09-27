# Testmiljø på UpCloud

Testmiljøet kjører på én server hos UpCloud, som er et finsk selskap med datasentre i EU. Serveren har fire deler:

- databasen
- appen
- en jobb som sender e-post hvert 15. sekund
- Caddy, som ordner HTTPS

Serveren sjekker `main` hvert 5. minutt og bygger på nytt når noe er flettet inn.

Testmiljøet kjører **uten testmodus**: innloggingskoder og fakturaer sendes som e-post via SMTP. Vi bruker **Mailtrap Sandbox**. Den fanger opp all e-post i en innboks på mailtrap.io, slik at ingenting når fram til ekte mottakere. Der leser du innloggingskodene og ser fakturaene med PDF, uansett hvilken e-postadresse de er sendt til.

Oppsettet ligger i `deploy/upcloud/`:

| Fil | Hva |
| --- | --- |
| `installer.sh` | Kjøres én gang på en ny server. Installerer Docker, brannmur og swap, lager hemmeligheter og starter testmiljøet |
| `compose.yml` | Database, app, e-postjobb og Caddy |
| `init-db.sh` | Lager databaserollene med tilfeldige passord (appen er underlagt skottene mellom bedriftene) |
| `oppdater.sh` | Henter siste `main` og bygger på nytt. Kjøres hvert 5. minutt |

## Sett det opp (én gang, ca. 30 minutter)

### 1. Hent SMTP-opplysningene fra Mailtrap Sandbox

1. Logg inn på https://mailtrap.io og gå til **Email Testing → Inboxes** (Sandbox).
2. Åpne innboksen, for eksempel «My Inbox».
3. Under **Integration** velger du **SMTP**. Der står:
   - **Host:** `sandbox.smtp.mailtrap.io`
   - **Port:** bruk `2525`
   - **Username** og **Password**: to lange rader med bokstaver og tall. Trykk på kopieringsknappen ved siden av hvert felt.

Gratisversjonen tar imot et begrenset antall e-poster per måned. Det holder godt til test.

**Senere**, når ekte kunder skal få e-post, bytter vi til Mailtrap **Email Sending**, eller en annen tjeneste. Det krever at bedriften har et eget domene. Da endres bare SMTP-opplysningene.

### 2. Lag en lesenøkkel i GitHub

Repoet er privat, så serveren trenger en nøkkel for å hente koden. Nøkkelen kan bare lese dette ene repoet.

1. Gå til https://github.com/settings/personal-access-tokens/new
2. **Token name:** `fakturasystem-testserver`. **Expiration:** 1 år (eller det du ønsker).
3. **Repository access:** *Only select repositories* → `sasisena/fakturasystem`.
4. **Permissions → Repository permissions → Contents:** *Read-only*. Ikke gi andre rettigheter.
5. Trykk **Generate token** og kopier nøkkelen. Den begynner med `github_pat_`. Nøkkelen vises bare én gang.

### 3. Opprett serveren i UpCloud

I UpCloud-panelet velger du **Servers → Deploy server**:

- **Location:** et datasenter i Norden, for eksempel Stockholm eller Helsinki.
- **Plan:** minst **2 GB minne**.
- **Operating system:** **Ubuntu Server 24.04 LTS**.
- **SSH keys:** du kan bruke den samme offentlige nøkkelen som for ATAK-serveren.
- **Initialization script:** lim inn skriptet under. Bytt ut verdiene i anførselstegn først (GitHub-nøkkelen, og brukernavn og passord fra Mailtrap):

```bash
#!/bin/bash
GITHUB_TOKEN='lim-inn-nøkkelen-fra-steg-2'
export SMTP_VERT='sandbox.smtp.mailtrap.io'
export SMTP_PORT='2525'
export SMTP_BRUKER='username-fra-mailtrap'
export SMTP_PASSORD='password-fra-mailtrap'
export AVSENDER='faktura@eksempel.no'
apt-get update -q && apt-get install -y -q git
git clone "https://faktura:${GITHUB_TOKEN}@github.com/sasisena/fakturasystem.git" /opt/faktura
bash /opt/faktura/deploy/upcloud/installer.sh
```

Trykk **Deploy**.

Skriptet med nøklene blir liggende i UpCloud-panelet for serveren. Det er greit for et testmiljø, men ikke del skjermbilder av det.

### 4. Vent 15–20 minutter og åpne testmiljøet

Første bygg tar tid. Adressen lages ut fra serverens offentlige IPv4-adresse, som står i serveroversikten i UpCloud. Punktumene byttes med bindestreker:

> IP `94.237.10.20` → **https://94-237-10-20.sslip.io**

## Slik prøver du det

1. Åpne adressen og trykk **Kom i gang gratis**.
2. Skriv en e-postadresse, for eksempel din egen. Koden havner i Mailtrap-innboksen innen et halvt minutt (ikke i din vanlige innboks). Åpne mailtrap.io og les koden der.
3. Registrer bedriften med organisasjonsnummeret. Navn og adresse hentes fra Brønnøysundregistrene.
4. Sett opp tofaktor med en app på telefonen, for eksempel Google Authenticator eller Microsoft Authenticator.
5. Lag en kunde, lag en faktura og send den på e-post. Den dukker opp i Mailtrap-innboksen med PDF-en som vedlegg.

Bruk bare oppdiktede kunder eller deg selv. Testmiljøet har ikke sikkerhetskopier og er ikke satt opp for ekte kundedata.

## Godt å vite

- **Kostnad:** serveren koster det samme per måned uansett trafikk.
- **Oppdatering:** innen 5 minutter etter at noe er flettet inn i `main` begynner serveren å bygge. Bygget tar 5–10 minutter. Dataene blir liggende.
- **Hvem som helst som finner adressen, kan registrere seg.** Det er derfor ikke lurt å dele adressen offentlig ennå.
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
| Se om e-post blir sendt | `docker logs faktura-test-jobber-1 --tail 20` |
| Ny GitHub-nøkkel | `git -C /opt/faktura remote set-url origin https://faktura:<ny-nøkkel>@github.com/sasisena/fakturasystem.git` |

Hemmelighetene (passord og nøkler) ligger i `/etc/faktura/test.env`, som bare root kan lese.

## Produksjon

Produksjon skal ikke settes opp med disse filene. Den krever:

- sikkerhetskopier i EU/EØS
- databehandleravtale med UpCloud
- en e-posttjeneste som sender ekte e-post fra eget domene (for eksempel Mailtrap Email Sending), slik at fakturaene ikke havner i søppelposten
- eget domene
