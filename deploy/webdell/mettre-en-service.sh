#!/usr/bin/env bash
# Met en service une version de Calcoolos sur le Dell (sans sudo). Appelé par deploy/publier.sh.
#
#   bash mettre-en-service.sh <archive.tar.gz> [domaine] [dossier de l'application]
#
# Étapes : empreinte → décompression dans releases/<version> → tests de l'API avec le PHP du
# serveur → sauvegarde de la base → migrations → bascule du lien « current » → vérification par
# Nginx (page d'accueil et API). Si la vérification échoue, retour automatique à la version
# précédente. Avant la bascule, rien ne change pour les joueurs.
set -euo pipefail
archive="${1:?Usage : bash mettre-en-service.sh calcoolos-<version>.tar.gz [domaine] [dossier]}"
domain="${2:-calculos.zfx.fr}"
app="${3:-/home/calculos-zfx-fr/calcoolos}"
env_file="$app/shared/calcoolos.env"
php=php8.5
name="$(basename "$archive" .tar.gz)"
target="$app/releases/$name"

say() { printf '→ %s\n' "$*"; }
die() { printf 'ARRÊT : %s\n' "$*" >&2; exit 1; }

[[ -f "$env_file" ]] || die "installation absente ($env_file) : lancer d'abord deploy/webdell/installer.sh avec sudo."
[[ -e "$target" ]] && die "la version $name existe déjà dans $target."

if [[ -f "$archive.sha256" ]]; then
  (cd "$(dirname "$archive")" && sha256sum -c --quiet "$(basename "$archive").sha256") || die "empreinte invalide"
fi

say "Décompression dans $target"
mkdir -p "$target"
tar -xzf "$archive" -C "$target"

say "Tests de l'API avec $($php -r 'echo PHP_VERSION;') (SQLite en mémoire)"
if ! $php "$target/server/tests/run.php" > "$target/tests-api.txt" 2>&1; then
  tail -20 "$target/tests-api.txt" >&2
  rm -rf -- "$target"
  die "tests de l'API en échec : version non installée."
fi
tail -1 "$target/tests-api.txt"

say "Sauvegarde de la base"
bash "$target/deploy/webdell/sauvegarde.sh" "$app"

say "Migrations"
CALCOOLOS_ENV_FILE="$env_file" $php "$target/server/bin/migrate.php"

previous="$(readlink -f "$app/current" 2>/dev/null || true)"
switch_to() {
  ln -sfn "$1" "$app/current.new"
  mv -Tf "$app/current.new" "$app/current"
}
say "Bascule"
switch_to "$target"
[[ -n "$previous" ]] && echo "$previous" > "$app/previous"

say "Vérification par Nginx (comme un visiteur, sans passer par Internet)"
check() {
  local url="http://127.0.0.1$1"
  curl -fsS --max-time 10 -H "Host: $domain" -H 'X-Forwarded-Proto: https' "$url"
}
if check /api/etat | grep -q '"connecte"' && check / | grep -q '<title>' \
  && check "/jeu/decollage.html" | grep -q '<title>'; then
  say "En service : $name  →  https://$domain"
else
  if [[ -n "$previous" ]]; then
    switch_to "$previous"
    die "la vérification a échoué : retour automatique à $(basename "$previous")."
  fi
  die "la vérification a échoué (aucune version précédente). Voir $(dirname "$app")/logs/."
fi

# On garde les 5 versions les plus récentes (dont l'actuelle et la précédente).
cur="$(readlink -f "$app/current")"
prev="$(cat "$app/previous" 2>/dev/null || true)"
ls -1dt "$app"/releases/*/ | tail -n +6 | while read -r old; do
  old="${old%/}"
  [[ "$old" == "$cur" || "$old" == "$prev" ]] || rm -rf -- "$old"
done
