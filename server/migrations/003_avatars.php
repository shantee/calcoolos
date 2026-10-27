<?php

declare(strict_types=1);

use Calcoolos\Schema;

/**
 * Nouveaux avatars (grille pixel art de Philippe, 27/10/2026) : les profils qui avaient un
 * ancien avatar dessiné par code reçoivent le plus proche des nouveaux. « robot » et
 * « canard » existent toujours.
 */
return static fn (Schema $s): array => [
    "UPDATE profils SET avatar = 'flamme' WHERE avatar = 'dragon'",
    "UPDATE profils SET avatar = 'pigeon' WHERE avatar = 'chouette'",
    "UPDATE profils SET avatar = 'axolotl' WHERE avatar = 'escargot'",
    "UPDATE profils SET avatar = 'chat-aviateur' WHERE avatar = 'chat'",
    "UPDATE profils SET avatar = 'requin' WHERE avatar = 'baleine'",
    "UPDATE profils SET avatar = 'poisson-astro' WHERE avatar = 'poisson'",
];
