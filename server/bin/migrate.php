<?php

declare(strict_types=1);

/**
 * Applique les migrations de la base (à lancer à chaque déploiement).
 * Usage : php server/bin/migrate.php
 */
require dirname(__DIR__) . '/src/bootstrap.php';

use Calcoolos\Config;
use Calcoolos\Db;

if (PHP_SAPI !== 'cli') {
    exit(1);
}
$db = Db::connect(Config::load());
$applied = Db::migrate($db);
echo $applied ? 'Migrations appliquées : ' . implode(', ', $applied) . "\n" : "Base déjà à jour.\n";
