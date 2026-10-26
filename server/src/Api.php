<?php

declare(strict_types=1);

namespace Calcoolos;

use PDO;

/**
 * L'API JSON de la plateforme.
 *
 * - Les invités n'ont besoin de rien ici (tout reste dans leur navigateur).
 * - Un adulte (parent) crée un compte : e-mail + mot de passe, ou « Continuer avec Google »
 *   (même compte, mêmes profils : seul le moyen de se connecter change).
 * - Il crée des profils de joueurs privés : pseudo, avatar, niveau. Rien d'autre.
 * - Les résultats sont rattachés à un profil ; seul le compte propriétaire les voit.
 * - Classements publics : seulement les profils dont l'adulte l'a autorisé, sous un
 *   nom public généré (jamais le pseudo, jamais l'e-mail).
 *
 * Protection CSRF : toute requête POST doit être en JSON et porter l'en-tête
 * `X-Calcoolos` (impossible depuis un formulaire d'un autre site) ; une fois
 * connecté, elle doit aussi porter le jeton de session `X-CSRF-Token`.
 */
final class Api
{
    public const MAX_PROFILES = 6;
    private const AVATARS = ['dragon', 'chouette', 'escargot', 'robot', 'chat', 'baleine', 'canard', 'poisson'];
    private const LOGIN_LIMIT = 8;
    private const LOGIN_WINDOW = 900;
    private const SIGNUP_LIMIT = 5;
    private const SIGNUP_WINDOW = 3600;
    private const RESULT_GAP = 8;
    private const RESULT_HOURLY = 60;

    /** @var \Closure(): int */
    private \Closure $clock;
    private Google $google;

    /** @param (\Closure(): int)|null $clock horloge (secondes), remplaçable dans les tests */
    public function __construct(
        private readonly PDO $db,
        private readonly Session $session,
        private readonly Config $config,
        ?\Closure $clock = null,
    ) {
        $this->clock = $clock ?? static fn (): int => time();
        $this->google = new Google($config, $this->clock);
    }

    public function handle(Request $r): Response
    {
        try {
            return $this->route($r);
        } catch (HttpError $e) {
            $data = ['erreur' => $e->getMessage()];
            if ($e->fields) {
                $data['champs'] = $e->fields;
            }
            return new Response($e->status, $data);
        } catch (\Throwable $e) {
            // Journal minimal : type et lieu de l'erreur, aucune donnée personnelle.
            error_log('calcoolos api: ' . $e::class . ' ' . $e->getFile() . ':' . $e->getLine() . ' ' . $e->getMessage());
            return new Response(500, ['erreur' => 'Erreur interne, réessaie plus tard.']);
        }
    }

    private function route(Request $r): Response
    {
        $m = $r->method;
        $p = $r->path;
        if ($m === 'POST') {
            $this->checkPostOrigin($r);
        }
        if ($m === 'GET' && $p === '/etat') {
            return $this->state();
        }
        if ($m === 'POST' && $p === '/inscription') {
            return $this->signup($r);
        }
        if ($m === 'POST' && $p === '/connexion') {
            return $this->login($r);
        }
        if ($m === 'POST' && $p === '/google') {
            return $this->googleLogin($r);
        }
        if ($m === 'GET' && $p === '/classements') {
            return $this->leaderboards($r);
        }
        // Tout le reste exige d'être connecté.
        $account = $this->account();
        if ($m === 'POST') {
            $this->checkCsrf($r);
        }
        if ($m === 'POST' && $p === '/deconnexion') {
            $this->session->destroy();
            return new Response(200, ['ok' => true]);
        }
        if ($m === 'POST' && $p === '/mot-de-passe') {
            return $this->changePassword($r, $account);
        }
        if ($m === 'POST' && $p === '/google/associer') {
            return $this->googleLink($r, $account);
        }
        if ($m === 'POST' && $p === '/google/dissocier') {
            return $this->googleUnlink($r, $account);
        }
        if ($m === 'GET' && $p === '/profils') {
            return new Response(200, ['profils' => $this->profiles($account)]);
        }
        if ($m === 'POST' && $p === '/profils') {
            return $this->createProfile($r, $account);
        }
        if (preg_match('#^/profils/(\d+)/(modifier|supprimer|resultats)$#', $p, $mm)) {
            $profile = $this->ownedProfile($account, (int) $mm[1]);
            return match ([$m, $mm[2]]) {
                ['POST', 'modifier'] => $this->updateProfile($r, $profile),
                ['POST', 'supprimer'] => $this->deleteProfile($profile),
                ['GET', 'resultats'] => $this->results($profile),
                default => throw new HttpError(405, 'Méthode non permise.'),
            };
        }
        if ($m === 'POST' && $p === '/resultats') {
            return $this->saveResult($r, $account);
        }
        if ($m === 'GET' && $p === '/export') {
            return $this->export($account);
        }
        if ($m === 'POST' && $p === '/supprimer-compte') {
            return $this->deleteAccount($r, $account);
        }
        throw new HttpError(404, 'Adresse inconnue.');
    }

