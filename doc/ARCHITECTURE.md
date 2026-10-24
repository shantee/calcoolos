# Architecture (état au 24/10/2026, étape B)

## Vue d'ensemble

```
Navigateur                                         Serveur Dell (plus tard, étape D)
┌───────────────────────────────────────────┐      ┌──────────────────────────────┐
│ Pages HTML/CSS (accueil, hub)             │      │ Nginx : sert dist/ (statique) │
│ Jeu Phaser 4 + TypeScript (rendu, sons)   │ ───▶ │ API PHP 8 (PHP-FPM)           │
│ Logique pure src/core (énigmes, barème)   │ JSON │ MariaDB : comptes, scores     │
└───────────────────────────────────────────┘      └──────────────────────────────┘
```

- **Vite** ne sert qu'au développement et à la construction : `npm run build` produit des fichiers statiques
  (`dist/`). Le serveur n'exécute ni Node ni Vite.
- **PHP + MariaDB** viendront à l'étape D pour les comptes, profils et scores (décision de Philippe du 24/10/2026).
- **Phaser 4.2.1** (MIT) gère le rendu WebGL, les animations, les particules et les entrées.

## Découpage du code

| Dossier | Contenu | Dépend de Phaser ? |
|---|---|---|
| `src/core/` | `rng` (hasard reproductible), `puzzle` (générateur et solveur), `scoring` (barème), `difficulty` (paliers) | non, testé seul |
| `src/game/siege/round.ts` | état d'une partie (sélection, validation, score, série) | non, testé seul |
| `src/game/siege/base-scene.ts` | scène commune : mise en page, entrées, enchaînement des actions | oui |
| `src/game/siege/scene-a.ts`, `scene-b.ts` | rendu et effets propres à chaque variante | oui |
| `src/game/sfx.ts` | sons synthétisés (Web Audio), coupables | non |
| `src/art/` | génération des visuels (aucun fichier image) | non |

Les mini-jeux suivants suivront le même schéma : une logique pure testée dans `src/core` et une scène Phaser.
Les modules partagés (profil, statistiques, progression) arriveront avec la plateforme (étape D).

## Moteur d'énigmes

- Grille de N cubes (valeurs bornées par palier). Pour toutes les sommes possibles, le **nombre minimal de cubes**
  est calculé par programmation dynamique (sac à dos 0/1, chaque cube servant au plus une fois).
- Une cible n'est proposée que si elle est atteignable, dans les bornes du palier, et si son optimum est compris
  entre `minOptimal` (2 : jamais de réponse en un seul cube) et `maxOptimal`.
- Sans cible admissible, un cube est relancé jusqu'à en obtenir une. Une solution existe donc toujours.
- Après un tir, seuls les cubes utilisés sont remplacés : le joueur garde ses repères.
- Les tests comparent le solveur à une force brute sur 600 grilles et vérifient 1 200 énigmes générées
  (300 par palier) ainsi qu'une partie enchaînée de 500 cibles.

## Barème (première version)

| Situation | Effet |
|---|---|
| Somme exacte avec le minimum de cubes | 100 dégâts, « Parfait ! », série +1 |
| Chaque cube en trop | −25 % de dégâts (plancher 40 %), série remise à 0 |
| Points | `10 × cible × efficacité × multiplicateur de série` (série : +25 % par coup parfait, au plus ×2) |
| Validation fausse | 0 point, série remise à 0, sélection conservée, message « il manque X » ou « X de trop » |
| Vitesse | bonus seulement en mode chronométré (pas encore activé dans le prototype) |

Cliquer au hasard n'est pas rentable : il faut valider explicitement, et une erreur casse la série.
Ennemi : 200 points de vie, donc 2 coups parfaits. Dans ce prototype, il ne peut pas gagner : s'il atteint le phare,
il est repoussé.

## Paliers (réglés à la main)

| Palier | Public | Grille | Cubes | Cible | Optimum |
|---|---|---|---|---|---|
| Éveil | 7-8 ans | 3×3 | 1-9 | 6-18 | 2 |
| Explorateur | 9-10 ans | 4×4 | 1-12 | 10-30 | 2-3 |
| Stratège | 11-12 ans | 4×4 | 2-19 | 15-50 | 2-3 |
| Maître | ados, adultes | 4×4 | 3-29 | 25-80 | 2-4 |

## Choix techniques et risques

| Choix | Pourquoi | Risque / limite |
|---|---|---|
| Phaser 4 (sorti en 2026) | moteur 2D mûr, WebGL, particules, entrées tactiles | API récente : moins d'exemples en ligne que Phaser 3 ; voir ci-dessous |
| Visuels générés par code | aucun droit d'auteur à gérer, palette maîtrisée, variations faciles | plus long à produire qu'un dessin à la main ; limite le niveau de détail |
| Sons synthétisés | aucun fichier ni licence | timbre plus simple que des sons enregistrés |
| `maxTextures: 1` | sur le GPU logiciel des tests, Phaser 4 mélangeait des textures au-delà de 2 par lot | à revérifier sur un vrai GPU (`?textures=16`) ; coût négligeable ici |
| Phaser dans un fichier séparé (357 Ko compressé) | mis en cache une fois pour tous les jeux | premier chargement un peu lourd sur mobile |
| Échelle « FIT » 1280×720 | une seule mise en page, bandes noires en 4:3 | pixel art pas toujours à un multiple entier en variante A |
