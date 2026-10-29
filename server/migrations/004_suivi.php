<?php

declare(strict_types=1);

use Calcoolos\Schema;

/**
 * Mesure d'audience maison (Calcoolos Analytics), sans cookie ni adresse IP :
 * - visites : une période d'activité d'un navigateur (identifiant aléatoire gardé dans le navigateur) ;
 * - parties : du lancement d'un jeu à sa fin ou à son abandon, avec le temps de jeu actif ;
 * - suivi_bilans : totaux par jour gardés quand les détails anciens sont effacés (conservation) ;
 * - suivi_journal : envois reçus et refusés par jour (santé de la collecte).
 * resultats.partie_cle relie une partie suivie au résultat envoyé par un profil (pas de double compte).
 * Les données existantes ne sont pas modifiées.
 */
return static fn (Schema $s): array => [
    "CREATE TABLE visites (
        id {$s->id()},
        cle VARCHAR(32) NOT NULL,
        visiteur VARCHAR(32) NOT NULL,
        compte_id {$s->refNull()},
        debut DATETIME NOT NULL,
        dernier DATETIME NOT NULL,
        actif INTEGER NOT NULL DEFAULT 0,
        pages INTEGER NOT NULL DEFAULT 0,
        appareil VARCHAR(12) NOT NULL,
        entree VARCHAR(20) NOT NULL,
        niveau_choisi TINYINT NOT NULL DEFAULT 0,
        inscription TINYINT NOT NULL DEFAULT 0,
        CONSTRAINT visites_cle UNIQUE (cle),
        CONSTRAINT visites_compte FOREIGN KEY (compte_id) REFERENCES comptes (id) ON DELETE SET NULL
    ){$s->table()}",
    'CREATE INDEX visites_par_debut ON visites (debut)',
    'CREATE INDEX visites_par_visiteur ON visites (visiteur, debut)',
    'CREATE INDEX visites_par_dernier ON visites (dernier)',

    "CREATE TABLE parties (
        id {$s->id()},
        cle VARCHAR(32) NOT NULL,
        visite_id {$s->refNull()},
        visiteur VARCHAR(32) NOT NULL,
        profil_id {$s->refNull()},
        compte_id {$s->refNull()},
        jeu VARCHAR(16) NOT NULL,
        niveau VARCHAR(16) NOT NULL,
        mode VARCHAR(16) NOT NULL,
        debut DATETIME NOT NULL,
        dernier DATETIME NOT NULL,
        fin DATETIME NULL,
        actif INTEGER NOT NULL DEFAULT 0,
        etat VARCHAR(12) NOT NULL,
        gagne TINYINT NULL,
        score INTEGER NULL,
        CONSTRAINT parties_cle UNIQUE (cle),
        CONSTRAINT parties_visite FOREIGN KEY (visite_id) REFERENCES visites (id) ON DELETE SET NULL,
        CONSTRAINT parties_profil FOREIGN KEY (profil_id) REFERENCES profils (id) ON DELETE SET NULL,
        CONSTRAINT parties_compte FOREIGN KEY (compte_id) REFERENCES comptes (id) ON DELETE SET NULL
    ){$s->table()}",
    'CREATE INDEX parties_par_debut ON parties (debut)',
    'CREATE INDEX parties_par_profil ON parties (profil_id, debut)',
    'CREATE INDEX parties_en_cours ON parties (etat, dernier)',

    "CREATE TABLE suivi_bilans (
        jour DATE NOT NULL,
        jeu VARCHAR(16) NOT NULL,
        visiteurs INTEGER NOT NULL,
        visites INTEGER NOT NULL,
        parties INTEGER NOT NULL,
        terminees INTEGER NOT NULL,
        actif INTEGER NOT NULL,
        PRIMARY KEY (jour, jeu)
    ){$s->table()}",

    "CREATE TABLE suivi_journal (
        jour DATE NOT NULL PRIMARY KEY,
        recus INTEGER NOT NULL DEFAULT 0,
        refuses INTEGER NOT NULL DEFAULT 0,
        dernier_refus VARCHAR(80) NULL
    ){$s->table()}",

    'ALTER TABLE resultats ADD COLUMN partie_cle VARCHAR(32) NULL',
    'CREATE INDEX resultats_par_partie ON resultats (partie_cle)',
];
