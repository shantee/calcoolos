<?php

declare(strict_types=1);

/**
 * Chargement des classes de l'API (pas de dépendance Composer à installer).
 */
spl_autoload_register(static function (string $class): void {
    $prefix = 'Calcoolos\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $name = substr($class, strlen($prefix));
    // Quelques petites classes vivent dans le fichier de leur classe principale.
    $files = ['Schema' => 'Db', 'Response' => 'Http', 'HttpError' => 'Http', 'Request' => 'Http',
        'NativeSession' => 'Session', 'MemorySession' => 'Session', 'Names' => 'Games'];
    $file = __DIR__ . '/' . ($files[$name] ?? $name) . '.php';
    if (is_file($file)) {
        require_once $file;
    }
});
