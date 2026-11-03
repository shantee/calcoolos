# Six niveaux scolaires : CP, CE1, CE2, CM1, CM2, Aventurier

Chantier du 03/11/2026. Remplace les quatre niveaux à piments (Doux, Relevé, Piquant, Explosif). Ce document est la
**grille pédagogique de référence** : les générateurs de calculs (`src/core/calculs.ts`, `src/core/multiplications.ts`)
et les réglages des six jeux la suivent. Toute modification d'un générateur doit rester cohérente avec elle.

Phrase affichée à côté du choix : « Les niveaux correspondent approximativement aux apprentissages de chaque classe.
Tu peux changer à tout moment. » Tous les niveaux sont librement sélectionnables, quel que soit l'âge du joueur.

## 1. Sources

- Programme de mathématiques du cycle 2 (CP, CE1, CE2), arrêté du 10 octobre 2024, **BO n° 41 du 31 octobre 2024**,
  en vigueur à la rentrée 2025. Texte relu dans sa reprise intégrale « mise en parallèle » de la CPD mathématiques
  du Jura (académie de Besançon), et dans le résumé par classe de la même année (les sites education.gouv.fr et
  eduscol.education.fr n'étaient pas joignables depuis le poste le 03/11/2026).
- Programme de mathématiques du cycle 3, arrêté du 10 avril 2025, **BO n° 16 du 17 avril 2025** (CM1 à la rentrée
  2025, CM2 à la rentrée 2026) : texte officiel intégral (copie publiée par le Café pédagogique), rubrique
  « Le calcul mental » de chaque classe.
- **Exemples de réussite** CM1 et CM2 (Éduscol 2025), relus dans leur reprise par l'IEN de Crest (académie de
  Grenoble, novembre 2025) : « Exercices MathsMentales et programmes 2025 » CE1, CM1, CM2.
- Éduscol, « Instructions officielles pour l'enseignement du calcul mental du CP au CM2 » (document 65189) : cité par
  les sources ci-dessus, non relu directement (site injoignable).

Les copies téléchargées ne sont pas versionnées (droits) ; les URL figurent dans `JOURNAL_PROJET.md` (03/11/2026).

## 2. Ce que disent les programmes (calcul mental)

Les programmes distinguent trois choses : les **faits numériques à mémoriser** (restitués « de façon quasi
instantanée »), les **calculs appuyés sur la numération** et les **procédures** enseignées explicitement. Ils fixent
aussi une **fluence** de fin d'année (nombre de résultats justes en un temps donné). Ce qui est vu en cours d'année n'est
pas forcément maîtrisé à la fin : le jeu en tient compte en plaçant les acquis en palier 1 et les nouveautés en palier 3.

### CP — nombres jusqu'à 100

| | Contenu |
|---|---|
| Nombres | jusqu'à 59 au plus tard en période 2, jusqu'à 100 en période 3 ; tout le calcul mental reste ≤ 100 |
| Faits à mémoriser | tables d'addition dans les deux sens (`4 + … = 12`, `5 + 3 = …`, `10 = 7 + …`) ; doubles de 1 à 10, de 20, 30, 40, 50 ; moitiés des nombres pairs de 2 à 20 et de 40, 60, 80, 100. Fin de CP : 8 égalités en une minute |
| Numération | ajouter ou soustraire 1 ou 2 (`17 − 2`), 10 (`37 − 10`), un nombre de dizaines (`76 − 30`) |
| Procédures | complément à la dizaine supérieure (74 → 80) ; ajouter un nombre < 9 (`32 + 4`, `47 + 8`) ; ajouter 9 ; ajouter deux nombres < 100 (`47 + 28`) ; moitié d'un nombre pair (46) ; soustraire un nombre < 10 à une dizaine (`50 − 6`) |
| Multiplication | **sens seulement** (problèmes multiplicatifs ≤ 30, groupements) ; le signe × arrive au CE1 |
| Fluence fin d'année | 9 résultats en 3 minutes (procédures) |

