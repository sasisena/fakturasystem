#!/bin/bash
# Henter siste versjon av main og bygger testmiljøet på nytt hvis noe er endret.
# Kjøres hvert 5. minutt av systemd (faktura-oppdater.timer). «--tving» bygger uansett.
set -euo pipefail

# Versjonen som sist ble bygget ferdig. Vi sammenligner med denne (ikke med git HEAD), slik at
# et bygg som feiler, blir forsøkt på nytt neste gang i stedet for å bli hoppet over.
BYGGET=/var/lib/faktura/bygget

main() {
  cd /opt/faktura
  git fetch -q origin main
  local ny
  ny="$(git rev-parse origin/main)"
  if [ "$(cat "$BYGGET" 2>/dev/null || true)" = "$ny" ] && [ "${1:-}" != "--tving" ]; then
    return 0
  fi
  git reset -q --hard "$ny"
  echo "Bygger $(git rev-parse --short HEAD) …"
  GIT_SHA="$(git rev-parse --short HEAD)" docker compose -f deploy/upcloud/compose.yml --env-file /etc/faktura/test.env up -d --build --remove-orphans
  docker image prune -f >/dev/null
  mkdir -p "$(dirname "$BYGGET")"
  echo "$ny" > "$BYGGET"
  echo "Testmiljøet kjører $(git rev-parse --short HEAD)."
}

# Hele skriptet leses før det kjøres, siden git reset kan endre denne filen underveis.
main "$@"
exit
