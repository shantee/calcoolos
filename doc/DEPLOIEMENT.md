# Calcoolos en ligne : serveur Dell « WebDell »

Le site est en service depuis le 25/10/2026 à l'adresse **https://calculos.zfx.fr**, sur le Dell sous Ubuntu de
Philippe. Ce serveur héberge aussi d'autres sites, avec CloudPanel, Nginx, PHP-FPM 8.5, MariaDB 11.8 et le tunnel
Cloudflare `webpi`. Calcoolos y est installé **comme un site CloudPanel ordinaire**, sans conteneur ni nouveau
service. **Aucune protection d'accès** n'a été ajoutée : pas de Cloudflare Access, pas de mot de passe général.

## Ce qui est installé

```
/home/calculos-zfx-fr/                       site CloudPanel (utilisateur calculos-zfx-fr, PHP-FPM 127.0.0.1:20011)
  htdocs/calculos.zfx.fr -> calcoolos/current/dist      document root = lien vers la version en service
  calcoolos/
    releases/<version>/      une version : dist/ (site statique), server/ (API PHP), deploy/ (scripts)
    current -> releases/…    version en service (bascule instantanée)
    previous                 nom de la version précédente (retour arrière)
    shared/calcoolos.env     configuration et secrets générés sur le serveur (640, jamais dans git)
    shared/var/sessions/     sessions PHP
    backups/                 sauvegardes de la base (.sql.gz, 14 jours)
  logs/php/error.log         erreurs PHP ; logs/nginx/ pour Nginx
/etc/nginx/sites-enabled/calculos.zfx.fr.conf    vhost CloudPanel + bloc « # Calcoolos (installer.sh) »
/etc/cron.d/calcoolos                            sauvegarde quotidienne à 3 h 17 (utilisateur du site)
Base MariaDB « calcoolos », utilisateur « calcoolos » (limité à cette base, créé par CloudPanel)
```

