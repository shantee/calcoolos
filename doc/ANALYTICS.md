# Calcoolos Analytics — mesure d'audience et administration

Première version de l'espace d'administration de Calcoolos (29/10/2026) : fréquentation, joueurs, jeux, temps passé.
Ouverture : **https://tool.zfx.fr/calcoolos/** (tuile « Calcoolos Analytics » du portail), avec la connexion du portail.

## Architecture

```
navigateur (src/platform/suivi.ts)  ──POST /api/suivi──▶  API PHP de Calcoolos (server/src/Suivi.php)  ──▶  MariaDB « calcoolos »
                                                                                                             │
tool.zfx.fr/calcoolos/ (admin/app, module du portail) ──GET 127.0.0.1:8080/api/admin/… + jeton──▶ server/src/Stats.php
```

- Aucun service tiers, aucun nouveau démon, aucune modification de Nginx : le module vit dans le portail existant.
- Les identifiants MariaDB ne quittent pas le site Calcoolos. Le module du portail ne connaît qu'un **jeton**
  (`/home/tool-zfx-fr/portail/calcoolos/config.php`, 640), dont Calcoolos ne garde que l'empreinte SHA-256
  (`/home/calculos-zfx-fr/calcoolos/admin-stats.sha256`, lue par `Config`).
- `/api/admin/*` répond **404** sauf requête GET venue de 127.0.0.1 avec le bon jeton : depuis Internet, même avec le
  jeton, c'est 404 (l'adresse vue par PHP est celle du visiteur, rétablie depuis `CF-Connecting-IP`).
- Le module du portail est appelé par `portail/app/front.php` **après** `authenticate()` (bloc « Calcoolos
  Analytics ») et derrière l'`auth_request` Nginx qui protège tout `tool.zfx.fr` : pages, API et fichiers
  `/assets/calcoolos/` exigent la session du portail. Le portail n'a qu'un utilisateur (Philippe) : toute session
  valide est administratrice.

## Ce qui est mesuré (et ce qui ne l'est pas)

| Donnée | Détail |
|---|---|
| Visiteur | identifiant aléatoire (22 caractères) dans `localStorage['calcoolos.visiteur']` ; estimation : plusieurs appareils ou données effacées = plusieurs visiteurs |
| Visite (session) | identifiant aléatoire partagé entre onglets (`calcoolos.visite`), nouvelle après 30 min sans activité ; page d'arrivée, nombre de pages, appareil, temps actif, niveau choisi, compte créé |
| Partie | du bouton Tranquille/Défi à l'écran de fin (`terminee`) ou au départ de la page (`abandon`, envoyé par `sendBeacon`) ; jeu, niveau, mode, temps actif, victoire, score ; profil s'il est connecté |
| Appareil | ordinateur / tablette / téléphone, déduit de `(pointer: coarse)` et de la petite dimension de l'écran |
| Jamais | cookie (pour un invité), adresse IP, touche, clic, mouvement, position, empreinte de navigateur, e-mail dans l'administration |

**Temps actif** : une seconde compte si la page est visible, qu'un geste (clavier, souris, doigt, molette) a eu lieu
dans la dernière minute, et — pour une partie — que le jeu n'est pas en pause (bouton II de Pluie de météores, du
Dragon et de Décollage !). Un onglet oublié compte au plus une minute. Les durées sont des **cumuls** : le serveur garde
la plus grande valeur, bornée par le temps réellement écoulé depuis le début (+ 45 s), donc un envoi répété, perdu ou
en retard ne fausse rien. Chaque partie a une clé unique : jamais comptée deux fois.

**Fermetures brutales et réseau** : un signal toutes les 30 s pendant l'activité ; à la fermeture, `sendBeacon`. Une
partie sans nouvelles depuis 10 minutes est fermée comme abandonnée (avec le temps reçu jusque-là). Une fin arrivée
sans son début reconstitue la partie.

**Navigateurs pilotés** (Playwright, `navigator.webdriver`) : non comptés, pour que les vérifications automatiques
(`verifier-en-ligne.mjs`…) ne gonflent pas les chiffres. Exception : `localStorage['calcoolos.suivi-test'] = '1'`
(utilisé par `scripts/analytics-e2e.mjs`).

## Tables (migration `004_suivi.php`)

- `visites`, `parties` : détail, effacé après `SUIVI_CONSERVATION_JOURS` (défaut 400, minimum 30 ; réglable dans
  `shared/calcoolos.env`) ; avant d'effacer, `suivi_bilans` garde les totaux par jour et par jeu.
- `suivi_journal` : envois reçus / refusés par jour (page Santé).
- `resultats.partie_cle` : relie le résultat d'un profil à sa partie mesurée.
- Suppression d'un compte : ses parties mesurées sont effacées, ses visites deviennent anonymes.
- L'entretien (parties perdues, conservation) tourne à chaque ouverture de l'administration et, au hasard, une fois
  sur 400 envois : pas de tâche planifiée à installer.

