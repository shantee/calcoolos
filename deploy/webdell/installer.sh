#!/usr/bin/env bash
# Installation de Calcoolos sur le serveur Dell « WebDell » (CloudPanel + Cloudflare Tunnel).
# À lancer UNE FOIS, avec sudo, sur le Dell. Peut être relancé sans risque (rien n'est écrasé).
#
#   sudo bash installer.sh [domaine] [utilisateur-admin]
#   (défauts : calculos.zfx.fr et l'utilisateur qui lance sudo)
#
# Ce que fait le script, dans l'ordre :
#   1. crée le site avec l'outil maison : `webpi-site add <domaine>` (CloudPanel, PHP 8.5, Nginx,
#      route du tunnel Cloudflare et DNS ; aucun Cloudflare Access) ;
#   2. prépare /home/<site>/calcoolos/ (versions, configuration, sessions, sauvegardes), modifiable
#      sans sudo par l'utilisateur admin (ACL, comme le fait webpi-site pour htdocs) ;
#   3. crée la base MariaDB « calcoolos » par CloudPanel et génère sur place le mot de passe et la
#      clé APP_SECRET dans shared/calcoolos.env (jamais affichés, jamais dans git) ;
#   4. remplace le dossier htdocs/<domaine> (vide) par un lien vers la version en service ;
#   5. ajoute au vhost de CE site seulement : l'API /api/ (PHP-FPM du site) et les en-têtes de
#      sécurité ; sauvegarde du vhost, `nginx -t`, retour arrière automatique si le test échoue ;
#   6. planifie une sauvegarde quotidienne de la base (/etc/cron.d/calcoolos).
#
# Garde-fous : toute configuration existante qui ne correspond pas à ce qui est attendu arrête le
# script (pas de contournement automatique). Les autres sites ne sont pas touchés.
set -euo pipefail

domain="${1:-calculos.zfx.fr}"
admin="${2:-${SUDO_USER:-shantee}}"
db=calcoolos
stamp="$(date +%Y%m%d-%H%M%S)"
backup="/root/webpi-backups/calcoolos-$stamp"
vhost="/etc/nginx/sites-enabled/$domain.conf"
marker="# Calcoolos (installer.sh)"

