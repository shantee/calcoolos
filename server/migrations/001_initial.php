<?php

declare(strict_types=1);

use Calcoolos\Schema;

/**
 * Schéma initial : comptes adultes, profils de joueurs privés, résultats,
 * tentatives (limitation de débit). Dates en UTC.
 */
return static fn (Schema $s): array => [
    "CREATE TABLE comptes (
        id {$s->id()},
        email VARCHAR(254) NOT NULL,
        mot_de_passe VARCHAR(255) NOT NULL,
        cree_le DATETIME NOT NULL,
        derniere_connexion DATETIME NULL,
        CONSTRAINT comptes_email UNIQUE (email)
    ){$s->table()}",

    "CREATE TABLE profils (
        id {$s->id()},
        compte_id {$s->ref()},
        pseudo VARCHAR(40) NOT NULL,
        avatar VARCHAR(20) NOT NULL,
        niveau VARCHAR(16) NOT NULL,
        classement_public TINYINT NOT NULL DEFAULT 0,
        nom_public VARCHAR(40) NOT NULL,
        cree_le DATETIME NOT NULL,
        CONSTRAINT profils_compte FOREIGN KEY (compte_id) REFERENCES comptes (id) ON DELETE CASCADE
    ){$s->table()}",
    'CREATE INDEX profils_par_compte ON profils (compte_id)',

    "CREATE TABLE resultats (
        id {$s->id()},
        profil_id {$s->ref()},
        jeu VARCHAR(16) NOT NULL,
        niveau VARCHAR(16) NOT NULL,
        mode VARCHAR(16) NOT NULL,
        score INTEGER NOT NULL,
        gagne TINYINT NOT NULL,
        etoiles TINYINT NOT NULL,
        duree INTEGER NOT NULL,
        precision_pct SMALLINT NOT NULL,
        ops TEXT NOT NULL,
        details TEXT NOT NULL,
        verifie TINYINT NOT NULL,
        motif VARCHAR(160) NULL,
        joue_le DATETIME NOT NULL,
        CONSTRAINT resultats_profil FOREIGN KEY (profil_id) REFERENCES profils (id) ON DELETE CASCADE
    ){$s->table()}",
    'CREATE INDEX resultats_par_profil ON resultats (profil_id, joue_le)',
    'CREATE INDEX resultats_classement ON resultats (jeu, niveau, mode, verifie, score)',

    "CREATE TABLE tentatives (
        id {$s->id()},
        cle VARCHAR(100) NOT NULL,
        moment DATETIME NOT NULL
    ){$s->table()}",
    'CREATE INDEX tentatives_par_cle ON tentatives (cle, moment)',
];
