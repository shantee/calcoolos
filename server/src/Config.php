<?php

declare(strict_types=1);

namespace Calcoolos;

/**
 * Configuration lue dans l'environnement, puis dans un fichier `.env` facultatif
 * (jamais versionné). En développement, des valeurs sûres par défaut permettent
 * de lancer l'API sans rien configurer (SQLite dans server/var/).
 */
final class Config
{
    /** @param array<string, string> $values */
    private function __construct(private array $values)
    {
    }

    public static function load(?string $envFile = null): self
    {
        $root = dirname(__DIR__);
        $file = $envFile ?? (getenv('CALCOOLOS_ENV_FILE') ?: $root . '/.env');
        $values = is_file($file) ? self::parse((string) file_get_contents($file)) : [];
        foreach (['APP_ENV', 'DB_DSN', 'DB_USER', 'DB_PASSWORD', 'APP_SECRET', 'COOKIE_SECURE', 'VAR_DIR', 'GOOGLE_CLIENT_ID', 'GOOGLE_CERTS_FILE'] as $key) {
            $env = getenv($key);
            if ($env !== false && $env !== '') {
                $values[$key] = $env;
            }
        }
        $values['APP_ENV'] ??= 'dev';
        $values['VAR_DIR'] ??= $root . '/var';
        if ($values['APP_ENV'] !== 'prod') {
            $values['DB_DSN'] ??= 'sqlite:' . $values['VAR_DIR'] . '/dev.sqlite';
            $values['COOKIE_SECURE'] ??= '0';
            $values['APP_SECRET'] ??= self::devSecret($values['VAR_DIR']);
        }
        foreach (['DB_DSN', 'APP_SECRET'] as $required) {
            if (($values[$required] ?? '') === '') {
                throw new \RuntimeException("Configuration incomplète : $required manquant");
            }
        }
        if (strlen($values['APP_SECRET']) < 32) {
            throw new \RuntimeException('APP_SECRET doit faire au moins 32 caractères');
        }
        return new self($values);
    }

    /** @param array<string, string> $values */
    public static function fromArray(array $values): self
    {
        return new self($values + ['APP_ENV' => 'test', 'COOKIE_SECURE' => '0', 'APP_SECRET' => str_repeat('t', 32)]);
    }

    public function get(string $key, string $default = ''): string
    {
        return $this->values[$key] ?? $default;
    }

    public function isProd(): bool
    {
        return $this->get('APP_ENV') === 'prod';
    }

    /** @return array<string, string> */
    private static function parse(string $text): array
    {
        $out = [];
        foreach (preg_split('/\R/', $text) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$k, $v] = array_map('trim', explode('=', $line, 2));
            if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && $v[-1] === $v[0]) {
                $v = substr($v, 1, -1);
            }
            $out[$k] = $v;
        }
        return $out;
    }

    /** Secret de développement, créé une fois dans server/var (jamais en production). */
    private static function devSecret(string $varDir): string
    {
        $file = $varDir . '/secret-dev';
        if (!is_file($file)) {
            if (!is_dir($varDir)) {
                mkdir($varDir, 0700, true);
            }
            file_put_contents($file, bin2hex(random_bytes(32)));
            chmod($file, 0600);
        }
        return trim((string) file_get_contents($file));
    }
}
