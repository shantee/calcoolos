# Architecture (état au 24/10/2026, étape D)

## Vue d'ensemble

```
Navigateur                                         Serveur Dell (kit prêt, pas encore installé)
┌───────────────────────────────────────────┐      ┌───────────────────────────────────┐
│ Pages HTML/CSS + TS (accueil, espace      │      │ Nginx (127.0.0.1:8088) : dist/     │
│ parents, progrès, classements)            │ ───▶ │ /api/ → PHP-FPM (pool dédié)       │
│ Jeux Phaser 4 + TypeScript (rendu, sons)  │ JSON │ server/ : API PHP 8.3, sans        │
│ Logique pure (énigmes, barèmes, stats)    │      │ dépendance → MariaDB 10.11         │
│ localStorage : invité, file d'attente     │      └───────────────────────────────────┘
└───────────────────────────────────────────┘          ▲ tunnel Cloudflare (après accord)
```

- **Vite** ne sert qu'au développement et à la construction : `npm run build` produit des fichiers statiques
  (`dist/`). Le serveur n'exécute ni Node ni Vite.
- **PHP + MariaDB** pour les comptes, profils et scores (décision de Philippe du 24/10/2026). L'API n'a aucune
  dépendance Composer : une dizaine de fichiers dans `server/src`, faciles à relire. SQLite sert au développement et
  aux tests ; les migrations sont écrites une fois et adaptées aux deux moteurs.
- **Phaser 4.2.1** (MIT) gère le rendu WebGL, les animations, les particules et les entrées.

## Découpage du code

| Dossier | Contenu | Dépend de Phaser ? |
|---|---|---|
| `src/core/` | `rng` (hasard reproductible), `puzzle` (générateur et solveur), `scoring` (barème), `difficulty` (paliers) | non, testé seul |
| `src/game/siege/round.ts` | état d'une partie (sélection, validation, score, série) | non, testé seul |
| `src/core/adaptive.ts` | difficulté adaptative à l'intérieur d'un palier | non, testé seul |
| `src/core/waves.ts` | types de monstres, vagues, modes Tranquille et Défi | non, testé seul |
| `src/game/siege/session.ts` | partie complète : vagues, cœurs, statistiques | non, testé seul |
| `src/game/siege/game-scene.ts` | **le jeu** : rendu, effets, écrans de début et de fin | oui |
| `src/art/world-b.ts` | monstres, habitants du décor, destruction du phare | non |
| `src/core/expressions.ts` | calculs des jeux d'arcade, par niveau, sans conflit de réponses | non, testé seul |
| `src/game/meteors/session.ts` | Pluie de météores : vagues, chute, saisie, tirs, boss, boucliers | non, testé seul |
| `src/game/meteors/meteor-scene.ts` | Pluie de météores : rendu, pavé numérique, effets | oui |
| `src/art/space.ts` | vaisseau, météores, robots, Robot-Mère, station, pavé | non |
| `src/game/dragon/session.ts` | Dragon gourmand : lanternes, objectifs garantis atteignables, ciels, faim, cœurs | non, testé seul |
| `src/game/dragon/dragon-scene.ts` | Dragon gourmand : vol, corps qui suit le chemin, feu, chauves-souris, orage | oui |
| `src/art/dragon.ts` | ciel, dragon, lanternes, chauves-souris, orage, montgolfière… | non |
| `src/platform/` | API, joueur actif, envoi des résultats (`results.ts`), statistiques (`stats.ts`, testé), avatars, DOM | non |
| `src/entries/*.ts` | une entrée par page (accueil, compte, tableau, classements, jeux) | selon la page |
| `server/` | API PHP : `Api.php` (routes), `Games.php` (contrôle des scores), `Db.php` (migrations), `Session.php` | — |
| `src/game/fx.ts` | feu d'artifice et confettis partagés | oui |
| `src/game/siege/base-scene.ts`, `scene-a.ts`, `scene-b.ts` | prototypes du point de contrôle B (figés) | oui |
| `src/game/sfx.ts` | sons synthétisés (Web Audio), coupables | non |
| `src/art/` | génération des visuels (aucun fichier image) | non |

