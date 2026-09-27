#!/bin/bash
# Henter siste versjon av main og bygger testmiljøet på nytt hvis noe er endret.
# Kjøres hvert 5. minutt av systemd (faktura-oppdater.timer). «--tving» bygger uansett.
set -euo pipefail

main() {
  cd /opt/faktura
  git fetch -q origin main
  if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && [ "${1:-}" != "--tving" ]; then
    return 0
  fi
  git reset -q --hard origin/main
  echo "Bygger $(git rev-parse --short HEAD) …"
  GIT_SHA="$(git rev-parse --short HEAD)" docker compose -f deploy/upcloud/compose.yml --env-file /etc/faktura/test.env up -d --build --remove-orphans
  docker image prune -f >/dev/null
  echo "Testmiljøet kjører $(git rev-parse --short HEAD)."
}

# Hele skriptet leses før det kjøres, siden git reset kan endre denne filen underveis.
main "$@"
exit
