#!/usr/bin/env bash
# Préparation du serveur, UNE seule fois (à lancer PAR PHILIPPE, sur le Dell, avec sudo).
#
#   sudo bash deploy/premiere-installation.sh calcoolos.mondomaine.fr
#
# Ce script :
#   - crée l'utilisateur système « calcoolos » et les dossiers ;
#   - crée la base MariaDB et son utilisateur, avec un mot de passe généré ICI ;
#   - écrit /etc/calcoolos/calcoolos.env (secrets générés sur le serveur, lisibles
#     par root et calcoolos seulement) ;
#   - installe le pool PHP-FPM et le site Nginx (écoute locale 127.0.0.1:8088).
# Il NE touche PAS à Cloudflare, au DNS, au tunnel ni aux autres sites.
# Il peut être relancé : ce qui existe déjà est conservé.
set -euo pipefail

domain="${1:?Usage : sudo bash deploy/premiere-installation.sh nom.de.domaine}"
here="$(cd "$(dirname "$0")" && pwd)"
[[ $EUID -eq 0 ]] || { echo "À lancer avec sudo." >&2; exit 1; }

for cmd in nginx php mariadb php-fpm8.3; do
  command -v "$cmd" >/dev/null || { echo "Manque : $cmd (voir doc/DEPLOIEMENT.md, prérequis)." >&2; exit 1; }
done
php -m | grep -qi pdo_mysql || { echo "Manque l'extension PHP pdo_mysql (paquet php8.3-mysql)." >&2; exit 1; }

echo "→ Utilisateur et dossiers"
id calcoolos >/dev/null 2>&1 || useradd --system --home /srv/calcoolos --shell /usr/sbin/nologin calcoolos
install -d -m 711 -o root -g root /srv/calcoolos
install -d -m 711 -o root -g root /srv/calcoolos/releases
install -d -m 750 -o root -g calcoolos /etc/calcoolos
install -d -m 700 -o calcoolos -g calcoolos /var/lib/calcoolos /var/lib/calcoolos/sessions
install -d -m 750 -o calcoolos -g adm /var/log/calcoolos

echo "→ Base MariaDB"
env_file=/etc/calcoolos/calcoolos.env
if [[ -f "$env_file" ]]; then
  echo "  $env_file existe déjà : base et secrets conservés."
else
  db_password="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-32)"
  app_secret="$(openssl rand -hex 32)"
  mariadb <<SQL
CREATE DATABASE IF NOT EXISTS calcoolos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'calcoolos'@'localhost' IDENTIFIED BY '${db_password}';
ALTER USER 'calcoolos'@'localhost' IDENTIFIED BY '${db_password}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON calcoolos.* TO 'calcoolos'@'localhost';
FLUSH PRIVILEGES;
SQL
  umask 027
  cat > "$env_file" <<ENV
APP_ENV=prod
DB_DSN=mysql:host=localhost;dbname=calcoolos;charset=utf8mb4
DB_USER=calcoolos
DB_PASSWORD=${db_password}
APP_SECRET=${app_secret}
COOKIE_SECURE=1
VAR_DIR=/var/lib/calcoolos
ENV
  chown root:calcoolos "$env_file"
  chmod 640 "$env_file"
  echo "  Base créée ; secrets écrits dans $env_file (jamais affichés)."
fi

echo "→ PHP-FPM (pool dédié)"
install -m 644 "$here/php-fpm-calcoolos.conf" /etc/php/8.3/fpm/pool.d/calcoolos.conf
php-fpm8.3 -t

echo "→ Nginx (écoute locale 127.0.0.1:8088)"
sed "s/calcoolos.example.invalid/${domain}/" "$here/nginx-calcoolos.conf" > /etc/nginx/sites-available/calcoolos
ln -sfn /etc/nginx/sites-available/calcoolos /etc/nginx/sites-enabled/calcoolos
nginx -t

echo "→ Sauvegarde quotidienne"
cat > /etc/cron.d/calcoolos <<'CRON'
17 3 * * * root bash /srv/calcoolos/current/deploy/backup.sh >/dev/null 2>&1
CRON

systemctl reload php8.3-fpm
systemctl reload nginx
echo
echo "Serveur prêt. Étape suivante : sudo bash deploy/install-release.sh calcoolos-<version>.tar.gz"
echo "Puis, SEULEMENT après accord : relier ${domain} au tunnel Cloudflare vers http://127.0.0.1:8088."
