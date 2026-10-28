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
| Langues : anglais et allemand | fait le 26/10/2026 : drapeaux, détection du navigateur, traductions (sauf confidentialité) |
| Chantier 02 : logo animé, espace joueur, comptes, niveau | fait le 26/10/2026 (session 10), publié |
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

## 2026-10-28 : Claude, Décollage ! en police Minecraftia

**Demande** : remplacer la police des textes de Décollage ! (Pixelify Sans) par Minecraftia, fournie par Philippe.

**Fait**
- `src/fonts/minecraftia/` (TTF + `readme.txt` de l'auteur), `src/styles/minecraftia.css`, chargée par
  `src/entries/fusee.ts` avant le lancement. Pixelify Sans n'est plus chargée dans ce jeu (l'accueil la garde).
- `style()` : taille ×0,8 arrondie au multiple de 8 px (pixels nets ; 32 px = pixels de 4 px comme le décor), plus
  de gras (une seule graisse).
- Symboles absents de la police (affichés « _ ») : − remplacé par « - » ; touche effacer du pavé dessinée
  (`backspaceIcon()`). Écran de début : deux légendes sous les boutons mises sur deux lignes (elles se
  chevauchaient). Bulles : plus coupées au bord gauche.
- Cœurs (Philippe tenait au ♥, `emoji.zip`) : EmojiFont (Satsuyako) range ses dessins sur les lettres (« C » = cœur
  plein, « B » = cœur vide). `scripts/police-symboles.py` (fonttools, hors dépendances du projet) en tire
  `src/fonts/emoji/symboles.ttf` : ♥ et ♡ sur leur vrai caractère, agrandis ×2 (pixels de la même taille que ceux
  de Minecraftia) et centrés sur les majuscules. Police « Symboles pixel » en secours de Minecraftia : les textes
  gardent « ♥ ».
- Vérifié : typecheck, 127 tests, build, parties gagnée et perdue (`fusee-auto.mjs`), captures relues, aucune
  erreur de console.

**Limites** : Minecraftia est sous Creative Commons BY-SA (indiqué dans le fichier) : citer l'auteur. Licence
d'EmojiFont inconnue (voir `ART_ASSETS.md`).

## 2026-10-28 : Claude, session 17 (Décollage ! : premiers graphismes fournis : jauge, vache, enfants)

Demande de Philippe : remplacer peu à peu les graphismes dessinés par code de Décollage ! par des images PNG qu'il
génère, une à la fois. Première : la **jauge d'altitude** et sa petite fusée (`sources-images/decollage/jauge-et-fusee.png`).

**Fait**
- Image découpée (jauge 267 × 1371, fusée 437 × 633) puis réduite à la taille d'affichage exacte (jauge 96 × 494,
  fusée 38 × 55, `magick -filter Lanczos`), en WebP sans perte dans `src/images/decollage/`. Le jeu est en
  `pixelArt` (pixels nets) : une image réduite par Phaser à l'affichage serait abîmée, d'où la réduction à l'avance.
- `rocket-scene.ts` : chargement dans `preload()` ; ancienne colonne de 5 couleurs, mini-planète et mini-fusée
  supprimées (`miniRocket` retirée de `pixel-rocket.ts`). La jauge a 4 bandes pour 5 étages : village → vert,
  nuages et dirigeables → ciel (moitié chacun), espace → étoiles, Bonbon → rose ; la fusée monte bande par bande
  (`GAUGE_Y`, bas de la fusée = altitude), le sommet l'amène au pied de la planète.
- Vérifié : partie gagnée automatique (`fusee-auto.mjs`), captures à chaque étage (`CAPTURES/fusee-jauge-etages.png`,
  `fusee-jauge-partie.png`), aucune erreur de console ; tests 127, CSP sans violation.

Puis **la vache et trois enfants** (`vaches.png`, `enfants.png`), chacun en deux poses (repos, joie) :
- Découpe automatique (colonnes vides entre les poses), poses d'un même personnage calées sur un même cadre
  (pieds au sol, corps centré d'après le bas de l'image) pour qu'elles ne sautent pas quand on passe de l'une à
  l'autre ; vache 89 × 59, enfants 40 à 47 × 56 à 63.
- **Mécanisme général** : toute image `src/images/decollage/<nom>.webp` est chargée sous la clé `f-<nom>` ; comme
  `tx()` ne dessine une texture que si elle manque, elle **remplace d'elle-même le dessin par code** du même nom
  (`vache-0`, `vache-1`…). `sprite()` ne grossit pas ×4 ces images. Pour la prochaine : connaître la clé de
  texture du dessin à remplacer, découper, réduire à la taille voulue, déposer.
- Trois enfants (`enfant`, `enfant2`, `enfant3`) : les trois du village sont différents ; sur les plateformes,
  l'enfant dépend du numéro de la plateforme. Les habitants des plateformes sont placés selon leur largeur.