    // --- Sécurité -------------------------------------------------------------------------------

    private function now(): int
    {
        return ($this->clock)();
    }

    private function stamp(?int $t = null): string
    {
        return gmdate('Y-m-d H:i:s', $t ?? $this->now());
    }

    private function checkPostOrigin(Request $r): void
    {
        if ($r->header('x-calcoolos') !== '1' || !str_starts_with(strtolower($r->header('content-type')), 'application/json')) {
            throw new HttpError(403, 'Requête refusée.');
        }
        $origin = $r->header('origin');
        if ($origin !== '' && $r->header('host') !== '' && parse_url($origin, PHP_URL_HOST) !== explode(':', $r->header('host'))[0]) {
            throw new HttpError(403, 'Requête refusée.');
        }
    }

    private function checkCsrf(Request $r): void
    {
        $token = $this->session->get('csrf');
        if (!is_string($token) || !hash_equals($token, $r->header('x-csrf-token'))) {
            throw new HttpError(403, 'Session expirée : recharge la page.');
        }
    }

    /** @return array{id: int, email: string} */
    private function account(): array
    {
        $id = $this->session->active() ? $this->session->get('compte') : null;
        if (!is_int($id)) {
            throw new HttpError(401, 'Connecte-toi d’abord.');
        }
        $q = $this->db->prepare('SELECT id, email FROM comptes WHERE id = ?');
        $q->execute([$id]);
        $row = $q->fetch();
        if (!$row) {
            $this->session->destroy();
            throw new HttpError(401, 'Connecte-toi d’abord.');
        }
        return ['id' => (int) $row['id'], 'email' => (string) $row['email']];
    }

    private function ipKey(Request $r): string
    {
        return substr(hash_hmac('sha256', $r->ip, $this->config->get('APP_SECRET')), 0, 32);
    }

    /** Compte les tentatives récentes pour une clé ; lève 429 au-delà de la limite. */
    private function limit(string $key, int $max, int $window): void
    {
        $q = $this->db->prepare('SELECT COUNT(*) FROM tentatives WHERE cle = ? AND moment > ?');
        $q->execute([$key, $this->stamp($this->now() - $window)]);
        if ((int) $q->fetchColumn() >= $max) {
            throw new HttpError(429, 'Trop de tentatives : réessaie dans quelques minutes.');
        }
    }

    private function remember(string $key): void
    {
        $this->db->prepare('INSERT INTO tentatives (cle, moment) VALUES (?, ?)')->execute([$key, $this->stamp()]);
        if (random_int(1, 50) === 1) {
            $this->db->prepare('DELETE FROM tentatives WHERE moment < ?')->execute([$this->stamp($this->now() - 86400)]);
        }
    }

    private function startSession(int $accountId): string
    {
        $this->session->regenerate();
        $this->session->set('compte', $accountId);
        $csrf = bin2hex(random_bytes(24));
        $this->session->set('csrf', $csrf);
        return $csrf;
    }

    private static ?string $dummy = null;

    /** Empreinte factice, calculée avec le même algorithme que les vraies. */
    private static function dummyHash(): string
    {
        return self::$dummy ??= self::hash(bin2hex(random_bytes(16)));
    }

