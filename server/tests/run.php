<?php

declare(strict_types=1);

/**
 * Tests de l'API (sans serveur web) : comptes, profils, résultats, isolation
 * des données entre familles, classements, limites, export, suppression.
 *
 *   php server/tests/run.php                       (SQLite en mémoire)
 *   TEST_DB_DSN='mysql:unix_socket=/run/mysqld/mysqld.sock;dbname=calcoolos_test' \
 *   TEST_DB_USER=root php server/tests/run.php     (MariaDB, base de test vidée)
 */
require dirname(__DIR__) . '/src/bootstrap.php';

use Calcoolos\Api;
use Calcoolos\Config;
use Calcoolos\Db;
use Calcoolos\MemorySession;
use Calcoolos\Request;
use Calcoolos\Response;

$dsn = getenv('TEST_DB_DSN') ?: 'sqlite::memory:';
$config = Config::fromArray(['DB_DSN' => $dsn, 'DB_USER' => getenv('TEST_DB_USER') ?: '', 'DB_PASSWORD' => getenv('TEST_DB_PASSWORD') ?: '']);
$db = Db::connect($config);
if (Db::driver($db) === 'mysql') {
    $db->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach (['resultats', 'profils', 'comptes', 'tentatives', 'schema_version'] as $t) {
        $db->exec("DROP TABLE IF EXISTS $t");
    }
    $db->exec('SET FOREIGN_KEY_CHECKS = 1');
}
Db::migrate($db);
// Une seconde migration ne doit rien refaire.
assert_true(Db::migrate($db) === [], 'migrations idempotentes');

$now = 1_800_000_000;
$clock = static function () use (&$now): int {
    return $now;
};

/** Un navigateur simulé : sa propre session, son jeton CSRF. */
final class Client
{
    public MemorySession $session;
    public string $csrf = '';

    public function __construct(private Api $api, public string $ip = '203.0.113.7')
    {
    }

    public static function make(PDO $db, MemorySession $s, Config $c, Closure $clock, string $ip = '203.0.113.7'): self
    {
        $cl = new self(new Api($db, $s, $c, $clock), $ip);
        $cl->session = $s;
        return $cl;
    }

    /** @param array<string, string> $headers */
    public function call(string $method, string $path, ?array $body = null, array $headers = [], array $query = []): Response
    {
        $h = ['host' => 'calcoolos.test', 'content-type' => 'application/json', 'x-calcoolos' => '1'];
        if ($this->csrf !== '') {
            $h['x-csrf-token'] = $this->csrf;
        }
        $h = array_merge($h, $headers);
        $r = $this->api->handle(new Request($method, $path, $query, $body === null ? '' : json_encode($body), $h, $this->ip));
        if (is_array($r->data) && isset($r->data['csrf']) && is_string($r->data['csrf'])) {
            $this->csrf = $r->data['csrf'];
        }
        return $r;
    }

    public function post(string $path, array $body = [], array $headers = []): Response
    {
        return $this->call('POST', $path, $body, $headers);
    }

    public function get(string $path, array $query = []): Response
    {
        return $this->call('GET', $path, null, [], $query);
    }
}

$failures = 0;
$count = 0;
function assert_true(bool $cond, string $what): void
{
    global $failures, $count;
    $count++;
    if (!$cond) {
        $failures++;
        echo "  ÉCHEC : $what\n";
    }
}
function assert_status(Response $r, int $status, string $what): void
{
    assert_true($r->status === $status, "$what (attendu $status, reçu {$r->status} : " . $r->body() . ')');
}
function section(string $name): void
{
    echo "• $name\n";
}

$newClient = static fn (string $ip = '203.0.113.7'): Client => Client::make($db, new MemorySession(), $config, $clock, $ip);
$result = static fn (int $profile, array $over = []): array => array_merge([
    'profil' => $profile, 'jeu' => 'dragon', 'niveau' => 'explorateur', 'mode' => 'defi', 'score' => 8000,
    'gagne' => true, 'etoiles' => 2, 'duree' => 240, 'precision' => 0.9, 'ops' => ['+' => [17, 2]], 'details' => ['objectifs' => 17],
], $over);

// ---------------------------------------------------------------------------------------------
section('Invité');
$guest = $newClient();
$r = $guest->get('/etat');
assert_status($r, 200, 'état invité');
assert_true($r->data === ['connecte' => false], 'invité non connecté');
assert_true(!$guest->session->active(), 'aucune session (donc aucun cookie) pour un invité');
assert_status($guest->get('/profils'), 401, 'profils interdits sans compte');
assert_status($guest->get('/classements', ['jeu' => 'dragon', 'niveau' => 'eveil', 'mode' => 'defi']), 200, 'classements publics lisibles');
assert_status($guest->get('/nimporte'), 401, 'route privée inconnue : 401 d’abord');

