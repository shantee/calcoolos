<?php

declare(strict_types=1);

namespace Calcoolos;

use PDO;

/**
 * Accès à la base : MariaDB en production, SQLite pour le développement et les
 * tests. Les migrations sont écrites une fois et adaptées au moteur.
 */
final class Db
{
    public static function connect(Config $config): PDO
    {
        $dsn = $config->get('DB_DSN');
        if (str_starts_with($dsn, 'sqlite:')) {
            $path = substr($dsn, 7);
            if ($path !== ':memory:' && !is_dir(dirname($path))) {
                mkdir(dirname($path), 0700, true);
            }
        }
        $pdo = new PDO($dsn, $config->get('DB_USER') ?: null, $config->get('DB_PASSWORD') ?: null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        if (self::driver($pdo) === 'sqlite') {
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA journal_mode = WAL');
        } else {
            $pdo->exec("SET time_zone = '+00:00'");
        }
        return $pdo;
    }

    public static function driver(PDO $pdo): string
    {
        return (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    }

    /**
     * Applique les migrations manquantes (dossier server/migrations, dans l'ordre).
     * @return list<string> fichiers appliqués
     */
    public static function migrate(PDO $pdo): array
    {
        $pdo->exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
        $current = (int) ($pdo->query('SELECT MAX(version) FROM schema_version')->fetchColumn() ?: 0);
        $applied = [];
        $files = glob(dirname(__DIR__) . '/migrations/*.php') ?: [];
        sort($files);
        foreach ($files as $file) {
            $version = (int) basename($file);
            if ($version <= $current) {
                continue;
            }
            /** @var callable(Schema): list<string> $migration */
            $migration = require $file;
            foreach ($migration(new Schema(self::driver($pdo))) as $sql) {
                $pdo->exec($sql);
            }
            $pdo->prepare('INSERT INTO schema_version (version) VALUES (?)')->execute([$version]);
            $applied[] = basename($file);
        }
        return $applied;
    }
}

/** Petits morceaux de SQL qui diffèrent entre MariaDB et SQLite. */
final class Schema
{
    public function __construct(public readonly string $driver)
    {
    }

    public function id(): string
    {
        return $this->driver === 'mysql' ? 'BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    }

    public function ref(): string
    {
        return $this->driver === 'mysql' ? 'BIGINT UNSIGNED NOT NULL' : 'INTEGER NOT NULL';
    }

    public function table(): string
    {
        return $this->driver === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
    }
}
