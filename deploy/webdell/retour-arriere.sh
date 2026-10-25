#!/usr/bin/env bash
# Revient à la version précédente de Calcoolos sur le Dell (sans sudo, instantané).
#
#   bash /home/calculos-zfx-fr/calcoolos/current/deploy/webdell/retour-arriere.sh
#
# Le code revient en arrière ; la base garde son schéma (les migrations ajoutent sans détruire,
# l'ancienne version fonctionne donc encore). En dernier recours, restaurer une sauvegarde de
# backups/ (voir doc/DEPLOIEMENT.md).
set -euo pipefail
app="${1:-/home/calculos-zfx-fr/calcoolos}"
previous="$(cat "$app/previous" 2>/dev/null || true)"
if [[ -z "$previous" || ! -d "$previous" ]]; then
  echo "Aucune version précédente connue. Versions disponibles :" >&2
  ls -1t "$app/releases" >&2
  echo "Bascule manuelle : ln -sfn $app/releases/<version> $app/current" >&2
  exit 1
fi
current="$(readlink -f "$app/current")"
ln -sfn "$previous" "$app/current.new"
mv -Tf "$app/current.new" "$app/current"
echo "$current" > "$app/previous"
echo "Revenu à : $(basename "$previous")  (la version quittée reste disponible : relancer ce script pour y revenir)"
