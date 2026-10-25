# CALCOOLOS — CHANTIER 01 : REFONTE WOW DE LA PAGE D’ACCUEIL
## Ordre d’exécution pour Claude Code — 25 octobre 2026

TU DOIS DÉVELOPPER ET TESTER LA REFONTE DE LA PAGE D’ACCUEIL EXISTANTE.
Ceci est un CHANTIER UNIQUE : n’ajoute pas de nouveau mini-jeu et ne modifie pas les mécaniques des 4 jeux. Les captures et illustrations jointes servent à comprendre les jeux et à reconstruire leur présentation.

### 1. CONTEXTE ET INTENTION
Plateforme : Calcoolos (dépôt GitHub shantee/calcoolos), jeux de calcul mental 7-12 ans et adultes. Quatre jeux existants : « Cubes de siège », « Pluie de météores », « Le Dragon gourmand », « Décollage ! ».
L’accueil actuel présente trois petites cartes serrées sur la première ligne, puis une quatrième mal logée dessous. Le descriptif de « Décollage ! » semble déborder horizontalement de son encart sur la capture ; le dernier bloc est coupé par le bas du viewport de la capture. Le résultat manque d’impact et d’air. Il s’agit d’une critique de mise en page, pas d’un problème de gameplay.
Objectif : recréer une page d’accueil impressionnante, originale, harmonieuse, soignée, premium, élégante, vivante, claire et rapide. Le « WOW » doit venir de la hiérarchie graphique, des illustrations et de micro-animations bien dosées, PAS d’une accumulation d’effets, de nuages, d’étoiles ou d’îles.

### 2. DÉCISION FERME SUR LA MISE EN PAGE
PRÉSENTER LES QUATRE JEUX UN PAR UN, VERTICALEMENT. C’est le choix du commanditaire, pas une demande de grille 2x2. Faire de belles grandes sections illustrées avec une image marquante, le titre, une explication claire et courte (2 ou 3 phrases), un exemple mathématique éventuellement et un bouton « Jouer » évident. L’ordre reste : Cubes, Météores, Dragon, Décollage.
Sur ordinateur, chaque section peut présenter image large d’un côté et texte de l’autre, avec alternance possible gauche/droite si cela améliore le rythme. Sur mobile, image en premier puis texte et bouton, une seule colonne. S’assurer qu’on devine immédiatement qu’il y a d’autres jeux en faisant défiler : amorce visible de la section suivante, repère de progression discret, accroche « Explore les jeux » ou autre mécanisme subtil. Ne jamais piéger le scroll et ne pas imposer un carrousel masquant les jeux.

### 3. ILLUSTRATIONS LIVRÉES
Utiliser EN PRIORITÉ les quatre nouvelles images dans `assets/illustrations_retenues/` ou leur version WebP dans `assets/webp_optimises/` :
- `01_cubes_de_siege` : phare, plateau de cubes, chat, monstre « 29 » ;
- `02_pluie_de_meteores` : fusée avec pilote chat, météores numérotés, pavé de réponses ;
- `03_le_dragon_gourmand` : dragon, lanternes numérotées, nuit ;
- `04_decollage` : petite fusée, plateforme, panneau de calcul et paysage clair.
Ces images sont des ILLUSTRATIONS PROMOTIONNELLES : ne pas les prendre pour des captures de gameplay contractuelles ni pour des ressources de calcul ou du texte de l’interface.
TU AS CARTE BLANCHE POUR REDIMENSIONNER, RECADRER, ROGNER, REPOSITIONNER LES IMAGES, APPLIQUER DES MASQUES ET DÉGRADÉS, CHOISIR `object-fit`/`object-position`, LES CONVERTIR EN WEBP/AVIF, PRODUIRE DES VERSIONS ADAPTÉES PAR FORMAT, ET LES COMPOSER DANS LES SECTIONS. Tu peux créer des versions portrait/paysage à partir des originaux si nécessaire. Conserver de préférence les sujets principaux (mascotte, ennemi, fusée, dragon, cube) et éviter de rogner l’action clé. Ne pas étirer ni déformer les proportions des personnages. Garder les fichiers sources d’origine et réutiliser les variantes optimisées pour le site.
Les quatre propositions plus anciennes sont dans `assets/illustrations_precedentes_archivees/`. Elles sont archivées pour référence et NE DOIVENT PAS remplacer les quatre nouvelles images sans raison documentée.

### 4. COHÉRENCE ARTISTIQUE
La direction du commanditaire : du pixel art travaillé, propre, original, un côté jeu indépendant premium, quelques éléments inspirés du vivant de floor796 sans copie de ses créations, une certaine simplicité ludique proche de l’animation fantasy, SANS rendu générique enfantin, trop sucré ou surchargé « IA fouillis ». Respecter l’identité existante de Calcoolos (palette nocturne / stylisation) tout en donnant à l’accueil plus de qualité, de contraste, d’espace, de profondeur et d’intention. Les quatre images peuvent posséder des ambiances différentes, mais la TYPOGRAPHIE, LES CADRES, LES BOUTONS, LES ESPACEMENTS et les transitions doivent constituer un système cohérent.
Effets possibles mais retenus : transitions au scroll, parallax léger limité, silhouettes flottantes, survol magnétique discret, révélation de titre, halos très subtils, petits éléments réagissant au pointeur. Rien de bruyant ; 60 fps lorsque possible. Respecter `prefers-reduced-motion` et le paramètre `?calme` lorsqu’il s’applique.

