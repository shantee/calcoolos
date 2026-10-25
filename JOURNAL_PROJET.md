# Journal du projet

## État actuel

| Étape | Statut |
|---|---|
| A. Initialisation (socle, scripts, accueil minimal) | fait |
| B. Direction artistique (2 variantes + captures) | fait : **B (2D illustrée) retenue** par Philippe |
| C. Jeu complet « Cubes de siège » | fait : jouable de bout en bout, victoire et défaite testées dans le navigateur |
| Deuxième jeu « Pluie de météores » | fait : jouable de bout en bout, victoire et défaite testées |
| Troisième jeu « Le Dragon gourmand » | fait : jouable de bout en bout, victoire et défaite testées |
| Quatrième jeu « Décollage ! » (pixel art, idée de Philippe) | fait : jouable de bout en bout, testé dans Chromium |
| D. Plateforme (invité, comptes, profils, sauvegardes) | fait : API PHP + MariaDB, parcours complet testé, comptes isolés |
| Chantier 01 : refonte de l'accueil | fait, avec boutons lecture sur les illustrations |
| Mise en ligne | **faite le 25/10/2026** : https://calculos.zfx.fr (Dell, CloudPanel) ; publier : `bash deploy/publier.sh` |
| E. Finition | à faire : vrais téléphones et tablettes, accessibilité, page de confidentialité |

## Rappels pour Philippe

- **Réglage d'effort « high » :** Philippe a demandé qu'on le lui rappelle au bon moment. **C'est maintenant** (fin de
  l'étape C, rappel fait le 24/10/2026) : la direction est choisie et le jeu complet est jouable ; la suite est de la
  finition graphique et de nouveaux jeux. Cela consomme plus de crédit.
- Accès GitHub en écriture rétabli par Philippe le 24/10/2026 ; branche `dev` poussée.
- Aperçu jouable sans installation : page privée claude.ai https://claude.ai/artifact/JnagX1RcsW7yWbMBi3VQWh
  (les jeux seulement, en mode invité : l'aperçu n'a pas de serveur PHP).
- **Site en ligne** : https://calculos.zfx.fr. Reste à faire relire la page de confidentialité (identité du
  responsable, hébergement). Publication et retour arrière : `doc/DEPLOIEMENT.md`.

## 2026-10-25 : Claude, session 7, suite (mise en ligne sur le serveur Dell)

**Demande de Philippe** : installer Calcoolos sur le Dell à l'adresse https://calculos.zfx.fr. Il faut utiliser
l'existant (CloudPanel, Nginx, PHP-FPM, MariaDB, tunnel Cloudflare, outil `webpi-site`), sans conteneur ni nouveau
service et **sans aucune protection d'accès**. Le site complet doit tourner (4 jeux, API, base dédiée, comptes,
progrès, classements), avec une mise à jour en une commande qui garde les données et permet le retour arrière. Il
faut prévoir un futur changement de domaine et ne perturber aucun autre site.

**Fait**
- Nouveaux scripts dans `deploy/webdell/` (le kit générique de `deploy/` reste pour un serveur sans CloudPanel) :
  - `installer.sh` (sudo, une fois) : `webpi-site add calculos.zfx.fr` (site CloudPanel PHP 8.5, route du tunnel, DNS
    proxifié), base `calcoolos` par `clpctl`, secrets générés sur place, document root → lien vers `current/dist`,
    bloc `/api/` et en-têtes de sécurité ajoutés au seul vhost de ce site (sauvegarde, `nginx -t`, restauration
    automatique), cron de sauvegarde quotidienne ;
  - `mettre-en-service.sh` : tests de l'API avec PHP 8.5 du serveur, sauvegarde, migrations, bascule atomique,
    vérification, retour automatique ;
  - `retour-arriere.sh`, `sauvegarde.sh`.
