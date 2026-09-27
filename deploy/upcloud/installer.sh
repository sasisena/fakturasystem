#!/bin/bash
# Setter opp testmiljøet på en ny Ubuntu-server (24.04). Kjøres som root, én gang.
# Forventer at repoet allerede er klonet til /opt/faktura, og miljøvariablene GMAIL_ADRESSE og GMAIL_APPPASSORD.
# DOMENE er valgfri. Uten den brukes <ip-med-bindestreker>.sslip.io.
# Se docs/TESTMILJO-UPCLOUD.md.
set -euo pipefail
exec > >(tee -a /var/log/faktura-installer.log) 2>&1
echo "== Fakturasystem testmiljø: installasjon startet $(date -u +%FT%TZ)"

GMAIL_APPPASSORD="${GMAIL_APPPASSORD// /}"
if [[ ! "${GMAIL_ADRESSE:-}" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}$ ]]; then
  echo "GMAIL_ADRESSE mangler eller er ugyldig." >&2
  exit 1
fi
if [[ ! "$GMAIL_APPPASSORD" =~ ^[a-z]{16}$ ]]; then
  echo "GMAIL_APPPASSORD må være app-passordet fra Google: 16 små bokstaver (mellomrom fjernes automatisk)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q docker.io docker-compose-v2 git curl openssl ufw
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
SMTP_URL=smtps://${GMAIL_ADRESSE//@/%40}:${GMAIL_APPPASSORD}@smtp.gmail.com:465
EMAIL_FROM="Fakturasystem <${GMAIL_ADRESSE}>"
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

echo "== Ferdig. Testmiljøet: https://$DOMENE"