section('Inscription');
$alice = $newClient('198.51.100.1');
assert_status($alice->post('/inscription', ['email' => 'pas-une-adresse', 'motDePasse' => 'assez-long-pour-passer', 'adulte' => true]), 422, 'adresse invalide');
assert_status($alice->post('/inscription', ['email' => 'alice@exemple.fr', 'motDePasse' => 'court', 'adulte' => true]), 422, 'mot de passe trop court');
assert_status($alice->post('/inscription', ['email' => 'alice@exemple.fr', 'motDePasse' => 'assez-long-pour-passer']), 422, 'case « adulte » obligatoire');
assert_status($alice->post('/inscription', ['email' => 'alice@exemple.fr', 'motDePasse' => 'assez-long-pour-passer', 'adulte' => true], ['x-calcoolos' => '']), 403, 'sans en-tête X-Calcoolos : refus (CSRF)');
assert_status($alice->post('/inscription', ['email' => 'alice@exemple.fr', 'motDePasse' => 'assez-long-pour-passer', 'adulte' => true], ['content-type' => 'application/x-www-form-urlencoded']), 403, 'formulaire classique refusé');
assert_status($alice->post('/inscription', ['email' => 'alice@exemple.fr', 'motDePasse' => 'assez-long-pour-passer', 'adulte' => true], ['origin' => 'https://mechant.example']), 403, 'autre origine refusée');
$r = $alice->post('/inscription', ['email' => ' Alice@Exemple.fr ', 'motDePasse' => 'assez-long-pour-passer', 'adulte' => true]);
assert_status($r, 201, 'inscription');
assert_true($r->data['email'] === 'alice@exemple.fr', 'adresse normalisée');
assert_true($alice->session->regenerations === 1, 'nouvel identifiant de session à la connexion');
$hash = (string) $db->query("SELECT mot_de_passe FROM comptes WHERE email = 'alice@exemple.fr'")->fetchColumn();
assert_true(str_starts_with($hash, '$argon2id$') || str_starts_with($hash, '$2y$'), 'mot de passe haché (argon2id ou bcrypt)');
assert_true(!str_contains($hash, 'assez-long'), 'mot de passe jamais en clair');
assert_status($newClient('198.51.100.9')->post('/inscription', ['email' => 'alice@exemple.fr', 'motDePasse' => 'autre-mot-de-passe', 'adulte' => true]), 409, 'adresse déjà utilisée');

section('Jeton CSRF');
$saved = $alice->csrf;
$alice->csrf = 'faux';
assert_status($alice->post('/profils', ['pseudo' => 'Lina', 'avatar' => 'dragon', 'niveau' => 'explorateur']), 403, 'mauvais jeton refusé');
$alice->csrf = $saved;

section('Profils');
assert_status($alice->post('/profils', ['pseudo' => 'L', 'avatar' => 'dragon', 'niveau' => 'explorateur']), 422, 'pseudo trop court');
assert_status($alice->post('/profils', ['pseudo' => '<script>', 'avatar' => 'dragon', 'niveau' => 'explorateur']), 422, 'pseudo avec balise refusé');
assert_status($alice->post('/profils', ['pseudo' => 'Lina', 'avatar' => 'licorne', 'niveau' => 'explorateur']), 422, 'avatar inconnu');
assert_status($alice->post('/profils', ['pseudo' => 'Lina', 'avatar' => 'dragon', 'niveau' => 'expert']), 422, 'niveau inconnu');
$r = $alice->post('/profils', ['pseudo' => 'Lina', 'avatar' => 'dragon', 'niveau' => 'explorateur']);
assert_status($r, 201, 'profil créé');
$lina = $r->data['profils'][0];
assert_true($lina['classementPublic'] === false, 'profil privé par défaut');
assert_true(preg_match('/^\S+ \S+ \d\d$/u', $lina['nomPublic']) === 1, 'nom public généré : ' . $lina['nomPublic']);
$r = $alice->post('/profils', ['pseudo' => 'Noé', 'avatar' => 'robot', 'niveau' => 'eveil']);
$noe = $r->data['profils'][1];
for ($i = 0; $i < 4; $i++) {
    $alice->post('/profils', ['pseudo' => "Enfant $i", 'avatar' => 'chat', 'niveau' => 'eveil']);
}
assert_status($alice->post('/profils', ['pseudo' => 'Septième', 'avatar' => 'chat', 'niveau' => 'eveil']), 422, 'six profils au maximum');
$r = $alice->post("/profils/{$noe['id']}/modifier", ['niveau' => 'explorateur', 'avatar' => 'baleine']);
assert_status($r, 200, 'profil modifié');
assert_true($r->data['profils'][1]['niveau'] === 'explorateur' && $r->data['profils'][1]['avatar'] === 'baleine', 'modifications enregistrées');

