<?php

declare(strict_types=1);

use Calcoolos\Schema;

/**
 * Connexion avec Google : identifiant Google (`sub`) associé à un compte, unique.
 * Un compte créé par Google n'a pas de mot de passe (mot_de_passe vide : la connexion
 * classique échoue toujours pour lui).
 */
return static fn (Schema $s): array => [
    'ALTER TABLE comptes ADD COLUMN google_sub VARCHAR(255) NULL',
    'CREATE UNIQUE INDEX comptes_google ON comptes (google_sub)',
];
