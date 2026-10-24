# Journal du projet

## État actuel

| Étape | Statut |
|---|---|
| A. Initialisation (socle, scripts, accueil minimal) | fait |
| B. Direction artistique (2 variantes + captures) | fait : **B (2D illustrée) retenue** par Philippe |
| C. Jeu complet « Cubes de siège » | fait : jouable de bout en bout, victoire et défaite testées dans le navigateur |
| D. Plateforme (invité, comptes, profils, sauvegardes) | non commencé |
| E. Finition, déploiement Dell | non commencé |

## Rappels pour Philippe

- **Réglage d'effort « high » :** Philippe a demandé qu'on le lui rappelle au bon moment. **C'est maintenant** (fin de
  l'étape C, rappel fait le 24/10/2026) : la direction est choisie et le jeu complet est jouable ; la suite est de la
  finition graphique et de nouveaux jeux. Cela consomme plus de crédit.
- Accès GitHub en écriture rétabli par Philippe le 24/10/2026 ; branche `dev` poussée.
- Aperçu jouable sans installation : page privée claude.ai https://claude.ai/artifact/JnagX1RcsW7yWbMBi3VQWh

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
