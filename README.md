# calcoolos

Plateforme francophone de jeux de calcul mental, pensée d'abord pour les 7-12 ans et agréable pour les plus grands.
Ici, les calculs sont les actions du jeu : on additionne des cubes pour tirer sur un monstre, et non pour répondre à un questionnaire.

> **État : quatre jeux complets et jouables** : « Cubes de siège », « Pluie de météores », « Le Dragon gourmand »
> (2D illustrée) et « Décollage ! » (pixel art), plus la plateforme (invité, espace famille, profils, progrès, classements) avec son API PHP.
> **En ligne : https://calculos.zfx.fr** (serveur Dell). Publier une mise à jour : `bash deploy/publier.sh` (voir `doc/DEPLOIEMENT.md`).
> Cahier des charges : [`doc/`](doc/) · journal : [`JOURNAL_PROJET.md`](JOURNAL_PROJET.md) · **reprendre le projet : [`AGENTS.md`](AGENTS.md)**.

## Lancer le projet

Prérequis : Node.js 20 ou plus récent (testé avec Node 22).

```bash
npm install
npm run api        # API PHP sur 127.0.0.1:8080 (base SQLite de développement créée toute seule)
npm run dev        # http://localhost:5173 (rechargement automatique ; /api est transmis à l'API PHP)
```

Sans `npm run api`, les jeux marchent en mode invité ; l'espace parents et les classements indiquent que le serveur
est indisponible. Prérequis de l'API : PHP 8.2 ou plus avec `pdo_sqlite` (développement) ou `pdo_mysql` (production)
et `mbstring`.

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm test` | tests unitaires (moteurs des jeux, barèmes, tableau de bord) |
| `npm run test:api` | tests de l'API PHP (SQLite en mémoire ; MariaDB avec `TEST_DB_DSN`, voir `server/tests/run.php`) |
| `npm run typecheck` | vérification TypeScript |
| `npm run build` | version de production dans `dist/` (fichiers statiques uniquement) |
| `npm run preview` | sert `dist/` sur http://localhost:4173 |
| `npm run captures` | captures réelles dans Chromium (serveur lancé ; voir plus bas) |

Pages :

- `/` : accueil (une grande vitrine illustrée par jeu, aide en 2-3 phrases, choix du niveau ; `?calme` y coupe aussi
  les animations) ;
- `/jeu/cubes-de-siege.html` : Cubes de siège ;
- `/jeu/pluie-de-meteores.html` : Pluie de météores ;
- `/jeu/dragon-gourmand.html` : Le Dragon gourmand ;
- `/jeu/decollage.html` : Décollage ! ;
- `/compte.html` (espace parents), `/tableau.html` (mes progrès), `/classements.html`, `/confidentialite.html` ;
- (les prototypes A et B du choix de direction artistique ont été retirés le 26/10/2026 : historique git).

Paramètres d'URL utiles : `?niveau=eveil|explorateur|stratege|maitre`, `?graine=123` (partie reproductible),
`?calme` (animations réduites, comme le réglage système « réduire les animations »), `?accelere=4` (monstres
accélérés, pour les tests).

### Parties automatiques

Partie complète jouée automatiquement (gagnée, ou perdue avec `perdre`) :

```bash
node scripts/partie-auto.mjs http://localhost:4173 CAPTURES tranquille explorateur
node scripts/partie-auto.mjs http://localhost:4173 CAPTURES perdre explorateur
node scripts/meteores-auto.mjs http://localhost:4173 CAPTURES gagner stratege
node scripts/meteores-auto.mjs http://localhost:4173 CAPTURES perdre explorateur
node scripts/test-un-seul-monstre.mjs http://localhost:4173
node scripts/dragon-auto.mjs http://localhost:5173 CAPTURES gagner stratege
node scripts/dragon-auto.mjs http://localhost:5173 CAPTURES perdre explorateur
node scripts/fusee-auto.mjs http://localhost:5173 CAPTURES gagner explorateur
node scripts/plateforme-e2e.mjs http://localhost:5173 CAPTURES   # parcours complet (npm run api + npm run dev)
node scripts/csp-check.mjs                                        # dist/ avec les en-têtes de sécurité de Nginx
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
exploser ; le Robot-Mère demande six calculs. Pause : bouton « II », Échap ou P. Touche aussi la baleine, le chat
astronaute, les petits robots… et attrape le canard s'il passe.

