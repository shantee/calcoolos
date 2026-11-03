# Astuces de calcul mental : les calculs malins dans les jeux et la future rubrique

Demande de Philippe du 03/11/2026 : garder les calculs « malins » (`147 × 5`), qui ont une vraie méthode de calcul
mental, mais mieux les accompagner (plus de temps, petit indice), et préparer une rubrique « Astuces de calcul
mental » sur le site.

## 1. Dans les jeux (fait le 03/11/2026)

**Calcul malin ou automatique.** Dans la grille commune (`src/core/calculs.ts`), une famille de calculs est
*maline* quand elle a une entrée dans `ASTUCES` : elle se fait avec une méthode (`× 5` = moitié de `× 10`,
`+ 19` = `+ 20 − 1`, `13 × 7` = `10 × 7 + 3 × 7`…). Les autres restent *automatiques* : faits de table, doubles
jusqu'à 20, `+ 10`, dizaines entières, `× 10`, calculs entre parenthèses.

**Ce que reçoit un calcul malin :**

- `astuce` : une phrase courte qui met sur la piste **sans jamais contenir la réponse** (vérifié sur 54 000 calculs ;
  si la phrase la contiendrait, par exemple `25 × 4` avec « 4 × 25 = 100 », le calcul n'a pas d'astuce) ;
- **un bon tiers de temps en plus** (`TEMPS_MALIN = 1,35` dans `tempsDeReflexion`) : Décollage ! et le Voyage Zen
  de MULTIRAIL, qui utilisent ce temps, en profitent tous les deux. Exemple : `147 × 5` au CM1 en Défi passe
  d'environ 8,8 s à 11,5 s.

**Décollage !** : l'astuce apparaît en jaune sous l'encadré du calcul **1,5 s après** le calcul (`ASTUCE_APRES`,
`session.ts`) : qui connaît sa méthode répond sans la voir, qui hésite la découvre. Après une erreur ou un temps
écoulé, elle reste affichée avec la bonne réponse ; après une bonne réponse, elle disparaît. Rien ne change aux
points ni aux cœurs.

**Pas encore dans les autres jeux** : Pluie de météores (plusieurs calculs à l'écran, pas de place pour une phrase
par météore) et les multiplications élaborées de Neon Flight et MULTIRAIL (`multiplications.ts`, autre générateur).
Le champ `astuce` est prêt : le Voyage Zen pourrait l'afficher sous le calcul de la même façon.

### Exemples réellement tirés

| Niveau | Calcul | Astuce |
|---|---|---|
| CP | `47 + 8`, `13 − 7` | passe par 50 / passe par 10 |
| CP | `41 + 9` | + 9, c'est + 10 puis − 1 |
| CE1 | `47 − 9` | − 9, c'est − 10 puis + 1 |
| CE1 | `333 + 90` | + 90, c'est + 100 puis − 10 |
| CE1 | `18 × 6` | 10 × 6 + 8 × 6 |
| CE2 | `4 × 17` | × 4, c'est doubler deux fois |
| CE2 | `70 × 8` | 8 × 7, puis × 10 |
| CM1 | `5 × 130` | × 5, c'est la moitié de × 10 |
| CM1 | `88 ÷ 8` | 80 ÷ 8 + 8 ÷ 8 |
| CM2 | `25 × 35` | 4 × 25 = 100 |
| CM2 | `180 ÷ 4` | ÷ 4, c'est la moitié de la moitié |
| CM2 | `154 ÷ 2` | moitié de 100, puis moitié de 54 |
| Aventurier | `2 × 7 × 25` | commence par 2 × 25 |
| Aventurier | `376 ÷ 8` | 320 ÷ 8 + 56 ÷ 8 |

Ajouter une astuce : une ligne dans `ASTUCES` (nom exact de la famille) ; `npm test` vérifie que le nom existe, que la
réponse n'apparaît jamais et que la phrase tient à l'écran (48 caractères au plus).

## 2. La future rubrique « Astuces de calcul mental » (proposition, rien n'est construit)

### Où l'intégrer

- Une page `astuces.html`, au même rang que Classements : lien **« Astuces »** dans la barre du haut, et une carte
  sous le manège de l'accueil (« Les astuces des champions »).
- Chaque astuce a son ancre (`astuces.html#fois-5`). Plus tard, l'écran de fin de Décollage ! peut proposer
  « Les astuces de ta partie » (celles qui sont apparues), avec un lien direct vers chaque fiche.

### Structure

Quatre familles, dans l'ordre où on les apprend ; chaque fiche porte la pastille de couleur de la classe où elle
arrive (mêmes couleurs que le sélecteur de niveau).

| Famille | Fiches | Classe |
|---|---|---|
| **Ajouter et enlever** | Passer par la dizaine (`47 + 8`) · Ajouter 9, 19, 99 (`+ 10 − 1`) · Enlever 9, 19, 99 (`− 10 + 1`) · Les dizaines d'abord (`47 + 28`) | CP → CM2 |
| **Doubler, prendre la moitié** | Doubler en deux morceaux (`2 × 35`) · La moitié en deux morceaux (`346 ÷ 2`) · Moitié de la moitié (`÷ 4`, `÷ 8`) | CE1 → CM2 |
| **Multiplier** | × 10, × 100 (on décale) · × 4 et × 8 (doubler deux ou trois fois) · × 5 (moitié de × 10) · × 50 (moitié de × 100) · × 25 (4 × 25 = 100) · Décomposer (`13 × 7 = 70 + 21`) · × 11 et × 99 | CE1 → Aventurier |
| **Diviser** | Retrouver la table (`63 ÷ 7` parce que `7 × 9 = 63`) · Couper en morceaux (`84 ÷ 7 = 70 ÷ 7 + 14 ÷ 7`) | CE2 → CM2 |

### Une fiche

1. **Le titre en truc de champion** : « Multiplier par 5 ? Prends la moitié de × 10 ! »
2. **Le personnage explique** dans une bulle, en une phrase.
3. **Un exemple en étapes** qui s'affichent l'une après l'autre (bouton « Étape suivante », ou au défilement) :
   `147 × 5` → `147 × 10 = 1 470` → `la moitié de 1 470` → `735`. Un petit dessin quand il aide : pour × 4, deux
   flèches « double » ; pour la dizaine, la droite numérique avec le saut jusqu'à 50.
4. **« À toi ! »** : trois calculs à taper sur la page, vérifiés tout de suite (pas de score, pas de compte).
5. **« Je m'entraîne en jouant »** : lien vers Décollage ! au niveau où l'astuce apparaît.

### Présentation illustrée

- **Personnage** : le logo « qui calcule de tête » (yeux, bulle de pensée), déjà animé et propre à Calcoolos ; il
  pointe l'étape en cours et cligne de l'œil à la fin. Autre possibilité : le chat pilote de Décollage !, si Philippe
  préfère un personnage des jeux (il en fournirait l'image, comme pour les graphismes de Décollage !).
- Style des pages de la plateforme (cartes, fond de l'accueil), nombres en `.pixel-nombre` (pas de Pixelify Sans
  pour les chiffres).
- Pas d'animation lourde : étapes en `opacity`/`transform`, respect de `prefers-reduced-motion`.

### Taille du chantier

Une page statique et un petit script pour « À toi ! » ; le plus long est le texte des fiches (une quinzaine). Un
premier lot de 5 fiches (passer par la dizaine, + 9 / + 99, × 5, × 25, doubler-moitié) suffirait pour lancer la
rubrique.
