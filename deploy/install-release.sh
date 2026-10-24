#!/usr/bin/env bash
# Met en service une version sur le serveur (à lancer PAR PHILIPPE, sur le Dell, avec sudo).
#
#   sudo bash install-release.sh /chemin/calcoolos-<version>.tar.gz
#
# Étapes : vérification de l'empreinte → décompression dans releases/<version> →
# sauvegarde de la base → migrations → bascule du lien « current » → rechargement
# de PHP-FPM. En cas d'échec avant la bascule, la version en service ne change pas.
set -euo pipefail

archive="${1:?Usage : sudo bash install-release.sh calcoolos-<version>.tar.gz}"
base=/srv/calcoolos
name="$(basename "$archive" .tar.gz)"
target="$base/releases/$name"

if [[ -f "$archive.sha256" ]]; then
  (cd "$(dirname "$archive")" && sha256sum -c "$(basename "$archive").sha256")
fi
if [[ -e "$target" ]]; then
  echo "La version $name existe déjà dans $target." >&2
  exit 1
fi

echo "→ Décompression dans $target"
mkdir -p "$target"
tar -xzf "$archive" -C "$target"
chown -R root:calcoolos "$target"
chmod -R u=rwX,g=rX,o= "$target"
# Nginx (www-data) doit pouvoir lire le site statique.
chmod -R o=rX "$target/dist"
chmod o=x "$target"

echo "→ Sauvegarde de la base avant migration"
bash "$target/deploy/backup.sh"

echo "→ Migrations"
sudo -u calcoolos CALCOOLOS_ENV_FILE=/etc/calcoolos/calcoolos.env php "$target/server/bin/migrate.php"

echo "→ Bascule"
previous="$(readlink -f "$base/current" || true)"
ln -sfn "$target" "$base/current.new"
mv -Tf "$base/current.new" "$base/current"
[[ -n "$previous" ]] && echo "$previous" > "$base/previous"
systemctl reload php8.3-fpm

echo "→ Vérification"
if curl -fsS http://127.0.0.1:8088/api/etat >/dev/null; then
  echo "En service : $name"
else
  echo "ATTENTION : l'API ne répond pas. Retour arrière : sudo bash $target/deploy/rollback.sh" >&2
  exit 1
fi