- `deploy/publier.sh` : publication en une commande depuis le poste, sans sudo.
- `server/src/Session.php` : réglages `session.sid_*` appliqués seulement avant PHP 8.4 (dépréciés en 8.5 et
  signalés dans le journal d'erreurs).
- `scripts/verifier-en-ligne.mjs` : vérification après publication. Il lance les 4 jeux sur ordinateur, tablette et
  téléphone (tactile), joue et gagne une partie avec un compte de test, retrouve la progression après reconnexion sur
  un autre appareil, ouvre le tableau de bord et les classements, puis supprime le compte.
- Doc : `doc/DEPLOIEMENT.md` réécrit pour le Dell (publication, retour arrière, restauration, opérations courantes,
  changement de domaine), `AGENTS.md`, `README.md`.

**Problèmes rencontrés et corrigés**
- Le test de connexion de l'installateur passait en `root` : le `~/.my.cnf` de root l'emportait sur
  `--defaults-extra-file`. Corrigé avec `--defaults-file`, aussi dans la sauvegarde.
- Première publication en 404. Nginx de CloudPanel (`disable_symlinks if_not_owner`) refuse un lien dont le
  propriétaire diffère de celui de sa cible. Le lien du document root appartient maintenant à `shantee`.
- Le retour automatique de cette première publication avait fait pointer `current` sur lui-même (`readlink -f` d'un
  chemin absent). La détection de la version précédente est corrigée et le retour arrière a été testé dans les deux
  sens.

**Vérifications (sur le site public, en HTTPS)**
- `scripts/plateforme-e2e.mjs` : 20/20. Couvre l'invité sans cookie, l'inscription, les profils, une partie enregistrée
  et vérifiée dans MariaDB, le tableau de bord, les classements, l'isolation entre familles, l'export et la déconnexion.
- `scripts/verifier-en-ligne.mjs` : 24/24, aucune erreur de console. Le cookie est `Secure` + `HttpOnly` +
  `SameSite=Lax`. Captures (WebP) dans `CAPTURES/dell-production/`.
- En-têtes : CSP et `no-cache` sur les pages, cache long sur `assets/`, `no-store` sur l'API. `server/`, `shared/`,
  `.env` et fichiers cachés donnent 404. Aucun autre site touché : seul le vhost de calculos.zfx.fr a été modifié.
- Comptes de test supprimés : la base de production est vide.

**Limites honnêtes**
- Pas essayé sur un vrai téléphone ni une vraie tablette, seulement en émulation dans Chromium. Sons jamais écoutés.
- Les réponses de l'API portent deux fois `Cache-Control` et `nosniff` (PHP et Nginx). C'est sans effet, mais à
  nettoyer un jour.
- Une régénération du vhost par CloudPanel efface le bloc `/api/`. Il faut alors relancer `installer.sh`.
- Page de confidentialité toujours à faire relire.

## 2026-10-25 : Claude, session 7 (chantier 01 : refonte de l'accueil)

**Demande de Philippe** (zip « Chantier 01 », cahier des charges copié dans `doc/CHANTIER_01_ACCUEIL.md`) : refaire
l'accueil avec un effet « wow » maîtrisé ; les quatre jeux présentés **un par un, verticalement**, chacun avec une grande
illustration (quatre images fournies), 2-3 phrases et un bouton « Jouer » ; faire sentir qu'il y a d'autres jeux plus
bas ; ne toucher ni aux jeux ni à la plateforme ; ne rien déployer.

**Fait**
- Projet repris en local par Claude Code (poste Fedora de Philippe) ; branche `refonte-accueil` créée depuis `main`
  (= `dev`).
- `index.html` réécrit : **ouverture** (titre, accroche, phrase d'intro, « Qui joue ? », niveau en 4 boutons radio,
  lien « Explore les 4 jeux », mosaïque des 4 illustrations qui mène à chaque jeu), puis **4 vitrines** (image 4:3
  encadrée, numéro « 01 / 04 », lieu, titre, aide, exemple de calcul décoratif, « Jouer », commandes du jeu), puis un
  encadré **Pour les parents** (invité sans cookie, espace famille, confidentialité, prototypes).
- Grand écran : image et texte côte à côte, en alternance gauche/droite. Téléphone : une colonne, image d'abord ;
  la mosaïque remonte sous le titre pour que les 4 jeux soient visibles dès le premier écran.
- Effets retenus (`src/entries/accueil.ts`) : le fond change doucement de couleur selon le jeu lu (nuit marine,
  violet, prune, bleu) ; apparition des vitrines au défilement ; illustration qui suit légèrement la souris ;
  bouton « Jouer » légèrement attiré par le curseur ; vignettes qui « respirent » ; repère de progression (4 traits) sur
  le bord droit des grands écrans. Tout est coupé avec « réduire les animations » ou `?calme` (transmis aux jeux).
- Ancien décor (îles, étoiles en SVG) retiré, comme demandé (« pas d'accumulation d'étoiles ni d'îles »).
- Images : originaux PNG gardés dans `sources-images/accueil/`, versions WebP 480/800/1448 (`cwebp -q 80`, 23 à
  116 Ko) servies avec `srcset`/`sizes`, dimensions explicites, chargement différé sauf la première ; images non
  recadrées (le 4:3 d'origine tient partout, rien de l'action n'est coupé). Les 4 anciennes propositions ne sont pas
  utilisées.
- `scripts/plateforme-e2e.mjs` adapté au niveau en boutons radio ; `scripts/csp-check.mjs` sert le `.webp` et vérifie
  que toutes les illustrations de l'accueil se chargent.

**Vérifications**
- `npm run typecheck` OK, `npm test` 82/82, `npm run build` OK, `scripts/csp-check.mjs` : aucune violation sur les
  9 pages, toutes les images chargées.
- Chrome (Playwright) à 1440×900, 1280×720, 768×1024, 390×844, 360×740 : aucun débordement horizontal, aucun texte ni
  bouton coupé. Niveau retenu après rechargement et transmis aux 4 liens, flèches du clavier dans le choix du niveau,
  lien d'évitement en premier Tab, focus visible, clic « Jouer » → bon jeu avec le bon niveau, `?calme` et mouvement
  réduit vérifiés. Captures dans `CAPTURES/accueil-refonte/`.
- Corrigé après lecture des captures : grand vide sous l'ouverture, police pixel en capitales peu lisible, « 9 + 9 »
  lu « g + g » en Pixelify (défaut déjà présent dans l'ancien accueil), mosaïque invisible au premier écran sur
  téléphone, marges trop grandes sur téléphone.

**Limites honnêtes**
- PHP absent du poste : `npm run test:api` et `scripts/plateforme-e2e.mjs` **non lancés** ; « Qui joue ? » (compte
  connecté) n'a donc pas été vu à l'écran, seulement conservé tel quel dans le code.
- Pas d'AVIF (l'outil local ne l'encode pas ; le WebP suffit). Pas testé sur un vrai téléphone, ni Firefox/Safari.

**Suite de la session (demandes de Philippe)**
- Les quatre illustrations sont des créations de Philippe (noté dans `ART_ASSETS.md`).
- **Bouton lecture sur les illustrations** : au survol, voile léger et bouton rond en verre dépoli qui apparaît avec un
  petit rebond, onde lumineuse qui s'en échappe, bouton safran quand on le vise ; un clic n'importe où sur l'image
  lance le jeu (même lien et même niveau que « Jouer »). Calque `a.lancer` posé sur l'image : l'image garde sa
  description pour les lecteurs d'écran, le calque est ignoré au clavier (le bouton « Jouer » suffit). Écran tactile :
  bouton toujours visible, plus petit. Vérifié dans Chrome (survol, clic au centre et dans un coin, toucher simulé) ;
  typecheck, 82 tests, build et CSP OK. `scripts/plateforme-e2e.mjs` vise désormais `a.jouer[data-jeu]` (deux liens
  par jeu).

## 2026-10-25 : Claude, session 6 (quatrième jeu « Décollage ! »)

**Demande de Philippe** : un jeu de pur calcul mental en pixel art, plein de petits détails marrants : les calculs
restent peu de temps (moins pour les faciles), chaque bonne réponse propulse une fusée qu'il faut piloter pour se poser
sur des plateformes ; un monde vertical à explorer (village, nuages habités, espace) jusqu'à une planète ; bonus sur
les plateformes. Dernier jeu pour le moment.

**Fait**
- **Décollage !** (`jeu/decollage.html`) : logique pure testée (`src/game/rocket/session.ts`, 13 tests dont un
  pilote automatique qui atteint la planète dans 80 mondes avec une seule poussée par plateforme), scène pixel art,
  musique chiptune et sons dédiés.
- Le temps dépend du calcul (2 à 3 s pour 4 + 3, davantage pour 7 × 8 ou 56 ÷ 8), plus long en Tranquille, un peu
  plus court en altitude ; en haut, des calculs du niveau suivant s'invitent. En cas d'erreur, la bonne réponse
  s'affiche.
- Cinq étages : le village (maisons, moulin, vache qui meugle, enfants, cerf-volant), la mer de nuages (habitants
  nuageux, moutons, arc-en-ciel), le ciel des dirigeables (château du roi des nuages, dirigeable), l'espace (satellite,
  soucoupe, lune qui fait un clin d'œil, astronaute, le canard perdu de Pluie de météores), la planète Bonbon
  (sucettes, maisons en guimauve, oursons qui dansent à l'arrivée).
- Plateformes en terre, en nuage, planches tenues par des ballons, métal ; mobiles à hélice, fragiles qui s'effritent ;
  habitants qui saluent quand on se pose ; bonus bouclier, sablier, turbo, étoile, cœur ; étoiles à attraper en vol.
- Chute : une montgolfière de secours ramène la fusée au bout d'une corde (Défi : −1 cœur, sauf bouclier).
- Police pixel des nombres dessinée pour le jeu : avec la police pixel habituelle, le 5 ressemblait à un S.
- Chiffres du clavier acceptés sans Maj sur un clavier AZERTY (aussi dans Pluie de météores).
- Plateforme : résultats, classements, tableau de bord et succès (« Astronaute ») connaissent le nouveau jeu.

**Limites** : sons et musique non écoutés par un humain ; sur téléphone, piloter et taper en même temps demande deux
mains (boutons à gauche, pavé à droite).

## 2026-10-24 : Claude, session 5 (troisième jeu, étape D, kit de déploiement)

**Demande de Philippe** : un troisième jeu arcade, qui fasse réfléchir et soit addictif, avec des effets graphiques
soignés ; puis attaquer l'installation sur le serveur : comptes, base de données, statistiques, classements.

**Fait**
- **Le Dragon gourmand** (`jeu/dragon-gourmand.html`) : on guide un dragon-lanterne (souris, doigt ou flèches) qui
  avale des lanternes numérotées pour faire **exactement** le nombre demandé ; les lanternes avalées brillent dans son
  corps (total jamais affiché). Additions, et multiplications aux niveaux Stratège et Maître (« 24 = 3 × 8 »).
  - Réussi : le ventre s'illumine, souffle de feu, écaille d'or qui allonge le dragon ; coup parfait (le moins de
    lanternes possible) : couronne de feu, feu d'artifice, clin d'œil de la lune.
  - Trop mangé : hoquet, trombone triste, les lanternes sont recrachées.
  - Trois ciels : crépuscule, nuit (chauves-souris rouges à crocs, que le feu transforme en petites chauves-souris
    roussies et gentilles), orage (nuages grognons qui se chargent avant l'éclair, pluie).
  - Mode « dragon doré » à partir d'une série de 4, lucioles qui suivent le dragon, gâteau de lune bonus, escargot en
    montgolfière, lune endormie qui ronfle, phare de Cubes de siège sur son île, poissons volants, étoiles filantes,
    aurore boréale à la victoire ; défaite : le dragon pique dans la mer et sa tête flotte, étourdie.
  - Musique pentatonique originale (3 intensités), sons dédiés (croc, glouglou mélodieux, souffle, hoquet, tonnerre).
  - Garanties testées : objectif toujours atteignable, jamais coincé après une bouchée (12 tests).
- **Plateforme (étape D)** :
  - API PHP sans dépendance (`server/`) : comptes adultes, profils privés (pseudo, avatar, niveau), résultats,
    classements, export et suppression ; MariaDB en production, SQLite en développement ;
  - pages : accueil « Qui joue ? », espace parents, mes progrès (graphiques ECharts, records, succès), classements,
    confidentialité ;
  - les trois jeux envoient leur résultat (profil actif → serveur ; invité → navigateur ; hors ligne → file
    d'attente) ; Cubes de siège donne maintenant aussi 1 à 3 étoiles ;
  - protection des mineurs : profils privés par défaut, classement public seulement sur autorisation de l'adulte et
    sous un nom inventé (« Dragon Futé 42 »), jamais le pseudo ni l'e-mail ; aucun cookie pour les invités ;
  - contrôle des scores : forme vérifiée (sinon refus), vraisemblance vérifiée (sinon « non classé ») ;
  - tests : 83 vérifications d'API (SQLite et MariaDB 10.11), parcours complet dans Chromium (20 vérifications).
- **Kit de déploiement (`deploy/`, guide `doc/DEPLOIEMENT.md`)** : préparation du serveur, mise en service avec
  sauvegarde et migrations, retour arrière, sauvegardes quotidiennes, Nginx avec CSP stricte, pool PHP-FPM isolé.
  **Répétition générale dans un conteneur Ubuntu** (Nginx + PHP-FPM + MariaDB) : installation, parcours complet,
  deuxième version, retour arrière, restauration d'une sauvegarde — tout fonctionne. Rien n'a été installé sur le Dell,
  rien n'a été changé chez Cloudflare.

**Limites** : sons et musique du dragon non écoutés par un humain ; pas d'envoi d'e-mail (pas de mot de passe oublié en
libre-service : outil d'administration à la place) ; page de confidentialité à faire relire ; l'aperçu claude.ai ne
contient que les jeux (pas de serveur PHP).

## 2026-10-24 : Claude, session 4 (Pluie de météores, effort « high »)

**Demande de Philippe** : rendre Pluie de météores (« le jeu avec la fusée ») plus beau et plus agréable :
effets visuels plus développés, petits détails marrants, créativité libre.

**Fait**
- **Le pilote** : un petit robot dans la bulle du vaisseau, dont le visage change (content quand on touche,
  inquiet quand un météore approche, « oups » quand on se trompe) ; cliquer sur le vaisseau le fait sourire.
- **Verrouillage** : dès que la saisie commence comme la réponse d'un ennemi, un viseur tournant le verrouille et
  il prend peur (grands yeux, sueur) ; les robots s'écrient « Au secours ! », et narguent parfois (« Trop lent ! »).
- **Danger** : un « ! » rouge clignote sur les calculs presque arrivés, un halo rouge borde l'écran, bip d'alerte.
- **Explosions en plusieurs temps** : éclair, boule de feu, fumée, éclats, braises, onde, à-coup de caméra ; les
  robots perdent boulons, ressorts et engrenages (« boing ») ; le météore doré lâche une pluie de pièces qui volent
  jusqu'au score.
- **Mode « EN FEU ! »** à partir d'une série de 8 : laser doré, aura d'étincelles, étoiles qui défilent plus vite,
  musique plus rythmée.
- **Musique** : boucle chiptune originale jouée en direct (3 intensités : calme, en feu, boss), coupée avec le son.
- **Vaisseau** : gaz du réacteur, inclinaison vers la cible, recul au tir, toux de fumée en cas d'erreur.
- **Décor vivant** : nébuleuses qui respirent, planète annelée, étoiles filantes, **baleine cosmique** qui traverse
  le ciel et chante si on la touche, **chat astronaute** attaché à l'antenne par un câble (miaou et pirouette),
  **deux petits robots** sur la station (sautent de joie aux séries de 5, paniquent aux impacts), **canard en
  plastique** perdu dans l'espace (l'attraper rapporte 100 points) ; fissures sur le bouclier.
- **Boss** : alerte rouge, « Rendez-vous, humains ! », panique quand il ne lui reste qu'un calcul, puis chapelet
  d'explosions et dislocation en quatre morceaux.
- **Fin** : 1 à 3 étoiles (victoire ; 85 % de calculs justes ; sans faute ni impact), qui tombent une à une ;
  la baleine passe en chantant pendant la fête de victoire.
- **Pause** (bouton, Échap ou P) qui fige toute la scène.
- Captures : `CAPTURES/meteores-*.png`, planche des personnages `CAPTURES/espace-personnages.png`.

**Limites** : sons et musique jamais écoutés par un humain ; testé seulement dans Chromium avec GPU logiciel ; le
verrouillage montre quels ennemis commencent par le chiffre tapé (aide légère, à retirer si Philippe la juge trop
généreuse).

## 2026-10-24 : Claude, session 3 (finitions et deuxième jeu)

**Retours de Philippe** : Cubes de siège validé. Bug d'un boss superposé à un autre monstre ; effet plus
impressionnant pour les coups parfaits (explosion rouge-rose, feu d'artifice) ; animation et musique de victoire
« comme à la fin d'un jeu de plateforme » ; puis d'autres jeux d'arcade (robots, vaisseaux spatiaux). Les
multiplications dans Cubes de siège : plus tard.

**Fait**
- Bug corrigé : un tir en vol pendant qu'un monstre atteignait le phare (mode Défi) faisait apparaître un second
  monstre. Le monstre s'arrête pendant le tir et un garde empêche tout doublon ; test de non-régression
  `scripts/test-un-seul-monstre.mjs` (tirs au moment critique, jamais plus d'un monstre).
- Coup parfait : tampon « PARFAIT ! » et feu d'artifice rouge, rose et or (plus de fusées avec la série), qui ne
  masque jamais la pancarte ; dégâts affichés à côté du monstre.
- Victoire : fanfare composée pour le jeu (mélodie originale, pas celle d'un jeu existant), faisceau du phare,
  feu d'artifice, confettis, cubes qui sautent en vague, chouette et escargot qui dansent, puis l'écran de fin.
- Feu d'artifice et confettis regroupés dans `src/game/fx.ts`, partagé par les deux jeux.
- **Pluie de météores** (`jeu/pluie-de-meteores.html`) :
  - météores rouges à crocs, robots ennemis en zigzag, météore doré (onde de choc qui détruit tout l'écran),
    boss « Robot-Mère » à 6 calculs ;
  - on tape la réponse sur le pavé à l'écran ou au clavier ; le vaisseau tire dès que la saisie correspond à une
    réponse, sans touche Entrée ; une saisie impossible est une erreur (combo cassé) ;
  - deux réponses à l'écran ne peuvent jamais être le début l'une de l'autre (pas de 3 et de 36 en même temps) ;
  - opérations selon le niveau : additions et soustractions (Éveil), tables de 2, 5 et 10 (Explorateur), toutes
    les tables et divisions (Stratège), tables jusqu'à 12 (Maître) ;
  - modes Tranquille (chute lente, le bouclier tient) et Défi (3 boucliers) ; victoire avec boucle du vaisseau et
    feu d'artifice ; défaite avec explosion de la station et robots qui dansent ;
  - logique pure testée (15 tests) ; partie gagnée et perdue jouées automatiquement (`scripts/meteores-auto.mjs`).
- Bug trouvé en route : des tirs rapprochés laissaient des météores détruits à l'écran ; corrigé (le tir ne dépend
  plus de l'animation du vaisseau, et un filet de sécurité fait exploser tout météore mort encore affiché).
- Accueil : les deux jeux côte à côte, chacun avec son aide en deux phrases.
- 49 tests unitaires.

**Limites** : toujours testé seulement dans Chromium avec un GPU logiciel ; sons non écoutés par un humain ; sur
téléphone, le pavé numérique et le terrain sont petits (pensé pour ordinateur et tablette).

**Prochaines étapes proposées** : retours de Philippe sur Pluie de météores ; troisième jeu (recommandation :
Astéroïdes en morceaux, voir `doc/IDEES_JEUX.md`) ; multiplications dans Cubes de siège ; étape D (comptes).

## 2026-10-24 : Claude, session 2 (étape C)

**Retours de Philippe**
- Direction B retenue, avec plus de petits détails rigolos (comme l'escargot de A).
- Moins d'indices : ne plus afficher « il reste 1 ».
- Un écran d'aide en deux phrases à l'accueil qui explique qu'il faut additionner.
- Monstres plus effrayants (rouges, grandes dents), beaucoup d'effets (pierres, poussière, phare qui s'écroule ou
  explose en cas de défaite, monstres qui dansent), sons rigolos, mignons ou rétro.
- Plus tard : multiplications, et d'autres jeux plus « arcade » avec de l'action (voir `doc/IDEES_JEUX.md`).

**Fait**
- Jeu complet `jeu/cubes-de-siege.html` (`src/game/siege/game-scene.ts`) :
  - écran de début : règle en deux phrases, choix Tranquille (lent, le phare ne craint rien) ou Défi (rapide,
    3 cœurs) ;
  - 4 vagues : Mordillon, Trotte-menu (rapide, 1 coup), Carapaçon (lent, blindé : seuls les coups parfaits font
    pleinement mal), Roi Mordillon (boss) ;
  - écran de fin : score, monstres vaincus, coups parfaits, calculs justes, meilleure série, temps habituel, record
    local par niveau et par mode.
- Plus d'indice sur la somme : le calcul s'affiche « 6 + 5 = ? » ; une erreur dit seulement « Ce n'est pas 14 ».
- Monstres redessinés : rouges, crocs, yeux jaunes fendus, cornes, piquants (`CAPTURES/monstres.png`).
- Phare touché : pierres qui tombent et rebondissent, poussière, fissures, secousse ; défaite : le phare tremble,
  explose en morceaux, laisse des gravats, la chouette s'envole, et les monstres dansent en ricanant (« Ha ha ha ! »).
- Petits habitants cliquables : escargot (se cache, aussi quand un monstre approche), chouette (cligne, regarde le
  monstre, tourne la tête, saute aux coups parfaits), lune (dort, clin d'œil aux coups parfaits, rougit), poisson
  volant.
- Sons ajoutés : grognement, « aïe » rétro, pièce, chouette, plop, bloup, clochette, éboulement, effondrement,
  ricanement, ritournelle de danse, fanfare de vague, victoire.
- Difficulté adaptative prudente et testée ; grille qui ne s'appauvrit plus en petits nombres (doublons limités,
  remplacement rééquilibré).
- Accueil : aide en deux phrases avec exemple `9 + 9 = 18`, bouton « Jouer », prototypes en lien discret.
- `scripts/partie-auto.mjs` : joue une partie gagnée ou perdue entière dans Chromium, avec captures.
- 34 tests unitaires.

**Limites**
- Testé dans Chromium avec un GPU logiciel uniquement ; pas encore sur une vraie tablette ou un vrai téléphone.
- Sons jamais écoutés par un humain.
- Le bonus de vitesse du mode Défi existe, mais il n'est pas encore expliqué au joueur.
- Pas de multiplication, pas de comptes (étape D).

**Prochaines étapes proposées**
- Philippe essaie le jeu et donne ses retours ; passer en effort « high » pour la finition graphique.
- Choisir le prochain jeu (`doc/IDEES_JEUX.md`, recommandation : Pluie de météores) et/ou la variante ×.
- Étape D : comptes, profils, sauvegardes (API PHP + MariaDB).

## 2026-10-24 : Claude, session 1 (étapes A et B)

**Décisions**
- Documents d'origine rangés dans `doc/` (demande de Philippe).
- Nom affiché « Calcoolos », provisoire : défini une seule fois dans `brand.json`.
- Outillage confirmé par Philippe : TypeScript + Vite pour le jeu (outil de développement seulement, le serveur ne
  reçoit que des fichiers statiques) et API PHP + MariaDB pour l'étape D.
- Phaser 4.2.1 ; visuels et sons entièrement générés par code (aucune licence d'image à gérer).
- Branche de travail `dev`.

**Fait**
- Moteur d'énigmes garanti soluble avec calcul de l'optimum, barème, 4 paliers, état de partie. 23 tests unitaires
  (dont comparaison à la force brute sur 600 grilles et 1 200 énigmes générées).
- Scène commune « Cubes de siège » : sélection souris, tactile et clavier ; validation ; retour bienveillant en cas
  d'erreur ; fusion des cubes en rune, tir, impact, dégâts, série ; ennemi qui marche, encaisse, meurt et est remplacé ;
  remplacement des cubes utilisés ; son coupable (M) ; respect de « réduire les animations ».
- Variante A (pixel art, outil PixelForge) et variante B (2D illustrée) jouables.
- Accueil provisoire avec choix du niveau.
- Captures réelles dans Chromium : accueil (bureau, tablette, mobile) et les deux variantes (départ, sélection, tir,
  impact, erreur ; bureau et tablette). Aucune erreur de console ni de chargement.

**Problèmes rencontrés**
- Phaser 4 + GPU logiciel des tests : morceaux de textures mélangés au-delà de 2 textures par lot. Contourné avec
  `maxTextures: 1` (`src/game/render-config.ts`). À retester sur un vrai GPU.
- Premiers rendus corrigés après lecture des captures : éclair d'impact plein écran (trop violent), cubes masqués par le
  cadre, rune qui tournait et rendait le nombre illisible, fenêtre du phare qui ressemblait à un « 0 ».

**Limites honnêtes**
- Le prototype ne se perd pas : l'ennemi qui atteint le phare est simplement repoussé. Pas de vagues, pas de fin de
  partie, un seul archétype d'ennemi (étape C).
- Le mode chronométré existe dans le moteur mais n'est pas proposé dans l'interface.
- Testé seulement dans Chromium sans écran (GPU logiciel) ; non testé sur un vrai téléphone ni une vraie tablette, ni
  dans Firefox ou Safari.
- Sons non écoutés par un humain (générés, jamais entendus pendant les tests automatisés).

**Prochaine étape**
- Philippe choisit A ou B (recommandation : B, avec l'atmosphère de A ; voir `doc/DIRECTION_ARTISTIQUE.md`).
- Puis étape C : vagues, 3 archétypes d'ennemis, début et fin de partie, écran de score, mode sans pression,
  moteur d'adaptation simple.
