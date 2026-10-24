# Installer Calcoolos sur le serveur Dell (Ubuntu)

> **Rien n'a été installé sur le serveur.** Ce guide et les scripts de `deploy/` sont prêts ; c'est Philippe qui
> décide quand les lancer. **Aucune modification de Cloudflare, du DNS ou du tunnel** n'est faite par ces scripts :
> ce dernier branchement se fait à la main, après accord.

## Répétition générale déjà faite (24/10/2026)

Toute la procédure ci-dessous a été jouée dans un conteneur Ubuntu 24.04 neuf (pas sur le Dell) :
Nginx 1.24, PHP-FPM 8.3, MariaDB 10.11.

- `premiere-installation.sh`, puis `install-release.sh` : site en service sur `127.0.0.1:8088`, avec la configuration
  de production (`APP_ENV=prod`, cookie `Secure`).
- Parcours complet dans Chromium sur cette installation : 20 vérifications sur 20 (`scripts/plateforme-e2e.mjs`).
  Le parcours va de l'invité au compte, aux profils, à une partie enregistrée, au tableau de bord et aux classements,
  et vérifie que deux familles restent séparées.
- Deuxième version installée, puis retour arrière (`rollback.sh`) : la version précédente reprend la main.
- Sauvegarde restaurée dans une base vierge : les données sont bien là.
- Ni le code PHP ni les fichiers cachés ne sont accessibles depuis le web (404 et 403).

La répétition a trouvé et corrigé un défaut : l'empreinte de l'archive n'était pas vérifiable une fois copiée ailleurs.

Différences avec le Dell, à garder en tête :
- le conteneur n'avait pas systemd : `systemctl reload` y était simulé ;
- le conteneur n'avait pas d'IPv6 : le site par défaut de Nginx a été désactivé là-bas seulement (sur le Dell, les
  autres sites ne sont pas touchés) ;
- le tunnel Cloudflare n'a pas été simulé.

## Ce qui sera installé

```
/srv/calcoolos/
  releases/<version>/      une version : dist/ (site statique), server/ (API PHP), deploy/ (scripts)
  current -> releases/…    lien vers la version en service (bascule instantanée)
  previous                 version précédente (pour le retour arrière)
/etc/calcoolos/calcoolos.env    configuration et secrets (root:calcoolos, 640), générés sur le serveur
/var/lib/calcoolos/sessions     sessions PHP (utilisateur calcoolos, 700)
/var/log/calcoolos/             erreurs PHP
/var/backups/calcoolos/         sauvegardes quotidiennes de la base (14 jours)
/etc/php/8.3/fpm/pool.d/calcoolos.conf     pool PHP-FPM dédié (utilisateur calcoolos)
/etc/nginx/sites-available/calcoolos       site Nginx, écoute 127.0.0.1:8088 seulement
/etc/cron.d/calcoolos                      sauvegarde quotidienne à 3 h 17
```

Aucun Node.js sur le serveur : le site est construit sur la machine de développement.

## Prérequis sur le Dell

```bash
sudo apt install nginx php8.3-fpm php8.3-mysql php8.3-mbstring mariadb-server openssl curl
```

Ces paquets sont probablement déjà là, puisque d'autres sites PHP tournent sur le serveur. Le script de préparation
vérifie qu'ils sont tous présents avant de commencer.

## 1. Préparer une version (machine de développement)

```bash
bash deploy/release.sh
```

Le script lance les tests, construit le site et produit `releases/calcoolos-<version>.tar.gz` avec son empreinte
`.sha256`. Il refuse de livrer du code non validé dans git. Copier les deux fichiers sur le serveur (par exemple avec
`scp`).

## 2. Préparer le serveur (une seule fois)

```bash
tar -xzf calcoolos-<version>.tar.gz deploy        # récupère les scripts
sudo bash deploy/premiere-installation.sh calcoolos.mon-domaine.fr
```

Ce script :
- crée l'utilisateur système `calcoolos`, sans connexion possible, et ses dossiers ;
- crée la base `calcoolos` et un utilisateur MariaDB limité à cette base, en local seulement ;
- génère sur place le mot de passe de la base et la clé `APP_SECRET`, et les range dans `/etc/calcoolos/calcoolos.env`.
  Ils ne sont jamais affichés et jamais dans le dépôt ;
- installe le pool PHP-FPM dédié, avec `open_basedir`, les fonctions système désactivées et 6 processus au plus ;
- installe le site Nginx, qui n'écoute qu'en local, puis vérifie les configurations (`php-fpm8.3 -t`, `nginx -t`)
  avant de recharger ;
- planifie la sauvegarde quotidienne.

