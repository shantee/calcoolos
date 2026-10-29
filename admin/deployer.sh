#!/usr/bin/env bash
# Calcoolos Analytics : installe ou met à jour le module d'administration sur tool.zfx.fr (sans sudo).
#
#   bash admin/deployer.sh            préparer + envoyer + installer + vérifier
#   bash admin/deployer.sh --preparer seulement construire admin/build/ (banc d'essai local)
#
# Sur le Dell (utilisateur shantee, ACL déjà en place pour le portail) :
#   /home/tool-zfx-fr/portail/calcoolos/app/        code PHP du module (front.php, vue.php)
#   /home/tool-zfx-fr/portail/calcoolos/config.php  adresse de l'API et jeton (640, créé une fois, jamais versionné)
#   /home/tool-zfx-fr/htdocs/tool.zfx.fr/assets/calcoolos/   CSS, JS, ECharts, icône, avatars
#   /home/calculos-zfx-fr/calcoolos/admin-stats.sha256       empreinte du jeton, lue par l'API de Calcoolos
#   portail/app/front.php : 5 lignes ajoutées (bloc « Calcoolos Analytics »), copie de sauvegarde avant
#   portail/data/tools.json : tuile « Calcoolos Analytics » ajoutée si absente, copie de sauvegarde avant
# Le jeton est tiré au hasard SUR le Dell ; il ne transite pas par ce poste.
set -euo pipefail
cd "$(dirname "$0")/.."

ssh_target="${CALCOOLOS_SSH:-shantee@192.168.1.26}"
tool_home="/home/tool-zfx-fr"
app_calcoolos="/home/calculos-zfx-fr/calcoolos"
build="admin/build"