- Vérifié : partie gagnée automatique sans erreur, `CAPTURES/fusee-vache-enfants.png` ; tests 127, CSP ok.

**Limites**
- Le pilote de la petite fusée est un astronaute, celui du jeu est un chat (dessin fourni gardé tel quel).
- La vache regarde maintenant à droite (l'ancienne regardait à gauche).

Puis **la fusée et son chat pilote** (planche 4 × 4 `fusee-pilote-decolle.png`, vrai pixel art 128 px par case) :
- Coque découpée (34 × 47) pour les 4 têtes du jeu : normal = case 1 (au repos), joie = case 10, peur = case 14
  (bouche grande ouverte), ouf = case 7 (au décollage) ; flammes (sous la tuyère) des cases 9 à 11 pour les 3 images
  de flamme. Veilleuse = flamme écrasée à 40 %, turbo = flamme allongée de 40 % et passée au bleu (comme avant).
- **Harmonisation des couleurs** : chaque image est rapprochée à 50 % de la palette du jeu (Sweetie 16, `P`), et la
  coque reçoit le contour encre `#1a1c2c` d'un pixel comme tous les sprites du jeu ; affichage ×2 (pixels nets,
  coque 72 × 98, proche de l'ancienne 60 × 88). Les images de décollage avec débris (cases 6-7) ne servent pas.
- `px(key)` : ×1 pour une image fournie, ×4 pour un dessin ; le bouclier se centre sur la nouvelle coque.
- Vérifié : parties gagnée et perdue automatiques sans erreur, captures `fusee-nouvelle-fusee*.png` ; tests 127, CSP ok.
- **Publié** à 10 h 59 (`calcoolos-20261028-105937-b9a91b0`) et partie gagnée en ligne sans erreur.

Puis **les plateformes d'herbe du village** (`plateforme-herbe.png` : 3 tailles, chacune simple et avec un visage étonné) :
- Planche dessinée sur une grille d'environ 8 px : ramenée à 1 pixel par pixel (33 × 23, 64 × 29, 87 × 33) puis
  ×4 comme tout le décor (`herbe-<taille>-0/1.webp`), plus net qu'un redimensionnement lissé.
- `session.ts` : dans le village (étage 0), chaque plateforme est petite (1 sur 4), moyenne (45 %) ou grande (30 %),
  `GRASS_SIZES` (132, 256, 348 px) ; champ `size` des plateformes. Les mondes changent donc (tirage en plus) ; le
  test « chaque plateforme à portée d'une poussée » (200 mondes) passe toujours.
- Scène : le sol est sous les touffes d'herbe (`top`), la fusée s'y pose pile ; quand elle se pose, la plateforme
  ouvre de grands yeux 1,2 s (version avec visage).
- Vérifié : partie gagnée automatique sans erreur, `CAPTURES/fusee-plateformes-herbe*.png` ; tests 127, CSP ok.
- **Publié** par l'autre session Claude (version `5198749`, avec sa police Minecraftia et ses cœurs) ; vérifié en ligne
  par moi : 6 images d'herbe servies, partie gagnée sans erreur. Coordination entre sessions : voir AGENTS.md § 9.

**Publié** le 28/10/2026 à 10 h 48 (`calcoolos-20261028-104803-50048cc`, API 132 sur le Dell) ; partie automatique sur
https://calculos.zfx.fr gagnée sans erreur, jauge, vache et enfants visibles. Commits non poussés sur GitHub.

## 2026-10-27 : Claude, session 16 (classements sur une seule page)

Demande de Philippe : plus de menus déroulants, tous les classements de tous les jeux sur la même page ; pas de
classement « famille » s'il n'y a qu'un membre.

- **API** : `GET /classements` (sans paramètre) renvoie les 32 classements (jeu × niveau × mode) en une requête : top 5
  public ; si on est connecté, les profils de la famille sont marqués (`famille: true`) et ajoutés avec leur rang même
  hors du top ; le classement familial n'existe que là où **au moins deux** profils de la famille ont joué.
- **Page** : un bloc par jeu (raccourcis en haut), une ligne Défi puis une ligne Tranquille, un petit tableau par
  niveau (médailles, avatar, score). La famille ressort en doré, le joueur actif encadré ; l'invité voit son meilleur
  score local en pointillés dans chaque tableau. Carte « Dans la famille » en haut, seulement si utile.
- Tests API et scripts e2e mis à jour ; captures dans `CAPTURES/classements/`.
- Plus tard, si les jeux/modes/niveaux se multiplient : remettre un sélecteur (idée de Philippe).

## 2026-10-27 : Claude, session 15 (Décollage ! : couleurs de calculs, demi-cœurs, plus de temps)

Demande de Philippe : plus de cœurs (6 ou 8), une ou deux secondes de plus (surtout Tranquille et Éveil) ; trois
catégories de calculs affichées en vert, orange, rouge/violet, avec un algorithme qui juge la difficulté selon le
niveau (« 2 × 8 c'est facile, 35 − 27 plus compliqué ») ; on ne doit plus pouvoir gagner en attendant les calculs
faciles : un calcul raté ou laissé filer coûte un demi-cœur, un cœur entier s'il était vert.

**Fait**
- `src/core/calc-grade.ts` : `effort()` (retenue, emprunt, deux nombres à deux chiffres, au-delà de 20 / 100, tables
  pondérées 2/5/10 faciles, 7 et 8 redoutées ; nombre rond, faire 10, doubles, carrés aident ; division = produit + 1),
  `gradeOf()` (seuils par niveau), `pickGrade()` (proportions par niveau, plus de rouge en altitude),
  `pickGraded()` (calcul de la couleur voulue). Calibré sur 4 000 tirages par niveau ; exemples dans
  `tests/calc-grade.test.ts` (Éveil : 8 + 2 vert, 8 + 5 orange, 13 − 8 rouge ; 35 − 27 rouge ; 7 × 8 rouge en Stratège).
- Décollage ! : Défi à **8 cœurs** (bonus cœur plafonné à 8) ; raté = −½ ♥ (−1 ♥ si vert), affiché « −½ ♥ » ; cœurs
  à moitié vides dans la barre (`heartIcon('demi')`), bonus actifs sur la ligne du dessous ; encadré du calcul bordé
  de vert, d'orange ou de rouge sur fond violet, étiquette « facile ● / moyen ●● / difficile ●●● » dessous (les
  points pour les daltoniens) ; barre de temps devenue blanche (elle clignote à la fin) pour ne pas mélanger les
  couleurs ; points × 1 / 1,5 / 2 ; temps + 1 s, + 2 s en Éveil ou en Tranquille, + 0/1/2 s selon la couleur.
  Écran de début : légende des couleurs, « 8 cœurs : un raté coûte ½ ♥, 1 ♥ si vert ». Les calculs du niveau
  suivant en altitude sont remplacés par plus de rouge. Textes traduits (anglais, allemand).

**Vérifié** : Vitest 127/127 (dont 6 nouveaux sur les couleurs, 3 sur le temps et les demi-cœurs), types,
construction ; dans le Chrome des agents (Éveil, Défi, ordinateur et téléphone en allemand) : encadrés des trois
couleurs, ratés à −1 et −½, cœurs 6,5 dessinés juste, aucune erreur.

**Limites** : réglages (proportions, seuils, secondes) à juger par Philippe en jouant ; `scripts/fusee-auto.mjs`
non relancé (Chromium ne démarre pas dans le bac à sable) ; parties complètes jouées par le pilote automatique
de Vitest seulement.

## 2026-10-27 : Claude, session 14 (nouveaux avatars)

Demande de Philippe : remplacer les avatars dessinés par code (« pas très beaux ») par sa grille pixel art de
49 avatars (`sources-images/avatars/grille-avatars.png`, 1312 × 1199, 7 × 7), proposée à la création et à la
modification d'un profil ; puis « mélange-les un peu, les Adventure Time sont en premier ».

**Fait**
- Découpe : bords de chaque case détectés automatiquement (cases de 152 à 178 px, pas toutes carrées), 5 px retirés
  (coins arrondis), carré central, WebP 128 × 128 (`magick`, Lanczos, q86) : `src/images/avatars/<id>.webp`, 324 Ko
  en tout. Chargées par `import.meta.glob` (fichiers servis par le site, rien en `data:`).
- `src/platform/avatars.ts` : 49 avatars (identifiant + nom), ordre mélangé une fois pour toutes (personnages voisins
  de la grille éloignés, Adventure Time dispersés) ; avatar par défaut `astronaute`, invité `fantome` ; niveaux :
  Éveil `axolotl`, Explorateur `chat-aviateur`, Stratège `robot`, Maître `sorcier`.
- Anciens avatars : migration `003_avatars.php` (dragon → flamme, chouette → pigeon, escargot → axolotl, chat →
  chat-aviateur, baleine → requin, poisson → poisson-astro ; robot et canard gardent leur nom) ; le navigateur fait
  la même conversion pour un joueur actif retenu sous l'ancien nom (`avatarId()`).
- Serveur : `Api::AVATARS` = même liste, même ordre (vérifié par `tests/avatars.test.ts`, ainsi que la longueur
  ≤ 20 de la colonne) ; test API « ancien avatar refusé ».
- Style : vignettes carrées à coins arrondis, rondes dans les pastilles (barre, « Qui joue ? », niveaux) ; grille de
  choix qui s'adapte à la largeur (5 par ligne sur téléphone), avatar choisi agrandi avec anneau safran.
- Noms des avatars traduits en anglais et en allemand.
- Les anciens dessins restent dans les jeux (chouette, escargot, chat astronaute…) : seuls les avatars changent.

**Vérifié** : Vitest 118/118, types, construction ; captures (`CAPTURES/avatars/`) de l'espace famille, du choix,
de l'accueil invité et du panneau joueur, ordinateur et téléphone, avec une API imitée dans le Chrome des agents ;
49 images chargées, aucune cassée ; l'avatar choisi part bien au serveur.

**Limites**
- Tests de l'API PHP non lancés sur le poste (podman refusé par le bac à sable) : ils tournent sur le Dell avant
  la migration, à la publication (`mettre-en-service.sh`, retour arrière automatique).
- Plusieurs avatars reprennent des personnages connus (Adventure Time : Finn, Jake, Princesse Chewing-gum,
  Marceline, BMO ; Rick de Rick et Morty ; Lapin crétin ; Kakashi de Naruto ; Noiraude de Ghibli) et deux animaux
  fument (chat à lunettes, pingouin). **Décision de Philippe (27/10/2026) : on garde tout** (« pas un truc tout
  lisse tout fade ») ; si un ayant droit nous contacte, on retire l'avatar concerné (liste dans `avatars.ts` et
  `Api.php`, plus une ligne de migration pour les profils qui l'auraient choisi).

## 2026-10-27 : Claude, session 13 (classements sous le pseudo, pseudos rigolos)

Demande de Philippe : supprimer la case « Apparaître dans les classements publics, sous le nom inventé… »
(« inutile et confusant, on va faire simple ») ; tout le monde au classement public **sous son pseudo** (« on
changera si une personne s'en plaint ») ; à la création du profil, un bouton « Aide-moi à trouver un pseudo » qui
propose des pseudos sympas : jeux de mots sur les maths, mais aussi des trucs marrants (« Super Calculateur »,
« Roi des Nombres ») et des animaux (« Lama Fâché », « Poisson Malin »).

Fait :
- Serveur : `/classements` affiche le pseudo de tous les profils (scores vérifiés seulement, jamais l'e-mail) ;
  `classementPublic` / `nomPublic` retirés des profils et de `/profils/{id}/modifier`. Colonnes laissées en base
  (aucune migration ; `nom_public` est encore rempli car obligatoire).
- Espace famille : case et bouton « Autre nom » retirés ; bouton « 🎲 Aide-moi à trouver un pseudo » sous le champ
  Pseudo (nouveau profil et « Modifier ») ; textes de l'espace famille, des classements et de la confidentialité
  mis à jour (+ anglais et allemand).
- `src/platform/pseudos.ts` : 22 jeux de mots (Léa Dition, Sir Conférence, Pierre Amide…), 24 titres (Super
  Calculateur, Roi des Nombres…), 22 animaux × 18 adjectifs accordés (Lama Fâché, Chouette Maligne…).

Tests : Vitest 115 (dont 3 pour les pseudos : tous acceptés par le serveur), API 126, parcours plateforme 21/21.

Suite (même jour) : Philippe a perdu une partie de Cubes de siège en Explorateur et voulait la voir au classement.
Le serveur compte déjà les parties perdues (score vérifié) ; deux causes possibles côté page :
- la page Classements s'ouvrait toujours sur le Dragon en Défi → elle s'ouvre maintenant sur **la dernière partie
  jouée** sur l'appareil (`calcoolos.derniere-partie`, écrit par `reportResult`) ;
- en invité, rien ne part au serveur → carte « Sur cet appareil » (meilleur score local + « Créer mon compte ») et
  message de fin « Mode invité : score gardé ici, hors classement. » (vérifié sur capture : tient dans le cadre).
Base de production non consultée (lecture refusée) : on ne sait pas laquelle des deux causes l'a touché.

## 2026-10-26 : Claude, session 12 (« Continuer avec Google »)

Demande de Philippe : se connecter ou créer son compte d'un clic avec Google, sans parcours compliqué ; garder
e-mail + mot de passe et le mode invité ; même système de profils ; pas de fusion par la seule adresse ; jetons
vérifiés en PHP avec `sub` ; CSP non affaiblie ailleurs ; aucun secret dans git ; domaine modifiable.

Fait :
- Serveur : `server/src/Google.php` (vérification du JWT RS256 sans bibliothèque : clés de Google en cache,
  `iss`, `aud`, `exp`, `iat`, seul RS256 accepté), migration `002_google.php` (`comptes.google_sub`, unique),
  routes `POST /google`, `/google/associer`, `/google/dissocier` ; `/etat` annonce `googleClientId` (public) et,
  connecté, `google` / `motDePasse`. Un compte créé avec Google n'a pas de mot de passe ; la connexion classique
  lui est impossible (même temps de réponse) ; sa suppression se confirme en recopiant l'adresse. Adresse déjà
  connue → 409 avec explication (se connecter par mot de passe puis associer). Limites d'essais réutilisées.
- Interface : `src/platform/google.ts` (bouton officiel de Google, chargé seulement sur `compte.html` et
  seulement si configuré ; disparaît si Google est injoignable) ; dans `compte.ts`, bloc Google en tête des cartes
  « Se connecter » et « Créer mon compte », mention « adulte responsable », bloc « Se connecter plus vite »
  (associer) ou « Compte Google associé » (dissocier) dans l'espace famille. Traductions anglaise et allemande.
- CSP : règle propre à `compte.html` (script, styles et cadre de `accounts.google.com/gsi/` seulement,
  `Referrer-Policy: strict-origin-when-cross-origin`) dans `deploy/nginx-calcoolos.conf`, `installer.sh` et le
  nouveau `deploy/webdell/activer-google.sh` (sudo : ID client dans `shared/calcoolos.env` + règle du vhost,
  sauvegardes, `nginx -t`, retour arrière). Page de confidentialité complétée.
- Guide pour Philippe : `doc/GOOGLE.md` (console Google pas à pas, commande à lancer, changement de domaine).

Vérifié : API 129/129 (SQLite et MariaDB 11.8), dont 8 sortes de jetons refusés ; Vitest 112 ; typecheck ;
build ; `google-e2e.mjs` 33/33 (Google imité) ; `csp-check` : aucune violation, le vrai script de Google se
charge sur `compte.html` (il répond seulement que l'ID client de test n'existe pas).

Limites : **rien n'a été essayé avec le vrai Google** (pas encore d'ID client) ; un compte créé avec Google ne
peut pas se donner de mot de passe (pas d'e-mails envoyés par le site) ; la mention « adulte » est une
déclaration, comme la case du formulaire.

Reste : Philippe crée l'ID client (`doc/GOOGLE.md` § 1), puis `activer-google.sh` sur le Dell, puis un essai réel
en ligne (création, reconnexion, association) sur ordinateur et téléphone.

## 2026-10-26 : Claude, session 11 (pied de page, prototypes retirés)

Demande de Philippe : retirer du pied de l'accueil « Dans tous les jeux, M coupe le son. Archives : prototype A ·
prototype B », et se débarrasser des prototypes.

- Paragraphe retiré de `index.html` (et sa règle `.parents .discret`).
- Supprimés : `prototypes/a.html`, `prototypes/b.html`, `src/entries/proto-a.ts`, `proto-b.ts`,
  `src/game/siege/base-scene.ts`, `scene-a.ts`, `scene-b.ts`, `src/art/variant-a.ts`, `scripts/captures.mjs`
  (+ entrées de `vite.config.ts`, script `captures` de `package.json`, 12 textes de `en.ts` / `de.ts`). Aucun jeu
  n'en dépendait ; `pixelforge.ts` reste (Décollage !). Les anciennes captures `CAPTURES/proto-*` restent comme
  trace du choix de direction artistique ; le code est dans l'historique git.
- La touche M coupe toujours le son dans les 4 jeux (seule la mention a disparu).
- Vérifié : 112 tests, typecheck, build ; publié.

## 2026-10-26 : Claude, session 10 (chantier 02 : logo animé, comptes, espace joueur, niveau)

**Demande de Philippe** : transformer l'accueil en vrai accueil de plateforme de jeux :
- un **logo animé** original et mémorable (beau même immobile, sobre, compatible avec « réduire les animations ») ;
- la **création de compte** mise en valeur, sans jamais rendre le compte obligatoire ;
- un **espace joueur** bien visible (invité, adulte connecté, enfant) ;
- un **choix du niveau** impossible à ignorer, mémorisé intelligemment ;
- une finition professionnelle.

En cours de session, il a demandé de soigner particulièrement la direction artistique du logo. Il a autorisé la
publication en fin de chantier.

**Fait**
- **Logo « qui calcule de tête »** (`src/platform/logo.ts`, `src/styles/logo.css`, aucun fichier image).
  - Le mot Calcoolos en lettres « autocollant » : remplissage safran dégradé, contour brun chaud, ombre courte.
    Les deux « o » du milieu sont des **yeux** qui suivent le pointeur et clignent de temps en temps.
  - Chaque lettre a deux couches (contour dessous, remplissage dessus, dessinées par `::before` / `::after`) : tous
    les contours passent sous tous les remplissages, et les lettres se soudent en un seul autocollant.
  - **Arrivée sur le site** : les lettres tombent en place, les yeux se réveillent et regardent autour d'eux. Le logo
    lève ensuite les yeux vers une **bulle de pensée** qui contient un vrai calcul du niveau choisi
    (`pickExpression`, le générateur des jeux). Il réfléchit (le regard parcourt le calcul), trouve la réponse, et
    ses yeux sourient (« ^ ^ ») avec trois étincelles.
  - Ensuite, le logo reste calme : un clin d'œil de temps en temps, une nouvelle pensée au clic, ou d'elle-même
    toutes les 25 à 40 s (seulement si le logo est visible).
  - Version barre : le même mot en petit ; les yeux suivent le pointeur, avec un clin d'œil au survol.
  - Animations réduites (réglage système ou `?calme`) : aucun mouvement, aucune bulle ; le logo reste complet.
  - Pistes écartées après essai : quatre cubes d'opérations autour du mot (décor générique, demande de Philippe
    d'aller plus loin) ; contour à l'encre (invisible sur le fond de nuit) ; relief en « pile de pièces » des yeux
    (incohérent avec les lettres).
- **Espace joueur dans la barre** (`src/platform/topbar.ts`), juste à droite du logo.
  - Bouton avec l'avatar, le nom et le statut : « Invité · sans compte » (anneau en pointillés), ou le pseudo avec
    « Niveau Éveil » (anneau safran).
  - Il ouvre un panneau : qui joue, son niveau (avec un lien « changer »), parties gardées sur l'appareil (vraies
    données locales). Selon la situation, on y trouve aussi « Créer mon compte » / « Se connecter », ou bien
    « Qui joue ? » avec les profils, « Voir les progrès », l'espace famille et la déconnexion.
  - Le panneau se ferme avec Échap ou par un clic à côté, et le focus revient au bouton.
  - À droite de la barre : « Se connecter » et un bouton « Créer mon compte » pour un visiteur ; « Espace famille »
    pour un compte connecté.
  - Changer de joueur depuis la barre prévient la page (événement `calcoolos:joueur`). L'accueil se met à jour sans
    rechargement ; les autres pages se rechargent.
  - Mise en page : sur une ligne au-delà de 1200 px, sur deux lignes en dessous ; sur téléphone, le compte reste
    accessible depuis le panneau du joueur et le carnet.
  - Toutes les pages de la plateforme passent à 1200 px de large, comme l'accueil.
- **Choix du niveau** (`src/platform/niveau.ts`, testé dans `tests/niveau.test.ts`).
  - Quatre cartes avec un personnage par niveau (escargot, chat astronaute, robot, dragon), l'âge et la difficulté
    en crans, plus une ligne qui dit ce que contient le niveau (« Calculs jusqu'à 100, toutes les tables,
    divisions »).
  - Règle de départ : le niveau du profil actif ; sinon le dernier choisi sur l'appareil ; sinon **aucun**.
    Un nouveau venu voit l'étiquette « avant de jouer », et son premier « Jouer » ouvre la fenêtre « Quel est ton
    niveau ? » (4 cartes avec un exemple de calcul) : le choix est retenu et le jeu se lance aussitôt. Pas de
    confirmation aux parties suivantes.
  - **Rappel du niveau à côté de chaque « Jouer »** (personnage + « Niveau Stratège · changer », qui ramène au choix).
  - Avec un profil actif, changer le niveau sur l'accueil l'enregistre aussi **sur le profil**
    (`/profils/{id}/modifier`) : le niveau suit l'enfant d'un appareil à l'autre.
  - **Plus de niveaux** : étudié, mais pas ajouté (voir « Pour plus tard »).
- **Carnet d'aventurier** (bande sous l'ouverture).
  - Pour un visiteur : les six avantages d'un compte en tuiles avec pictogrammes, « Créer mon compte gratuit »
    (vers `compte.html#inscription`) et « J'ai déjà un compte · Se connecter », avec le rappel que c'est facultatif.
    S'il a déjà joué en invité, le texte cite ses vraies parties locales.
  - Pour un joueur connecté : « Le carnet de Lina », avec ses **vrais chiffres** lus sur le serveur (parties,
    étoiles, succès, meilleur score) et un lien vers ses progrès.
  - Serveur injoignable : la bande est masquée.
- **Espace parents** : les liens `#inscription` et `#connexion` mettent la bonne carte en premier, mise en évidence,
  avec le curseur dans son premier champ.
- **Ouverture de l'accueil réorganisée** : logo, accroche, « table de lancement » (qui joue + niveau), puis les
  vignettes. Sur téléphone, le niveau passe avant les vignettes.
- **Traductions** anglaises et allemandes de tous les nouveaux textes ; le nom « Calcoolos » n'est jamais traduit.
- **Tests**
  - `scripts/accueil-e2e.mjs` (nouveau, 68 vérifications avec la vraie API) : nouveau venu, panneau, fenêtre du
    premier niveau, 4 jeux lancés au bon niveau, rappel « changer », inscription depuis l'accueil, profils,
    changement de joueur sans rechargement, niveau enregistré sur le profil, tablette (portrait et paysage),
    téléphone, déconnexion, animations réduites, anglais et allemand, aucune erreur JavaScript.
  - Captures dans `CAPTURES/chantier-02/`.
  - Les scripts existants ciblent maintenant le bouton « Se déconnecter » de la page (`#contenu`), puisque le
    panneau joueur en contient un aussi.

**Vérifié** (Chromium, GPU logiciel)
- 112 tests Vitest, vérification des types, construction.
- 83 vérifications de l'API PHP (PHP 8.3 en conteneur, SQLite).
- Parcours plateforme 20/20, parcours accueil 68/68.
- CSP sans violation sur toutes les pages.
- Animation du logo vérifiée image par image (planches de captures toutes les 0,5 à 1 s).

**Limites**
- Le logo n'a été vu qu'en GPU logiciel (Chromium sans carte graphique) : fluidité à confirmer sur une vraie tablette.
- Le pointeur suivi par les yeux n'existe pas au doigt : sur tablette, les yeux regardent l'endroit touché.
- Un compte créé ne récupère pas les parties jouées avant en invité (comme avant ; à envisager).
- Traductions faites par Claude, non relues.
- PHP n'est pas installé sur ce poste : l'API de développement tourne dans un conteneur `php:8.3-cli` (voir AGENTS.md).

**Pour plus tard : des niveaux plus fins**
- Les quatre paliers sont larges (Explorateur va de « 12 + 9 » à « 5 × 10 »). Une piste propre serait de garder les
  quatre « mondes » et d'ajouter deux crans dans chacun (huit paliers), sur le moteur adaptatif déjà présent.
- Il faudrait alors toucher à :
  - `TierId` et `TIERS` (`src/core/difficulty.ts`), `MENUS` (`src/core/expressions.ts`) ;
  - les réglages propres à chaque jeu (cibles du Dragon, chronos de Décollage !, grilles de Cubes de siège) ;
  - `Games::TIERS` côté PHP, les classements (une table par palier), les noms et succès du tableau de bord,
    les traductions, et une migration des profils existants.
- C'est un chantier à part entière, pas un ajout de boutons ; non fait ici volontairement.

## 2026-10-26 : Claude, session 9 (sélecteur de langue, anglais et allemand)

**Demande de Philippe** : tout à droite de l'accueil, un sélecteur de langue discret et visuel (drapeaux du
Royaume-Uni, de l'Allemagne et de la France), trois versions du site, et la détection automatique de la langue du
visiteur. C'est pour le montrer à une amie qui ne parle pas français : on traduit une fois, le français reste la
version principale, et il n'est pas grave que les autres langues prennent du retard.

**Fait**
- `src/i18n/` : choix de la langue (choix enregistré, sinon langue du navigateur, sinon anglais), sélecteur à trois
  drapeaux dessinés en SVG (barre du haut de toutes les pages de la plateforme, tout à droite), traduction par
  dictionnaire « texte français → traduction » avec modèles pour les textes contenant des nombres.
- Traduction automatique de la page (HTML et tout ce que le code ajoute) et des textes Phaser des quatre jeux, sans
  modifier le code des pages ni des scènes ; appels directs à `t()` seulement pour les graphiques ECharts et les
  `confirm()`. Dates du tableau de bord au format de la langue.
- Dictionnaires anglais et allemand (~420 textes chacun) : accueil, espace parents, progrès, classements, succès,
  messages de l'API PHP, quatre jeux (aides, bulles des personnages, fins de partie), boutons plein écran.
  Noms choisis : *Siege Cubes / Würfel-Belagerung*, *Meteor Shower / Meteoritenregen*, *The Hungry Dragon / Der
  hungrige Drache*, *Lift-off! / Abheben!* ; modes *Relaxed / Entspannt* et *Challenge / Profi*.
- Décollage ! : l'antiligature « fi/fl » de la police pixel est retirée avant la traduction puis remise.
- Scripts Playwright : tous en `locale: 'fr-FR'` (sinon Chromium, réglé en anglais, aurait affiché le site en anglais
  et les vérifications de textes français auraient échoué).
- 7 tests Vitest (détection, modèles, morceaux, oubli) : 105 tests au total.

**Vérifié dans Chromium** : navigateur allemand → site en allemand ; navigateur français → français ; clic sur un
drapeau → langue changée et retenue ; pages de la plateforme en anglais et en allemand (ordinateur et téléphone) ;
écrans de début, parties et fins des quatre jeux en allemand (parties automatiques gagnées et perdues) : aucun texte
resté en français à part l'icône pause « II » et le « z » du dragon qui dort. Corrections après captures : « Score »
gardé tel quel en allemand dans Décollage ! (« Punkte » débordait), ciels du dragon raccourcis (*Abend*, *Sturm*),
deux phrases d'aide raccourcies. CSP : aucune violation.

**Limites**
- Traductions faites par Claude, non relues par une personne de langue anglaise ou allemande.
- Non traduits : page de confidentialité, noms inventés des classements (« Dragon Futé 42 »), anciens prototypes.
- Petits accords imparfaits (« 0 game played » au singulier, comme en français).
- Espace parents en anglais/allemand vérifié seulement en mode « serveur indisponible » (pas de PHP sur ce poste) ;
  les messages de l'API sont dans les dictionnaires.

## 2026-10-25 : Claude, session 8 (bonus volants et plein écran)

**Demande** : des power-ups dans Cubes de siège (optionnels, peu nombreux, bien distincts des ennemis) et un vrai
plein écran dans les quatre jeux, pensé pour la tablette.

**Fait**
- **Bonus volants** (Cubes de siège) : logique pure `src/game/siege/powerups.ts` (testée, `tests/powerups.test.ts`),
  dessins `src/art/bonus-b.ts`, spectacle dans `game-scene.ts` (section « Bonus volants »).
  - Deux passages au plus par partie (un en vague 2, un en vague 3 ou 4), jamais pendant une entrée de monstre, une
    victoire, ni quand le monstre est déjà près du phare. Soucoupe (extraterrestre à trois yeux) puis ballon-poisson
    (souris aviatrice), auréole et traînée dorées, étiquette « BONUS ! » : impossible de les confondre avec un monstre.
  - Calcul adapté au niveau (jamais trivial), 7 s en Tranquille, 1,5 s de moins en Défi. Réponse au clavier (chiffres)
    ou sur un pavé sombre et doré qui sort seulement pendant le passage ; la grille et le monstre continuent.
    Deux erreurs ou temps écoulé : l'engin se moque (« Nananère ! ») et repart, aucune pénalité.
  - Bonne réponse : le paquet tombe, rebondit, s'ouvre ; le bonus file dans l'une des deux niches au pied du phare
    (touche B ou N, clic, doigt). Niches pleines : plus aucun engin (aucun bonus perdu). Un bonus inutile au moment
    (monstre encore au fond, déjà gelé…) est gardé, avec une explication.
  - **Super Poussée** (premier bonus toujours) : gant de boxe à ressort, « PAF ! », onde de choc, le monstre s'envole
    en tournoyant avec des yeux exorbités jusqu'au fond, atterrit dans la poussière, étoiles et réplique vexée.
    Carapaçon : roule ; Roi : trop lourd, ne recule qu'à moitié en freinant des talons.
  - **Gel** : bloc de glace 6 s (5 s en Défi), se fissure puis éclate. **Méga-tir** : la lanterne se charge d'or, le
    prochain coup réussi fait double dégâts (le score ne change pas), tampon « MÉGA ! ».
  - Correction au passage : Phaser pouvait relire deux fois la file clavier quand une image est lente (un chiffre
    comptait double) ; les touches sont désormais dédoublonnées.
- **Plein écran** (`src/game/plein-ecran.ts`, quatre jeux) : deux boutons ronds en bas à droite (Accueil, Plein
  écran entrer/sortir) remplacent le lien du bas qui chevauchait « Son ». Plein écran demandé en lançant la partie
  (clic, doigt — au lever du doigt pour Chrome —, clavier), jamais forcé : refus du navigateur = le jeu continue ;
  sortie volontaire (Échap, bouton) = plus de demande dans cet onglet. Page entière en plein écran (les boutons
  restent), Phaser recadre en gardant les proportions, zones sûres (encoche) respectées, paysage demandé sur tablette.
- **Petite PWA** : manifeste produit depuis `brand.json` (plugin Vite), icônes du phare dans `public/icones/`,
  balises « écran d'accueil » sur toutes les pages. **Pas de service worker** (le site reste toujours à jour).

**Ajustement demandé ensuite** : atelier collé au bord gauche (marge 34 → 12 px, cubes inchangés à 84 px), phare
et point d'arrêt décalés de 28 px vers la gauche, entrée des monstres 20 px plus à droite : approche de 538 px au lieu
de 490 (+10 %).

**Vérifié** : 98 tests Vitest ; `scripts/bonus-auto.mjs` (17 vérifications + partie naturelle gagnée sur tablette) ;
`scripts/plein-ecran-auto.mjs` (4 jeux × 6 formats, clavier, souris, doigt, sortie, retour à l'accueil : 68 OK) ;
parties automatiques des quatre jeux ; CSP.

**Limites** : iPhone n'a pas de plein écran pour une page (bouton masqué) : l'ajouter à l'écran d'accueil donne un
affichage sans barre. Le plein écran headless de Chromium ne change pas la taille de la fenêtre : le recadrage réel
reste à voir sur une vraie tablette. Sons des bonus jamais écoutés par un humain.

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
