# Niveaux de difficulté

Quatre niveaux, décrits par leurs calculs et non par un âge : **Doux** (vert, 1 piment), **Relevé** (jaune, 2),
**Piquant** (orange, 3), **Explosif** (rouge, 4). Les identifiants techniques `eveil`, `explorateur`, `stratege`,
`maitre` ne changent pas : profils, résultats et classements existants restent valables.

## Le niveau se choisit au lancement (02/11/2026)

La fenêtre `#choix-niveau` de l'accueil s'ouvre à chaque lancement et propose le dernier niveau choisi ; « Reprendre »
relance directement au niveau de la dernière partie. Neon Flight et MULTIRAIL ne posent que des tables : la fenêtre
le dit (`NIVEAU_TABLES`) au lieu de promettre des additions.

Explosif ne pose jamais de `× 2` ni de `÷ 2`, y compris dans l'autre sens (`MENUS`, `FACTEUR_MIN` de Neon Flight), mais
garde volontairement des calculs faciles pour respirer : relevé du 02/11 sur 20 000 tirages, 27 % de calculs verts dans
Décollage !, 39 % de `× 5` ou `× 10` dans Neon Flight, 24 % de `× 5` dans MULTIRAIL (sans `× 10`). Ne pas les retirer.
Chaque niveau garde ses propres tables mémorisées (`tablesParNiveau`). `scripts/niveaux-e2e.mjs` relève les vrais
calculs des six jeux aux quatre niveaux, en passant par la fenêtre.

## Pourquoi pas un cinquième palier (étude du 30/10/2026)

Un palier réel n'est pas qu'une étiquette. Il faudrait :

- `TierId`, `NIVEAUX` et la liste PHP `Games::TIERS` (facile, sans migration : `niveau` est un texte) ;
- de vrais calculs : `MENUS` (`expressions.ts`), seuils et poids de `calc-grade.ts`, énigmes de `difficulty.ts` ;
- le réglage de chaque jeu : `DRAGON_TIERS`, `TIER_TIME` (Décollage !), `flightMs` (phare), `TIME_LIMIT` et
  `TIER_SERIES` (Neon Flight), `TIER_SPEED`, `TIER_SERIES` et `ZEN_LEVELS` (MULTIRAIL) ;
- classements (`classements.ts`, grille à 4 niveaux), administration, tests ;
- surtout **rejouer et équilibrer chaque jeu** : c'est le vrai coût.

Proposition le jour venu : garder les quatre et ajouter « Volcan » (violet, 5 piments), avec par exemple
12 × 15 ou 144 ÷ 12, tables jusqu'à 15.
