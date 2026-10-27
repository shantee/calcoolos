# AGENTS.md — reprendre le projet Calcoolos

Ce fichier s'adresse à un agent de code (Claude Code, Codex…) ou à un développeur qui reprend le projet. Il résume
**l'idée, la philosophie, les règles, l'état réel et les pièges connus**. Lis-le en entier avant de toucher au code,
puis `JOURNAL_PROJET.md` (historique détaillé, session par session) et `doc/ARCHITECTURE.md` (règles de chaque jeu).

Dernière mise à jour : 27/10/2026 (session 15 : Décollage ! en couleurs de calculs, 8 cœurs et demi-cœurs ; session 14 : avatars).

---

## 1. L'idée en une phrase

Une plateforme web **francophone** de mini-jeux de **calcul mental** pour les 7-12 ans (agréable aussi pour les ados
et les adultes), où **le calcul est l'action du jeu** : on additionne des cubes pour tirer sur un monstre, on tape un
résultat pour faire exploser un météore, on fait manger des lanternes à un dragon, on fait décoller une fusée. Jamais un
simple questionnaire.

Nom affiché : **Calcoolos** (provisoire, nom de travail d'origine « Projet Archipel »). Il n'est écrit qu'à un endroit :
`brand.json`. Le cahier des charges d'origine est dans `doc/archipel_*` (mega-prompt, vision, mode d'emploi).

## 2. Philosophie (ce qui compte pour Philippe, le porteur du projet)