Chemin d'une requête : Cloudflare (HTTPS) → tunnel `webpi` → Nginx :80 → bloc :8080 du vhost →
`/api/…` vers PHP-FPM du site (point d'entrée `server/public/index.php` de la version en service), le reste en
fichiers statiques depuis `dist/`. Aucun Node.js sur le serveur : le site est construit sur la machine de développement.

## Publier une mise à jour (cas courant)

Depuis la machine de développement, dans le dépôt, code validé dans git :

```bash
bash deploy/publier.sh
```

Pas de sudo. Le script enchaîne :

1. les tests, la vérification des types et la construction ;
2. une archive `releases/calcoolos-<date>-<commit>.tar.gz`, sans configuration ni secret, envoyée sur le Dell ;
3. sur le Dell, avec le `deploy/webdell/mettre-en-service.sh` **de cette archive** :
   - tests de l'API avec le PHP 8.5 du serveur ;
   - sauvegarde de la base, puis migrations ;
   - bascule du lien `current` ;
   - vérification de `/api/etat`, de l'accueil et d'un jeu ;
   - **retour automatique** à la version précédente si la vérification échoue.

Les données des joueurs ne sont jamais touchées par une publication : elles sont dans la base et dans `shared/`,
hors des versions. Cinq versions restent sur le serveur.

Vérification complète après publication (Playwright de la machine, voir `AGENTS.md`) :

```bash
node scripts/verifier-en-ligne.mjs https://calculos.zfx.fr CAPTURES/en-ligne
```

Le script vérifie les 4 jeux sur ordinateur, tablette et téléphone. Il crée un compte de test, joue une partie,
retrouve la progression sur un autre appareil, puis supprime le compte. Il crée un compte réel : la limite de
5 inscriptions par heure s'applique.

Réglages facultatifs de `publier.sh` : `CALCOOLOS_SSH` (défaut `shantee@192.168.1.26`), `CALCOOLOS_DOMAIN`,
`CALCOOLOS_APP`.

## Retour arrière

```bash
ssh shantee@192.168.1.26 bash /home/calculos-zfx-fr/calcoolos/current/deploy/webdell/retour-arriere.sh
```

Le site revient à la version précédente. Relancé une deuxième fois, il revient à la nouvelle. La base garde son
schéma : les migrations ajoutent sans détruire, donc l'ancienne version fonctionne encore.

### Restaurer la base

Dernier recours, si des données ont été abîmées. Chaque mise en service commence par une sauvegarde, et une autre est
faite chaque nuit.

```bash
ssh shantee@192.168.1.26
ls /home/calculos-zfx-fr/calcoolos/backups/
zcat /home/calculos-zfx-fr/calcoolos/backups/calcoolos-AAAAMMJJ-HHMMSS.sql.gz | sudo mariadb calcoolos
```

La sauvegarde Borg du serveur (`webpi-backup`, toutes les 72 h) copie aussi `/home`, donc ce dossier.

## Opérations courantes (sur le Dell, en `shantee`)

| Besoin | Commande |
|---|---|
| Sauvegarde immédiate | `bash /home/calculos-zfx-fr/calcoolos/current/deploy/webdell/sauvegarde.sh` |
| Un parent a oublié son mot de passe (pas d'e-mail pour l'instant) | `CALCOOLOS_ENV_FILE=/home/calculos-zfx-fr/calcoolos/shared/calcoolos.env php8.5 /home/calculos-zfx-fr/calcoolos/current/server/bin/reset-password.php adresse@exemple.fr` |
| Voir les erreurs PHP | `sudo tail /home/calculos-zfx-fr/logs/php/error.log` |
| Voir les erreurs Nginx | `sudo tail /home/calculos-zfx-fr/logs/nginx/error.log` |
| Version en service | `readlink /home/calculos-zfx-fr/calcoolos/current` |

Utiliser `php8.5` : la commande `php` du serveur est la 8.4.

## Installation initiale (déjà faite, à relancer seulement si besoin)

```bash
scp deploy/webdell/installer.sh shantee@192.168.1.26:calcoolos-livraisons/
ssh -t shantee@192.168.1.26 sudo bash calcoolos-livraisons/installer.sh calculos.zfx.fr
bash deploy/publier.sh
```

`installer.sh` se lance une fois, avec sudo. On peut le relancer sans risque : ce qui existe déjà est conservé.

1. Il crée le site avec l'outil maison `webpi-site add`. Cet outil gère CloudPanel, PHP 8.5, la route du tunnel et
   le DNS proxifié, sans Cloudflare Access.
2. Il prépare `calcoolos/` avec des ACL, pour que l'admin `shantee` publie sans sudo.
3. Il crée la base par `clpctl db:add`. Le mot de passe et la clé `APP_SECRET` sont générés sur place, jamais
   affichés.
4. Il remplace le document root par un lien vers `current/dist`.
5. Il ajoute au vhost **de ce site seulement** le bloc `/api/` et les en-têtes de sécurité (CSP, etc.). Il sauvegarde
   d'abord le vhost dans `/root/webpi-backups/calcoolos-<date>/`, lance `nginx -t`, et restaure le vhost si le test
   échoue.
6. Il planifie la sauvegarde quotidienne.

**Si CloudPanel régénère le vhost** (modification du site dans l'interface CloudPanel), le bloc
`# Calcoolos (installer.sh)` disparaît et l'API ne répond plus. Il suffit de relancer `installer.sh`, qui le remet.

**Piège : liens et propriétaires.** Nginx de CloudPanel refuse un lien dont le propriétaire n'est pas celui de sa
cible (`disable_symlinks if_not_owner`). Le lien `htdocs/calculos.zfx.fr`, `current` et les versions appartiennent
donc tous à `shantee`. Si ce n'est pas le cas, le site répond 404.

## Changer de nom de domaine plus tard

Rien dans le code ne dépend du domaine. L'API compare simplement l'origine des requêtes au nom demandé. Le plus
simple est d'ajouter le nouveau domaine au site existant, comme pour smoothsaying.com
(`serveur-dell/2026-10-rattachement-smoothsaying-com/` dans le dossier de travaux) :

1. Ajouter le nouveau nom aux `server_name` des blocs 80/443 et 8080 du vhost `calculos.zfx.fr.conf`. Sauvegarder
   le vhost avant, lancer `nginx -t`, puis recharger Nginx.
2. Ajouter une route au tunnel `webpi` (nouveau nom → `http://localhost:80`) et un CNAME proxifié. Cette étape touche
   **Cloudflare : demander l'accord de Philippe**.
3. Éventuellement, rediriger l'ancien nom vers le nouveau avec une 301 dans le bloc 80.
4. Passer `CALCOOLOS_DOMAIN=nouveau.domaine` à `publier.sh`, ou changer la valeur par défaut dans le script.
5. « Continuer avec Google » : ajouter la nouvelle origine dans la console Google (`doc/GOOGLE.md`).

Les données sont conservées : même base, mêmes dossiers. Le cookie de session est lié au nom de domaine, donc les
familles devront **se reconnecter une fois** sur la nouvelle adresse. La progression des invités est dans leur
navigateur, liée elle aussi au domaine : elle ne suit pas.

## Connexion avec Google

Code publié ; activation en deux temps (console Google par Philippe, puis `sudo bash activer-google.sh <ID client>`
sur le Dell) : tout est dans `doc/GOOGLE.md`. L'identifiant client est dans `shared/calcoolos.env`
(`GOOGLE_CLIENT_ID`), jamais dans le dépôt.

## Sécurité : ce qui est en place

- Mots de passe hachés avec argon2id, connexion à temps constant, nouvel identifiant de session à la connexion.
- Cookie de session `HttpOnly`, `SameSite=Lax` et `Secure`. Aucun cookie pour les invités.
- Protection CSRF : chaque POST doit être en JSON, porter un en-tête propre au site et, une fois connecté, un jeton de
  session. Les POST venant d'une autre origine sont refusés.
- Limites de débit : 8 essais de mot de passe par adresse e-mail en 15 minutes, 5 inscriptions par heure et par
  visiteur, et des résultats de partie espacés. La vraie adresse du visiteur vient de `CF-Connecting-IP`, réglage
  global de CloudPanel. Les adresses IP ne sont gardées que sous forme d'empreinte, pendant 24 heures au plus.
- Requêtes SQL préparées partout. Toutes les entrées sont validées. Les pseudos sont affichés comme du texte, jamais
  comme du HTML.
- En-têtes HTTP : CSP stricte (sans script en ligne ni domaine extérieur), `X-Frame-Options`, `nosniff`,
  `Referrer-Policy` et `Permissions-Policy`. Les pages ont `Cache-Control: no-cache`, les fichiers de `assets/` un
  cache long, et l'API `no-store`.
- PHP du site : `open_basedir` limité à `calcoolos/`, aux logs et à `/tmp`. Le code PHP, `shared/` et les fichiers
  cachés ne sont pas accessibles depuis le web (404). L'utilisateur MariaDB est limité à sa base.

**Limites** :
- La conformité au RGPD n'est pas garantie sans relecture humaine. La page de confidentialité est un brouillon à
  compléter, notamment avec l'identité du responsable du site.
- Il n'y a pas d'envoi d'e-mail : pas de vérification d'adresse ni de mot de passe oublié en libre-service.
- Les scores sont calculés dans le navigateur : le serveur écarte l'invraisemblable, mais ne peut pas empêcher toute
  triche.

## Autre serveur : kit générique

`deploy/premiere-installation.sh`, `release.sh`, `install-release.sh`, `rollback.sh` et `backup.sh` installent
Calcoolos sur un serveur Ubuntu **sans CloudPanel**. Ce kit utilise un utilisateur `calcoolos`, `/srv/calcoolos`, un
pool PHP-FPM dédié, et Nginx en local sur 127.0.0.1:8088 derrière un tunnel. Il a été répété le 24/10/2026 dans un
conteneur Ubuntu 24.04 : 20 vérifications sur 20, retour arrière et restauration testés. Il n'est **pas** utilisé sur
le Dell. Les en-têtes de référence sont dans `deploy/nginx-calcoolos.conf`, que lit `scripts/csp-check.mjs`. Le bloc
de `installer.sh` doit rester identique.