## Données anciennes

Avant la mesure (installée le 29/10/2026 à 13 h 56), seule la table `resultats` existe : parties **terminées** des **profils
connectés**, avec la durée annoncée par le jeu (pauses comprises). L'administration les compte comme « historique »
(parties terminées, temps de jeu, fiches des joueurs, records) ; elle n'invente ni visites, ni invités, ni parties
commencées ou abandonnées pour cette période, et l'écrit dans un bandeau.

## Indicateurs

- **Jeu préféré** : indice 0–100 = temps joué 30 % + joueurs 20 % + parties par joueur 20 % + part de joueurs revenus un
  autre jour 20 % + part de parties menées au bout 10 %, chaque signal rapporté au meilleur des quatre jeux. Fiabilité
  affichée (faible < 10 parties, moyenne < 30).
- **Fidélisation** : joueurs (profils ou navigateurs invités) dont la première partie tombe dans la période ; retour le
  lendemain et sous 7 jours comptés seulement si le délai est écoulé.
- **Entonnoir** : sessions → niveau choisi (ou jeu lancé directement) → jeu lancé → partie terminée → compte créé.
- **Actif maintenant** : signe de vie depuis moins de 2 minutes.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/platform/suivi.ts` | collecte dans le navigateur (`demarrerSuivi`, `partieCommence`, `partieTerminee`, `partiePause`, `etapeParcours`) |
| `server/src/Suivi.php` | réception, contrôles, idempotence, entretien et conservation |
| `server/src/Stats.php` | tous les calculs de l'administration |
| `server/src/Api.php` | routes `POST /suivi` et `GET /admin/{resume,joueurs,joueur,historique,direct,sante}` |
| `admin/app/front.php`, `vue.php` | module du portail : page et relais vers l'API (paramètres filtrés, lecture seule) |
| `admin/assets/` | `app.js` (interface, ECharts 6.1 copié depuis `node_modules` au déploiement), `app.css`, `icone.svg` (pixel art) |
| `admin/deployer.sh` | déploiement sans sudo (voir plus bas) |
| `scripts/analytics-e2e.mjs` | test de bout en bout (vraies parties dans les quatre jeux, abandon, pause, profil) |

## Déployer

1. Calcoolos (collecte + API) : `bash deploy/publier.sh` (comme d'habitude ; la migration 004 est appliquée après
   sauvegarde de la base).
2. Module : `bash admin/deployer.sh` (sans sudo). Il copie le module, crée le jeton une seule fois **sur le Dell**,
   ajoute le bloc au routeur du portail et la tuile (copies de sauvegarde dans `~/portail-backups/` sur le Dell), puis
   vérifie : API locale avec jeton 200, sans jeton 404, depuis Internet 404, pages et API du module redirigées vers la
   connexion sans session.

Retirer le module : restaurer `front.php` et `tools.json` depuis `~/portail-backups/calcoolos-analytics-<date>/`,
supprimer `portail/calcoolos/` et `htdocs/tool.zfx.fr/assets/calcoolos/`, puis `admin-stats.sha256` (l'API admin
redevient 404). La collecte côté Calcoolos est indépendante.

## Banc d'essai local

```bash
npm run build && bash admin/deployer.sh --preparer        # admin/build/ (assets, avatars, ECharts)
# API avec un jeton de banc, base SQLite séparée
podman run -d --name calcoolos-api-banc --network host -v "$PWD":/app:z -w /app -e VAR_DIR=/app/server/var/banc \
  -e ADMIN_TOKEN_SHA256=$(printf 'jeton-du-banc' | sha256sum | cut -d' ' -f1) docker.io/library/php:8.3-cli \
  php -S 127.0.0.1:8080 server/public/index.php
# portail simulé (admin/build/banc-routeur.php + config.php avec 'jeton' => 'jeton-du-banc')
podman run -d --name calcoolos-portail-banc --network host -v "$PWD/admin/build":/banc:z -w /banc \
  docker.io/library/php:8.3-cli php -S 127.0.0.1:8099 -t /banc/banc-docroot /banc/banc-routeur.php
npm run dev
node scripts/analytics-e2e.mjs http://127.0.0.1:5173 http://127.0.0.1:8099
```

## Limites connues

- Visiteurs distincts = navigateurs : estimation (plusieurs appareils, navigation privée, données effacées).
- Le temps actif d'un jeu piloté seulement au regard (lecture d'un calcul sans toucher à rien pendant plus d'une
  minute) n'est plus compté au-delà d'une minute ; c'est voulu (onglet oublié).
- Un abandon par fermeture brutale du navigateur (sans `pagehide`) n'est connu qu'au bout de 10 minutes.
- Les jours affichés sont ceux de l'heure de Paris ; les jours anciens résumés (bilans) sont en jours UTC.
- Le portail n'a qu'un compte : pas de rôles plus fins pour l'instant.
