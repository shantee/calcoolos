<?php

declare(strict_types=1);

namespace Calcoolos;

/**
 * Vérification des jetons d'identité de « Continuer avec Google » (Google Identity Services).
 *
 * Le navigateur reçoit de Google un jeton signé (JWT RS256) et nous le transmet. On vérifie ici,
 * sans bibliothèque : la signature avec les clés publiques de Google (mises en cache), l'émetteur,
 * le destinataire (notre identifiant client), l'expiration. On n'en garde que l'identifiant Google
 * (`sub`, stable) et l'adresse e-mail.
 */
final class Google
{
    private const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
    private const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
    /** Décalage d'horloge toléré entre Google et le serveur (secondes). */
    private const SKEW = 300;
    /** Délai minimal entre deux téléchargements forcés des clés (clé inconnue). */
    private const REFETCH_GAP = 300;

    /** @var \Closure(): int */
    private \Closure $clock;

    /** @param (\Closure(): int)|null $clock */
    public function __construct(private readonly Config $config, ?\Closure $clock = null)
    {
        $this->clock = $clock ?? static fn (): int => time();
    }

    public function clientId(): string
    {
        return $this->config->get('GOOGLE_CLIENT_ID');
    }

    public function enabled(): bool
    {
        return $this->clientId() !== '';
    }

    /**
     * @return array{sub: string, email: string, emailVerifie: bool}
     * @throws HttpError 401 si le jeton n'est pas valable
     */
    public function verify(mixed $jwt): array
    {
        $refuse = static fn (): HttpError => new HttpError(401, 'Connexion Google refusée : réessaie.');
        if (!is_string($jwt) || strlen($jwt) > 4096 || substr_count($jwt, '.') !== 2) {
            throw $refuse();
        }
        [$h64, $p64, $s64] = explode('.', $jwt);
        $header = self::decodeJson($h64);
        $claims = self::decodeJson($p64);
        $signature = self::b64url($s64);
        if ($header === null || $claims === null || $signature === null) {
            throw $refuse();
        }
        // Seul RS256 est accepté (jamais « none », jamais un algorithme choisi par le jeton).
        if (($header['alg'] ?? '') !== 'RS256' || !is_string($header['kid'] ?? null)) {
            throw $refuse();
        }
        $pem = $this->publicKey($header['kid']);
        if ($pem === null || openssl_verify("$h64.$p64", $signature, $pem, OPENSSL_ALGO_SHA256) !== 1) {
            throw $refuse();
        }
        $now = ($this->clock)();
        $ok = in_array($claims['iss'] ?? null, self::ISSUERS, true)
            && ($claims['aud'] ?? null) === $this->clientId()
            && is_int($claims['exp'] ?? null) && $claims['exp'] + self::SKEW > $now
            && is_int($claims['iat'] ?? null) && $claims['iat'] - self::SKEW < $now
            && (!isset($claims['nbf']) || is_int($claims['nbf']) && $claims['nbf'] - self::SKEW < $now)
            && is_string($claims['sub'] ?? null) && preg_match('/^[A-Za-z0-9_-]{1,255}$/', $claims['sub']) === 1
            && is_string($claims['email'] ?? null) && strlen($claims['email']) <= 254
            && filter_var($claims['email'], FILTER_VALIDATE_EMAIL) !== false;
        if (!$ok || $this->clientId() === '') {
            throw $refuse();
        }
        return [
            'sub' => $claims['sub'],
            'email' => strtolower($claims['email']),
            'emailVerifie' => ($claims['email_verified'] ?? false) === true || ($claims['email_verified'] ?? '') === 'true',
        ];
    }

    /** Clé publique (PEM) de Google pour cet identifiant de clé, ou null. */
    private function publicKey(string $kid): ?string
    {
        $keys = $this->keys(false);
        if (!isset($keys[$kid])) {
            // Google change de clés régulièrement : on retélécharge, mais pas plus d'une fois toutes les 5 minutes.
            $keys = $this->keys(true);
        }
        $jwk = $keys[$kid] ?? null;
        if (!is_array($jwk) || ($jwk['kty'] ?? '') !== 'RSA' || !is_string($jwk['n'] ?? null) || !is_string($jwk['e'] ?? null)) {
            return null;
        }
        $n = self::b64url($jwk['n']);
        $e = self::b64url($jwk['e']);
        return $n === null || $e === null ? null : self::rsaPem($n, $e);
    }