    private static function hash(string $password): string
    {
        return password_hash($password, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT);
    }

    // --- Comptes ----------------------------------------------------------------------------------

    private function state(): Response
    {
        $guest = ['connecte' => false] + $this->googleConfig();
        $id = $this->session->active() ? $this->session->get('compte') : null;
        if (!is_int($id)) {
            return new Response(200, $guest);
        }
        try {
            $account = $this->account();
        } catch (HttpError) {
            return new Response(200, $guest);
        }
        return new Response(200, $this->connected($account, (string) $this->session->get('csrf')));
    }

    /** L'identifiant client Google (public), seulement si la connexion Google est configurée. */
    private function googleConfig(): array
    {
        return $this->google->enabled() ? ['googleClientId' => $this->google->clientId()] : [];
    }

    /**
     * État renvoyé une fois connecté (toutes les façons de se connecter renvoient le même).
     * @param array{id: int, email: string} $account
     */
    private function connected(array $account, string $csrf): array
    {
        $q = $this->db->prepare('SELECT mot_de_passe, google_sub FROM comptes WHERE id = ?');
        $q->execute([$account['id']]);
        $row = $q->fetch() ?: [];
        return [
            'connecte' => true,
            'email' => $account['email'],
            'csrf' => $csrf,
            'profils' => $this->profiles($account),
            'motDePasse' => ($row['mot_de_passe'] ?? '') !== '',
            'google' => ($row['google_sub'] ?? null) !== null,
        ] + $this->googleConfig();
    }

    /** @return array{0: string, 1: string} */
    private function credentials(array $in): array
    {
        $email = $in['email'] ?? '';
        $password = $in['motDePasse'] ?? '';
        if (!is_string($email) || !is_string($password)) {
            throw new HttpError(422, 'Données invalides.');
        }
        return [strtolower(trim($email)), $password];
    }

