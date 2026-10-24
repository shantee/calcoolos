# Journal du projet

## État actuel

| Étape | Statut |
|---|---|
| A. Initialisation (socle, scripts, accueil minimal) | fait |
| B. Direction artistique (2 variantes + captures) | fait, **en attente du choix de Philippe** |
| C. Jeu complet « Cubes de siège » | non commencé (moteur d'énigmes, barème et paliers déjà testés) |
| D. Plateforme (invité, comptes, profils, sauvegardes) | non commencé |
| E. Finition, déploiement Dell | non commencé |

## Rappels pour Philippe

- **Réglage d'effort « high » :** Philippe a demandé qu'on le lui rappelle au bon moment. Moment recommandé : la phase de
  finition graphique, quand la direction est choisie et que le jeu complet est jouable (fin de l'étape C ou étape E).
  Pas utile pour les prototypes ; cela consomme plus de crédit.
- Accès GitHub en écriture rétabli par Philippe le 24/10/2026 ; branche `dev` poussée.
- Aperçu jouable sans installation : page privée claude.ai https://claude.ai/artifact/JnagX1RcsW7yWbMBi3VQWh

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
