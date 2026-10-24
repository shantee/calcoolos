# Ressources graphiques, sonores et typographiques

Aucun fichier image ni son externe n'est utilisé. Inventaire au 24/10/2026 :

| Ressource | Provenance | Licence |
|---|---|---|
| Tous les sprites et décors de la variante A (cubes, chiffres pixel, ennemi, pancarte, phare, ciel, îles, nuages, escargot, particules) | générés par code : `src/art/variant-a.ts` avec l'outil maison `src/art/pixelforge.ts` | code du projet |
| Police pixel des chiffres (7×10) | dessinée pour le projet dans `src/art/pixelforge.ts` | code du projet |
| Tous les sprites et décors de la variante B | dessinés par code (Canvas 2D) : `src/art/variant-b.ts` | code du projet |
| Décor SVG de l'accueil | écrit à la main dans `index.html` | code du projet |
| Sons (sélection, fusion, tir, impact, erreur, victoire) | synthétisés en direct par Web Audio : `src/game/sfx.ts` | code du projet |
| Police Pixelify Sans | paquet npm `@fontsource/pixelify-sans` 5.3.0 (Google Fonts) | SIL Open Font License 1.1 |
| Police Bricolage Grotesque | paquet npm `@fontsource-variable/bricolage-grotesque` 5.3.0 (Google Fonts) | SIL Open Font License 1.1 |
| Moteur Phaser 4.2.1 | npm `phaser` | MIT |

Les polices sont servies depuis le site lui-même (pas d'appel à Google). Aucun élément n'est copié d'une œuvre
existante. Les références citées dans le cahier des charges (floor796, Kingdom Rush, Adventure Time) n'ont servi que
d'inspiration générale.
