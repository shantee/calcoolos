#!/usr/bin/env bash
# Revient à la version précédente (sur le serveur, avec sudo).
#
#   sudo bash /srv/calcoolos/current/deploy/rollback.sh
#
# Le code revient en arrière immédiatement. La base, elle, garde son schéma : les
# migrations de Calcoolos ajoutent sans rien détruire, l'ancienne version continue
# donc de fonctionner. Si une migration devait un jour être destructive, restaurer
# la sauvegarde faite juste avant (voir doc/DEPLOIEMENT.md, « Restaurer la base »).
set -euo pipefail
base=/srv/calcoolos
previous="$(cat "$base/previous" 2>/dev/null || true)"
if [[ -z "$previous" || ! -d "$previous" ]]; then
  echo "Aucune version précédente connue. Versions disponibles :" >&2
  ls -1 "$base/releases" >&2
  echo "Bascule manuelle : sudo ln -sfn $base/releases/<version> $base/current" >&2
  exit 1
fi
current="$(readlink -f "$base/current")"
ln -sfn "$previous" "$base/current.new"
mv -Tf "$base/current.new" "$base/current"
echo "$current" > "$base/previous"
systemctl reload php8.3-fpm
echo "Revenu à : $previous"
