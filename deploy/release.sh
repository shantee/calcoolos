#!/usr/bin/env bash
# Prépare une version livrable (sur la machine de développement, pas sur le serveur) :
# tests, construction, puis une archive calcoolos-<version>.tar.gz contenant
# dist/ (site statique) et server/ (API PHP), sans configuration ni secret.
#
#   bash deploy/release.sh
set -euo pipefail
cd "$(dirname "$0")/.."

version="$(git describe --always --dirty)-$(date -u +%Y%m%d%H%M)"
if [[ "$version" == *dirty* ]]; then
  echo "Des modifications ne sont pas validées (git commit) : abandon." >&2
  exit 1
fi

echo "1/4 Tests du jeu et de la plateforme"
npm ci --no-audit --no-fund
npm test
echo "2/4 Tests de l'API (SQLite en mémoire)"
php server/tests/run.php
echo "3/4 Construction"
npm run build
echo "4/4 Archive"
mkdir -p releases
tar --exclude='server/var' --exclude='server/.env' --exclude='server/config.php' \
  -czf "releases/calcoolos-$version.tar.gz" dist server deploy
(cd releases && sha256sum "calcoolos-$version.tar.gz" > "calcoolos-$version.tar.gz.sha256")
echo "Prêt : releases/calcoolos-$version.tar.gz"
