# Niveaux de difficulté

Quatre niveaux, décrits par leurs calculs et non par un âge : **Doux** (vert, 1 piment), **Relevé** (jaune, 2),
**Piquant** (orange, 3), **Explosif** (rouge, 4). Les identifiants techniques `eveil`, `explorateur`, `stratege`,
`maitre` ne changent pas : profils, résultats et classements existants restent valables.

## Le niveau se choisit au lancement (02/11/2026)

La fenêtre `#choix-niveau` de l'accueil s'ouvre à chaque lancement et propose le dernier niveau choisi ; « Reprendre »
relance directement au niveau de la dernière partie. Neon Flight et MULTIRAIL posent surtout des tables : la fenêtre
le dit (`NIVEAU_TABLES`) au lieu de promettre des additions. MULTIRAIL à Explosif a son propre texte
(`EXPLOSIF_MULTIRAIL`) : ce n'est plus un niveau de tables.

## Calculs à trois nombres (02/11/2026)

`src/core/trois-termes.ts` intercale `3 × 8 + 2`, `15 + 27 + 22` ou `60 − 7 × 8` entre les tables de Neon Flight et
MULTIRAIL : 15 % à Relevé, 25 % à Piquant, 35 % à Explosif (`PART_TROIS_TERMES`, ce dernier pour Neon Flight seulement).
Jamais à Doux, à l'entraînement, ni aux deux premiers calculs d'une partie. Les produits viennent des tables choisies,
le résultat reste entre 1 et 999, et le temps est multiplié par 1,5 (`TEMPS_TROIS_TERMES`) : limite et seuils du combo à
Neon Flight, vitesse du train et temps de référence à MULTIRAIL. Ces calculs n'entrent ni dans la grille des tables ni
dans la maîtrise, et ne sont pas reposés après une erreur. Un fait de table raté passe avant eux. Le Voyage Zen garde
ses propres calculs (`zen.ts`).

Explosif ne pose jamais de `× 2` ni de `÷ 2` isolés, y compris dans l'autre sens (`MENUS`, `FACTEUR_MIN` de Neon Flight),
mais garde volontairement des calculs faciles pour respirer : relevé du 02/11 sur 20 000 tirages, 27 % de calculs verts
dans Décollage !, 39 % de `× 5` ou `× 10` dans Neon Flight, 24 % de `× 5` à l'entraînement de MULTIRAIL (sans `× 10`).
Ne pas les retirer. Chaque niveau garde ses propres tables mémorisées (`tablesParNiveau`). `scripts/niveaux-e2e.mjs`
relève les vrais calculs des six jeux aux quatre niveaux, en passant par la fenêtre.

## MULTIRAIL à Explosif : du vrai calcul mental (02/11/2026)

`src/game/multirail/explosif.ts` remplace les tables en Aventure et les calculs du Voyage Zen, à Explosif seulement.
L'Entraînement (tables seules) et les niveaux Doux, Relevé et Piquant ne changent pas : c'est là qu'on apprend les tables.
Les exemples de Philippe sont les références : `(3 × 2) + 12`, `(7 × 8) + 23`, `88 + 77`, `(144 ÷ 12) + 87`,
`250 − (9 × 8) + 17`.

- **Calculs** : une trentaine de familles, dont plusieurs à une seule opération pour souffler (moins de 10 %). Jamais de
  multiplication ni de division isolée. Le moteur d'expressions est celui du Voyage Zen (`evaluate`, `format`) : nombres
  et résultats intermédiaires ≤ 500, divisions exactes, parenthèses autour de tout `×` ou `÷`. `× 2` n'existe qu'au
  palier 1, dans un calcul combiné ; `× 10` ne sort que si le joueur a choisi cette seule table. Les produits viennent des
  tables de la partie : la série classée garde donc un sens.
- **Effort** : `charge()` estime les secondes de calcul (retenues, emprunts, grands facteurs, résultats à garder en tête).
  Cinq paliers correspondent à cinq bandes d'effort (`BANDES`), de 1,5 à 11 ; `TEXTE_MAX` garde la plaque lisible.
- **Progression** : `niveauDuVoyage` monte de région en région jusqu'au plateau (`PLATEAU`, 3,6), puis ondule au lieu de
  grimper. La première région reste sous le palier 4, la deuxième sous le 5. Dans chaque région, `VAGUE` entre doucement,
  monte, souffle, atteint son sommet et souffle.
- **Respiration** : après un palier 4, au plus le 3 ; après un 5, le 2 ou le 3 ; après une erreur, un cran de moins ;
  après deux erreurs, palier 2 au plus. Le Grand Pont (trois calculs d'affilée) s'arrête au palier 3.
- **Temps** : `tempsAccorde` = lecture + marge × effort, entre 5,5 et 24 s. La marge se resserre doucement jusqu'à la
  sixième région et s'élargit pour un joueur en difficulté. Bouillotte règle son allure sur ce temps (comme au Voyage Zen),
  la jauge mesure le temps et non la distance, et le wagon n'est perdu qu'une fois le temps écoulé. Un calcul à la fois,
  deux secondes de voyage après chaque pont. Au Voyage Zen, le temps est multiplié par 1,4 (`TEMPS_ZEN`).
- **Points** : la série progresse si la réponse arrive dans les 55 % du temps (`PART_RAPIDE`, le seuil fixe de 3 s était
  inatteignable). Le sommet rapporte 36 % de plus (`poidsDuPalier`) : pas davantage, sinon une réponse dépasse
  `maxPerAnswer` (3 000, `Games.php`) et le score sort des classements.

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