say() { printf '→ %s\n' "$*"; }
die() { printf 'ARRÊT : %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "à lancer avec sudo."
id "$admin" >/dev/null 2>&1 || die "utilisateur admin introuvable : $admin"
for c in webpi-site clpctl nginx mariadb setfacl openssl; do
  command -v "$c" >/dev/null || die "commande absente : $c"
done

# --- 1. Site CloudPanel + tunnel + DNS -----------------------------------------------------------
if [[ -f "$vhost" ]]; then
  say "Site $domain déjà présent dans CloudPanel : non recréé."
else
  say "Création du site $domain avec webpi-site (CloudPanel, tunnel, DNS)"
  webpi-site add "$domain"
fi
[[ -f "$vhost" ]] || die "vhost introuvable après création : $vhost"

root_line="$(grep -m1 -E '^\s*root /home/[^/]+/htdocs/' "$vhost" | awk '{print $2}' | tr -d ';')"
[[ "$root_line" == /home/*/htdocs/"$domain" ]] || die "racine du vhost inattendue : '$root_line'"
user="$(echo "$root_line" | cut -d/ -f3)"
id "$user" >/dev/null 2>&1 || die "utilisateur du site introuvable : $user"
port="$(grep -m1 -oE 'fastcgi_pass 127\.0\.0\.1:[0-9]+' "$vhost" | cut -d: -f2)"
[[ -n "$port" ]] || die "port PHP-FPM du site introuvable dans le vhost"
home="/home/$user"
app="$home/calcoolos"
docroot="$home/htdocs/$domain"
say "Site : utilisateur $user, PHP-FPM 127.0.0.1:$port, application $app"

mkdir -p "$backup"
chmod 700 "$backup"

# --- 2. Dossiers de l'application ----------------------------------------------------------------
say "Dossiers de l'application"
install -d -o "$user" -g "$user" -m 770 "$app" "$app/releases" "$app/shared" "$app/backups"
install -d -o "$user" -g "$user" -m 700 "$app/shared/var"
# L'admin livre les versions sans sudo ; le site (PHP) lit le code et écrit seulement dans shared/var.
setfacl -m "u:$admin:rx" "$home"
setfacl -R -m "u:$admin:rwX,u:$user:rwX" "$app/releases" "$app/backups"
setfacl -m "u:$admin:rwx,u:$user:rwx" "$app"
setfacl -m "u:$admin:rx" "$app/shared"
find "$app/releases" "$app/backups" -type d -exec setfacl -m "d:u:$admin:rwx,d:u:$user:rwx" {} +

# --- 3. Base de données et configuration ---------------------------------------------------------
env_file="$app/shared/calcoolos.env"
if [[ -f "$env_file" ]]; then
  say "Configuration déjà présente : $env_file (conservée)"
else
  exists="$(mariadb -N -B -e "SHOW DATABASES LIKE '$db'")"
  [[ -z "$exists" ]] || die "la base '$db' existe déjà mais $env_file est absent : à examiner à la main."
  say "Base MariaDB '$db' créée par CloudPanel"
  dbpass="$(openssl rand -base64 33 | tr -d '/+=\n' | cut -c1-32)"
  secret="$(openssl rand -hex 32)"
  clpctl db:add "--domainName=$domain" "--databaseName=$db" "--databaseUserName=$db" \
    "--databaseUserPassword=$dbpass" >/dev/null
  umask 077
  cat > "$env_file" <<EOF
# Configuration de production de Calcoolos (générée par installer.sh le $stamp). Ne pas versionner.
APP_ENV=prod
DB_DSN=mysql:host=127.0.0.1;dbname=$db;charset=utf8mb4
DB_USER=$db
DB_PASSWORD=$dbpass
APP_SECRET=$secret
COOKIE_SECURE=1
VAR_DIR=$app/shared/var
EOF
  unset dbpass secret
fi
chown "$user:$user" "$env_file"
chmod 640 "$env_file"
setfacl -m "u:$admin:r" "$env_file"

# --- 4. Document root -> version en service -------------------------------------------------------
if [[ -L "$docroot" ]]; then
  [[ "$(readlink "$docroot")" == "$app/current/dist" ]] || die "$docroot est un lien vers '$(readlink "$docroot")' (inattendu)"
  say "Lien du site déjà en place."
else
  [[ -d "$docroot" ]] || die "document root introuvable : $docroot"
  if [[ -n "$(ls -A "$docroot")" ]]; then
    say "Contenu initial de $docroot mis de côté dans $backup/htdocs-initial"
    cp -a "$docroot" "$backup/htdocs-initial"
  fi
  rm -rf -- "$docroot"
  ln -s "$app/current/dist" "$docroot"
  chown -h "$user:$user" "$docroot"
  say "$docroot -> $app/current/dist"
fi

# --- 5. Vhost : API et en-têtes de sécurité (ce site seulement) ----------------------------------
if grep -qF "$marker" "$vhost"; then
  say "Vhost déjà adapté : inchangé."
else
  [[ "$(grep -c 'location ~ \\.php\$ {' "$vhost")" == 1 ]] || die "vhost : bloc PHP introuvable ou multiple"
  grep -qE 'location (\^~ )?/api/' "$vhost" && die "vhost : un bloc /api/ existe déjà"
  awk '/^server \{/ {n++} n==2 && /location \/ \{/ {f=1} END {exit f}' "$vhost" \
    || die "vhost : le bloc 8080 a déjà un 'location /'"
  cp -a "$vhost" "$backup/$domain.conf"
  # Mêmes en-têtes que deploy/nginx-calcoolos.conf (lus par scripts/csp-check.mjs) : garder identiques.
  csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  block="$(cat <<EOF
  $marker : début
  # API PHP : toutes les adresses /api/… vont au même point d'entrée de la version en service.
  # \$realpath_root suit le lien « current » : une nouvelle version est prise en compte aussitôt.
  location ^~ /api/ {
    root $app/current/server/public;
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME \$realpath_root/index.php;
    fastcgi_param SCRIPT_NAME /api/index.php;
    fastcgi_param CALCOOLOS_ENV_FILE $env_file;
    fastcgi_param HTTPS "on";
    fastcgi_param SERVER_PORT 443;
    fastcgi_param PHP_VALUE "
error_log=$home/logs/php/error.log;
display_errors=off;
memory_limit=128M;
date.timezone=UTC;
open_basedir=$app/:$home/logs/:/tmp/;";
    fastcgi_pass 127.0.0.1:$port;
    fastcgi_read_timeout 15s;
    client_max_body_size 64k;
    add_header Cache-Control "no-store" always;
    add_header X-Content-Type-Options "nosniff" always;
  }

  # Pages du site (fichiers construits) : toujours fraîches, avec les en-têtes de sécurité.
  location / {
    add_header Cache-Control "no-cache" always;
    add_header Content-Security-Policy "$csp" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "same-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    add_header X-Frame-Options "DENY" always;
    try_files \$uri \$uri/ =404;
  }
  $marker : fin

EOF
)"
  BLOCK="$block" awk '
    /location ~ \\\.php\$ \{/ && !done { print ENVIRON["BLOCK"]; done=1 }
    { print }
  ' "$backup/$domain.conf" > "$vhost.calcoolos-tmp"
  cat "$vhost.calcoolos-tmp" > "$vhost"
  rm -f "$vhost.calcoolos-tmp"
  if nginx -t 2>"$backup/nginx-t.txt"; then
    systemctl reload nginx
    say "Vhost adapté et Nginx rechargé (sauvegarde : $backup/$domain.conf)"
  else
    cat "$backup/$domain.conf" > "$vhost"
    cat "$backup/nginx-t.txt" >&2
    die "nginx -t a échoué : vhost restauré, Nginx non rechargé."
  fi
fi

# --- 6. Sauvegarde quotidienne de la base --------------------------------------------------------
cron=/etc/cron.d/calcoolos
line="17 3 * * * $user /bin/bash $app/current/deploy/webdell/sauvegarde.sh $app >/dev/null 2>&1"
if [[ -f "$cron" ]]; then
  grep -qF "$line" "$cron" || die "$cron existe avec un autre contenu : à examiner."
  say "Sauvegarde quotidienne déjà planifiée."
else
  printf '# Calcoolos : sauvegarde quotidienne de la base (14 jours), installée par installer.sh\n%s\n' "$line" > "$cron"
  chmod 644 "$cron"
  say "Sauvegarde quotidienne planifiée (3 h 17) : $cron"
fi

# --- Bilan ----------------------------------------------------------------------------------------
say "Connexion du compte dédié à la base"
tmpcnf="$(mktemp)"
chmod 600 "$tmpcnf"
printf '[client]\nuser=%s\npassword=%s\nhost=127.0.0.1\n' "$db" "$(sed -n 's/^DB_PASSWORD=//p' "$env_file")" > "$tmpcnf"
mariadb --defaults-extra-file="$tmpcnf" -N -B -e "SELECT CONCAT('  ok : ', CURRENT_USER())" "$db"
rm -f "$tmpcnf"

cat <<EOF

Installation terminée.
  Application : $app   (versions dans releases/, configuration dans shared/)
  Site        : https://$domain   (lien $docroot -> current/dist)
  Sauvegarde  : $backup
Étape suivante, depuis la machine de développement (sans sudo) : bash deploy/publier.sh
EOF