    /** @return array<string, array<string, mixed>> clés indexées par kid */
    private function keys(bool $force): array
    {
        // Tests et développement : un fichier de clés local remplace Google (jamais en production).
        $local = $this->config->get('GOOGLE_CERTS_FILE');
        if ($local !== '' && !$this->config->isProd()) {
            return self::index(json_decode((string) @file_get_contents($local), true));
        }
        $cache = $this->config->get('VAR_DIR') . '/google-certs.json';
        $now = ($this->clock)();
        $saved = is_file($cache) ? json_decode((string) file_get_contents($cache), true) : null;
        $fresh = is_array($saved) && ($saved['expire'] ?? 0) > $now;
        $recent = is_array($saved) && ($saved['telecharge'] ?? 0) > $now - self::REFETCH_GAP;
        if (is_array($saved) && ($fresh && !$force || $force && $recent)) {
            return self::index($saved['jwks'] ?? null);
        }
        [$body, $maxAge] = self::download();
        if ($body === null) {
            return is_array($saved) ? self::index($saved['jwks'] ?? null) : [];
        }
        $jwks = json_decode($body, true);
        if (self::index($jwks) === []) {
            return is_array($saved) ? self::index($saved['jwks'] ?? null) : [];
        }
        $tmp = $cache . '.' . bin2hex(random_bytes(4));
        file_put_contents($tmp, json_encode(['telecharge' => $now, 'expire' => $now + max(300, min($maxAge, 86400)), 'jwks' => $jwks]));
        rename($tmp, $cache);
        return self::index($jwks);
    }

    /** @return array{0: ?string, 1: int} corps et durée de validité annoncée (Cache-Control) */
    private static function download(): array
    {
        if (!function_exists('curl_init')) {
            return [null, 0];
        }
        $maxAge = 3600;
        $ch = curl_init(self::CERTS_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_HEADERFUNCTION => static function ($ch, string $line) use (&$maxAge): int {
                if (preg_match('/^cache-control:.*max-age=(\d+)/i', $line, $m)) {
                    $maxAge = (int) $m[1];
                }
                return strlen($line);
            },
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        return [is_string($body) && $status === 200 ? $body : null, $maxAge];
    }

    /** @return array<string, array<string, mixed>> */
    private static function index(mixed $jwks): array
    {
        $out = [];
        foreach (is_array($jwks) && is_array($jwks['keys'] ?? null) ? $jwks['keys'] : [] as $k) {
            if (is_array($k) && is_string($k['kid'] ?? null)) {
                $out[$k['kid']] = $k;
            }
        }
        return $out;
    }

    /** @return array<string, mixed>|null */
    private static function decodeJson(string $part): ?array
    {
        $raw = self::b64url($part);
        $data = $raw === null ? null : json_decode($raw, true, 8);
        return is_array($data) ? $data : null;
    }

    private static function b64url(string $s): ?string
    {
        if ($s === '' || preg_match('/^[A-Za-z0-9_-]+$/', $s) !== 1) {
            return null;
        }
        $raw = base64_decode(strtr($s, '-_', '+/'), true);
        return $raw === false ? null : $raw;
    }

    /** Clé publique RSA (module n, exposant e) au format PEM, encodée à la main en DER. */
    private static function rsaPem(string $n, string $e): string
    {
        $len = static function (int $l): string {
            if ($l < 0x80) {
                return chr($l);
            }
            $b = ltrim(pack('N', $l), "\0");
            return chr(0x80 | strlen($b)) . $b;
        };
        $der = static fn (int $tag, string $body): string => chr($tag) . $len(strlen($body)) . $body;
        $int = static fn (string $b): string => $der(0x02, (ord($b[0]) & 0x80) ? "\0" . $b : $b);
        $rsa = $der(0x30, $int($n) . $int($e));
        // AlgorithmIdentifier : rsaEncryption (1.2.840.113549.1.1.1), paramètres NULL.
        $algo = $der(0x30, $der(0x06, "\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01") . "\x05\x00");
        $spki = $der(0x30, $algo . $der(0x03, "\0" . $rsa));
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }
}