section('Résultats');
$r = $alice->post('/resultats', $result($lina['id']));
assert_status($r, 201, 'résultat enregistré');
assert_true($r->data['verifie'] === true && $r->data['record'] === true, 'vérifié et record');
assert_status($alice->post('/resultats', $result($lina['id'], ['score' => 9000])), 429, 'deux résultats en quelques secondes : refus');
$now += 30;
$r = $alice->post('/resultats', $result($lina['id'], ['score' => 39000, 'duree' => 20]));
assert_status($r, 201, 'résultat douteux accepté…');
assert_true($r->data['verifie'] === false, '… mais non vérifié (victoire trop rapide)');
$now += 30;
assert_status($alice->post('/resultats', $result($lina['id'], ['jeu' => 'tetris'])), 422, 'jeu inconnu');
assert_status($alice->post('/resultats', $result($lina['id'], ['score' => -5])), 422, 'score négatif');
assert_status($alice->post('/resultats', $result($lina['id'], ['ops' => ['%' => [1, 2]]])), 422, 'opération inconnue');
assert_status($alice->post('/resultats', $result($lina['id'], ['gagne' => 'oui'])), 422, 'type invalide');
assert_status($alice->post('/resultats', $result(999999)), 404, 'profil inexistant');
$r = $alice->post('/resultats', $result($lina['id'], ['score' => 7000, 'gagne' => false, 'etoiles' => 0, 'duree' => 90]));
assert_status($r, 201, 'défaite enregistrée');
assert_true($r->data['record'] === false, 'pas un record');
$r = $alice->get("/profils/{$lina['id']}/resultats");
assert_status($r, 200, 'historique');
assert_true(count($r->data['resultats']) === 3, 'trois résultats dans l’historique');
assert_true($r->data['resultats'][0]['score'] === 7000 && $r->data['resultats'][0]['ops'] === ['+' => [17, 2]], 'contenu de l’historique');

section('Isolation entre familles');
$bob = $newClient('198.51.100.2');
assert_status($bob->post('/inscription', ['email' => 'bob@exemple.fr', 'motDePasse' => 'un-autre-mot-de-passe', 'adulte' => true]), 201, 'deuxième compte');
$r = $bob->post('/profils', ['pseudo' => 'Sam', 'avatar' => 'canard', 'niveau' => 'explorateur']);
$sam = $r->data['profils'][0];
assert_status($bob->get("/profils/{$lina['id']}/resultats"), 404, 'Bob ne lit pas les résultats de Lina');
assert_status($bob->post("/profils/{$lina['id']}/modifier", ['pseudo' => 'Pirate']), 404, 'Bob ne modifie pas Lina');
assert_status($bob->post("/profils/{$lina['id']}/supprimer"), 404, 'Bob ne supprime pas Lina');
assert_status($bob->post('/resultats', $result($lina['id'])), 404, 'Bob n’écrit pas dans l’historique de Lina');
$r = $bob->get('/profils');
assert_true(count($r->data['profils']) === 1 && $r->data['profils'][0]['pseudo'] === 'Sam', 'Bob ne voit que ses profils');
$export = $bob->get('/export');
assert_true(!str_contains($export->body(), 'Lina') && !str_contains($export->body(), 'alice'), 'l’export de Bob ne contient rien d’Alice');
$now += 30;
assert_status($bob->post('/resultats', $result($sam['id'], ['score' => 12000])), 201, 'résultat de Sam');

section('Classements');
$q = ['jeu' => 'dragon', 'niveau' => 'explorateur', 'mode' => 'defi'];
$r = $guest->get('/classements', $q);
assert_true($r->data['public'] === [], 'profils privés absents du classement public');
assert_true(!isset($r->data['famille']), 'pas de classement familial pour un invité');
$alice->post("/profils/{$lina['id']}/modifier", ['classementPublic' => true]);
$r = $guest->get('/classements', $q);
assert_true(count($r->data['public']) === 1, 'Lina apparaît après autorisation');
$row = $r->data['public'][0];
assert_true($row['score'] === 8000, 'seul le meilleur score VÉRIFIÉ compte (pas 39000)');
assert_true($row['nom'] === $lina['nomPublic'] && !str_contains($r->body(), 'Lina') && !str_contains($r->body(), '@'), 'nom public seulement : ni pseudo ni e-mail');
assert_true(array_keys($row) === ['rang', 'nom', 'avatar', 'score'], 'aucune autre donnée exposée');
$r = $alice->get('/classements', $q);
assert_true(count($r->data['famille']) === 1 && $r->data['famille'][0]['nom'] === 'Lina', 'classement familial avec le vrai pseudo, pour la famille seulement');
$r = $alice->post("/profils/{$lina['id']}/modifier", ['nouveauNomPublic' => true]);
assert_status($r, 200, 'nouveau nom public');
assert_status($guest->get('/classements', ['jeu' => 'dragon', 'niveau' => 'x', 'mode' => 'defi']), 422, 'classement inconnu');

