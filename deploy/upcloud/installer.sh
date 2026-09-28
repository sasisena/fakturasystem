#!/bin/bash
# Setter opp testmiljøet på en ny Ubuntu-server (24.04). Kjøres som root, én gang.
# Forventer at repoet allerede er klonet til /opt/faktura, og miljøvariabelen TESTSIDE_PASSORD.
# E-post er valgfritt: sett SMTP_VERT, SMTP_PORT, SMTP_BRUKER, SMTP_PASSORD og AVSENDER for å sende
# ekte e-post (f.eks. via Mailtrap). Uten dem vises innloggingskoder og fakturaer bare på testsiden.
# DOMENE er valgfri. Uten den brukes <ip-med-bindestreker>.sslip.io.
# Se docs/TESTMILJO-UPCLOUD.md.
set -euo pipefail
exec > >(tee -a /var/log/faktura-installer.log) 2>&1
echo "== Fakturasystem testmiljø: installasjon startet $(date -u +%FT%TZ)"

if [ "${#TESTSIDE_PASSORD}" -lt 12 ] || [[ "$TESTSIDE_PASSORD" =~ [^A-Za-z0-9._-] ]]; then
  echo "TESTSIDE_PASSORD må være minst 12 tegn og bare ha bokstaver a–z, tall, punktum, bindestrek og understrek." >&2
  exit 1
fi

SMTP_URL=""
EMAIL_FROM=""
if [ -n "${SMTP_VERT:-}" ]; then
  for v in SMTP_PORT SMTP_BRUKER SMTP_PASSORD AVSENDER; do
    if [ -z "${!v:-}" ]; then
      echo "$v mangler. Når SMTP_VERT er satt, må alle e-postverdiene fylles ut. Se docs/TESTMILJO-UPCLOUD.md." >&2
      exit 1
    fi
  done
  if [[ ! "$SMTP_PORT" =~ ^[0-9]+$ ]]; then
    echo "SMTP_PORT må være et tall, for eksempel 2525, 587 eller 465." >&2
    exit 1
  fi
  if [[ ! "$AVSENDER" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$ ]]; then
    echo "AVSENDER må være en e-postadresse, for eksempel faktura@eksempel.no." >&2
    exit 1
  fi
  # Port 465 bruker kryptert tilkobling fra start (smtps); de andre krypterer underveis (STARTTLS).
  if [ "$SMTP_PORT" = "465" ]; then protokoll=smtps; else protokoll=smtp; fi
  # Brukernavn og passord kan inneholde tegn som må kodes i en adresse.
  kod() { python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"; }
  SMTP_URL="${protokoll}://$(kod "$SMTP_BRUKER"):$(kod "$SMTP_PASSORD")@${SMTP_VERT}:${SMTP_PORT}"
  EMAIL_FROM="Fakturasystem <${AVSENDER}>"
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q docker.io docker-compose-v2 git curl openssl ufw python3
systemctl enable --now docker

# Bygget av appen trenger mer minne enn de minste serverne har.
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Brannmur: bare SSH, HTTP og HTTPS.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443
ufw --force enable

if [ -z "${DOMENE:-}" ]; then
  ip=$(ip -4 route get 1.1.1.1 | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')
  DOMENE="${ip//./-}.sslip.io"
fi

mkdir -p /etc/faktura
chmod 700 /etc/faktura
if [ ! -f /etc/faktura/test.env ]; then
  umask 077
  cat > /etc/faktura/test.env <<ENV
DOMENE=$DOMENE
APP_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
OWNER_DB_PASSWORD=$(openssl rand -hex 24)
APP_DB_PASSWORD=$(openssl rand -hex 24)
TESTSIDE_PASSORD=$TESTSIDE_PASSORD
SMTP_URL=$SMTP_URL
EMAIL_FROM="$EMAIL_FROM"
ENV
fi
chmod 700 /opt/faktura

bash /opt/faktura/deploy/upcloud/oppdater.sh --tving

echo "Venter på at appen starter …"
for _ in $(seq 1 120); do
  curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1 && break
  sleep 5
done

cat > /etc/systemd/system/faktura-oppdater.service <<'UNIT'
[Unit]
Description=Oppdater Fakturasystem testmiljø fra main
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/bash /opt/faktura/deploy/upcloud/oppdater.sh
UNIT
cat > /etc/systemd/system/faktura-oppdater.timer <<'UNIT'
[Unit]
Description=Sjekk etter ny versjon av Fakturasystem hvert 5. minutt

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now faktura-oppdater.timer

echo "== Ferdig. Testmiljøet: https://$DOMENE  Testside: https://$DOMENE/test/koder"
