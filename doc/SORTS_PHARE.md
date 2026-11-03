# Panique au phare ! — jokers magiques

Statut : publié le 03/11/2026, à confirmer visuellement par Philippe. Release 20261103-225435-a63a540 sur https://calculos.zfx.fr.

## Règles
- Six classes conservées. CM2 : plafond de base 120, deux à trois cubes ; adaptation existante conservée. Les cibles au-dessus de 120 et les solutions longues deviennent occasionnelles.
- Allure selon le nombre minimal de cubes, les nombres peu ronds et la rareté des solutions optimales. Au-dessus de 120, temps supplémentaire.
- Trois gros boutons tactiles : Coup de froid (8 secondes dès activation), Météorite (cible soluble proche de 75 % de la précédente, sélection effacée sans erreur ni perte de série), Indice lumineux (un cube d'une solution optimale).
- Une charge initiale chacun, recharge toutes les 8 / 6 / 4 bonnes réponses. Deux charges visibles au maximum.
- Les bonus volants sont conservés. Leur gel réutilise la même glace et dure aussi huit secondes.
- Pendant le pavé des bonus volants, les boutons magiques sont masqués pour éviter les superpositions.
- La météorite ne déplace pas un ennemi gelé : le gel reste prioritaire. Une cible déjà minimale ne consomme pas de charge.
- Animations allégées avec la préférence système ou ?calme.

## Journal — 2026-11-03, Codex
Logique, effets Phaser et tests ajoutés. Compilation de production réussie. Tests ciblés : 40 réussis, dont 360 grilles pour météorite/indice et 100 départs CM2. Suite initiale : 267 réussis, un ancien test attendait un gel différent selon le mode ; attente mise à jour pour les huit secondes.

## Prochaines étapes
Confirmer la sensation de jeu sur une vraie tablette et l'équilibrage avec un enfant ; publier seulement sur demande. Les effets et sons n'ont pas été évalués par un humain.

Validation finale : 271/271 tests passent (délai porté à 30 s pour les gros tests de génération : trois dépassaient les 5 s par défaut). Build réussi. Parcours Chromium tactile avec animations réduites : trois sorts activés, nouvelle solution vérifiée, abscisse identique après 7,5 s de gel puis déplacement après dégel ; aucune erreur JavaScript. Capture : CAPTURES/sorts-phare/tactile.png. Pas d'essai physique sur tablette.
Commits locaux : be26678, 2b76c4b. L'index général est modifié mais son commit est impossible : .git du dossier parent en lecture seule.

## Publication — 03/11/2026, Codex
Demandée explicitement par Philippe. Publication via deploy/publier.sh : 271 tests, types/build, 252 vérifications API, sauvegarde de base puis bascule réussis. Release 20261103-225435-a63a540. Configuration SSH locale contournée avec -F /dev/null (fichier système refusé par OpenSSH), sans modification système.
Parcours tactile sur le site public réussi : les trois sorts fonctionnent, cible 77 soluble, gel vérifié immobile puis reprise après huit secondes, aucune erreur JavaScript. Capture : CAPTURES/sorts-phare/en-ligne.png. Pas de push GitHub.