### 5. CONTENU ET FONCTIONNALITÉS À CONSERVER
Ne pas casser la barre de navigation existante ni l’accueil invité / familial. Conserver « Qui joue ? » quand un compte actif le demande, le choix de niveau (Éveil 7-8, Explorateur 9-10, Stratège 11-12, Maître ados/adultes), les vrais liens Jouer, les informations invité / confidentialité et la navigation vers l’espace famille. Ne pas introduire de faux écrans.
Chemins de jeu EXACTS :
- `jeu/cubes-de-siege.html`
- `jeu/pluie-de-meteores.html`
- `jeu/dragon-gourmand.html`
- `jeu/decollage.html`
Faire coexister un titre principal clair, une accroche motivante, un contrôle de niveau facile à trouver, des CTA lisibles et les 4 jeux dans une séquence logique. Ne jamais montrer le résultat d’une énigme avant la réponse dans les jeux ; ici les exemples restent purement éditoriaux.

### 6. TECHNIQUE, ACCESSIBILITÉ, PERFORMANCE
Dépôt : `shantee/calcoolos`, branche de travail respectant le flux Git du projet. Consulter `AGENTS.md`, `CLAUDE.md`, `JOURNAL_PROJET.md`, `doc/DIRECTION_ARTISTIQUE.md`, `doc/ARCHITECTURE.md` avant tout changement. Cibles a priori : `index.html`, `src/styles/accueil.css`, `src/entries/accueil.ts` et éventuellement des composants partagés déjà existants ; ne pas toucher aux moteurs des jeux sans nécessité démontrée.
La page doit fonctionner sur un grand écran de bureau, sur tablette et sur téléphone (exemples d’essai : 1440x900, 1280x720, 768x1024, 390x844, 360x740). Les textes doivent s’adapter sans déborder, les boutons ne doivent jamais être coupés et les images ne doivent pas pousser horizontalement le viewport.
Utiliser des images optimisées, `srcset`/`sizes` ou `picture` si utile, chargement différé des visuels sous la ligne de flottaison, dimensions explicites pour éviter les sauts, image première section prioritaire. Attention aux chargements réseaux et cache. Images avec `alt` descriptif, vrai HTML sémantique, titres ordonnés, navigation clavier et focus visible, contraste et cibles tactiles corrects. Pas de contenu ou de contrôle important uniquement au survol.
Conserver la politique de sécurité de contenu (CSP), ne pas ajouter de CDN externe, de dépendance lourde gratuite et inutile, de pisteur ni d’appel externe non justifié.

### 7. MÉTHODE DE TRAVAIL EXIGÉE
1. Lire les consignes de reprise du dépôt et faire un état initial bref.
2. Implémenter une proposition de page d’accueil entière et réellement jouable ; éviter plusieurs maquettes fictives.
3. Lancer `npm run typecheck`, `npm run build`, `npm test`, et tests complémentaires pertinents.
4. Ouvrir vraiment la page dans Chromium/Playwright et produire DES CAPTURES DES RENDUS (pas de maquettes uniquement) aux tailles bureau et mobile. Vérifier scroll haut/milieu/bas, affichage des 4 jeux, textes, liens Jouer, sélecteur de niveau, barre parent/compte et absence de scroll horizontal.
5. Inspecter soi-même les captures et corriger les problèmes de composition/alignement avant livraison. Vérifier la lisibilité des visuels après recadrage.
6. Mettre à jour la documentation et `JOURNAL_PROJET.md`, fournir un résumé en FRANÇAIS SIMPLE des choix artistiques, fichiers changés, essais faits, limites restantes et aperçu visuel.
7. Ne pas déployer sur le Dell, ni modifier Cloudflare/DNS ou d’autres sites, sans autorisation explicite.

### 8. CRITÈRES DE RÉCEPTION
- Exactement 4 jeux présentés verticalement, un jeu par grande section, pas de grille 3+1.
- 4 nouvelles illustrations intégrées ; mascotte/objet principal bien visible ; pas de déformation des images.
- Aucun débordement horizontal ou coupure de texte/CTA, notamment « Décollage ! ».
- Les visiteurs comprennent immédiatement l’existence de plusieurs jeux et peuvent facilement défiler.
- Mise en page réellement responsive ; quatre liens Jouer actifs et niveau conservé.
- Accueil connecté/invité et parcours familles non régressés.
- Apparence premium, originale, aérée ; micro-animations utiles seulement ; mode mouvement réduit pris en compte.
- Captures de tests desktop/tablette/mobile disponibles ; build/typecheck/tests réussis, ou échecs expliqués.
- Aucun déploiement ni écriture hors du dépôt.

IMPORTANT : Les captures présentent en haut un avertissement Chromium concernant `--disable-blink-features=AutomationControlled`. C’est une bannière du navigateur de test, pas un bug de Calcoolos : ne pas perdre de temps à la corriger dans le code du site.

MISSION : ne réponds pas seulement avec une description ou un plan : effectue la refonte dans le dépôt, vérifie le résultat dans un navigateur et livre un travail prêt à être relu.
