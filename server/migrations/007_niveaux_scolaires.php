<?php

declare(strict_types=1);

use Calcoolos\Schema;

/**
 * Six niveaux scolaires (03/11/2026, doc/NIVEAUX_SCOLAIRES.md) : CP, CE1, CE2, CM1, CM2, Aventurier remplacent
 * Doux, Relevé, Piquant, Explosif. Un ancien niveau ne se traduit pas en classe (Explosif n'est ni le CM2 ni
 * l'Aventurier) : le profil garde la trace de son ancien niveau dans `niveau_avant` et choisira sa classe au prochain
 * jeu (niveau vide). Les résultats ne changent pas : ils restent sous leur ancien niveau, classés à part.
 * Retour arrière : l'ancienne version lit un niveau vide comme un niveau inconnu (fenêtre de choix) ; rien à défaire.
 */
return static fn (Schema $s): array => [
    'ALTER TABLE profils ADD COLUMN niveau_avant VARCHAR(16) NULL',
    "UPDATE profils SET niveau_avant = niveau, niveau = '' WHERE niveau IN ('eveil', 'explorateur', 'stratege', 'maitre')",
];
