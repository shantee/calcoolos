#!/usr/bin/env bash
# Sauvegarde de la base Calcoolos sur le Dell (sans sudo). Garde 14 jours.
#
#   bash sauvegarde.sh [/home/<site>/calcoolos]
#
# Lancée chaque nuit par /etc/cron.d/calcoolos (utilisateur du site) et avant chaque mise en
# service. Le mot de passe est lu dans shared/calcoolos.env et passé par un fichier temporaire
# privé (jamais en argument). La sauvegarde Borg du serveur (webpi-backup) copie aussi ce dossier.
set -euo pipefail
app="${1:-/home/calculos-zfx-fr/calcoolos}"
env_file="$app/shared/calcoolos.env"
dir="$app/backups"

val() { sed -n "s/^$1=//p" "$env_file" | head -1; }
dsn="$(val DB_DSN)"
dbname="$(sed -n 's/.*dbname=\([^;]*\).*/\1/p' <<<"$dsn")"
host="$(sed -n 's/.*host=\([^;]*\).*/\1/p' <<<"$dsn")"

cnf="$(mktemp)"
trap 'rm -f "$cnf"' EXIT
chmod 600 "$cnf"
printf '[client]\nuser=%s\npassword=%s\nhost=%s\n' "$(val DB_USER)" "$(val DB_PASSWORD)" "${host:-127.0.0.1}" > "$cnf"

umask 077
file="$dir/calcoolos-$(date +%Y%m%d-%H%M%S).sql.gz"
mariadb-dump --defaults-extra-file="$cnf" --single-transaction --no-tablespaces \
  --default-character-set=utf8mb4 "$dbname" | gzip -9 > "$file"
find "$dir" -name 'calcoolos-*.sql.gz' -mtime +14 -delete
echo "Sauvegarde : $file"
