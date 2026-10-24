# calcoolos

Plateforme francophone de jeux de calcul mental, pensée d'abord pour les 7-12 ans et agréable pour les plus grands.
Ici, les calculs sont les actions du jeu : on additionne des cubes pour tirer sur un monstre, et non pour répondre à un questionnaire.

> **État : prototype, étape B (point de contrôle visuel).** Deux directions graphiques jouables de la scène
> « Cubes de siège » attendent un choix. Pas encore de comptes ni de serveur.
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

- `/` : accueil provisoire, choix du niveau ;
- `/prototypes/a.html` : variante A, pixel art ;
- `/prototypes/b.html` : variante B, 2D illustrée.

Paramètres d'URL utiles : `?niveau=eveil|explorateur|stratege|maitre`, `?graine=123` (partie reproductible),
`?calme` (animations réduites, comme le réglage système « réduire les animations »).

### Captures

```bash
npm run build && npm run preview &
node scripts/captures.mjs http://localhost:4173 CAPTURES
```

Le script utilise le Playwright installé sur la machine (il n'est pas une dépendance du projet). Il signale toute
erreur de console ou tout fichier qui n'a pas pu se charger.

## Comment jouer

Un monstre approche du phare avec un nombre sur sa pancarte. Choisis des cubes dont la somme fait exactement ce nombre,
puis « Lancer ! ». Moins tu utilises de cubes, plus le coup est fort : deux solutions au nombre minimal de cubes valent
exactement la même chose. Une erreur ne coûte rien d'autre que la série en cours, et le jeu indique ce qui manque.

Clavier : flèches, Espace (choisir), Entrée (lancer), Retour arrière ou Échap (effacer), M (son).

## Organisation

```
brand.json            nom et slogan de la plateforme (le seul endroit à modifier pour renommer)
index.html            accueil
prototypes/           pages des deux variantes graphiques
src/core/             logique pure et testée : hasard reproductible, énigmes, barème, paliers
src/game/             jeu Phaser : scène commune, variantes A et B, sons synthétisés
src/art/              « PixelForge » (pixel art procédural) et dessins de la variante B
tests/                tests Vitest
scripts/captures.mjs  captures Playwright
CAPTURES/             captures réelles des écrans
doc/                  cahier des charges d'origine + documents de conception
```

Voir [`doc/ARCHITECTURE.md`](doc/ARCHITECTURE.md), [`doc/DIRECTION_ARTISTIQUE.md`](doc/DIRECTION_ARTISTIQUE.md)
et [`ART_ASSETS.md`](ART_ASSETS.md).

## Renommer la plateforme

« Calcoolos » est un nom provisoire. Pour le changer : modifier `brand.json`. Les pages HTML (`%BRAND_NAME%`) et le
code (`src/brand.ts`) le reprennent automatiquement. Les clés de stockage local (`calcoolos.*`) sont internes et
peuvent rester telles quelles.