section('Connexion');
$alice2 = $newClient('198.51.100.1');
assert_status($alice2->post('/connexion', ['email' => 'alice@exemple.fr', 'motDePasse' => 'mauvais']), 401, 'mauvais mot de passe');
assert_status($alice2->post('/connexion', ['email' => 'inconnu@exemple.fr', 'motDePasse' => 'peu-importe-ici']), 401, 'adresse inconnue : même message');
$r = $alice2->post('/connexion', ['email' => 'ALICE@exemple.fr', 'motDePasse' => 'assez-long-pour-passer']);
assert_status($r, 200, 'connexion');
assert_true(count($r->data['profils']) === 6, 'profils retrouvés à la connexion');
$attacker = $newClient('192.0.2.66');
for ($i = 0; $i < 8; $i++) {
    $attacker->post('/connexion', ['email' => 'bob@exemple.fr', 'motDePasse' => "essai-$i-xxxx"]);
}
assert_status($attacker->post('/connexion', ['email' => 'bob@exemple.fr', 'motDePasse' => 'un-autre-mot-de-passe']), 429, 'trop d’essais : blocage temporaire');
$now += 901;
assert_status($attacker->post('/connexion', ['email' => 'bob@exemple.fr', 'motDePasse' => 'un-autre-mot-de-passe']), 200, 'débloqué après 15 minutes');

section('Mot de passe et déconnexion');
assert_status($alice2->post('/mot-de-passe', ['ancien' => 'faux-faux-faux', 'nouveau' => 'nouveau-mot-de-passe']), 403, 'ancien mot de passe vérifié');
assert_status($alice2->post('/mot-de-passe', ['ancien' => 'assez-long-pour-passer', 'nouveau' => 'nouveau-mot-de-passe']), 200, 'mot de passe changé');
assert_status($alice2->post('/deconnexion'), 200, 'déconnexion');
assert_true($alice2->get('/etat')->data === ['connecte' => false], 'déconnecté');
assert_status($alice2->get('/profils'), 401, 'plus d’accès après déconnexion');
assert_status($alice2->post('/connexion', ['email' => 'alice@exemple.fr', 'motDePasse' => 'nouveau-mot-de-passe']), 200, 'connexion avec le nouveau mot de passe');

section('Export et suppression');
$r = $alice2->get('/export');
assert_status($r, 200, 'export');
assert_true(($r->headers['Content-Disposition'] ?? '') !== '', 'export téléchargeable');
assert_true($r->data['compte']['email'] === 'alice@exemple.fr' && count($r->data['profils']) === 6 && count($r->data['profils'][0]['resultats']) === 3, 'export complet');
assert_true(!str_contains($r->body(), 'mot_de_passe') && !str_contains($r->body(), '$argon'), 'l’export ne contient pas le mot de passe');
assert_status($alice2->post("/profils/{$noe['id']}/supprimer"), 200, 'profil supprimé');
assert_status($alice2->post('/supprimer-compte', ['motDePasse' => 'faux-faux-faux']), 403, 'suppression protégée par le mot de passe');
assert_status($alice2->post('/supprimer-compte', ['motDePasse' => 'nouveau-mot-de-passe']), 200, 'compte supprimé');
$left = (int) $db->query("SELECT COUNT(*) FROM profils p JOIN comptes c ON c.id = p.compte_id WHERE c.email = 'alice@exemple.fr'")->fetchColumn();
$orphans = (int) $db->query('SELECT COUNT(*) FROM resultats r LEFT JOIN profils p ON p.id = r.profil_id WHERE p.id IS NULL')->fetchColumn();
assert_true($left === 0 && $orphans === 0, 'profils et résultats effacés avec le compte');
assert_true((int) $db->query('SELECT COUNT(*) FROM resultats')->fetchColumn() === 1, 'les résultats de Bob restent');
assert_status($alice->get('/profils'), 401, 'l’ancienne session d’Alice ne donne plus accès');

echo "\n" . ($failures === 0 ? "OK : $count vérifications ($dsn)\n" : "$failures échec(s) sur $count vérifications\n");
exit($failures === 0 ? 0 : 1);