**Le Dragon gourmand** : guide le dragon (souris, doigt ou flèches) et avale des lanternes pour faire exactement le
nombre demandé (en additionnant, ou en multipliant aux niveaux Stratège et Maître). Les lanternes avalées restent
visibles dans son corps ; s'il dépasse, il a le hoquet et recrache tout. Moins de lanternes = coup parfait.

**Décollage !** : un calcul apparaît, avec peu de temps pour répondre (moins pour les calculs faciles). Chaque bonne
réponse fait décoller la fusée ; pilote-la (flèches, Q et D, ou les boutons) pour te poser sur une plateforme. Du
village jusqu'à la planète Bonbon, en passant par la mer de nuages, le ciel des dirigeables et l'espace. Bonus sur
certaines plateformes : bouclier, sablier (plus de temps), turbo, étoile, cœur.

**Plateforme** : sans compte, tout reste dans le navigateur (aucun cookie). Un adulte peut créer un espace famille :
un profil par enfant (pseudo, avatar, niveau), progrès sur tous les appareils, classements publics sous le pseudo
(un bouton propose des pseudos rigolos).

## Organisation

```
brand.json            nom et slogan de la plateforme (le seul endroit à modifier pour renommer)
index.html            accueil (illustrations : src/images/accueil/, originaux : sources-images/accueil/)
jeu/                  pages des jeux
compte.html, tableau.html, classements.html, confidentialite.html   pages de la plateforme
src/core/             logique pure et testée : hasard reproductible, énigmes, barème, paliers, calculs
src/game/             jeux Phaser : siege/, meteors/, dragon/ (logique pure + scène), sons, effets partagés
src/platform/         plateforme : API, joueur actif, envoi des résultats, statistiques, avatars, barre du haut
src/entries/          point d'entrée de chaque page
src/i18n/             langues : détection, drapeaux, traduction anglaise (en.ts) et allemande (de.ts)
src/art/              dessins par code : variante B, monde de l'archipel, espace, dragon
server/               API PHP (src/, migrations/, bin/ outils, tests/, public/index.php)
deploy/               mise en ligne : publier.sh (publication), webdell/ (serveur Dell), kit générique
tests/                tests Vitest
scripts/              captures Playwright et partie automatique
CAPTURES/             captures réelles des écrans
doc/                  cahier des charges d'origine + documents de conception
```

Voir [`doc/ARCHITECTURE.md`](doc/ARCHITECTURE.md), [`doc/DEPLOIEMENT.md`](doc/DEPLOIEMENT.md),
[`doc/DIRECTION_ARTISTIQUE.md`](doc/DIRECTION_ARTISTIQUE.md) et [`ART_ASSETS.md`](ART_ASSETS.md).

## Langues

Le site est écrit en **français** (version de référence). Trois drapeaux, tout à droite de la barre du haut,
permettent de passer en **anglais** ou en **allemand** ; sans choix, la langue du navigateur est prise (français,
allemand ou anglais, et l'anglais pour toute autre langue). Le choix est retenu dans le navigateur.

Les traductions sont des dictionnaires « texte français → traduction » (`src/i18n/en.ts`, `src/i18n/de.ts`). On
continue d'écrire le code en français comme avant : un texte nouveau ou modifié qui n'est pas dans le dictionnaire
s'affiche simplement en français dans les autres langues. Pour voir ce qui manque sur une page :
`window.__tradManquantes` dans la console du navigateur. La page de confidentialité n'est pas traduite.

## Renommer la plateforme

« Calcoolos » est un nom provisoire. Pour le changer : modifier `brand.json`. Les pages HTML (`%BRAND_NAME%`) et le
code (`src/brand.ts`) le reprennent automatiquement. Les clés de stockage local (`calcoolos.*`) sont internes et
peuvent rester telles quelles.
