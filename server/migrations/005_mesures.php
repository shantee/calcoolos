<?php

declare(strict_types=1);

use Calcoolos\Schema;

/**
 * Chantier 3 (29/10/2026) : Neon Flight et statistiques communes à tous les jeux.
 * - variante : ce qui sépare les classements d'un même jeu, niveau et mode (Neon Flight : série de
 *   tables) ; vide pour les autres jeux, donc rien ne change pour les classements existants ;
 * - debut, actif : début de la partie et temps de jeu actif (pauses et arrière-plan exclus) ;
 * - calculs, justes, fausses, temps_moyen, temps_median (ms, bonnes réponses), serie : indicateurs
 *   mathématiques communs ; faits : bilan par multiplication (JSON « 7×8 » → [justes, ratés, ms, n]).
 * Toutes ces colonnes sont NULL pour les parties déjà enregistrées : on n'invente pas le passé.
 */
return static fn (Schema $s): array => [
    "ALTER TABLE resultats ADD COLUMN variante VARCHAR(16) NOT NULL DEFAULT ''",
    'ALTER TABLE resultats ADD COLUMN debut DATETIME NULL',
    'ALTER TABLE resultats ADD COLUMN actif INTEGER NULL',
    'ALTER TABLE resultats ADD COLUMN calculs INTEGER NULL',
    'ALTER TABLE resultats ADD COLUMN justes INTEGER NULL',
    'ALTER TABLE resultats ADD COLUMN fausses INTEGER NULL',
    'ALTER TABLE resultats ADD COLUMN temps_moyen INTEGER NULL',
    'ALTER TABLE resultats ADD COLUMN temps_median INTEGER NULL',
    'ALTER TABLE resultats ADD COLUMN serie INTEGER NULL',
    'ALTER TABLE resultats ADD COLUMN faits TEXT NULL',
    'CREATE INDEX resultats_classement_variante ON resultats (jeu, niveau, mode, variante, verifie, score)',
    'CREATE INDEX resultats_par_profil_partie ON resultats (profil_id, partie_cle)',
];
