# Direction artistique : point de contrôle B

Deux variantes de la **même scène jouable** : même règle, même mise en page, même ennemi (le « Mordillon à
pancarte »), même phare à défendre. Seuls le rendu et le style des mouvements changent. Captures réelles (Chromium)
dans [`../CAPTURES/`](../CAPTURES/).

## Variante A : « Crépuscule d'archipel » (pixel art)

- Résolution native 427×240, affichée ×3 sans lissage. Sprites générés par **PixelForge** (`src/art/pixelforge.ts`) :
  formes éclairées comme des volumes, conversion en palette avec tramage ordonné (Bayer 4×4), contour automatique.
- Palette : ciel indigo → corail → abricot, pierre violacée, sarcelle magique, ambre pour l'interface.
- Chiffres des cubes : police pixel 7×10 dessinée pour le projet (traits de 2 pixels) ; textes avec Pixelify Sans.
- Mouvements « par pas » (sélection, pancarte qui se retourne), magie en lumière additive tramée.
- Vie du décor : étoiles qui scintillent, nuages qui dérivent, lucioles, escargot qui patrouille, maison minuscule sur
  une île lointaine.

**Forces :** atmosphère forte et cohérente ; le ciel tramé est très réussi ; style « auteur » qui assume son caractère.
**Faiblesses :** les textes pixel sont moins lisibles pour un enfant de 7 ans (accents, petits corps) ; l'agrandissement
n'est pas un multiple entier sur tous les écrans (pixels un peu inégaux) ; le pixel art évoque le rétro, ce qui
plaira moins à une partie du public ; les détails fins des personnages coûtent cher en temps.

## Variante B : « Gouache nocturne » (2D illustrée)

- Dessin vectoriel par code (`src/art/variant-b.ts`) : formes légèrement irrégulières, contour encré, ombre en aplat
  (croissant décalé), reflet, grain de papier sur toute la scène. Rendu ×2 pour rester net.
- Palette : nuit sarcelle, lune safran, corail, crème ; l'encre `#1d1a2b` unifie tout.
- Chiffres : Bricolage Grotesque (graisse 800), très lisibles sur les tuiles crème.
- Mouvements souples : rebond à la sélection, élasticité de la pancarte, dandinement, vol courbe des chiffres vers le
  point de fusion, comète avec traînée lumineuse, onde de choc.

**Forces :** lisibilité excellente (chiffres, cible, équation), aspect « premium » plus adulte, net sur tous les
écrans, personnages plus expressifs pour le même effort, se décline facilement vers le hub et l'interface web.
**Faiblesses :** le décor est encore simple (grand sol vide en bas, îles lointaines un peu schématiques) ; le style
« contour + aplat » est plus répandu, il faudra le pousser (textures, petits personnages, éclairage) pour qu'il reste
reconnaissable.

## Recommandation de Claude : **B**, en reprenant l'atmosphère de A

1. **Lisibilité d'abord** : le public commence à 7 ans et tout le jeu repose sur les nombres. B les rend parfaitement
   lisibles sans effort.
2. **Public large** : B plaît autant aux enfants qu'aux adultes ; le pixel art divise davantage.
3. **Évolutivité** : hub, interface web, nouveaux monstres et lieux se dessinent plus vite dans B, avec une qualité
   constante.
4. **À reprendre de A** : le ciel de crépuscule dégradé, les micro-détails vivants (escargot, maison), la retenue des
   effets.

Prochaines améliorations prévues si B est retenue : sol et premier plan plus riches (herbes hautes, rochers, racines
suspendues sous l'île), deux autres archétypes de monstres, petits habitants animés, ombres portées douces, typographie
du hub harmonisée.

## Charte provisoire (B)

| Élément | Règle |
|---|---|
| Encre | `#1d1a2b`, 4-5 px pour les personnages, 3 px pour les détails |
| Ombre | aplat plus foncé, décalé vers le bas-droite (lumière en haut à gauche) |
| Couleurs d'action | safran = sélection et récompense, sarcelle = magie et validation, corail = ennemis et « trop » |
| Chiffres | Bricolage Grotesque 800, jamais recouverts par un effet, jamais en rotation pendant un vol |
| Échelle | scène 1280×720 ; tuile 84 px ; ennemi environ 150 px |
| Effets | courts (moins d'une seconde), éclair limité à 16 % d'opacité, secousses supprimées si « réduire les animations » |
