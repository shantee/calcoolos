<?php

declare(strict_types=1);

use Calcoolos\Schema;

/**
 * Chantier comptes (30/10/2026) : un compte peut désigner le profil de son titulaire adulte.
 * Une seule colonne, vide pour tous les comptes existants : aucun profil existant ne change de nature
 * et l'ancienne version du code continue de fonctionner (retour arrière sans toucher à la base).
 * Pas de clé étrangère : le lien se lit toujours par jointure avec profils, donc un numéro périmé ne compte pas.
 */
return static fn (Schema $s): array => [
    "ALTER TABLE comptes ADD COLUMN profil_personnel {$s->refNull()}",
];