Il peut être relancé sans risque : une configuration existante est conservée.

## 3. Mettre une version en service

```bash
sudo bash deploy/install-release.sh calcoolos-<version>.tar.gz
```

Le script enchaîne : vérification de l'empreinte, décompression dans `releases/`, **sauvegarde de la base**,
migrations, bascule du lien `current`, rechargement de PHP-FPM, puis test de `/api/etat`. Si une étape échoue avant la
bascule, la version en service ne change pas.

Test local sur le serveur : `curl http://127.0.0.1:8088/api/etat` doit répondre `{"connecte":false}`.

## 4. Brancher le nom de domaine (après accord de Philippe seulement)

Le site écoute sur `http://127.0.0.1:8088`. Dans la configuration du tunnel Cloudflare existant, il faudra ajouter une
règle « nom de domaine → `http://127.0.0.1:8088` ». **Cette étape n'est pas scriptée et ne doit pas être faite sans
accord.**

Points à vérifier à ce moment-là :
- HTTPS côté Cloudflare : le cookie de session est marqué `Secure` (`COOKIE_SECURE=1`) ;
- Nginx lit la vraie adresse du visiteur dans `CF-Connecting-IP` : c'est nécessaire pour que la limite d'essais de mot
  de passe vise le bon visiteur. Ce réglage n'est sûr que parce que Nginx n'écoute qu'en local ;
- ne pas mettre en cache `/api/` côté Cloudflare.

## Retour arrière

```bash
sudo bash /srv/calcoolos/current/deploy/rollback.sh
```

Le lien `current` revient à la version précédente. La base garde son schéma : les migrations de Calcoolos ajoutent
sans détruire, donc l'ancienne version fonctionne encore. Testé lors de la répétition.

### Restaurer la base

Dernier recours, si des données ont été abîmées. Chaque mise en service fait d'abord une sauvegarde.

```bash
ls /var/backups/calcoolos/
zcat /var/backups/calcoolos/calcoolos-AAAAMMJJ-HHMMSS.sql.gz | sudo mariadb calcoolos
```

## Opérations courantes

| Besoin | Commande |
|---|---|
| Sauvegarde immédiate | `sudo bash /srv/calcoolos/current/deploy/backup.sh` |
| Un parent a oublié son mot de passe (pas d'e-mail pour l'instant) | `sudo -u calcoolos CALCOOLOS_ENV_FILE=/etc/calcoolos/calcoolos.env php /srv/calcoolos/current/server/bin/reset-password.php adresse@exemple.fr` |
| Voir les erreurs PHP | `sudo tail /var/log/calcoolos/php-error.log` |
| Voir les erreurs Nginx | `sudo tail /var/log/nginx/calcoolos-error.log` |
| Faire de la place | supprimer d'anciens dossiers dans `/srv/calcoolos/releases/`, sauf `current` et `previous` |

## Sécurité : ce qui est en place

- Mots de passe hachés avec argon2id, connexion à temps constant, nouvel identifiant de session à la connexion.
- Cookie de session `HttpOnly`, `SameSite=Lax` et `Secure` en HTTPS. Aucun cookie pour les invités.
- Protection CSRF : chaque POST doit être en JSON, porter un en-tête propre au site et, une fois connecté, un jeton de
  session. Les POST venant d'une autre origine sont refusés.
- Limites de débit : 8 essais de mot de passe par adresse e-mail en 15 minutes, 5 inscriptions par heure et par
  visiteur, et des résultats de partie espacés. Les adresses IP ne sont gardées que sous forme d'empreinte, pendant
  24 heures au plus.
- Requêtes SQL préparées partout. Toutes les entrées sont validées. Les pseudos sont affichés comme du texte, jamais
  comme du HTML.
- En-têtes HTTP : CSP stricte, sans script en ligne ni domaine extérieur, `X-Frame-Options`, `nosniff`,
  `Referrer-Policy` et `Permissions-Policy`. `scripts/csp-check.mjs` vérifie que toutes les pages et les trois jeux
  fonctionnent avec ces en-têtes.
- Pool PHP isolé (utilisateur dédié, `open_basedir`, fonctions système désactivées) et utilisateur MariaDB limité à sa
  base.

**Limites** : la conformité au RGPD n'est pas garantie sans relecture humaine. La page de confidentialité est un
brouillon à compléter, notamment avec l'identité du responsable du site. Il n'y a pas d'envoi d'e-mail : pas de
vérification d'adresse ni de mot de passe oublié en libre-service. Les scores des jeux sont calculés dans le
navigateur : le serveur écarte l'invraisemblable, mais ne peut pas empêcher toute triche.
