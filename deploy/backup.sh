#!/usr/bin/env bash
# Sauvegarde de la base Calcoolos (sur le serveur). Garde 14 jours.
#
#   sudo bash /srv/calcoolos/current/deploy/backup.sh
#
# Suggestion de tâche planifiée quotidienne (/etc/cron.d/calcoolos) :
#   17 3 * * * root bash /srv/calcoolos/current/deploy/backup.sh >/dev/null
#
# Utilise l'accès administrateur local de MariaDB (sudo mariadb-dump) : aucun mot de
# passe n'est écrit dans ce script.
set -euo pipefail
dir=/var/backups/calcoolos
mkdir -p "$dir"
chmod 700 "$dir"
file="$dir/calcoolos-$(date -u +%Y%m%d-%H%M%S).sql.gz"
mariadb-dump --single-transaction --routines --default-character-set=utf8mb4 calcoolos | gzip -9 > "$file"
chmod 600 "$file"
find "$dir" -name 'calcoolos-*.sql.gz' -mtime +14 -delete
echo "Sauvegarde : $file"
