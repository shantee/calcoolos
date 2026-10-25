# Ressources graphiques, sonores et typographiques

Dans les jeux, aucun fichier image ni son externe n'est utilisé. **Seule exception : les quatre illustrations de
l'accueil** (chantier 01, 25/10/2026), fournies par Philippe. Inventaire au 25/10/2026 :

| Ressource | Provenance | Licence |
|---|---|---|
| Tous les sprites et décors de la variante A (cubes, chiffres pixel, ennemi, pancarte, phare, ciel, îles, nuages, escargot, particules) | générés par code : `src/art/variant-a.ts` avec l'outil maison `src/art/pixelforge.ts` | code du projet |
| Police pixel des chiffres (7×10) | dessinée pour le projet dans `src/art/pixelforge.ts` | code du projet |
| Tous les sprites et décors de la variante B | dessinés par code (Canvas 2D) : `src/art/variant-b.ts` | code du projet |
| Monstres du jeu, escargot, chouette, visage de la lune, poisson volant, cœurs, bouclier, rubans, panneaux, pierres, fissures, gravats, bulles | dessinés par code : `src/art/world-b.ts` | code du projet |
| Monde spatial : fond, planète annelée, étoiles, vaisseau, pilote (4 visages), flamme, météores et robots (colère et peur), Robot-Mère, station, baleine cosmique, chat astronaute, canard, robots d'entretien, pièces détachées, pièces d'or, viseur, étoiles de score, halo de danger, plaques, débris, pavé numérique | dessinés par code : `src/art/space.ts` | code du projet |
| Monde du Dragon gourmand : ciel, voie lactée, îles et pagodes, mer, reflet de lune, lune, nuages, nuages d'orage, éclairs, aurore boréale, dragon (tête à 5 expressions, segments, écailles d'or, pattes, queue), lanternes, chauves-souris (méchantes, apeurées, roussies), gâteau de lune, montgolfière, parchemin, flammes, fumée, écailles, cœurs, notes, pluie | dessinés par code : `src/art/dragon.ts` | code du projet |
| Monde pixel de Décollage ! : fusée et son pilote chat (4 expressions), flammes, plateformes (terre, nuage, planche à ballons, métal, fragiles), bonus, étoiles, habitants (vache, enfants, nuageux, mouton, oiseau, roi, robot, extraterrestre, astronaute, oursons en gomme), maisons, arbres, moulin, tour de lancement, cerf-volant, montgolfière, dirigeable, château, arc-en-ciel, satellite, soucoupe, planètes, lune, comète, village Bonbon, police pixel des nombres | dessinés par code avec PixelForge : `src/art/pixel-rocket.ts` | code du projet |
| Avatars des profils (personnages des jeux) | composés à partir des dessins ci-dessus : `src/platform/avatars.ts` | code du projet |
| Illustrations de l'accueil (Cubes de siège, Pluie de météores, Le Dragon gourmand, Décollage !), 1448×1086 | **fournies par Philippe** (zip « Chantier 01 », 25/10/2026) ; originaux PNG dans `sources-images/accueil/`, versions WebP 480/800/1448 dans `src/images/accueil/` (`cwebp -q 80`) | **à préciser par Philippe** (outil de création et conditions d'usage) avant la mise en ligne |
| Sons (sélection, fusion, tir, impact, erreur, grognement, « aïe », pièce, chouette, éboulement, effondrement, ricanement, danse, fanfare, victoire, feu d'artifice, fanfare de victoire originale, laser, explosion, bips, alarme, onde de choc, danger, boing, pièces, baleine, miaou, coin-coin, « en feu », étoiles) | synthétisés en direct par Web Audio : `src/game/sfx.ts` | code du projet |
| Musique de Pluie de météores (boucle chiptune, 3 intensités) | composée et jouée en direct par Web Audio : `src/game/sfx.ts` | code du projet |
| Musique de Décollage ! (chiptune en do majeur, 3 intensités) et sons de la fusée (poussée, atterrissage, tic-tac, bonus, sifflement de chute, secours, meuh, piou, youpi) | composés et joués en direct par Web Audio : `src/game/sfx.ts` | code du projet |
| Musique du Dragon gourmand (pentatonique, 3 intensités) et sons du dragon (croc, gloup, souffle de feu, hoquet, trombone triste, chauve-souris, tonnerre, plouf) | composés et joués en direct par Web Audio : `src/game/sfx.ts` | code du projet |
| Police Pixelify Sans | paquet npm `@fontsource/pixelify-sans` 5.3.0 (Google Fonts) | SIL Open Font License 1.1 |
| Police Bricolage Grotesque | paquet npm `@fontsource-variable/bricolage-grotesque` 5.3.0 (Google Fonts) | SIL Open Font License 1.1 |
| Moteur Phaser 4.2.1 | npm `phaser` | MIT |
| Graphiques Apache ECharts 6.1.0 (tableau de bord) | npm `echarts` | Apache 2.0 |

Les polices sont servies depuis le site lui-même (pas d'appel à Google). Aucun élément n'est copié d'une œuvre
existante. Les références citées dans le cahier des charges (floor796, Kingdom Rush, Adventure Time) n'ont servi que
d'inspiration générale.