### CE1 — nombres jusqu'à 1 000

| | Contenu |
|---|---|
| Faits | tables d'addition (12 égalités/min en fin d'année) ; **tables de multiplication de 0 à 10**, apprises progressivement toute l'année, « encore imparfaites en fin de CE1 » (8 égalités/min) ; doubles de 1 à 15, de 20 à 50 de 5 en 5, de 100 à 500 ; moitiés des pairs jusqu'à 30, des dizaines jusqu'à 100 ; `25, 50, 75, 100` comme multiples de 25 |
| Numération | ajouter ou soustraire des dizaines (`234 + 60`, `541 − 20`, `746 + 80`) ou des centaines (`354 + 500`, `765 − 200`) ; multiplier par 10 un nombre < 100 (`72 × 10`) |
| Procédures | ajouter 9, 19, 29 ; soustraire 9 ; soustraire un nombre < 9 (`157 − 5`, `523 − 7`) ; moitié d'un pair (470) ; **distributivité** `13 × 7 = 70 + 21` (11 à 19 × un chiffre) |
| Division | pas encore (sens du partage dans les problèmes) |
| Fluence | 12 résultats en 3 minutes |

### CE2 — nombres jusqu'à 10 000

| | Contenu |
|---|---|
| Faits | tables d'addition (15/min) et de multiplication dans les deux sens (`7 × … = 42`, `70 = 7 × …` : 12/min) ; doubles jusqu'à 20, de 25, 35… 75, de 100 à 600 ; moitiés jusqu'à 40, de 120, 150, de 800, 1 000, 1 200 ; `4 × 25 = 100` ; décompositions de 60 (`4 × 15`, `5 × 12`…) |
| Numération | multiplier un entier par 10 ou 100 (`724 × 10`) |
| Procédures | ajouter 8, 9, 18, 19, 28, 29, 38, 39 ; soustraire 9, 19, 29, 39 ; multiplier par 4 ou 8 (`4 × 37`, `8 × 27 = 216`) ; un chiffre × des dizaines (`9 × 40 = 360`) ; 11 à 99 × un chiffre (`23 × 7 = 161`) |
| Division | sens de la division et signe ÷ ; `91 ÷ 7 = 13` parce que `7 × 13 = 91` |
| Fluence | 15 résultats en 3 minutes |

### CM1 — entiers jusqu'au million, décimaux jusqu'aux centièmes

| | Contenu |
|---|---|
| Faits | tables d'addition et de multiplication « avec une fluence qui se renforce » ; faits du CE2 ; premiers multiples de 25 et de 50 |
| Numération | multiplier un entier par 10, 100, 1 000 ; ajouter dixièmes et centièmes (décimaux) |
| Procédures | ajouter ou soustraire 8, 9, 18… 39 ; un chiffre × dizaines ou centaines (`9 × 400`) ; **× 4 ou × 8** ; **× 5** (× 10 puis moitié, nombres < 200) ; distributivité (`21 × 35 = 700 + 35`) |
| Opérations | divisions euclidiennes posées (diviseur à un chiffre) |

### CM2 — entiers jusqu'au milliard, décimaux

| | Contenu |
|---|---|
| Faits | faits du CM1 ; moitiés des impairs jusqu'à 15 (`9 ÷ 2 = 4,5`) ; fractions et décimaux usuels |
| Procédures | ajouter ou soustraire 8, 9… 98, 99 (`+ 98` = `+ 100 − 2`) ; dizaines, centaines ou milliers entre eux (`900 × 700`) ; distributivité (`12 × 42 = 420 + 84`) ; double et moitié d'un décimal ; **÷ 4 ou ÷ 8** (`140 ÷ 4 = 35`) ; **× 5** et **× 50** (`50 × 12,4 = 620`) |
| Expressions | calculs avec parenthèses, égalités à trou (`178 − … = 6 × 8`) |

## 3. Choix pour Calcoolos

