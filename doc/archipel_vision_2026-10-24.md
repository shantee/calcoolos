# Projet Archipel — Vision de la plateforme de jeux mathématiques

**24 octobre 2026 · Document de cadrage · nom provisoire**

## Promesse

Créer une plateforme francophone de calcul mental où les mathématiques sont une mécanique de jeu, non un quiz décoré. Plusieurs modes de jeux d'arcade prennent place dans un même monde fantastique à explorer. Public cible : 7 à 12 ans, mais ouverture aux adolescents et aux adultes.

## Les cinq piliers

1. **Jeu d'abord** : chaque activité est un jeu satisfaisant et autonome.
2. **Mathématiques intégrées** : additions, soustractions, multiplications, divisions, décompositions et stratégies.
3. **Un monde cohérent** : hub, lieux, personnages et secrets, sans imposer une architecture ouverte trop coûteuse en V1.
4. **Une plateforme vivante** : invités, comptes familiaux, progression, défis, statistiques et classements avec protection des mineurs.
5. **Direction artistique forte** : visuels beaux, originaux, soignés, effets avancés mais lisibles ; Claude choisit le meilleur compromis technique.

## Les deux premiers modes

### Cubes de siège — pilote

Un ennemi portant le nombre **18** approche. Une grille de cubes numérotés permet de sélectionner une somme égale à 18. `9 + 9` et `10 + 8` infligent plus de dégâts qu'une combinaison à trois cubes, si deux cubes constituent le minimum disponible. Le système garantit des solutions et calcule l'optimum. Sélection, fusion, tir et impact sont accompagnés d'animations et de sons soignés.

### Défense fantastique — extension

Des vagues de créatures progressent sur un chemin. Résoudre des opérations déclenche sorts, boucliers et attaques. La difficulté et la pression temporelle sont adaptées au public. À ajouter uniquement quand le premier jeu est solide.

## Le hub

Une carte animée donnant accès à une forêt, un atelier de cubes, une tour des multiplications, un marché des défis et un observatoire des statistiques. En V1, un ou deux lieux accessibles suffisent ; ne pas simuler de contenu absent.

## Apprentissage

Parcours par paliers 7-8, 9-10, 11-12 ans, puis avancé/adultes. Un moteur adaptatif simple et testable observe réussites, erreurs et sous-compétences. Les récompenses valorisent autant la progression que la vitesse ; mode sans pression disponible.

## Graphisme

Le style peut être pixel art travaillé, 2D illustrée ou hybride. Éviter le visuel générique d'application éducative. Références de principe : floor796.com pour la vie des décors, Kingdom Rush pour la lisibilité, Adventure Time pour l'étrangeté et l'humour, sans copie. Claude doit tester deux directions visuelles au maximum sur une scène réelle et justifier son choix. Effets visuels lisibles et fluides, sons, réduction des animations.

## Plateforme et sécurité

Jeu dans le navigateur ; serveur Dell sous Ubuntu pour fichiers web, API PHP, base MariaDB, comptes et scores. Front envisageable : Phaser + TypeScript/Vite ; graphiques ECharts. Entrée en mode anonyme sans inscription ; inscription adulte/parent et profils enfants pseudonymes privés par défaut. Aucune messagerie publique ni achats en V1. Classements opt-in et contrôlés, par mode et difficulté. RGPD et garanties pour enfants à valider avant ouverture publique. Secrets et autres services du serveur jamais exposés aux agents cloud.

## Ordre de réalisation

1. Dépôt indépendant, lancement local, deux directions visuelles et capture réelle.
2. Un mini-jeu **Cubes de siège** complet et amusant avec tests et FX.
3. Hub interactif, invité, comptes familiaux et sauvegardes.
4. Graphiques essentiels, progrès, contrôles de sécurité, documentation Dell.
5. Deuxième mini-jeu et fonctions sociales seulement si temps/budget le permettent.

## Critères de réussite

Une vraie session jouable, sans données truquées ; qualité visuelle constatée dans le navigateur ; maths correctes ; installation reproductible ; scores persistants lorsque connecté ; navigation agréable sur desktop et tablette ; tests passés ; document de déploiement sans opérations de production.

## Budget

Les 100 $ de crédit annoncés couvrent des sessions cloud Claude Code selon les conditions du compte et ne garantissent ni livraison intégrale ni coût fixe. Vérifier le solde à chaque étape et conserver une marge pour tests et polish. Le code et les fichiers doivent rester utilisables une fois le crédit épuisé.
