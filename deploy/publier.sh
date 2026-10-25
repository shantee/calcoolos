#!/usr/bin/env bash
# Publie la version actuelle du dépôt sur le Dell, en une commande (machine de développement).
#
#   bash deploy/publier.sh
#
# 1. refuse le code non validé dans git ; 2. tests, vérification des types, construction ;
# 3. archive dist/ + server/ + deploy/ (sans configuration ni secret) ; 4. envoi sur le Dell ;
# 5. mise en service par deploy/webdell/mettre-en-service.sh de CETTE version (tests de l'API
#    avec le PHP du serveur, sauvegarde de la base, migrations, bascule, vérification et retour
#    automatique si besoin). Aucun sudo : la préparation unique est deploy/webdell/installer.sh.
#
# Réglages (variables d'environnement facultatives) :
#   CALCOOLOS_SSH     accès SSH au Dell          (défaut : shantee@192.168.1.26)
#   CALCOOLOS_DOMAIN  adresse publique du site   (défaut : calculos.zfx.fr)
#   CALCOOLOS_APP     dossier sur le serveur     (défaut : /home/calculos-zfx-fr/calcoolos)
set -euo pipefail
cd "$(dirname "$0")/.."

ssh_target="${CALCOOLOS_SSH:-shantee@192.168.1.26}"
domain="${CALCOOLOS_DOMAIN:-calculos.zfx.fr}"
app="${CALCOOLOS_APP:-/home/calculos-zfx-fr/calcoolos}"

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Des modifications ne sont pas validées (git commit) : abandon." >&2
  exit 1
fi
version="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
name="calcoolos-$version"

echo "1/4 Tests, types et construction"
npm test --silent
npm run typecheck --silent
npm run build --silent

echo "2/4 Archive $name"
mkdir -p releases
tar --exclude='server/var' --exclude='server/.env' --exclude='server/config.php' \
  -czf "releases/$name.tar.gz" dist server deploy
(cd releases && sha256sum "$name.tar.gz" > "$name.tar.gz.sha256")

echo "3/4 Envoi vers $ssh_target"
ssh "$ssh_target" 'mkdir -p ~/calcoolos-livraisons'
scp -q "releases/$name.tar.gz" "releases/$name.tar.gz.sha256" "$ssh_target:calcoolos-livraisons/"

echo "4/4 Mise en service sur le serveur"
# Le script de mise en service est pris dans l'archive elle-même (toujours la bonne version).
ssh "$ssh_target" "cd ~/calcoolos-livraisons && tar -xzOf $name.tar.gz deploy/webdell/mettre-en-service.sh \
  | bash -s -- \"\$HOME/calcoolos-livraisons/$name.tar.gz\" '$domain' '$app' \
  && ls -1t calcoolos-*.tar.gz | tail -n +6 | while read -r f; do rm -f \"\$f\" \"\$f.sha256\"; done"
echo "Publié : https://$domain"