- **Entiers seulement.** Les claviers des jeux n'ont pas de virgule et tous les calculs se tapent en trois chiffres au
  plus (Neon Flight et MULTIRAIL n'en acceptent pas plus) : réponses entières de 1 à 999, jamais négatives, aucune étape négative, divisions
  toujours exactes. Les décimaux et les fractions du CM restent hors des jeux pour l'instant (piste notée plus bas) ;
  le CM se reconnaît aux procédures (× 5, × 25, × 50, ÷ 4, ÷ 8, distributivité, ± 98) et à la taille des nombres.
- **Trois paliers dans chaque classe**, pas davantage : 1 = acquis des années précédentes et faits mémorisés,
  2 = cœur de l'année, 3 = ce qui est découvert pendant l'année. Une partie commence surtout en palier 1 (aucun
  palier 3 dans les quatre premiers calculs), monte vers un **plateau** (environ 30 % / 45 % / 25 %) au bout d'une
  douzaine de calculs, puis n'augmente plus : une longue partie ne devient pas plus dure que la classe choisie. Après un
  palier 3 vient un palier 1 ou 2 ; deux erreurs sur les quatre derniers calculs font reculer le tirage (le palier 3
  passe d'environ 25 % à 10 %, au profit du palier 1) jusqu'à ce que les réponses redeviennent justes. Pas deux fois le
  même calcul parmi les six derniers (`TirageCalculs`, `src/core/calculs.ts`).
- **Le temps suit l'effort.** Chaque famille de calculs a un effort estimé (en secondes, pour un élève de la classe à
  l'aise) ; les jeux chronométrés en déduisent leur délai, généreux au CP, plus serré en Aventurier :
  `(2 + 1,5 × effort) × largesse`, largesse 1,6 au CP, 1,45 au CE1, 1,3 au CE2, 1,2 au CM1, 1,12 au CM2, 1 en
  Aventurier (`tempsDeReflexion`). Chaque jeu ajoute son réglage (Tranquille, altitude de Décollage !…), toujours
  entre 3 et 20 s.
- **Aucun indice qui fait le calcul**, à une exception voulue par Philippe : au CP, Neon Flight montre les groupements
  (`3 × 2` dessiné en deux groupes de trois points), parce qu'au CP la multiplication est d'abord un dénombrement de groupes.

## 4. La grille commune (calcul mental varié)

Utilisée par Pluie de météores, Décollage !, les bonus de Panique au phare !, le Voyage Zen de MULTIRAIL et le logo.

| Niveau | Palier 1 (acquis) | Palier 2 (cœur de l'année) | Palier 3 (découverte) |
|---|---|---|---|
| **CP** | `4 + 3`, `17 − 2`, `6 + 6` | `8 + 5`, `37 + 10`, `30 + 40`, `10 − 4`, `32 + 4` | `47 + 8`, `13 − 7`, `50 − 6`, `76 − 30`, `26 + 9`, `23 + 45` |
| **CE1** | `8 + 7`, `46 + 30`, `5 × 4`, `10 × 7`, `2 × 6` | `234 + 60`, `354 + 500`, `3 × 7`, `4 × 8`, `72 × 10`, `3 × 25`, `56 + 19`, `83 − 9`, `2 × 35` | `47 + 28`, `746 + 80`, `7 × 8`, `13 × 7` |
| **CE2** | `4 × 7`, `541 − 20`, `2 × 150`, `10 × 36` | `8 × 7`, `56 + 38`, `143 − 29`, `4 × 100`, `35 ÷ 5`, `156 + 78` | `63 ÷ 7`, `4 × 37`, `8 × 27`, `9 × 40`, `23 × 7` |
| **CM1** | `7 × 8`, `54 ÷ 6`, `38 × 10`, `746 + 80` | `347 + 28`, `612 − 39`, `6 × 40`, `3 × 300`, `5 × 36`, `4 × 45`, `25 × 6`, `4 × 15` | `21 × 35`, `14 × 6`, `245 + 178`, `(6 × 8) + 27`, `84 ÷ 7` |
| **CM2** | `9 × 7`, `72 ÷ 8`, `6 × 100`, `460 + 300` | `356 + 98`, `50 × 14`, `25 × 12`, `30 × 20`, `140 ÷ 4`, `216 ÷ 8`, `5 × 128` | `12 × 42`, `(7 × 8) + 23`, `250 − (9 × 8)`, `523 − 268`, `346 ÷ 2` |
| **Aventurier** | `11 × 8`, `12 × 9`, `25 × 8`, `50 × 7`, `486 + 57` | `17 × 6`, `25 × 16`, `144 ÷ 12`, `15 × 15`, `(7 × 8) + 23` | `13 × 14`, `(12 × 15) − (84 ÷ 7)`, `4 × 7 × 25`, `99 × 7`, `11 × 45`, `378 ÷ 6` |

Opérations par niveau : CP `+ −` ; CE1 `+ − ×` ; CE2 à Aventurier `+ − × ÷`.

## 5. Les six jeux : même niveau, mécanique propre

| Jeu | Ce que le niveau change | Ce qui ne change pas |
|---|---|---|
| **Panique au phare !** | valeur des cubes, taille des cibles, nombre de cubes de la meilleure solution, allure des monstres ; bonus volants tirés dans la grille commune | on additionne des cubes pour atteindre la cible |
| **Le Dragon gourmand** | valeurs des lanternes, cibles, combinaisons ; produits de lanternes à partir du CE2 seulement (tables connues), comme avant à Piquant | le dragon avale des lanternes jusqu'à la somme exacte |
| **Pluie de météores** | grille commune ; chute plus lente quand le calcul demande plus d'effort | on tape le résultat, aucune réponse n'est le début d'une autre |
| **Décollage !** | grille commune ; la couleur de l'encadré est le palier (vert 1, orange 2, rouge 3), le temps suit l'effort | calcul chronométré, poussée, plateformes |
| **Neon Flight** | **multiplications seulement** (grille ci-dessous) ; temps par calcul | on pilote en révisant ses tables, classements par série de tables |
| **MULTIRAIL** | Aventure et Entraînement : **multiplications seulement** (même grille que Neon Flight) ; Voyage Zen : grille commune (et, en Aventurier, le calcul mental combiné du 02/11) ; allure du train et temps selon l'effort | voyage contemplatif, ponts, wagons |

### Grille des multiplications (Neon Flight, MULTIRAIL)

La table choisie par le joueur reste le point d'appui : le niveau décide de ce qu'on fait avec elle.

| Niveau | Tables (deuxième facteur) | Multiplications élaborées (part) | Exemples |
|---|---|---|---|
| **CP** | facteurs 1 à 5, produits ≤ 30 (table de 10 : ≤ 50), **avec les groupements dessinés** dans Neon Flight | aucune | `3 × 2` ●●● ●●●, `5 × 4` |
| **CE1** | 1 à 5 pendant les huit premiers calculs, puis jusqu'à 10 | aucune | `4 × 6`, `7 × 3` |
| **CE2** | 2 à 10 | 20 % : table × dizaines, × 100, × 11 à 19, × 4 ou × 8 d'un nombre à deux chiffres | `7 × 40`, `6 × 100`, `7 × 13`, `4 × 23` |
| **CM1** | 2 à 10 | 30 % : × dizaines et centaines, × 5 d'un grand nombre, × 25, deux chiffres × un chiffre | `3 × 300`, `5 × 64`, `25 × 8`, `6 × 34` |
| **CM2** | 3 à 10 | 40 % : × 25, × 50, dizaines × dizaines, deux chiffres × un chiffre, 12 × ou 15 × la table | `8 × 50`, `30 × 20`, `8 × 47`, `12 × 7` |
| **Aventurier** | 3 à 12 (la table de 2 est écartée si d'autres sont choisies) | 55 % : facteurs 11 à 19, 25, 50, 99, trois facteurs | `13 × 14`, `12 × 15`, `25 × 16`, `50 × 18`, `4 × 7 × 25`, `99 × 6` |

Les deux premiers calculs d'une partie sont des faits de table ; une multiplication élaborée de découverte (palier 3)
n'arrive qu'après huit calculs, jamais sur le Grand Pont de MULTIRAIL ni après deux ratées. Son temps est multiplié par
`1 + 0,25 × (effort − 1)` (1,4 à 2,1). Elle n'entre pas dans la grille des tables ni dans la maîtrise. Seul le mode
classé en pose (Arcade de Neon Flight, Aventure de MULTIRAIL) ; l'Entraînement reste aux tables.

**MULTIRAIL, allure du train** : Douce au CP et au CE1, Promenade au CE2 et au CM1, Express au CM2 et en Aventurier ; le
train ralentit d'autant qu'une multiplication élaborée demande de temps. **Voyage Zen** : du CP au CM2, la grille
commune avec deux fois le temps de réflexion (6 à 30 s) ; en Aventurier, le calcul mental combiné (`explosif.ts`, qui
plafonne et laisse respirer).

## 6. Comptes, profils et classements existants

- Les identifiants techniques deviennent `cp`, `ce1`, `ce2`, `cm1`, `cm2`, `aventurier`.
- **Aucun résultat n'est modifié ni supprimé.** Les parties jouées aux anciens niveaux gardent leur niveau d'origine
  (`eveil`, `explorateur`, `stratege`, `maitre`) : elles restent dans l'historique, Mes progrès et les statistiques,
  affichées sous leur ancien nom, et leurs records sont visibles dans « Anciens records (niveaux à piments) » sur la
  page Classements. Elles ne sont jamais versées dans un classement de classe scolaire.
- **Profils** (migration 007) : l'ancien niveau est copié dans `profils.niveau_avant`, puis `profils.niveau` est vidé.
  Un profil sans niveau se voit proposer le choix au premier lancement ; aucune correspondance automatique
  (Explosif n'est pas « CM2 »).
- Les nouveaux classements comparent un jeu × une classe × un mode (× une série de tables pour Neon Flight et
  MULTIRAIL) : seulement des parties de difficulté comparable.

## 7. Vérifications (03/11/2026)

- `tests/calculs.test.ts` : 360 000 calculs (20 000 par niveau et par palier) relus par un évaluateur indépendant
  (`tests/outils-calculs.ts`) : valeur juste, entier de 1 à 999, aucune étape négative ou non entière, opérations de
  la classe, nombres ≤ 100 au CP, toutes les familles présentes, exemples de la fenêtre réellement tirés ; effort moyen
  croissant d'une classe à l'autre ; parties de 600 calculs à chaque niveau (entrée douce, respiration, plateau stable,
  aucune répétition) ; recul après des erreurs.
- `tests/multiplications.test.ts` : 55 000 multiplications élaborées par niveau, 1 500 questions de Neon Flight et 2 000
  de MULTIRAIL par niveau : que des ×, facteurs de la classe, temps accordé dans ses bornes, part des élaborées.
- Énigmes du phare et du dragon solubles aux six niveaux (`puzzle`, `dragon`), Voyage Zen, bonus, Décollage !.
- `scripts/niveaux-e2e.mjs` : six jeux × six niveaux par la vraie fenêtre de l'accueil, calculs réellement posés.

## 8. Pour plus tard

- **Rubrique « Techniques de calcul mental »** (chantier séparé, idée de Philippe) : astuces pour multiplier par 11,
  12, 25, 50, par 4 et 8 (doubler deux ou trois fois), par 5 (× 10 puis moitié), ajouter 9 ou 99, décomposer
  (`13 × 7 = 70 + 21`). Les procédures du programme citées ci-dessus en donnent le plan.
- Décimaux et fractions dans les jeux du CM (clavier avec virgule).
