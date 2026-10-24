<?php

declare(strict_types=1);

/**
 * Point d'entrée unique de l'API : /api/… (Nginx envoie ici toutes ces adresses).
 * En développement : php -S localhost:8080 server/public/index.php
 */
require dirname(__DIR__) . '/src/bootstrap.php';

use Calcoolos\Api;
use Calcoolos\Config;
use Calcoolos\Db;
use Calcoolos\NativeSession;
use Calcoolos\Request;
use Calcoolos\Response;

try {
    $config = Config::load();
    $db = Db::connect($config);
    if (!$config->isProd()) {
        // En développement, la base se met à jour toute seule ; en production : bin/migrate.php.
        Db::migrate($db);
    }
    $api = new Api($db, new NativeSession($config), $config);
    $api->handle(Request::fromGlobals())->send();
} catch (Throwable $e) {
    error_log('calcoolos api: ' . $e::class . ' ' . $e->getMessage());
    (new Response(503, ['erreur' => 'Service indisponible pour le moment.']))->send();
}
