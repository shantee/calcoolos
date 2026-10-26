#!/usr/bin/env bash
# Active « Continuer avec Google » sur le Dell. À lancer UNE FOIS, avec sudo (relançable sans risque).
#
#   sudo bash activer-google.sh <identifiant-client>.apps.googleusercontent.com [domaine]
#   sudo bash activer-google.sh --desactiver [domaine]      (le bouton disparaît, rien d'autre ne change)
#
# Ce que fait le script :
#   1. écrit GOOGLE_CLIENT_ID dans shared/calcoolos.env (sauvegarde avant) ; l'identifiant client est
#      public (il est visible dans la page), il n'y a aucun secret Google à stocker ;
#   2. ajoute au vhost de CE site seulement, dans le bloc Calcoolos, une règle pour compte.html : la
#      même politique de sécurité, plus le script et le cadre de accounts.google.com/gsi. Sauvegarde du
#      vhost, `nginx -t`, retour arrière automatique si le test échoue. Les autres pages et les
#      autres sites ne sont pas touchés.
# Changer de domaine plus tard : relancer installer.sh pour le nouveau domaine, puis ce script, et
# ajouter la nouvelle adresse dans la console Google (doc/GOOGLE.md).
set -euo pipefail

client="${1:?Usage : sudo bash activer-google.sh <identifiant>.apps.googleusercontent.com [domaine]}"
domain="${2:-calculos.zfx.fr}"
stamp="$(date +%Y%m%d-%H%M%S)"
backup="/root/webpi-backups/calcoolos-google-$stamp"
vhost="/etc/nginx/sites-enabled/$domain.conf"
marker="# Calcoolos (installer.sh)"
# Même politique que deploy/nginx-calcoolos.conf (location = /compte.html) : garder identiques.
csp_google="default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

say() { printf '→ %s\n' "$*"; }
die() { printf 'ARRÊT : %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "à lancer avec sudo."
if [[ "$client" != --desactiver ]]; then
  [[ "$client" =~ ^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$ ]] \
    || die "identifiant client inattendu : '$client' (forme attendue : 1234-abcd.apps.googleusercontent.com)"
fi
[[ -f "$vhost" ]] || die "vhost introuvable : $vhost"
grep -qF "$marker : fin" "$vhost" || die "bloc Calcoolos absent du vhost : lancer d'abord installer.sh"
root_line="$(grep -m1 -E '^\s*root /home/[^/]+/htdocs/' "$vhost" | awk '{print $2}' | tr -d ';')"
user="$(echo "$root_line" | cut -d/ -f3)"
env_file="/home/$user/calcoolos/shared/calcoolos.env"
[[ -f "$env_file" ]] || die "configuration introuvable : $env_file"

mkdir -p "$backup"
chmod 700 "$backup"

# --- 1. Identifiant client dans la configuration ---------------------------------------------------
cp -a "$env_file" "$backup/calcoolos.env"
tmp="$(mktemp)"
grep -v '^GOOGLE_CLIENT_ID=' "$env_file" > "$tmp" || true
if [[ "$client" == --desactiver ]]; then
  say "Connexion Google désactivée (GOOGLE_CLIENT_ID retiré)"
else
  printf 'GOOGLE_CLIENT_ID=%s\n' "$client" >> "$tmp"
  say "GOOGLE_CLIENT_ID enregistré dans $env_file"
fi
cat "$tmp" > "$env_file"   # cat > garde le propriétaire, les droits et les ACL du fichier
rm -f "$tmp"

# --- 2. Politique de sécurité de compte.html ---------------------------------------------------------
if grep -qE 'location = /compte\.html' "$vhost"; then
  say "Vhost : règle de compte.html déjà présente (inchangé)."
else
  cp -a "$vhost" "$backup/$domain.conf"
  block="$(cat <<EOF

  # Espace parents : en plus, le bouton « Continuer avec Google » (activer-google.sh, $stamp).
  location = /compte.html {
    add_header Cache-Control "no-cache" always;
    add_header Content-Security-Policy "$csp_google" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    add_header X-Frame-Options "DENY" always;
    try_files \$uri =404;
  }
EOF
)"
  BLOCK="$block" MARK="$marker : fin" awk '
    index($0, ENVIRON["MARK"]) && !done { print ENVIRON["BLOCK"]; done=1 }
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

# --- Vérification ------------------------------------------------------------------------------------
sleep 1
etat="$(curl -fsS --max-time 10 -H "Host: $domain" -H 'X-Forwarded-Proto: https' http://127.0.0.1/api/etat || true)"
entetes="$(curl -fsSI --max-time 10 -H "Host: $domain" -H 'X-Forwarded-Proto: https' http://127.0.0.1/compte.html || true)"
if [[ "$client" == --desactiver ]]; then
  grep -q googleClientId <<<"$etat" && die "l'API annonce encore Google : vérifier $env_file"
  say "Terminé : le bouton Google n'apparaît plus."
else
  grep -qF "$client" <<<"$etat" || die "l'API n'annonce pas l'identifiant : vérifier $env_file (sauvegarde : $backup)"
  grep -qi 'accounts.google.com/gsi/client' <<<"$entetes" || die "compte.html n'a pas la politique Google : vérifier le vhost"
  say "Terminé : « Continuer avec Google » est actif sur https://$domain/compte.html"
fi