- **Beau, vivant, drôle avant tout.** Philippe a demandé à plusieurs reprises « plus d'effets, plus de petits détails
  marrants » : habitants cliquables, animaux, clins d'œil d'un jeu à l'autre (le canard perdu de Pluie de météores
  réapparaît dans Décollage !), explosions en plusieurs temps, feux d'artifice, musiques, fêtes de victoire,
  défaites rigolotes (les monstres dansent, le dragon tombe à l'eau). Un nouveau jeu doit être **au moins aussi
  soigné** que les précédents.
- **Arcade et addictif, mais au service du calcul.** Réfléchir fait progresser ; bien jouer permet de rester en vie.
- **Pas d'indices qui font le calcul à la place de l'enfant.** Exemple : la somme en cours n'est jamais affichée dans
  Cubes de siège (« 6 + 5 = ? »), le total du ventre du dragon non plus. En cas d'erreur, on peut montrer la bonne
  réponse **après coup** (on apprend en se trompant), jamais avant.
- **Une erreur coûte peu** (la série, un peu de temps), jamais une humiliation. Deux modes partout : **Tranquille**
  (rien à perdre, plus lent) et **Défi** (cœurs, chrono).
- **Aide en deux phrases** sur l'accueil et dans l'écran de début de chaque jeu.
- **Tout est fait maison dans les jeux** : aucun fichier image ni son importé. Les visuels sont dessinés par code
  (Canvas 2D ou PixelForge), les sons et musiques sont synthétisés en direct (Web Audio). **Exception voulue par
  Philippe : les quatre illustrations de l'accueil** (chantier 01) **et les 49 avatars des profils** (27/10/2026),
  fournis par lui (`ART_ASSETS.md`).
- **Protection des enfants, vie privée par défaut** : aucun cookie pour un invité, profils enfants avec pseudo seulement,
  classements publics sous ce **pseudo** (simplification voulue par Philippe le 27/10/2026, plus d'autorisation ni de
  nom inventé ; « Aide-moi à trouver un pseudo » en propose des rigolos), export et suppression des données.
- **Honnêteté** : on ne dit pas qu'une chose marche sans l'avoir vue marcher dans un vrai navigateur ; on écrit les
  limites (sons jamais écoutés par un humain, tests en GPU logiciel, etc.).
- **Communication avec Philippe** : en français simple, sans jargon, en disant ce qui marche, comment le voir, les
  limites et la suite. Il aime voir des captures et un aperçu jouable.

## 3. Règles impératives (à respecter sans exception)

1. **Le serveur Dell héberge d'autres sites** : ne rien y perturber. Publier une nouvelle version avec
   `bash deploy/publier.sh` (sans sudo, retour automatique en cas d'échec) quand Philippe le demande. Toute autre
   intervention sur le serveur qui pourrait toucher un autre site ou un service partagé, et tout changement de
   **Cloudflare**, du **DNS** ou du **tunnel**, se fait **avec son accord explicite**. Jamais de protection d'accès
   (Cloudflare Access, mot de passe général, filtrage IP) à l'entrée du site : il doit rester ouvert à tous.
2. **Aucun secret dans le dépôt** : pas de mot de passe, pas de clé. Les modèles `.env.example` sont vides ; les
   secrets de production sont générés sur le serveur (`deploy/webdell/installer.sh`) et y restent.
3. Le dépôt GitHub est `shantee/calcoolos`. Branche de travail : `dev` (fusionnée dans `main`). Commits en français,
   compréhensibles, petits paliers ; ne pas réécrire l'historique publié.
4. Tout ce qui est visible par l'utilisateur est **écrit en français** (interface, docs, commentaires du code). Le
   français est la version de référence ; l'anglais et l'allemand sont des traductions posées par-dessus
   (`src/i18n/`, voir § 8 bis), qu'on n'est **pas obligé** de tenir à jour (souhait de Philippe, 26/10/2026).
   **Depuis le 27/10/2026 : on travaille en français uniquement** : ne plus tester en anglais ni en allemand, ne
   pas traduire les nouveaux textes (ils restent en français dans les autres langues) ; on y reviendra plus tard.
5. Ne pas créer d'écrans factices : une fonctionnalité annoncée doit marcher dans le navigateur, ou être signalée
   comme non faite.

## 4. État réel au 25/10/2026

| Élément | État |
|---|---|
| Socle (Vite + TypeScript + Phaser 4.2.1), accueil, niveaux | fait |
| Direction artistique | B « 2D illustrée gouache nocturne » retenue (prototypes A et B supprimés le 26/10/2026, visibles dans l'historique git et `CAPTURES/`) |
| Jeu 1 **Cubes de siège** | fait, validé par Philippe ; **bonus volants** (Super Poussée, Gel, Méga-tir) ajoutés en session 8 |
| Jeu 2 **Pluie de météores** | fait (grande passe d'effets) |
| Jeu 3 **Le Dragon gourmand** | fait |
| Jeu 4 **Décollage !** (pixel art, idée de Philippe) | fait — **dernier jeu prévu pour le moment** |
| Plateforme (invité, espace famille, profils, progrès, classements, succès) | faite, API PHP + MariaDB |
| Accueil (chantier 01) | refait : 4 grandes vitrines illustrées, une par jeu, boutons lecture au survol ; en ligne |
| Accueil (chantier 02, 26/10/2026) | logo animé « qui calcule de tête », espace joueur dans la barre, carnet (avantages du compte ou vrais progrès), choix du niveau en cartes + fenêtre au premier « Jouer » + rappel près de chaque « Jouer » ; en ligne |
| « Continuer avec Google » (26/10/2026) | code publié (Google Identity Services, jeton vérifié en PHP, `comptes.google_sub`, association à un compte existant) ; **bouton masqué tant que l'ID client n'est pas configuré** : étapes dans `doc/GOOGLE.md` |
| Mise en ligne | **faite le 25/10/2026** : https://calculos.zfx.fr (site CloudPanel du Dell, MariaDB, tunnel Cloudflare) ; guide `doc/DEPLOIEMENT.md` |
| Plein écran + PWA légère | boutons Accueil / Plein écran dans les 4 jeux (`src/game/plein-ecran.ts`), manifeste et icônes, sans service worker |
| Page de confidentialité | brouillon, à faire relire (identité du responsable, hébergement) |
| Langues (26/10/2026) | drapeaux 🇬🇧 🇩🇪 🇫🇷 tout à droite de la barre, détection de la langue du navigateur ; anglais et allemand traduits une fois (pages, 4 jeux, messages du serveur), sauf la page de confidentialité |

Tests : 127 tests TypeScript (Vitest, dont 7 pour les langues, 7 pour le niveau, 3 pour les avatars et 6 pour les couleurs de calculs), 126 vérifications d'API PHP (SQLite et MariaDB 11.8, dont la vérification des jetons Google), parcours complet de la
plateforme dans Chromium (21 vérifications), parcours de l'accueil (`scripts/accueil-e2e.mjs`, 68 vérifications), « Continuer avec Google » avec un Google imité (`scripts/google-e2e.mjs`, 33), parties gagnées et perdues jouées automatiquement pour chaque jeu,
vérification de la CSP sur toutes les pages. En ligne : parcours de la plateforme (20/20) et
`scripts/verifier-en-ligne.mjs` (24/24 : quatre jeux sur ordinateur, tablette et téléphone, reconnexion sur un autre
appareil).

Aperçu jouable (jeux seulement, mode invité, pas de PHP) : page privée claude.ai
https://claude.ai/artifact/JnagX1RcsW7yWbMBi3VQWh (reconstruite à la main depuis `dist/`, voir § 10).

## 5. Lancer, tester, construire

Prérequis : Node 20+ (testé 22), PHP 8.2+ avec `pdo_sqlite` (dev) / `pdo_mysql` (prod) et `mbstring`.

```bash
npm install
npm run api          # API PHP sur 127.0.0.1:8080 (SQLite créé tout seul dans server/var/)
npm run dev          # http://localhost:5173 ; Vite relaie /api vers 8080
npm test             # Vitest
npm run test:api     # tests de l'API (SQLite en mémoire)
TEST_DB_DSN='mysql:unix_socket=/run/mysqld/mysqld.sock;dbname=calcoolos_test;charset=utf8mb4' TEST_DB_USER=root npm run test:api
npm run typecheck
npm run build        # dist/ (statique) ; npm run preview -> :4173
```

Scripts Playwright (Playwright n'est pas une dépendance du projet : on utilise celui de la machine, par exemple
`NODE_PATH=/usr/local/lib/node_modules_global node scripts/…`) :

| Script | Rôle |
|---|---|
| `scripts/partie-auto.mjs` | Cubes de siège, partie gagnée ou perdue + captures |
| `scripts/bonus-auto.mjs` | bonus volants : chaque bonus, clavier et doigt, échec, niches pleines, partie naturelle (`SEUL1=1` : rapide) |
| `scripts/plein-ecran-auto.mjs` | plein écran et boutons des 4 jeux sur 6 formats |
| `scripts/test-un-seul-monstre.mjs` | non-régression : jamais deux monstres à la fois |
| `scripts/meteores-auto.mjs` | Pluie de météores, gagner / perdre |
| `scripts/dragon-auto.mjs` | Dragon gourmand, gagner / perdre (le dragon vole vraiment vers les lanternes) |
| `scripts/fusee-auto.mjs` | Décollage !, gagner / perdre (pilote automatique) |
| `scripts/plateforme-e2e.mjs` | parcours complet invité → compte → profils → partie → progrès → classements → isolation |
| `scripts/accueil-e2e.mjs` | accueil (chantier 02) : logo, espace joueur, niveau, 4 jeux au bon niveau, inscription, profils, formats, langues, animations réduites |
| `scripts/google-e2e.mjs` | « Continuer avec Google » (script de Google imité, jetons de test) : création, reconnexion, annulation, jeton refusé, compte existant puis association, tablette, Google injoignable |
| `scripts/verifier-en-ligne.mjs` | après une publication : 4 jeux × 3 appareils, compte, reconnexion, nettoyage |
| `scripts/csp-check.mjs` | sert `dist/` avec les en-têtes de `deploy/nginx-calcoolos.conf` et cherche les violations |

PHP absent du poste Fedora : lancer l'API dans un conteneur, `podman run --rm --name calcoolos-api-dev --network host
-v "$PWD":/app:z -w /app docker.io/library/php:8.3-cli php -S 127.0.0.1:8080 server/public/index.php` (et de même
`php server/tests/run.php`). Toujours `:z` (partagé) et non `:Z` : un second conteneur en `:Z` réétiquette le dossier
et le premier perd l'accès (« Permission denied »). Pour `google-e2e.mjs`, ajouter
`-e GOOGLE_CLIENT_ID=123-test.apps.googleusercontent.com -e GOOGLE_CERTS_FILE=/app/server/var/google-test-certs.json`
(le script écrit ce fichier de clés de test ; ignoré en production).

Chromium headless : lancer avec `--use-angle=swiftshader --enable-unsafe-swiftshader`. Les captures vont dans
`CAPTURES/` (à regarder vraiment : plusieurs bugs n'ont été vus que sur les captures).

Paramètres d'URL des jeux : `?niveau=eveil|explorateur|stratege|maitre`, `?graine=123`, `?calme` (animations
réduites), `?accelere=N`, `?textures=N`. Chaque jeu expose des crochets de test sur `window` : `__siege`,
`__meteores`, `__dragon`, `__fusee` (démarrer, répondre, nourrir, piloter, état…).

## 6. Carte du code

```
brand.json                 nom, slogan (seul endroit à modifier pour renommer)
index.html                 accueil : ouverture (logo, table de lancement « Qui joue ? » + niveau, vignettes), carnet
                           (compte), une vitrine par jeu, fenêtre <dialog> du premier niveau
src/images/accueil/        illustrations de l'accueil en WebP (480, 800, 1448) ; originaux dans sources-images/
src/images/avatars/        49 avatars WebP 128 × 128 découpés dans sources-images/avatars/grille-avatars.png
compte.html tableau.html classements.html confidentialite.html   pages de la plateforme
jeu/*.html                 une page par jeu
src/core/                  logique pure partagée : rng (mulberry32), puzzle (somme minimale, sac à dos),
                           scoring, difficulty (4 paliers), adaptive, waves, expressions (calculs par palier),
                           calc-grade (calcul vert / orange / rouge selon le niveau)
src/game/siege/            Cubes de siège : round.ts, session.ts (logique), game-scene.ts (Phaser)
src/game/meteors/          Pluie de météores : session.ts, meteor-scene.ts
src/game/dragon/           Le Dragon gourmand : session.ts, dragon-scene.ts
src/game/rocket/           Décollage ! : session.ts, rocket-scene.ts
src/game/sfx.ts            tous les sons + 3 musiques jouées en direct (pistes 'espace', 'dragon', 'fusee')
src/game/fx.ts             feu d'artifice et confettis (style B)
src/game/render-config.ts  maxTextures (voir pièges)
src/art/variant-b.ts       palette et outils de dessin du style B ; world-b.ts (archipel), space.ts, dragon.ts
src/art/pixelforge.ts      outil maison de pixel art (rampes, tramage Bayer, contour, chiffres 7×10)
src/art/pixel-rocket.ts    tout le pixel art de Décollage ! + police pixel des nombres
src/platform/              api.ts, player.ts (joueur actif), results.ts (envoi/file d'attente), stats.ts (tableau
                           de bord, testé), avatars.ts, topbar.ts (barre + espace joueur), logo.ts (logo animé),
                           google.ts (bouton « Continuer avec Google »),
                           niveau.ts (règle du niveau, fiches des niveaux, testé), dom.ts (construction DOM sans innerHTML)
src/styles/                accueil.css (accueil, aussi chargé par les autres pages), plateforme.css (barre, cartes,
                           formulaires), logo.css (chargé par topbar.ts, donc APRÈS les deux autres), game.css
src/entries/               point d'entrée de chaque page (chacun importe d'abord ../i18n/page, et ../i18n/phaser pour un jeu)
src/i18n/                  langue.ts (détection, choix), drapeaux.ts (sélecteur), traduire.ts (t()), page.ts (DOM),
                           phaser.ts (textes des jeux), en.ts et de.ts (dictionnaires « texte français → traduction »)
tests/                     Vitest
server/                    API PHP sans Composer : src/{Api,Games,Db,Http,Session,Config,Google}.php, migrations/,
                           bin/{migrate,reset-password}.php, tests/run.php, public/index.php
deploy/                    Nginx, pool PHP-FPM, scripts d'installation, mise en service, retour arrière, sauvegarde
doc/                       cahier des charges, ARCHITECTURE, DIRECTION_ARTISTIQUE, IDEES_JEUX, DEPLOIEMENT
CAPTURES/                  vraies captures d'écran
JOURNAL_PROJET.md          historique de toutes les sessions (à compléter à chaque session)
ART_ASSETS.md              inventaire des ressources et licences
```

**Schéma de chaque jeu** (à suivre pour tout nouveau jeu) : une **logique pure** sans Phaser dans `session.ts`
(déterministe avec graine, testée dans `tests/`, y compris un « pilote automatique » qui gagne), et une **scène**
Phaser qui ne fait que montrer et animer. La scène, en fin de partie, appelle `reportResult()` avec le format commun
(jeu, niveau, mode, score, gagne, etoiles, duree, precision, ops `{op: [justes, ratés]}`, details) et affiche
`outcomeText()`. Puis brancher le jeu dans : `vite.config.ts` (input), `index.html` (vitrine + illustration + aide en 2-3 phrases),
`GameId` (`src/platform/results.ts`), `GAME_NAMES` et succès (`src/platform/stats.ts`), `Games::CATALOG`
(`server/src/Games.php`, bornes de vraisemblance), `scripts/csp-check.mjs`, docs.

## 7. Les quatre jeux (résumé ; détails et réglages dans `doc/ARCHITECTURE.md`)

- **Cubes de siège** (style B) : un monstre approche du phare avec un nombre ; on choisit des cubes dont la somme fait
  exactement ce nombre ; moins de cubes = tir plus fort (« Parfait ! »). Énigme toujours soluble (programmation
  dynamique), grille rééquilibrée, 4 vagues, boss, difficulté adaptative, phare qui s'écroule en défaite, fête de
  victoire avec fanfare originale. Plus tard (souhait de Philippe) : variante multiplications.
- **Pluie de météores** (style B, espace) : météores et robots portent un calcul ; on tape le résultat, le vaisseau tire
  dès que la saisie correspond (aucune réponse à l'écran n'est le préfixe d'une autre). Météore doré, Robot-Mère,
  pilote robot à 4 visages, verrouillage, mode « en feu », baleine, chat astronaute, canard bonus.
- **Le Dragon gourmand** (style B, ciel du soir) : on guide un dragon (souris, doigt, flèches) qui avale des lanternes
  pour faire exactement un nombre (additions ; multiplications en Stratège/Maître) ; le total n'est jamais affiché ;
  trop mangé = hoquet. Objectif toujours atteignable, jamais coincé après une bouchée. Trois ciels (chauves-souris,
  orage), souffle de feu, écailles d'or.
- **Décollage !** (pixel art ×4) : un calcul chronométré est toujours affiché, dans un encadré vert, orange ou rouge
  selon sa difficulté pour le niveau (`src/core/calc-grade.ts`) ; plus il est dur, plus il donne de temps et de
  points ; en Défi, 8 cœurs, un calcul raté coûte ½ cœur (1 si vert) ; bonne réponse = poussée ; on pilote la fusée pour se poser sur des plateformes, du village à la
  planète Bonbon (5 étages). Plateformes mobiles et fragiles (qui se reforment), bonus, étoiles, montgolfière de
  secours. Chaque plateforme est à portée d'une poussée (testé sur 200 mondes).

Paliers (`src/core/difficulty.ts`) : Éveil 7-8 ans, Explorateur 9-10, Stratège 11-12, Maître ados/adultes.
Menus de calculs : `src/core/expressions.ts` (jamais de division avec reste, jamais de négatif).

## 8. Plateforme et serveur (résumé ; détails dans `doc/ARCHITECTURE.md` et `doc/DEPLOIEMENT.md`)

- **Invité** : tout dans `localStorage` (`calcoolos.*`), aucun cookie, aucune requête obligatoire.
- **Compte adulte** (e-mail + mot de passe argon2id, ou « Continuer avec Google » : même compte, `doc/GOOGLE.md`) → jusqu'à 6 **profils** (pseudo, avatar, niveau). Le joueur actif
  est retenu dans le navigateur ; le serveur vérifie à chaque fois que le profil appartient au compte (sinon 404).
- **Résultats** : forme vérifiée (sinon 422) puis vraisemblance (sinon gardé « non vérifié », hors classements) ;
  débit limité. Hors ligne : file d'attente renvoyée depuis l'accueil.
- **Classements** par jeu × niveau × mode : tous les profils, sous leur pseudo, scores vérifiés seulement ;
  classement familial privé. Les colonnes `profils.classement_public` et `nom_public` restent en base mais ne
  servent plus (27/10/2026). Pseudos proposés : `src/platform/pseudos.ts`.
- **Sécurité** : session PHP créée seulement à la connexion (cookie HttpOnly, SameSite=Lax, Secure en prod) ; CSRF par
  en-tête `X-Calcoolos` + JSON obligatoire + jeton de session + vérification de l'origine ; limites d'essais ; IP
  gardées en empreinte 24 h ; SQL préparé ; CSP stricte.
- **Production** (https://calculos.zfx.fr) : site CloudPanel `calculos-zfx-fr` sur le Dell (PHP-FPM 8.5, MariaDB
  11.8, tunnel Cloudflare `webpi`), versions dans `/home/calculos-zfx-fr/calcoolos/releases/`, lien `current`,
  sauvegarde avant chaque migration et chaque nuit. Publier : `bash deploy/publier.sh` ; revenir en arrière :
  `deploy/webdell/retour-arriere.sh`. Tout est dans `doc/DEPLOIEMENT.md`.

## 8 bis. Langues (anglais, allemand)

- **Principe** : le code reste écrit en français, sans clés de traduction. `t('Rejouer')` renvoie la traduction si le
  dictionnaire de la langue courante la connaît, sinon le texte français. Changer ou ajouter un texte français ne casse
  donc rien : il apparaît en français dans les autres langues tant qu'on ne l'a pas ajouté à `en.ts` / `de.ts`.
- **Sans toucher au code des pages et des jeux** : `src/i18n/page.ts` traduit le HTML au chargement puis tout ce que le
  code ajoute (MutationObserver : textes, `alt`, `title`, `aria-label`, `placeholder`) ; `src/i18n/phaser.ts` fait
  passer chaque `Text.setText` de Phaser par `t()`. Seuls les textes qui ne vont ni dans le DOM ni dans Phaser
  appellent `t()` directement : graphiques ECharts (`tableau.ts`), `window.confirm` (`compte.ts`). En français, rien
  de tout cela ne s'active.
- **Modèles** : une clé avec `{}` (morceau sans lettres : nombre, étoiles) ou `{*}` (n'importe quel texte, traduit à
  son tour) couvre les textes construits : `'Vague {} / {}'`, `'Niveau {*} · {*}'`. Ne pas mettre `{*}` dans une clé
  courte (« {*} sur {*} » avalerait toute phrase contenant « sur »). Les textes à plusieurs lignes, ou coupés par
  « · » ou trois espaces, sont traduits morceau par morceau.
- **Choix de la langue** : `localStorage['calcoolos.langue']`, sinon `navigator.languages` (fr, de, en), sinon
  anglais. Un clic sur un drapeau enregistre et recharge la page. Les pseudos proposés
  et la page de confidentialité restent en français.
- **Oublis** : `window.__tradManquantes` (console) liste les textes restés en français sur la page.
- **Largeur** : l'allemand est plus long ; les textes des jeux ont été vérifiés sur captures (début, partie, fin des
  4 jeux). Pour un nouveau texte, préférer une traduction courte plutôt que de toucher la mise en page.

## 9. Pièges connus (déjà rencontrés, ne pas retomber dedans)

- **SwiftShader / Phaser 4** : au-delà de 2 textures par lot, Phaser mélangeait les textures → `maxTextures: 1`
  (`src/game/render-config.ts`, retester sur vrai GPU avec `?textures=16`).
- **Texture manquante** = carré sombre barré dans le jeu : toujours créer la texture via `tx(key, make)` avant usage.
- **Pixelify Sans** : le 5 ressemble à un S (inacceptable pour un jeu de calcul) → nombres en police pixel maison
  (`numberFont()`, RetroFont). Elle n'a pas de ligature « fi »/« fl » (« Défi » devenait « DéA ») → `noLigature()`.
- **RetroFont dans Phaser 4** : `RetroFont.Parse` renvoie directement l'entrée `{data, texture, frame}` à mettre en cache.
- **Police à chasse fixe** : ne pas espacer les lettres d'un nombre (on lisait « 2 8 ») ; un texte par jeton.
- **Vite** : `assetsInlineLimit: 0` est obligatoire (les petites polices passaient en `data:` et la CSP les bloquait).
  Le relais `/api` doit garder l'en-tête Host (`changeOrigin: false`), sinon l'API refuse les POST (origine).
- **Rechargement à chaud** : modifier un fichier pendant une partie automatique sur `npm run dev` recharge la page et
  casse le script. Pour les longues parties automatiques, construire puis utiliser `vite preview`.
- **Claviers AZERTY** : lire les chiffres avec `e.code` (`Digit1`, `Numpad1`), pas `e.key`.
- **Pixelify Sans dans les pages web aussi** : ses chiffres se confondent (« 9 + 9 » lu « g + g ») ; sur l'accueil,
  elle ne sert qu'aux surtitres sans chiffres, les nombres utilisent `.pixel-nombre`.
- **Niveau de l'accueil** : quatre boutons radio `input[name="niveau"]` (plus de `<select id="niveau">`) ; Playwright
  doit cliquer la case elle-même (`page.click('input[value="stratege"]')`), l'étiquette est couverte par la case.
  Un nouveau venu n'a **aucun** niveau coché : son premier clic sur « Jouer » ouvre la fenêtre `#choix-niveau` au lieu
  de lancer le jeu. Un script qui part d'un navigateur neuf doit d'abord cocher un niveau (ou choisir dans la fenêtre).
- **Espace joueur** : `.joueur` est un bouton qui ouvre `#panneau-joueur` (plus un lien). Le panneau contient lui
  aussi « Se déconnecter » : dans l'espace parents, viser `#contenu button`.
- **Logo** : `logo.css` est chargé après `plateforme.css` ; une règle de la barre qui change le logo doit être plus
  précise (`.barre .logo-barre`). Les images clés WAAPI ne lisent pas les variables CSS : l'inclinaison des lettres
  est portée par leurs pseudo-éléments, les animations ne touchent qu'au déplacement de la lettre.
- **Clavier Phaser** : quand une image est lente, la file d'événements peut être relue deux fois ; dédoublonner
  (voir le gestionnaire des chiffres de Cubes de siège) toute touche qui compte.
- **Plein écran** : seulement juste après un geste ; au doigt, Chrome ne reconnaît le geste qu'au lever du doigt.
- **Ne pas faire `pkill -f motif`** si le motif apparaît dans la commande en cours (le shell se tue lui-même).
- **Tweens Phaser** : `killTweensOf` peut annuler un callback important (bug des météores fantômes) ; les actions de
  jeu ne doivent pas dépendre de la fin d'une animation décorative.
- **Sessions PHP sur Ubuntu** : dossier de sessions propre à l'appli (le nettoyage Debian utilise la durée de vie du
  php.ini global).
- **Derrière Cloudflare** : `real_ip_header CF-Connecting-IP` est indispensable pour les limites d'essais (réglage
  global de CloudPanel sur le Dell).
- **Nginx de CloudPanel et les liens** (`disable_symlinks if_not_owner`) : un lien doit appartenir au même
  propriétaire que sa cible, sinon 404. Le lien du document root, `current` et les versions appartiennent à `shantee`.
- **Sur le Dell, `php` est la 8.4** : utiliser `php8.5` (celle du site) pour les outils en ligne de commande.
- **Vhost régénéré par CloudPanel** : le bloc `# Calcoolos (installer.sh)` (API et en-têtes) disparaît ; relancer
  `deploy/webdell/installer.sh` (sudo), qui le remet sans toucher au reste.
- **Avatars** : la liste de `src/platform/avatars.ts` est recopiée dans `Api::AVATARS` (même ordre, vérifié par
  `tests/avatars.test.ts`). Retirer un avatar = l'enlever des deux listes + une migration qui convertit les profils
  qui l'avaient. Un identifiant inconnu s'affiche comme l'avatar par défaut (`astronaute`).
- **Langue des scripts Playwright** : sans `locale`, Chromium se déclare en anglais et le site passe en anglais.
  Tous les scripts de `scripts/` ouvrent leur page avec `locale: 'fr-FR'` (les vérifications lisent des textes
  français) : garder ce réglage dans tout nouveau script.
- **Google** : le script de Google n'est chargé que sur `compte.html`, seule page dont la CSP l'autorise
  (`location = /compte.html` dans le vhost, posée par `activer-google.sh`, sudo). Une page qui voudrait le bouton
  ailleurs doit recevoir la même règle. `csp-check.mjs` lancé avec une API qui annonce un faux ID client signale
  « [GSI_LOGGER]: The given client ID is not found » : c'est Google qui répond, pas une violation.
  Jamais de rattachement d'un compte Google à un compte existant par la seule adresse e-mail.
- **Tests en ligne** : le résultat d'une partie n'est envoyé qu'à l'affichage de l'écran de fin ; un script qui
  quitte la page avant ne laisse aucune trace. Limite de 5 inscriptions par heure : ne pas relancer en boucle
  `verifier-en-ligne.mjs`, qui crée (puis supprime) un compte.

## 10. Méthode de travail qui a bien marché

1. Logique pure + tests (dont un pilote automatique qui gagne) avant la scène.
2. Planche de sprites (`scratchpad/planche-*.cjs` : dessine les canvas dans une page et fait une capture) pour juger
   le dessin avant de l'intégrer.
3. Scène, puis **partie automatique avec captures**, puis **regarder les captures** et corriger (lisibilité,
   chevauchements, effets qui masquent l'essentiel).
4. `npm test`, `npm run test:api`, `npm run typecheck`, `npm run build`, `scripts/csp-check.mjs`.
5. Mettre à jour `JOURNAL_PROJET.md` (nouvelle section datée : demande, fait, limites), `README.md`,
   `doc/ARCHITECTURE.md`, `ART_ASSETS.md`, `doc/IDEES_JEUX.md` si besoin ; commit ; push.
6. Aperçu claude.ai (si disponible) : copier `dist/assets`, `dist/jeu` dans un dossier avec la page
   lanceur `calcoolos-apercu.html` (pas d'`index.html` dans les fichiers) et republier sur la même adresse.

## 11. Ce qui reste à faire (par priorité)

0. **À reprendre en premier (arrêt du 26/10/2026 au soir) : activer « Continuer avec Google ».** Le code est
   publié (`4a17d26`, migration `002_google.php` appliquée) ; le bouton reste caché tant que rien n'est configuré.
   1. ~~Console Google~~ **fait le 27/10/2026** (compte philippe25@gmail.com) : projet `calcoolos`, application
      « Calcoolos » publiée (Externe, sans logo pour éviter la vérification), domaine `zfx.fr`, client Web
      « Calcoolos site web » (origines `https://calculos.zfx.fr`, `http://localhost:5173`, `http://localhost`).
      ID client (public) : `82220296605-2srbvkp5bs0rr17uri95da6tagbj6tgo.apps.googleusercontent.com`.
   2. Philippe lance (sudo, il tape son mot de passe) :
      `ssh -t shantee@192.168.1.26 'sudo bash /home/calculos-zfx-fr/calcoolos/current/deploy/webdell/activer-google.sh <ID>'`
      (sauvegarde, `nginx -t`, retour arrière automatique ; annulation : `--desactiver`).
   3. L'agent vérifie en ligne : `/api/etat` annonce `googleClientId` ; en-têtes CSP de `/compte.html` contiennent
      `accounts.google.com/gsi/client` ; `node scripts/verifier-en-ligne.mjs` toujours 24/24 ; le bouton s'affiche
      sur ordinateur et téléphone, sans erreur de console.
   4. Essai réel **avec Philippe** (c'est lui qui clique dans la fenêtre Google) : création d'un compte neuf,
      déconnexion puis reconnexion, annulation de la fenêtre (aucune erreur), puis association à un compte
      existant (connexion par mot de passe → « Se connecter plus vite ») et vérification que profils et scores
      sont conservés. Supprimer ensuite les comptes d'essai.
   5. Si tout va bien : statut « terminé — à confirmer » dans `JOURNAL_PROJET.md` (session 12) et dans la ligne
      de `../INDEX.md` (n'indexer que cette ligne). En cas de souci : message exact de la console du navigateur et
      `doc/GOOGLE.md` § vérification.
1. Retours de Philippe sur le site en ligne (essai sur un vrai téléphone et une vraie tablette).
2. Faire **relire la page de confidentialité** (identité du responsable, lieu d'hébergement) ; ne pas prétendre à la
   conformité RGPD sans audit humain.
3. Retours de Philippe sur le Dragon gourmand et Décollage ! (sons et musiques jamais écoutés par un humain).
4. Étape E (finition) : accessibilité (navigation clavier dans tous les menus, contrastes), téléphone (pavé et terrain
   petits ; Décollage ! demande deux mains), performance sur appareils modestes, essai sur un vrai GPU.
5. Envoi d'e-mails (vérification d'adresse, mot de passe oublié) : aujourd'hui, outil d'administration
   `server/bin/reset-password.php`.
6. Niveaux plus fins (huit paliers dans les quatre mondes) : étudié en session 10, liste de ce qu'il faut toucher
   dans `JOURNAL_PROJET.md` ; reprise de l'historique invité à la création d'un compte.
7. Idées notées : Cubes de siège en multiplications ; autres jeux dans `doc/IDEES_JEUX.md` (Philippe a dit que
   Décollage ! était le dernier jeu « pour le moment »).