Chaque mini-jeu suit le même schéma : une logique pure testée et une scène Phaser. En fin de partie, la scène appelle
`reportResult()` (`src/platform/results.ts`) avec un résultat commun à tous les jeux (jeu, niveau, mode, score,
victoire, étoiles, durée, précision, réussites par opération, détails propres au jeu).

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
| Validation fausse | 0 point, série remise à 0, sélection conservée, message « Ce n'est pas N » sans donner l'écart |
| Vitesse | bonus (jusqu'à 50 points) seulement en mode Défi |
| Monstre vaincu | bonus : Mordillon 50, Trotte-menu 40, Carapaçon 90, Roi 200 |

Cliquer au hasard n'est pas rentable : il faut valider explicitement, et une erreur casse la série.
La somme en cours n'est jamais affichée (« 6 + 5 = ? ») : le calcul se fait de tête.

## Partie

| Monstre | Points de vie | Vitesse | Particularité |
|---|---|---|---|
| Mordillon | 200 | normale | — |
| Trotte-menu | 100 | rapide | tombe en un coup |
| Carapaçon | 300 | lente | blindé : un coup imparfait ne fait que la moitié des dégâts |
| Roi Mordillon | 400 | lente | boss de la dernière vague |

4 vagues (3, 4, 4 et 1 monstres), soit environ 25 tirs. Mode **Tranquille** : monstres à 55 % de la vitesse, le
phare repousse les monstres sans rien perdre. Mode **Défi** : vitesse normale, 3 cœurs ; un monstre qui atteint le
phare coûte un cœur, et à zéro le phare s'écroule.

**Difficulté adaptative** (`src/core/adaptive.ts`) : 3 coups parfaits d'affilée font monter d'un cran (au plus +2),
2 erreurs sur les 3 dernières tentatives font descendre d'un cran (au plus −1). Un cran élargit ou réduit de 20 % la
plage des cibles ; au cran +2, la meilleure solution peut demander un cube de plus.

**Grille équilibrée** : les cubes utilisés sont remplacés ; si ceux qui restent sont petits en moyenne, les nouveaux
sont plutôt grands, et une même valeur ne peut pas apparaître trop souvent.

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
| ECharts 6 (Apache 2.0) pour les graphiques | recommandé par le cahier des charges, accessible (description ARIA), rendu canvas | 181 Ko compressés, chargés seulement sur « Mes progrès » |
| API PHP sans framework ni Composer | une dizaine de fichiers lisibles, rien à mettre à jour, se déploie comme les autres sites PHP du Dell | moins d'outils prêts à l'emploi (envoi d'e-mail, etc.) |
| Échelle « FIT » 1280×720 | une seule mise en page, bandes noires en 4:3 | pixel art pas toujours à un multiple entier en variante A |

## Pluie de météores

| Élément | Règle |
|---|---|
| Saisie | chiffre par chiffre ; tir dès que la saisie vaut exactement une réponse à l'écran ; erreur dès qu'elle ne peut plus en devenir une |
| Conflits | deux réponses à l'écran ne sont jamais le début l'une de l'autre |
| Points | `(50 + 100 × hauteur restante) × (1 + 0,1 × combo)` ; doré × 3 + 50 par météore emporté ; boss + 100 par calcul, + 1 000 à la fin |
| Vagues | 3 vagues (8, 12 et 14 objets dont un doré ; robots dès la 2ᵉ) puis le Robot-Mère (6 calculs) |
| Modes | Tranquille : chute à 60 % de la vitesse, le bouclier bloque tout ; Défi : 3 boucliers |
| Opérations | Éveil + et − jusqu'à 20 ; Explorateur + et − jusqu'à 50, tables de 2, 5, 10 ; Stratège + et − jusqu'à 100, tables 2 à 9, divisions ; Maître jusqu'à 200, tables jusqu'à 12 |
| Verrouillage | dès que la saisie commence comme une réponse, l'ennemi correspondant est visé (viseur) et prend peur |
| Mode « en feu » | série ≥ 8 : effets renforcés et musique plus rapide (pas de points en plus que la série elle-même) |
| Bonus caché | canard de l'espace cliquable : + 100 points |
| Étoiles de fin | 1 pour la victoire, + 1 si ≥ 85 % de calculs justes, + 1 si ≥ 95 % et aucun impact |

## Le Dragon gourmand

| Élément | Règle |
|---|---|
| Lanternes | toujours le même nombre dans le ciel (6 à 9 selon le niveau) ; une lanterne avalée est remplacée ailleurs |
| Objectif | atteignable avec les lanternes présentes (sac à dos pour les sommes, table des produits pour ×) ; après chaque bouchée, le reste l'est encore (au besoin, une lanterne lointaine change discrètement de valeur) |
| Ventre | les valeurs avalées restent affichées sur le corps ; le total ne l'est jamais |
| Dépassement | somme > cible, ou produit qui ne divise plus la cible : hoquet, ventre vidé, série perdue, même objectif |
| Points | `(150 + 50 × lanternes) × 1,5 si parfait × série (jusqu'à × 2)` + bonus de vitesse en Défi ; + 1 000 à la victoire |
| Niveaux | Éveil : sommes 6-15, lanternes 1-9 ; Explorateur : 10-25, 1-12 ; Stratège : sommes 14-36 et produits 12-90 (40 %) ; Maître : sommes 24-60 et produits 24-240 (50 %) |
| Ciels | 5, 6 puis 6 objectifs ; chauves-souris dès le 2ᵉ ciel, orage et éclairs au 3ᵉ |
| Modes | Tranquille : vol plus lent, rien à perdre ; Défi : chrono de faim par objectif et 3 cœurs |
| Feu | à chaque objectif ; brûle les chauves-souris dans le cône (toutes sur un coup parfait), les autres fuient |
| Étoiles | 1 pour la victoire, + 1 si ≥ 85 % sans hoquet, + 1 si ≥ 95 % sans être touché ni affamé |

## Plateforme (étape D)

### Qui est qui

- **Invité** : rien à créer. Records et historique dans le navigateur (`localStorage`), aucun cookie.
- **Adulte** : un compte (e-mail + mot de passe) pour la famille. La case « je suis un adulte responsable » est
  obligatoire.
- **Profils de joueurs** (6 par compte au plus) : pseudo, avatar, niveau. Ni nom, ni âge, ni date de naissance. Le
  « joueur actif » est retenu dans le navigateur ; le serveur vérifie à chaque envoi que le profil appartient bien au
  compte connecté.

### Données (MariaDB)

| Table | Contenu |
|---|---|
| `comptes` | e-mail, empreinte du mot de passe (argon2id), dates de création et de dernière connexion |
| `profils` | compte, pseudo, avatar, niveau, autorisation de classement public (non par défaut), nom public inventé |
| `resultats` | profil, jeu, niveau, mode, score, victoire, étoiles, durée, précision, réussites par opération (JSON), détails (JSON), vérifié ou non, motif du doute, date |
| `tentatives` | clé (empreinte de l'IP ou de l'e-mail) et date, pour les limites de débit ; purgée après 24 h |

Supprimer un compte supprime ses profils et leurs résultats (`ON DELETE CASCADE`).

### API (`/api/…`, JSON)

| Méthode | Adresse | Rôle |
|---|---|---|
| GET | `/etat` | connecté ? profils, jeton CSRF (aucune session créée pour un invité) |
| POST | `/inscription`, `/connexion`, `/deconnexion`, `/mot-de-passe`, `/supprimer-compte` | compte |
| GET, POST | `/profils`, `/profils/{id}/modifier`, `/profils/{id}/supprimer` | profils (404 si le profil n'est pas au compte) |
| POST | `/resultats` | enregistre un résultat |
| GET | `/profils/{id}/resultats` | historique d'un profil (300 derniers) |
| GET | `/classements?jeu=&niveau=&mode=` | top 20 public (profils autorisés, nom inventé, scores vérifiés) + classement familial si connecté |
| GET | `/export` | toutes les données du compte (fichier JSON) |

### Résultats : refusés, gardés « non classés », ou vérifiés

Le jeu tourne dans le navigateur : le serveur ne peut pas prouver qu'un score est honnête.
- **Forme** (sinon refus 422) : jeu, niveau et mode connus ; entiers bornés ; opérations parmi + − × ÷.
- **Vraisemblance** (sinon gardé, mais « non vérifié » et absent des classements) : score sous le maximum du jeu,
  victoire pas trop rapide, pas d'étoile sans victoire, points et réponses par seconde plausibles.
- **Débit** : 8 s au moins entre deux résultats d'un profil, 60 par heure au plus.

### Tableau de bord

L'historique (serveur pour un profil, navigateur pour l'invité) est résumé dans le navigateur par
`src/platform/stats.ts` (testé) : chiffres clés, parties et réussite par jour sur 30 jours, réussite par opération
(graphiques ECharts, avec équivalent textuel pour les lecteurs d'écran), records par jeu, niveau et mode, dix succès,
dernières parties.

### Sécurité

Voir `doc/DEPLOIEMENT.md` (« Sécurité : ce qui est en place ») : argon2id, cookie HttpOnly + SameSite (+ Secure),
CSRF par en-tête dédié et jeton, vérification de l'origine, limites de débit, SQL préparé, CSP stricte vérifiée par
`scripts/csp-check.mjs`, pool PHP isolé.

## Décollage !

Jeu en **pixel art** (1 pixel d'art = 4 pixels d'écran, Phaser en mode `pixelArt`). Logique : `src/game/rocket/session.ts`
(testée) ; scène : `src/game/rocket/rocket-scene.ts` ; dessins : `src/art/pixel-rocket.ts`.

| Élément | Règle |
|---|---|
| Boucle | un calcul est toujours affiché ; bonne réponse = poussée (vitesse verticale 600 px/s, environ 280 px de hauteur) ; mauvaise réponse ou temps écoulé = pas de poussée (la bonne réponse est montrée) |
| Réponse | jugée dès qu'elle a le bon nombre de chiffres ; clavier (rangée du haut sans Maj, même en AZERTY, ou pavé) ou pavé à l'écran |
| Temps | court pour les calculs faciles (2 à 3 s pour 4 + 3), plus long pour les tables difficiles et les divisions ; × 1,5 en Tranquille, un peu plus court en altitude ; borné entre 2 et 11 s |
| Calculs | menu du niveau (`src/core/expressions.ts`) ; au-dessus du ciel des dirigeables, 30 % viennent du niveau suivant |
| Pilotage | gauche/droite en vol (accélération, glisse, vitesse plafonnée) ; posée, la fusée suit sa plateforme |
| Monde | 5 étages jusqu'à 7 600 px : village, mer de nuages, ciel des dirigeables, espace, planète Bonbon ; plateformes plus étroites en montant, mobiles et fragiles dès les nuages ; chaque plateforme est à portée d'une seule poussée (testé sur 200 mondes) |
| Chute | se poser plus bas sauve ; tomber de plus de 820 px sous la dernière plateforme sûre : la montgolfière de secours ramène la fusée (Défi : −1 cœur, sauf bouclier) ; atterrissage brutal (chute de plus de 520 px depuis le plus haut point du saut, soit plus de deux étages) : −1 cœur en Défi ; une plateforme fragile se reforme 4 s après sa chute |
| Bonus | bouclier (protège d'une chute), sablier (5 calculs avec plus de temps), turbo (poussée × 1,35), étoile (+200), cœur ; étoiles à attraper en vol (+25) |
| Points | `(20 + 30 × rapidité) × série` par calcul, +50 par nouvelle plateforme, +1 000 à l'arrivée (+300 par cœur restant) |
| Étoiles | 1 pour la planète, + 1 si ≥ 85 % de calculs justes, + 1 si ≥ 95 % sans chute |
| Police | les nombres utilisent une police pixel dessinée pour le projet (chiffres de PixelForge et signes + − × ÷ = ?) : avec la police pixel courante, le 5 ressemblait à un S |
