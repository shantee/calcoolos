# Panique au phare ! — jokers magiques

Statut : publié le 03/11/2026 avec les sprites fournis, à confirmer visuellement par Philippe. Release 20261103-230809-008c032 sur https://calculos.zfx.fr.

## Règles
- Six classes conservées. CM2 : plafond de base 120, deux à trois cubes ; adaptation existante conservée. Les cibles au-dessus de 120 et les solutions longues deviennent occasionnelles.
- Allure selon le nombre minimal de cubes, les nombres peu ronds et la rareté des solutions optimales. Au-dessus de 120, temps supplémentaire.
- Trois gros boutons tactiles : Coup de froid (8 secondes dès activation), Météorite (cible soluble proche de 75 % de la précédente, sélection effacée sans erreur ni perte de série), Indice lumineux (un cube d'une solution optimale).
- Une charge initiale chacun, recharge toutes les 8 / 6 / 4 bonnes réponses. Deux charges au maximum, sans réserve cachée.
- Deux livraisons volantes occasionnelles à partir de la vague 2 : toucher la soucoupe ou le dirigeable apporte une charge à un des trois sorts qui en manque (repli sur un autre sort si nécessaire).
- Aucun ancien pouvoir, emplacement B/N, raccourci B/N ni pavé bonus. Les trois boutons restent visibles pendant les livraisons. Un engin ignoré repart sans pénalité.
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
Vérification générale après publication : 24/24 réussies sur ordinateur, tablette et téléphone, reconnexion/progression et suppression du compte de test incluses ; aucune erreur de console.

## Sprites fournis — 03/11/2026, Codex
À la demande de Philippe, intégration de sort-1/2/3.png fournis dans Téléchargements. Originaux conservés dans sources-images/phare/, découpe reproductible via scripts/decouper-sorts.py. États couleur si charge disponible, gris si vide ; six WebP chargés par Phaser, icône 64 px à côté du nom et des charges. Construction réussie. Publication demandée dans le même message.
Publication des sprites réussie : release 20261103-230809-008c032, 274 tests et 252 vérifications API, sauvegarde de base puis bascule. Contrôle tactile Chromium du site public réussi : trois sprites colorés, trois états gris après consommation, cible soluble et gel/reprise vérifiés, aucune erreur JavaScript. Captures : CAPTURES/sorts-phare/sprites-prets-en-ligne.png et sprites-vides-en-ligne.png. Commits locaux 84e45a7 / 008c032 ; aucun push. Index général actualisé mais non commitable (.git parent en lecture seule).

## Fusion de l'arsenal — 03/11/2026, Codex
À la demande de Philippe : retrait des anciennes niches et raccourcis B/N, de la Super Poussée et du Méga-tir, de leurs dessins/effets spécifiques et de l'ancien pavé de calcul bonus. Les trois sorts et leurs sprites sont conservés. Les engins réutilisent la soucoupe et le dirigeable dessinés ; une grande zone tactile de 290 × 240 unités permet de récupérer directement une charge. Deux passages naturels, à partir de la vague 2 ; 10 s en Défi, 12 s en Tranquille. Passage manqué : aucun effet sur le score, la sélection ou la série.
Réserve unique MagicPowers : une charge initiale, maximum deux par sort, recharge aux bonnes réponses conservée (8/6/4), sans stockage caché à plein. Le cadeau vise un sort non plein ; si celui-ci se remplit pendant le vol, repli sur un autre sort. Toute collecte est unique.
Les trois boutons sont décalés dans la place libérée sous le phare pour éviter le recouvrement par les commandes Accueil/Plein écran sur téléphone. Les engins ne masquent plus les sorts. Ancien script bonus-auto.mjs remplacé par le contrôle du nouveau système ; anciens tests remplacés par six tests ciblés d'arsenal et livraisons.