echo "1/4 Préparation de $build"
[[ -f node_modules/echarts/dist/echarts.min.js ]] || { echo "ECharts absent : lancer npm install" >&2; exit 1; }
rm -rf "$build/app" "$build/assets"   # garde les fichiers du banc local (config.php, banc-*)
mkdir -p "$build/assets/vendor" "$build/assets/avatars" "$build/app"
cp admin/app/*.php "$build/app/"
cp admin/assets/app.css admin/assets/app.js admin/assets/icone.svg "$build/assets/"
cp node_modules/echarts/dist/echarts.min.js "$build/assets/vendor/"
cp node_modules/echarts/LICENSE "$build/assets/vendor/ECHARTS-LICENSE.txt"
cp src/images/avatars/*.webp "$build/assets/avatars/"
[[ "${1:-}" == "--preparer" ]] && { echo "Prêt : $build"; exit 0; }

echo "2/4 Envoi vers $ssh_target"
ssh "$ssh_target" "mkdir -p '$tool_home/portail/calcoolos/app' '$tool_home/htdocs/tool.zfx.fr/assets/calcoolos'"
rsync -rt --delete "$build/app/" "$ssh_target:$tool_home/portail/calcoolos/app/"
rsync -rt --delete "$build/assets/" "$ssh_target:$tool_home/htdocs/tool.zfx.fr/assets/calcoolos/"

echo "3/4 Installation (jeton, portail, tuile)"
ssh "$ssh_target" bash -s -- "$tool_home" "$app_calcoolos" <<'DISTANT'
set -euo pipefail
tool_home="$1"; app_calcoolos="$2"
stamp="$(date +%Y%m%d-%H%M%S)"
sauv="$HOME/portail-backups/calcoolos-analytics-$stamp"
mkdir -p "$sauv"; chmod 700 "$HOME/portail-backups" "$sauv"
cfg="$tool_home/portail/calcoolos/config.php"
hash_file="$app_calcoolos/admin-stats.sha256"

# Jeton : tiré une fois sur le Dell. Le portail garde le jeton, Calcoolos seulement son empreinte.
if [[ ! -f "$cfg" ]]; then
  jeton="$(openssl rand -hex 32)"
  umask 027
  cat > "$cfg" <<EOF
<?php
// Calcoolos Analytics : accès à l'API d'administration de Calcoolos (créé par admin/deployer.sh le $stamp).
// Ne pas versionner. L'empreinte SHA-256 de ce jeton est dans $hash_file.
return [
    'api' => 'http://127.0.0.1:8080',
    'hote' => 'calculos.zfx.fr',
    'jeton' => '$jeton',
];
EOF
  chmod 640 "$cfg"
  printf '%s\n' "$(printf '%s' "$jeton" | sha256sum | cut -d' ' -f1)" > "$hash_file"
  unset jeton
  echo "  jeton créé ($cfg) et empreinte posée ($hash_file)"
else
  echo "  configuration existante conservée"
fi
chmod 640 "$hash_file"
setfacl -m "u:calculos-zfx-fr:r" "$hash_file"
setfacl -m "u:tool-zfx-fr:r" "$cfg"

# Routeur du portail : le module passe APRÈS la vérification de session (bloc idempotent).
front="$tool_home/portail/app/front.php"
if ! grep -q "Calcoolos Analytics" "$front"; then
  cp -p "$front" "$sauv/front.php"
  python3 - "$front" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
ancre = "if ($path === '/' || $path === '/index.php') {"
bloc = ("// Calcoolos Analytics (module, voir calcoolos/admin/) : après la vérification de session ci-dessus.\n"
        "if ($path === '/calcoolos' || str_starts_with($path, '/calcoolos/')) {\n"
        "    require dirname(__DIR__) . '/calcoolos/app/front.php';\n"
        "    exit;\n"
        "}\n\n")
assert s.count(ancre) == 1 and s.index("if (!authenticate())") < s.index(ancre), "ancre introuvable"
neuf = s.replace(ancre, bloc + ancre)
open(p + ".neuf", "w").write(neuf)
PY
  if php8.5 -l "$front.neuf" >/dev/null; then
    cat "$front.neuf" > "$front"; rm -f "$front.neuf"
    echo "  portail : bloc ajouté (sauvegarde $sauv/front.php)"
  else
    rm -f "$front.neuf"; echo "ARRÊT : front.php modifié invalide, rien changé" >&2; exit 1
  fi
else
  echo "  portail : bloc déjà présent"
fi

# Tuile du portail (sous verrou, comme le portail lui-même).
tools="$tool_home/portail/data/tools.json"
cp -p "$tools" "$sauv/tools.json"
php8.5 -r '
$f = $argv[1];
$l = fopen($f . ".lock", "c"); flock($l, LOCK_EX);
$d = json_decode(file_get_contents($f), true, 64, JSON_THROW_ON_ERROR);
foreach ($d["categories"] as $c) foreach ($c["tools"] as $t) if (($t["url"] ?? "") === "/calcoolos/") { echo "  tuile déjà présente\n"; exit(0); }
$d["categories"][0]["tools"][] = ["id" => "t-calcoolos", "name" => "Calcoolos Analytics", "url" => "/calcoolos/",
  "icon" => ["type" => "image", "value" => "/assets/calcoolos/icone.svg"], "color" => "", "newTab" => false];
$tmp = $f . ".tmp"; file_put_contents($tmp, json_encode($d, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); rename($tmp, $f);
echo "  tuile ajoutée\n";' "$tools"
DISTANT

echo "4/4 Vérifications"
ssh "$ssh_target" bash -s -- "$tool_home" <<'DISTANT'
set -euo pipefail
tool_home="$1"
jeton="$(php8.5 -r 'echo (require $argv[1])["jeton"];' "$tool_home/portail/calcoolos/config.php")"
code="$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: calculos.zfx.fr' -H "Authorization: Bearer $jeton" http://127.0.0.1:8080/api/admin/sante)"
echo "  API d'administration de Calcoolos (local, avec jeton) : $code"
code="$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: calculos.zfx.fr' http://127.0.0.1:8080/api/admin/sante)"
echo "  même adresse sans jeton : $code (attendu 404)"
code="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $jeton" https://calculos.zfx.fr/api/admin/sante)"
echo "  depuis Internet, avec le jeton : $code (attendu 404)"
for u in /calcoolos/ /calcoolos/api/resume /calcoolos/api/joueurs /assets/calcoolos/app.js; do
  echo "  https://tool.zfx.fr$u sans connexion : $(curl -s -o /dev/null -w '%{http_code} → %{redirect_url}' "https://tool.zfx.fr$u")"
done
echo "  portail : $(curl -s -o /dev/null -w '%{http_code} → %{redirect_url}' https://tool.zfx.fr/)"
DISTANT
echo "Fait : https://tool.zfx.fr/calcoolos/"
