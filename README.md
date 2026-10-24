# calcoolos

Plateforme francophone de jeux de calcul mental, pensée d'abord pour les 7-12 ans et agréable pour les plus grands.
Ici, les calculs sont les actions du jeu : on additionne des cubes pour tirer sur un monstre, et non pour répondre à un questionnaire.

> **État : deux jeux complets et jouables** (direction 2D illustrée) : « Cubes de siège » et « Pluie de météores ».
> Pas encore de comptes ni de serveur.
> Cahier des charges : [`doc/`](doc/) · journal : [`JOURNAL_PROJET.md`](JOURNAL_PROJET.md).

## Lancer le projet

Prérequis : Node.js 20 ou plus récent (testé avec Node 22).

```bash
npm install
npm run dev        # http://localhost:5173 (rechargement automatique)
```

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm test` | tests unitaires (moteur d'énigmes, barème, déroulement d'une partie) |
| `npm run typecheck` | vérification TypeScript |
| `npm run build` | version de production dans `dist/` (fichiers statiques uniquement) |
| `npm run preview` | sert `dist/` sur http://localhost:4173 |
| `npm run captures` | captures réelles dans Chromium (serveur lancé ; voir plus bas) |

Pages :

- `/` : accueil, aide et choix du niveau ;
- `/jeu/cubes-de-siege.html` : Cubes de siège ;
- `/jeu/pluie-de-meteores.html` : Pluie de météores ;
- `/prototypes/a.html`, `/prototypes/b.html` : prototypes du choix de direction artistique (figés).

Paramètres d'URL utiles : `?niveau=eveil|explorateur|stratege|maitre`, `?graine=123` (partie reproductible),
`?calme` (animations réduites, comme le réglage système « réduire les animations »), `?accelere=4` (monstres
accélérés, pour les tests).

### Captures

```bash
npm run build && npm run preview &
node scripts/captures.mjs http://localhost:4173 CAPTURES
```

Partie complète jouée automatiquement (gagnée, ou perdue avec `perdre`) :

```bash
node scripts/partie-auto.mjs http://localhost:4173 CAPTURES tranquille explorateur
node scripts/partie-auto.mjs http://localhost:4173 CAPTURES perdre explorateur
node scripts/meteores-auto.mjs http://localhost:4173 CAPTURES gagner stratege
node scripts/meteores-auto.mjs http://localhost:4173 CAPTURES perdre explorateur
node scripts/test-un-seul-monstre.mjs http://localhost:4173
```

Ces scripts utilisent le Playwright installé sur la machine (il n'est pas une dépendance du projet). Il signale toute
erreur de console ou tout fichier qui n'a pas pu se charger.

## Comment jouer

Un monstre approche du phare avec un nombre sur sa pancarte. Additionne des cubes pour obtenir exactement ce nombre,
puis « Lancer ! ». Moins tu utilises de cubes, plus le coup est fort : deux solutions au nombre minimal de cubes valent
exactement la même chose. La somme n'est jamais affichée : le calcul se fait de tête. Une erreur ne coûte que la série
en cours.

Clavier : flèches, Espace (choisir), Entrée (lancer), Retour arrière ou Échap (effacer), M (son).

**Pluie de météores** : des météores et des robots tombent sur la station, chacun avec un calcul. Tape le résultat
(pavé à l'écran ou chiffres du clavier) : le vaisseau tire dès que la réponse est complète. Le météore doré fait tout
exploser ; le Robot-Mère demande six calculs.

## Organisation

```
brand.json            nom et slogan de la plateforme (le seul endroit à modifier pour renommer)
index.html            accueil
jeu/                  pages des jeux
prototypes/           pages des deux variantes graphiques (figées)
src/core/             logique pure et testée : hasard reproductible, énigmes, barème, paliers
src/game/             jeu Phaser : Cubes de siège (game-scene, session), prototypes A et B, sons synthétisés
src/art/              « PixelForge » (pixel art procédural), dessins de la variante B et du monde du jeu
tests/                tests Vitest
scripts/              captures Playwright et partie automatique
CAPTURES/             captures réelles des écrans
doc/                  cahier des charges d'origine + documents de conception
```

Voir [`doc/ARCHITECTURE.md`](doc/ARCHITECTURE.md), [`doc/DIRECTION_ARTISTIQUE.md`](doc/DIRECTION_ARTISTIQUE.md)
et [`ART_ASSETS.md`](ART_ASSETS.md).

## Renommer la plateforme

« Calcoolos » est un nom provisoire. Pour le changer : modifier `brand.json`. Les pages HTML (`%BRAND_NAME%`) et le
code (`src/brand.ts`) le reprennent automatiquement. Les clés de stockage local (`calcoolos.*`) sont internes et
peuvent rester telles quelles.