    private function signup(Request $r): Response
    {
        $in = $r->json();
        [$email, $password] = $this->credentials($in);
        $fields = [];
        if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $fields['email'] = 'Adresse e-mail invalide.';
        }
        if (mb_strlen($password) < 10 || mb_strlen($password) > 200) {
            $fields['motDePasse'] = 'Au moins 10 caractères.';
        }
        if (($in['adulte'] ?? false) !== true) {
            $fields['adulte'] = 'Le compte doit être créé par un adulte responsable.';
        }
        if ($fields) {
            throw new HttpError(422, 'Vérifie le formulaire.', $fields);
        }
        $ipKey = 'inscription:' . $this->ipKey($r);
        $this->limit($ipKey, self::SIGNUP_LIMIT, self::SIGNUP_WINDOW);
        $this->remember($ipKey);
        $q = $this->db->prepare('SELECT 1 FROM comptes WHERE email = ?');
        $q->execute([$email]);
        if ($q->fetch()) {
            throw new HttpError(409, 'Un compte existe déjà avec cette adresse.', ['email' => 'Déjà utilisée : connecte-toi plutôt.']);
        }
        $this->db->prepare('INSERT INTO comptes (email, mot_de_passe, cree_le, derniere_connexion) VALUES (?, ?, ?, ?)')
            ->execute([$email, self::hash($password), $this->stamp(), $this->stamp()]);
        $id = (int) $this->db->lastInsertId();
        $csrf = $this->startSession($id);
        return new Response(201, $this->connected(['id' => $id, 'email' => $email], $csrf));
    }

    private function login(Request $r): Response
    {
        [$email, $password] = $this->credentials($r->json());
        $ipKey = 'connexion-ip:' . $this->ipKey($r);
        $mailKey = 'connexion-mail:' . substr(hash_hmac('sha256', $email, $this->config->get('APP_SECRET')), 0, 32);
        $this->limit($ipKey, self::LOGIN_LIMIT * 3, self::LOGIN_WINDOW);
        $this->limit($mailKey, self::LOGIN_LIMIT, self::LOGIN_WINDOW);
        $q = $this->db->prepare('SELECT id, mot_de_passe FROM comptes WHERE email = ?');
        $q->execute([$email]);
        $row = $q->fetch();
        // Même travail que l'adresse existe ou non, ou que le compte n'ait pas de mot de passe (créé
        // avec Google) : pas d'indice par le temps de réponse.
        $hash = $row && $row['mot_de_passe'] !== '' ? (string) $row['mot_de_passe'] : self::dummyHash();
        $ok = password_verify($password, $hash) && $row && $row['mot_de_passe'] !== '';
        if (!$ok) {
            $this->remember($ipKey);
            $this->remember($mailKey);
            throw new HttpError(401, 'Adresse ou mot de passe incorrect.');
        }
        $id = (int) $row['id'];
        if (password_needs_rehash($hash, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT)) {
            $this->db->prepare('UPDATE comptes SET mot_de_passe = ? WHERE id = ?')->execute([self::hash($password), $id]);
        }
        $this->db->prepare('UPDATE comptes SET derniere_connexion = ? WHERE id = ?')->execute([$this->stamp(), $id]);
        $csrf = $this->startSession($id);
        return new Response(200, $this->connected(['id' => $id, 'email' => $email], $csrf));
    }

    // --- Continuer avec Google --------------------------------------------------------------------

    private function googleToken(Request $r, string $ipKey): array
    {
        if (!$this->google->enabled()) {
            throw new HttpError(404, 'La connexion avec Google n’est pas disponible.');
        }
        $this->limit($ipKey, self::LOGIN_LIMIT * 3, self::LOGIN_WINDOW);
        try {
            return $this->google->verify($r->json()['credential'] ?? null);
        } catch (HttpError $e) {
            $this->remember($ipKey);
            throw $e;
        }
    }

    /**
     * Connexion par Google : le compte associé à cet identifiant Google ; sinon, un nouveau compte.
     * Jamais de rattachement automatique à un compte existant par la seule adresse e-mail : son
     * propriétaire doit d'abord se connecter avec son mot de passe, puis associer Google.
     */
    private function googleLogin(Request $r): Response
    {
        $ipKey = 'google-ip:' . $this->ipKey($r);
        $g = $this->googleToken($r, $ipKey);
        $q = $this->db->prepare('SELECT id, email FROM comptes WHERE google_sub = ?');
        $q->execute([$g['sub']]);
        $row = $q->fetch();
        if ($row) {
            $id = (int) $row['id'];
            $this->db->prepare('UPDATE comptes SET derniere_connexion = ? WHERE id = ?')->execute([$this->stamp(), $id]);
            $csrf = $this->startSession($id);
            return new Response(200, $this->connected(['id' => $id, 'email' => (string) $row['email']], $csrf));
        }
        $q = $this->db->prepare('SELECT 1 FROM comptes WHERE email = ?');
        $q->execute([$g['email']]);
        if ($q->fetch()) {
            throw new HttpError(409, 'Un compte Calcoolos existe déjà avec cette adresse. Connecte-toi une fois avec ton mot de passe, puis associe Google dans l’espace famille.');
        }
        if (!$g['emailVerifie']) {
            throw new HttpError(422, 'Ce compte Google n’a pas d’adresse e-mail vérifiée.');
        }
        // Le bouton est accompagné de la mention « en continuant, vous confirmez être un adulte… ».
        if (($r->json()['adulte'] ?? false) !== true) {
            throw new HttpError(422, 'Le compte doit être créé par un adulte responsable.');
        }
        $signupKey = 'inscription:' . $this->ipKey($r);
        $this->limit($signupKey, self::SIGNUP_LIMIT, self::SIGNUP_WINDOW);
        $this->remember($signupKey);
        $this->db->prepare('INSERT INTO comptes (email, mot_de_passe, google_sub, cree_le, derniere_connexion) VALUES (?, ?, ?, ?, ?)')
            ->execute([$g['email'], '', $g['sub'], $this->stamp(), $this->stamp()]);
        $id = (int) $this->db->lastInsertId();
        $csrf = $this->startSession($id);
        return new Response(201, $this->connected(['id' => $id, 'email' => $g['email']], $csrf));
    }

    /**
     * Associe un compte Google au compte connecté (qui a donc prouvé qu'il en est le propriétaire).
     * @param array{id: int, email: string} $account
     */
    private function googleLink(Request $r, array $account): Response
    {
        $g = $this->googleToken($r, 'google-ip:' . $this->ipKey($r));
        $q = $this->db->prepare('SELECT id FROM comptes WHERE google_sub = ?');
        $q->execute([$g['sub']]);
        $owner = $q->fetchColumn();
        if ($owner !== false && (int) $owner !== $account['id']) {
            throw new HttpError(409, 'Ce compte Google est déjà associé à un autre compte Calcoolos.');
        }
        $this->db->prepare('UPDATE comptes SET google_sub = ? WHERE id = ?')->execute([$g['sub'], $account['id']]);
        return new Response(200, $this->connected($account, (string) $this->session->get('csrf')));
    }

    /** @param array{id: int, email: string} $account */
    private function googleUnlink(Request $r, array $account): Response
    {
        if (!$this->hasPassword($account)) {
            throw new HttpError(422, 'Ce compte n’a pas de mot de passe : Google est sa seule façon de se connecter.');
        }
        $password = $r->json()['motDePasse'] ?? '';
        $this->verifyPassword($account, is_string($password) ? $password : '');
        $this->db->prepare('UPDATE comptes SET google_sub = NULL WHERE id = ?')->execute([$account['id']]);
        return new Response(200, $this->connected($account, (string) $this->session->get('csrf')));
    }

    /** @param array{id: int, email: string} $account */
    private function hasPassword(array $account): bool
    {
        $q = $this->db->prepare('SELECT mot_de_passe FROM comptes WHERE id = ?');
        $q->execute([$account['id']]);
        return (string) $q->fetchColumn() !== '';
    }

    /** @param array{id: int, email: string} $account */
    private function changePassword(Request $r, array $account): Response
    {
        $in = $r->json();
        $old = $in['ancien'] ?? '';
        $new = $in['nouveau'] ?? '';
        if (!is_string($old) || !is_string($new)) {
            throw new HttpError(422, 'Données invalides.');
        }
        $this->verifyPassword($account, $old);
        if (mb_strlen($new) < 10 || mb_strlen($new) > 200) {
            throw new HttpError(422, 'Vérifie le formulaire.', ['nouveau' => 'Au moins 10 caractères.']);
        }
        $this->db->prepare('UPDATE comptes SET mot_de_passe = ? WHERE id = ?')->execute([self::hash($new), $account['id']]);
        $this->session->regenerate();
        return new Response(200, ['ok' => true]);
    }

    /** @param array{id: int, email: string} $account */
    private function verifyPassword(array $account, string $password): void
    {
        $key = 'verif:' . $account['id'];
        $this->limit($key, self::LOGIN_LIMIT, self::LOGIN_WINDOW);
        $q = $this->db->prepare('SELECT mot_de_passe FROM comptes WHERE id = ?');
        $q->execute([$account['id']]);
        if (!password_verify($password, (string) $q->fetchColumn())) {
            $this->remember($key);
            throw new HttpError(403, 'Mot de passe incorrect.', ['motDePasse' => 'Mot de passe incorrect.']);
        }
    }

    /** @param array{id: int, email: string} $account */
    private function deleteAccount(Request $r, array $account): Response
    {
        $in = $r->json();
        if ($this->hasPassword($account)) {
            $password = $in['motDePasse'] ?? '';
            $this->verifyPassword($account, is_string($password) ? $password : '');
        } elseif (!is_string($in['confirmation'] ?? null) || strtolower(trim($in['confirmation'])) !== $account['email']) {
            // Compte créé avec Google (sans mot de passe) : on confirme en recopiant l'adresse.
            throw new HttpError(403, 'Recopie exactement l’adresse du compte pour confirmer.', ['confirmation' => 'Adresse différente.']);
        }
        // ON DELETE CASCADE : profils et résultats partent avec le compte.
        $this->db->prepare('DELETE FROM comptes WHERE id = ?')->execute([$account['id']]);
        $this->session->destroy();
        return new Response(200, ['ok' => true]);
    }

    /** @param array{id: int, email: string} $account */
    private function export(array $account): Response
    {
        $q = $this->db->prepare('SELECT email, cree_le, derniere_connexion, google_sub IS NOT NULL AS google_associe FROM comptes WHERE id = ?');
        $q->execute([$account['id']]);
        $profiles = [];
        foreach ($this->profiles($account) as $p) {
            $p['resultats'] = $this->resultRows($p['id'], 100000);
            $profiles[] = $p;
        }
        return new Response(200, [
            'exporte_le' => $this->stamp(),
            'compte' => $q->fetch(),
            'profils' => $profiles,
        ], ['Content-Disposition' => 'attachment; filename="calcoolos-mes-donnees.json"']);
    }

    // --- Profils ----------------------------------------------------------------------------------

    /**
     * @param array{id: int, email: string} $account
     * @return list<array{id: int, pseudo: string, avatar: string, niveau: string, classementPublic: bool, nomPublic: string}>
     */
    private function profiles(array $account): array
    {
        $q = $this->db->prepare('SELECT id, pseudo, avatar, niveau, classement_public, nom_public FROM profils WHERE compte_id = ? ORDER BY id');
        $q->execute([$account['id']]);
        return array_map(static fn (array $p): array => [
            'id' => (int) $p['id'],
            'pseudo' => (string) $p['pseudo'],
            'avatar' => (string) $p['avatar'],
            'niveau' => (string) $p['niveau'],
            'classementPublic' => (bool) $p['classement_public'],
            'nomPublic' => (string) $p['nom_public'],
        ], $q->fetchAll());
    }

    /**
     * Le profil doit appartenir au compte connecté ; sinon 404 (on ne dit même pas qu'il existe).
     * @param array{id: int, email: string} $account
     * @return array{id: int, compte_id: int}
     */
    private function ownedProfile(array $account, int $id): array
    {
        $q = $this->db->prepare('SELECT id, compte_id FROM profils WHERE id = ? AND compte_id = ?');
        $q->execute([$id, $account['id']]);
        $row = $q->fetch();
        if (!$row) {
            throw new HttpError(404, 'Profil introuvable.');
        }
        return ['id' => (int) $row['id'], 'compte_id' => (int) $row['compte_id']];
    }

    private static function pseudo(mixed $v): string
    {
        if (!is_string($v)) {
            throw new HttpError(422, 'Vérifie le formulaire.', ['pseudo' => 'Choisis un pseudo.']);
        }
        $v = trim((string) preg_replace('/\s+/u', ' ', $v));
        if (!preg_match('/^[\p{L}\p{N} _\-]{2,20}$/u', $v)) {
            throw new HttpError(422, 'Vérifie le formulaire.', ['pseudo' => 'De 2 à 20 lettres ou chiffres.']);
        }
        return $v;
    }

    private static function avatar(mixed $v): string
    {
        if (!is_string($v) || !in_array($v, self::AVATARS, true)) {
            throw new HttpError(422, 'Vérifie le formulaire.', ['avatar' => 'Avatar inconnu.']);
        }
        return $v;
    }

    private static function tier(mixed $v): string
    {
        if (!is_string($v) || !in_array($v, Games::TIERS, true)) {
            throw new HttpError(422, 'Vérifie le formulaire.', ['niveau' => 'Niveau inconnu.']);
        }
        return $v;
    }

    /** @param array{id: int, email: string} $account */
    private function createProfile(Request $r, array $account): Response
    {
        $in = $r->json();
        $pseudo = self::pseudo($in['pseudo'] ?? null);
        $avatar = self::avatar($in['avatar'] ?? null);
        $tier = self::tier($in['niveau'] ?? null);
        if (count($this->profiles($account)) >= self::MAX_PROFILES) {
            throw new HttpError(422, 'Six profils au maximum par compte.');
        }
        $this->db->prepare('INSERT INTO profils (compte_id, pseudo, avatar, niveau, classement_public, nom_public, cree_le) VALUES (?, ?, ?, ?, 0, ?, ?)')
            ->execute([$account['id'], $pseudo, $avatar, $tier, Names::publicName(), $this->stamp()]);
        return new Response(201, ['profils' => $this->profiles($account)]);
    }

    /** @param array{id: int, compte_id: int} $profile */
    private function updateProfile(Request $r, array $profile): Response
    {
        $in = $r->json();
        $sets = [];
        $args = [];
        if (array_key_exists('pseudo', $in)) {
            $sets[] = 'pseudo = ?';
            $args[] = self::pseudo($in['pseudo']);
        }
        if (array_key_exists('avatar', $in)) {
            $sets[] = 'avatar = ?';
            $args[] = self::avatar($in['avatar']);
        }
        if (array_key_exists('niveau', $in)) {
            $sets[] = 'niveau = ?';
            $args[] = self::tier($in['niveau']);
        }
        if (array_key_exists('classementPublic', $in)) {
            if (!is_bool($in['classementPublic'])) {
                throw new HttpError(422, 'Données invalides.');
            }
            $sets[] = 'classement_public = ?';
            $args[] = $in['classementPublic'] ? 1 : 0;
        }
        if (($in['nouveauNomPublic'] ?? false) === true) {
            $sets[] = 'nom_public = ?';
            $args[] = Names::publicName();
        }
        if ($sets) {
            $args[] = $profile['id'];
            $this->db->prepare('UPDATE profils SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($args);
        }
        return new Response(200, ['profils' => $this->profiles(['id' => $profile['compte_id'], 'email' => ''])]);
    }

    /** @param array{id: int, compte_id: int} $profile */
    private function deleteProfile(array $profile): Response
    {
        $this->db->prepare('DELETE FROM profils WHERE id = ?')->execute([$profile['id']]);
        return new Response(200, ['profils' => $this->profiles(['id' => $profile['compte_id'], 'email' => ''])]);
    }

    // --- Résultats --------------------------------------------------------------------------------

    /** @param array{id: int, email: string} $account */
    private function saveResult(Request $r, array $account): Response
    {
        $in = $r->json();
        $profileId = $in['profil'] ?? null;
        if (!is_int($profileId)) {
            throw new HttpError(422, 'Profil manquant.');
        }
        $profile = $this->ownedProfile($account, $profileId);
        $res = Games::parse($in);
        // Débit : pas deux parties en quelques secondes, ni des centaines par heure.
        $q = $this->db->prepare('SELECT MAX(joue_le) AS dernier, COUNT(*) AS n FROM resultats WHERE profil_id = ? AND joue_le > ?');
        $q->execute([$profile['id'], $this->stamp($this->now() - 3600)]);
        $row = $q->fetch();
        if ($row && (int) $row['n'] >= self::RESULT_HOURLY) {
            throw new HttpError(429, 'Beaucoup de parties cette heure-ci : fais une pause !');
        }
        if ($row && $row['dernier'] !== null && $this->now() - (int) strtotime($row['dernier'] . ' UTC') < self::RESULT_GAP) {
            throw new HttpError(429, 'Résultat envoyé trop vite après le précédent.');
        }
        $doubt = Games::doubt($res);
        $this->db->prepare('INSERT INTO resultats (profil_id, jeu, niveau, mode, score, gagne, etoiles, duree, precision_pct, ops, details, verifie, motif, joue_le)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([
            $profile['id'], $res['jeu'], $res['niveau'], $res['mode'], $res['score'], $res['gagne'] ? 1 : 0, $res['etoiles'],
            $res['duree'], (int) round($res['precision'] * 100), json_encode((object) $res['ops'], JSON_UNESCAPED_UNICODE),
            json_encode((object) $res['details']), $doubt === null ? 1 : 0, $doubt, $this->stamp(),
        ]);
        // Meilleur score vérifié précédent, pour annoncer un record.
        $q = $this->db->prepare('SELECT MAX(score) FROM resultats WHERE profil_id = ? AND jeu = ? AND niveau = ? AND mode = ? AND verifie = 1 AND id <> ?');
        $id = (int) $this->db->lastInsertId();
        $q->execute([$profile['id'], $res['jeu'], $res['niveau'], $res['mode'], $id]);
        $best = $q->fetchColumn();
        return new Response(201, [
            'id' => $id,
            'verifie' => $doubt === null,
            'record' => $doubt === null && ($best === null || $best === false || $res['score'] > (int) $best),
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function resultRows(int $profileId, int $limit): array
    {
        $q = $this->db->prepare('SELECT id, jeu, niveau, mode, score, gagne, etoiles, duree, precision_pct, ops, details, verifie, joue_le
            FROM resultats WHERE profil_id = ? ORDER BY joue_le DESC, id DESC LIMIT ' . max(1, $limit));
        $q->execute([$profileId]);
        return array_map(static fn (array $x): array => [
            'id' => (int) $x['id'],
            'jeu' => (string) $x['jeu'],
            'niveau' => (string) $x['niveau'],
            'mode' => (string) $x['mode'],
            'score' => (int) $x['score'],
            'gagne' => (bool) $x['gagne'],
            'etoiles' => (int) $x['etoiles'],
            'duree' => (int) $x['duree'],
            'precision' => ((int) $x['precision_pct']) / 100,
            'ops' => json_decode((string) $x['ops'], true) ?: [],
            'details' => json_decode((string) $x['details'], true) ?: [],
            'verifie' => (bool) $x['verifie'],
            'date' => str_replace(' ', 'T', (string) $x['joue_le']) . 'Z',
        ], $q->fetchAll());
    }

    /** @param array{id: int, compte_id: int} $profile */
    private function results(array $profile): Response
    {
        return new Response(200, ['resultats' => $this->resultRows($profile['id'], 300)]);
    }

    // --- Classements ------------------------------------------------------------------------------

    private function leaderboards(Request $r): Response
    {
        $jeu = $r->query['jeu'] ?? '';
        $niveau = $r->query['niveau'] ?? '';
        $mode = $r->query['mode'] ?? '';
        if (!isset(Games::CATALOG[$jeu]) || !in_array($niveau, Games::TIERS, true) || !in_array($mode, Games::MODES, true)) {
            throw new HttpError(422, 'Classement inconnu.');
        }
        // Public : uniquement les profils autorisés par l'adulte, sous leur nom public.
        $q = $this->db->prepare('SELECT p.nom_public AS nom, p.avatar AS avatar, MAX(r.score) AS score
            FROM resultats r JOIN profils p ON p.id = r.profil_id
            WHERE r.jeu = ? AND r.niveau = ? AND r.mode = ? AND r.verifie = 1 AND p.classement_public = 1
            GROUP BY p.id, p.nom_public, p.avatar ORDER BY score DESC, p.id ASC LIMIT 20');
        $q->execute([$jeu, $niveau, $mode]);
        $public = [];
        foreach ($q->fetchAll() as $i => $row) {
            $public[] = ['rang' => $i + 1, 'nom' => (string) $row['nom'], 'avatar' => (string) $row['avatar'], 'score' => (int) $row['score']];
        }
        $out = ['public' => $public];
        // Famille : les profils du compte connecté, privés, avec leur vrai pseudo.
        $id = $this->session->active() ? $this->session->get('compte') : null;
        if (is_int($id)) {
            $q = $this->db->prepare('SELECT p.pseudo AS nom, p.avatar AS avatar, MAX(r.score) AS score
                FROM resultats r JOIN profils p ON p.id = r.profil_id
                WHERE p.compte_id = ? AND r.jeu = ? AND r.niveau = ? AND r.mode = ?
                GROUP BY p.id, p.pseudo, p.avatar ORDER BY score DESC');
            $q->execute([$id, $jeu, $niveau, $mode]);
            $out['famille'] = array_map(static fn (array $row): array => ['nom' => (string) $row['nom'], 'avatar' => (string) $row['avatar'], 'score' => (int) $row['score']], $q->fetchAll());
        }
        return new Response(200, $out);
    }
}
