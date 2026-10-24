<?php

declare(strict_types=1);

namespace Calcoolos;

/** Requête HTTP réduite à ce dont l'API a besoin (testable sans serveur web). */
final class Request
{
    /**
     * @param array<string, string> $query
     * @param array<string, string> $headers clés en minuscules
     */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query = [],
        public readonly string $body = '',
        public readonly array $headers = [],
        public readonly string $ip = '0.0.0.0',
    ) {
    }

    public static function fromGlobals(): self
    {
        $headers = [];
        foreach ($_SERVER as $k => $v) {
            if (str_starts_with((string) $k, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr((string) $k, 5)))] = (string) $v;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        }
        $uri = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
        // Tout ce qui suit « /api » est la route (le site peut vivre dans un sous-dossier).
        $pos = strpos($uri, '/api/');
        $path = $pos === false ? '/' : substr($uri, $pos + 4);
        $query = array_map('strval', array_filter($_GET, 'is_scalar'));
        return new self(
            strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            '/' . trim($path, '/'),
            $query,
            (string) file_get_contents('php://input', false, null, 0, 65536),
            $headers,
            (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'),
        );
    }

    public function header(string $name): string
    {
        return $this->headers[strtolower($name)] ?? '';
    }

    /** @return array<string, mixed> */
    public function json(): array
    {
        if ($this->body === '') {
            return [];
        }
        try {
            $data = json_decode($this->body, true, 16, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new HttpError(400, 'Données illisibles.');
        }
        if (!is_array($data) || array_is_list($data) && $data !== []) {
            throw new HttpError(400, 'Données illisibles.');
        }
        return $data;
    }
}

final class Response
{
    /** @param array<string, string> $headers */
    public function __construct(
        public readonly int $status,
        public readonly mixed $data,
        public readonly array $headers = [],
    ) {
    }

    public function body(): string
    {
        return json_encode($this->data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    public function send(): void
    {
        http_response_code($this->status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: same-origin');
        foreach ($this->headers as $k => $v) {
            header("$k: $v");
        }
        echo $this->body();
    }
}

/** Erreur prévue : message en français, montré tel quel à l'utilisateur. */
final class HttpError extends \RuntimeException
{
    /** @param array<string, string> $fields erreurs par champ */
    public function __construct(public readonly int $status, string $message, public readonly array $fields = [])
    {
        parent::__construct($message);
    }
}
