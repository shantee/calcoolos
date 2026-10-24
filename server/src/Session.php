<?php

declare(strict_types=1);

namespace Calcoolos;

/**
 * Session de l'adulte connecté. Aucune session (donc aucun cookie) n'est créée
 * pour un visiteur invité : elle ne démarre qu'à la connexion.
 */
interface Session
{
    /** La session existe-t-elle déjà (cookie présent et valide) ? */
    public function active(): bool;

    public function get(string $key): mixed;

    /** Démarre la session si besoin, puis écrit la valeur. */
    public function set(string $key, mixed $value): void;

    /** Nouvel identifiant (contre la fixation de session), à la connexion. */
    public function regenerate(): void;

    public function destroy(): void;
}

/** Sessions PHP natives, cookie HttpOnly + SameSite=Lax (+ Secure en HTTPS). */
final class NativeSession implements Session
{
    private const NAME = 'calcoolos_session';
    private const LIFETIME = 30 * 24 * 3600;
    private bool $started = false;

    public function __construct(private readonly Config $config)
    {
    }

    private function configure(): void
    {
        $dir = $this->config->get('VAR_DIR') . '/sessions';
        if (!is_dir($dir)) {
            mkdir($dir, 0700, true);
        }
        // Dossier propre à l'application : le nettoyage automatique d'Ubuntu ne s'y
        // applique pas, PHP s'en charge lui-même (gc_probability).
        session_save_path($dir);
        session_name(self::NAME);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.gc_maxlifetime', (string) self::LIFETIME);
        ini_set('session.gc_probability', '1');
        ini_set('session.gc_divisor', '100');
        ini_set('session.sid_length', '48');
        ini_set('session.sid_bits_per_character', '6');
        session_set_cookie_params([
            'lifetime' => self::LIFETIME,
            'path' => '/',
            'secure' => $this->config->get('COOKIE_SECURE') === '1',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    private function start(): void
    {
        if ($this->started) {
            return;
        }
        $this->configure();
        session_start();
        $this->started = true;
    }

    public function active(): bool
    {
        if ($this->started) {
            return true;
        }
        if (!isset($_COOKIE[self::NAME])) {
            return false;
        }
        $this->start();
        return true;
    }

    public function get(string $key): mixed
    {
        return $this->active() ? ($_SESSION[$key] ?? null) : null;
    }

    public function set(string $key, mixed $value): void
    {
        $this->start();
        $_SESSION[$key] = $value;
    }

    public function regenerate(): void
    {
        $this->start();
        session_regenerate_id(true);
    }

    public function destroy(): void
    {
        if (!$this->active()) {
            return;
        }
        $_SESSION = [];
        $p = session_get_cookie_params();
        setcookie(self::NAME, '', [
            'expires' => time() - 3600,
            'path' => $p['path'],
            'secure' => $p['secure'],
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_destroy();
        $this->started = false;
    }
}

/** Session en mémoire pour les tests (un objet par « navigateur » simulé). */
final class MemorySession implements Session
{
    /** @var array<string, mixed>|null */
    private ?array $data = null;
    public int $regenerations = 0;

    public function active(): bool
    {
        return $this->data !== null;
    }

    public function get(string $key): mixed
    {
        return $this->data[$key] ?? null;
    }

    public function set(string $key, mixed $value): void
    {
        $this->data ??= [];
        $this->data[$key] = $value;
    }

    public function regenerate(): void
    {
        $this->data ??= [];
        $this->regenerations++;
    }

    public function destroy(): void
    {
        $this->data = null;
    }
}
