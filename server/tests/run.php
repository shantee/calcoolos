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
use Calcoolos\Suivi;

$dsn = getenv('TEST_DB_DSN') ?: 'sqlite::memory:';
$config = Config::fromArray(['DB_DSN' => $dsn, 'DB_USER' => getenv('TEST_DB_USER') ?: '', 'DB_PASSWORD' => getenv('TEST_DB_PASSWORD') ?: '']);
$db = Db::connect($config);
if (Db::driver($db) === 'mysql') {
    $db->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach (['parties', 'visites', 'suivi_bilans', 'suivi_journal', 'resultats', 'profils', 'comptes', 'tentatives', 'schema_version'] as $t) {
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
assert_status($guest->get('/classements'), 200, 'classements publics lisibles');
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
assert_status($alice->post('/profils', ['pseudo' => 'Lina', 'avatar' => 'astronaute', 'niveau' => 'explorateur']), 403, 'mauvais jeton refusé');
$alice->csrf = $saved;

section('Profils');
assert_status($alice->post('/profils', ['pseudo' => 'L', 'avatar' => 'astronaute', 'niveau' => 'explorateur']), 422, 'pseudo trop court');
assert_status($alice->post('/profils', ['pseudo' => '<script>', 'avatar' => 'astronaute', 'niveau' => 'explorateur']), 422, 'pseudo avec balise refusé');
assert_status($alice->post('/profils', ['pseudo' => 'Lina', 'avatar' => 'licorne', 'niveau' => 'explorateur']), 422, 'avatar inconnu');
assert_status($alice->post('/profils', ['pseudo' => 'Lina', 'avatar' => 'chouette', 'niveau' => 'explorateur']), 422, 'ancien avatar refusé');
assert_status($alice->post('/profils', ['pseudo' => 'Lina', 'avatar' => 'astronaute', 'niveau' => 'expert']), 422, 'niveau inconnu');
$r = $alice->post('/profils', ['pseudo' => 'Lina', 'avatar' => 'astronaute', 'niveau' => 'explorateur']);
assert_status($r, 201, 'profil créé');
$lina = $r->data['profils'][0];
assert_true(array_keys($lina) === ['id', 'pseudo', 'avatar', 'niveau', 'personnel'], 'profil : pseudo, avatar, niveau, rien d\'autre');
$r = $alice->post('/profils', ['pseudo' => 'Noé', 'avatar' => 'robot', 'niveau' => 'eveil']);
$noe = $r->data['profils'][1];
for ($i = 0; $i < 4; $i++) {
    $alice->post('/profils', ['pseudo' => "Enfant $i", 'avatar' => 'chat-noir', 'niveau' => 'eveil']);
}
assert_status($alice->post('/profils', ['pseudo' => 'Septième', 'avatar' => 'chat-noir', 'niveau' => 'eveil']), 422, 'six profils au maximum');
$r = $alice->post("/profils/{$noe['id']}/modifier", ['niveau' => 'explorateur', 'avatar' => 'requin']);
assert_status($r, 200, 'profil modifié');
assert_true($r->data['profils'][1]['niveau'] === 'explorateur' && $r->data['profils'][1]['avatar'] === 'requin', 'modifications enregistrées');

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
$board = static fn (Response $r, string $jeu, string $niveau, string $mode): array => array_values(array_filter(
    $r->data['classements'],
    static fn (array $b): bool => $b['jeu'] === $jeu && $b['niveau'] === $niveau && $b['mode'] === $mode,
))[0];
$r = $guest->get('/classements');
assert_true(count($r->data['classements']) === 4 * 4 * 2 + 4 * 4 + 4 * 4, 'tous les classements d’un coup (jeu × niveau × mode ; Neon Flight et MULTIRAIL : niveau × variante)');
$b = $board($r, 'dragon', 'explorateur', 'defi');
assert_true(!isset($b['famille']), 'pas de classement familial pour un invité');
$row = array_values(array_filter($b['public'], static fn (array $x): bool => $x['nom'] === 'Lina'))[0] ?? null;
assert_true($row !== null, 'Lina au classement public sous son pseudo, sans autorisation à donner');
assert_true($row['score'] === 8000, 'seul le meilleur score VÉRIFIÉ compte (pas 39000)');
assert_true(!str_contains($r->body(), '@'), 'jamais l\'e-mail au classement public');
assert_true(array_keys($row) === ['rang', 'nom', 'avatar', 'score', 'parties', 'date', 'gagne', 'etoiles', 'duree', 'precision'], 'seulement le jeu exposé, rien du compte');
assert_true($row['parties'] === 2 && preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/', $row['date']) === 1, 'date du record et nombre de parties vérifiées');
assert_true($board($r, 'cubes', 'maitre', 'tranquille')['public'] === [], 'classement vide sans partie');
$r = $alice->get('/classements');
$b = $board($r, 'dragon', 'explorateur', 'defi');
$mark = array_values(array_filter($b['public'], static fn (array $x): bool => $x['nom'] === 'Lina'))[0];
assert_true(($mark['famille'] ?? false) === true, 'Lina marquée « famille » pour sa famille');
assert_true(!isset($b['famille']), 'pas de classement familial avec un seul membre');
$now += 30;
assert_status($alice->post('/resultats', $result($noe['id'], ['score' => 5000])), 201, 'résultat de Noé');
$b = $board($alice->get('/classements'), 'dragon', 'explorateur', 'defi');
assert_true(array_column($b['famille'] ?? [], 'nom') === ['Lina', 'Noé'], 'classement familial dès deux membres, sans rang public');
$r = $bob->get('/classements');
$seen = array_values(array_filter($board($r, 'dragon', 'explorateur', 'defi')['public'], static fn (array $x): bool => $x['nom'] === 'Lina'))[0];
assert_true(!isset($seen['famille']), 'Lina n’est pas marquée « famille » chez Bob');

section('Neon Flight et mesures communes');
// Une partie Neon Flight réaliste : 40 calculs, 36 justes, mode Arcade (Défi), tables 2 à 5.
$neon = static fn (int $profile, array $over = []): array => array_replace_recursive([
    'profil' => $profile, 'jeu' => 'neon', 'niveau' => 'explorateur', 'mode' => 'defi', 'variante' => 'petites', 'score' => 21000,
    'gagne' => true, 'etoiles' => 1, 'duree' => 130, 'actif' => 120, 'debut' => gmdate('Y-m-d\TH:i:s\Z', $now - 130),
    'precision' => 0.9, 'ops' => ['×' => [36, 4]], 'details' => ['distance' => 3100, 'altitude' => 140, 'crash' => 1],
    'mesures' => ['calculs' => 40, 'justes' => 36, 'fausses' => 4, 'serie' => 12, 'tempsMoyen' => 2400, 'tempsMedian' => 2100,
        'faits' => ['2×7' => [3, 1, 6000, 3], '7×8' => [1, 2, 5200, 1]]],
], $over);
$now += 30;
$r = $alice->post('/resultats', $neon($lina['id'], ['partie' => 'partieNEONAAAAAAAAA1']));
assert_status($r, 201, 'Neon Flight : résultat enregistré');
assert_true($r->data['verifie'] === true && $r->data['record'] === true, 'Neon Flight : vérifié et record');
$now += 30;
$r = $alice->post('/resultats', $neon($lina['id'], ['partie' => 'partieNEONAAAAAAAAA1', 'score' => 99999]));
assert_true($r->status === 201 && ($r->data['deja'] ?? false) === true, 'même partie renvoyée (file d’attente) : pas de doublon');
assert_true((int) $db->query("SELECT COUNT(*) FROM resultats WHERE partie_cle = 'partieNEONAAAAAAAAA1'")->fetchColumn() === 1, 'une seule ligne pour la partie');
assert_status($alice->post('/resultats', $neon($lina['id'], ['variante' => 'deux-a-cinq'])), 422, 'série de tables inconnue');
assert_status($alice->post('/resultats', $neon($lina['id'], ['mesures' => ['justes' => 50]])), 422, 'mesures incohérentes (justes > calculs)');
assert_status($alice->post('/resultats', $neon($lina['id'], ['mesures' => ['faits' => ['8×7' => [1, 0, 100, 1]]]])), 422, 'fait mal écrit (8×7 au lieu de 7×8)');
assert_status($alice->post('/resultats', $neon($lina['id'], ['mesures' => ['faits' => ['7×8' => [1, 0, 999999, 1]]]])), 422, 'temps de fait impossible');
$r = $alice->post('/resultats', $neon($lina['id'], ['score' => 500000, 'partie' => 'partieNEONAAAAAAAAA2']));
assert_true($r->status === 201 && $r->data['verifie'] === false, 'score au-delà de 3 600 points par bonne réponse : gardé, non vérifié');
$now += 30;
$r = $alice->post('/resultats', $neon($lina['id'], ['precision' => 0.5, 'partie' => 'partieNEONAAAAAAAAA3']));
assert_true($r->status === 201 && $r->data['verifie'] === false, 'précision annoncée différente des mesures : non vérifié');
$now += 30;
$r = $alice->post('/resultats', array_diff_key($neon($lina['id'], ['partie' => 'partieNEONAAAAAAAAA4']), ['mesures' => 1]));
assert_true($r->status === 201 && $r->data['verifie'] === false, 'Neon Flight sans mesures : non vérifié');
$now += 30;
$r = $alice->post('/resultats', $neon($lina['id'], ['mode' => 'tranquille', 'score' => 90000, 'partie' => 'partieNEONAAAAAAAAA5']));
assert_true($r->status === 201 && $r->data['verifie'] === true, 'Entraînement enregistré');
$now += 30;
$r = $alice->post('/resultats', $neon($lina['id'], ['variante' => 'perso', 'score' => 80000, 'partie' => 'partieNEONAAAAAAAAA6']));
assert_status($r, 201, 'tables au choix enregistrées');
$now += 30;
$r = $alice->post('/resultats', $neon($noe['id'], ['score' => 25000, 'variante' => 'expert', 'niveau' => 'maitre', 'partie' => 'partieNEONAAAAAAAAA7']));
assert_status($r, 201, 'Noé, autre profil de la même famille');
$r = $alice->get('/classements');
$nb = static fn (Response $r, string $niveau, string $variante): array => array_values(array_filter($r->data['classements'],
    static fn (array $b): bool => $b['jeu'] === 'neon' && $b['niveau'] === $niveau && ($b['variante'] ?? '') === $variante))[0] ?? [];
assert_true(array_column($nb($r, 'explorateur', 'petites')['public'], 'score') === [21000], 'classement Neon (Explorateur, tables 2 à 5) : le seul score vérifié de la série');
assert_true(array_column($nb($r, 'maitre', 'expert')['public'], 'nom') === ['Noé'], 'Noé classé à part (Maître, tables 2 à 12)');
assert_true(count(array_filter($r->data['classements'], static fn (array $b): bool => $b['jeu'] === 'neon' && $b['mode'] === 'tranquille')) === 0, 'pas de classement Neon en Entraînement');
assert_true(!str_contains(json_encode(array_column(array_filter($r->data['classements'], static fn (array $b): bool => $b['jeu'] === 'neon'), 'public')), '80000'), 'tables « perso » hors classement');
assert_true(!isset($board($r, 'dragon', 'explorateur', 'defi')['variante']), 'les autres jeux n’ont pas de variante');
$h = $alice->get("/profils/{$lina['id']}/resultats")->data;
$first = array_values(array_filter($h['resultats'], static fn (array $x): bool => ($x['cle'] ?? '') === 'partieNEONAAAAAAAAA1'))[0];
assert_true($first['mesures']['tempsMedian'] === 2100 && $first['mesures']['faits']['7×8'] === [1, 2, 5200, 1] && $first['actif'] === 120 && $first['variante'] === 'petites', 'historique : mesures, faits, temps actif et série relus');
$old = array_values(array_filter($h['resultats'], static fn (array $x): bool => $x['jeu'] === 'dragon'))[0];
assert_true(!isset($old['mesures']) && !isset($old['actif']) && !isset($old['variante']), 'anciennes parties : aucune mesure inventée');
assert_true($h['totaux']['neon']['parties'] === 6 && $h['totaux']['dragon']['parties'] === 3, 'totaux par jeu (au-delà de l’historique détaillé)');
assert_true(count(array_filter($alice->get("/profils/{$noe['id']}/resultats")->data['resultats'], static fn (array $x): bool => $x['jeu'] === 'neon')) === 1, 'les résultats de Noé restent les siens');

$rail = static fn (int $profile, array $over = []): array => array_replace_recursive([
    'profil' => $profile, 'jeu' => 'multirail', 'niveau' => 'explorateur', 'mode' => 'defi', 'variante' => 'zen', 'score' => 42000,
    'gagne' => true, 'etoiles' => 2, 'duree' => 300, 'actif' => 290, 'debut' => gmdate('Y-m-d\TH:i:s\Z', $now - 300),
    'precision' => 0.9, 'ops' => ['+' => [20, 2], '×' => [16, 2]], 'details' => ['distance' => 4200, 'regions' => 4, 'voyageurs' => 6],
    'mesures' => ['calculs' => 40, 'justes' => 36, 'fausses' => 4, 'serie' => 9, 'tempsMoyen' => 6400, 'tempsMedian' => 5900,
        'faits' => ['6×7' => [2, 0, 9000, 2]]],
], $over);
$now += 30;
$r = $alice->post('/resultats', $rail($lina['id'], ['partie' => 'partieRAILAAAAAAAAA1']));
assert_true($r->status === 201 && $r->data['verifie'] === true, 'MULTIRAIL Voyage Zen : vérifié');
$now += 30;
$r = $alice->post('/resultats', $rail($lina['id'], ['variante' => 'petites', 'score' => 30000, 'partie' => 'partieRAILAAAAAAAAA2']));
assert_true($r->status === 201 && $r->data['verifie'] === true, 'MULTIRAIL tables 2 à 5 : vérifié');
assert_status($alice->post('/resultats', $rail($lina['id'], ['variante' => 'tables-bizarres'])), 422, 'MULTIRAIL : variante inconnue');
$now += 30;
$r = $alice->post('/resultats', $rail($lina['id'], ['variante' => 'perso', 'score' => 77000, 'partie' => 'partieRAILAAAAAAAAA3']));
assert_status($r, 201, 'MULTIRAIL tables au choix enregistrées');
$now += 30;
$r = $alice->post('/resultats', $rail($lina['id'], ['mode' => 'tranquille', 'score' => 88000, 'partie' => 'partieRAILAAAAAAAAA4']));
assert_status($r, 201, 'MULTIRAIL Entraînement enregistré');
$r = $alice->get('/classements');
$rails = array_values(array_filter($r->data['classements'], static fn (array $b): bool => $b['jeu'] === 'multirail'));
$zen = array_values(array_filter($rails, static fn (array $b): bool => ($b['variante'] ?? '') === 'zen' && $b['niveau'] === 'explorateur'))[0] ?? [];
assert_true(array_column($zen['public'] ?? [], 'score') === [42000], 'classement MULTIRAIL Voyage Zen (Explorateur)');
assert_true(!str_contains(json_encode(array_column($rails, 'public')), '77000') && !str_contains(json_encode(array_column($rails, 'public')), '88000'), 'MULTIRAIL : tables « perso » et Entraînement hors classement');

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
assert_true($r->data['compte']['email'] === 'alice@exemple.fr' && count($r->data['profils']) === 6 && count($r->data['profils'][0]['resultats']) === 13, 'export complet');
assert_true(!str_contains($r->body(), 'mot_de_passe') && !str_contains($r->body(), '$argon'), 'l’export ne contient pas le mot de passe');
assert_status($alice2->post("/profils/{$noe['id']}/supprimer"), 200, 'profil supprimé');
assert_status($alice2->post('/supprimer-compte', ['motDePasse' => 'faux-faux-faux']), 403, 'suppression protégée par le mot de passe');
assert_status($alice2->post('/supprimer-compte', ['motDePasse' => 'nouveau-mot-de-passe']), 200, 'compte supprimé');
$left = (int) $db->query("SELECT COUNT(*) FROM profils p JOIN comptes c ON c.id = p.compte_id WHERE c.email = 'alice@exemple.fr'")->fetchColumn();
$orphans = (int) $db->query('SELECT COUNT(*) FROM resultats r LEFT JOIN profils p ON p.id = r.profil_id WHERE p.id IS NULL')->fetchColumn();
assert_true($left === 0 && $orphans === 0, 'profils et résultats effacés avec le compte');
assert_true((int) $db->query('SELECT COUNT(*) FROM resultats')->fetchColumn() === 1, 'les résultats de Bob restent');
assert_status($alice->get('/profils'), 401, 'l’ancienne session d’Alice ne donne plus accès');

// ---------------------------------------------------------------------------------------------
section('Continuer avec Google');
assert_status($guest->post('/google', ['credential' => 'x.y.z']), 404, 'Google non configuré : route indisponible');

// Une fausse « Google » : notre propre paire de clés, publiée dans un fichier de clés local.
$key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
$other = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
$b64 = static fn (string $s): string => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
$rsa = openssl_pkey_get_details($key)['rsa'];
$certs = tempnam(sys_get_temp_dir(), 'calcoolos-google-');
file_put_contents($certs, json_encode(['keys' => [['kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'kid' => 'cle-1', 'n' => $b64($rsa['n']), 'e' => $b64($rsa['e'])]]]));
$clientId = '123-test.apps.googleusercontent.com';
$gConfig = Config::fromArray(['DB_DSN' => $dsn, 'GOOGLE_CLIENT_ID' => $clientId, 'GOOGLE_CERTS_FILE' => $certs]);
$gClient = static fn (string $ip): Client => Client::make($db, new MemorySession(), $gConfig, $clock, $ip);
$token = static function (array $over = [], $signKey = null, array $head = []) use ($key, $b64, $clientId, &$now): string {
    $h = $b64(json_encode($head + ['alg' => 'RS256', 'kid' => 'cle-1', 'typ' => 'JWT']));
    $claims = array_filter($over + ['iss' => 'https://accounts.google.com', 'aud' => $clientId, 'sub' => '1100000000000000001',
        'email' => 'Camille@gmail.com', 'email_verified' => true, 'iat' => $now, 'exp' => $now + 3600], static fn ($v) => $v !== null);
    $p = $b64(json_encode($claims));
    openssl_sign("$h.$p", $sig, $signKey ?? $key, OPENSSL_ALGO_SHA256);
    return "$h.$p." . $b64($sig);
};

$camille = $gClient('198.51.100.20');
$r = $camille->get('/etat');
assert_true(($r->data['googleClientId'] ?? '') === $clientId, 'l’identifiant client Google (public) est donné aux invités');
foreach ([
    'jeton illisible' => 'pas-un-jeton',
    'signé par une autre clé' => $token([], $other),
    'pour un autre site (aud)' => $token(['aud' => 'autre.apps.googleusercontent.com']),
    'émetteur inconnu' => $token(['iss' => 'https://pirate.example']),
    'expiré' => $token(['exp' => $now - 3600, 'iat' => $now - 7200]),
    'clé inconnue' => $token([], null, ['kid' => 'cle-inconnue']),
    'algorithme « none »' => explode('.', $token([], null, ['alg' => 'none']))[0] . '.' . explode('.', $token())[1] . '.',
    'charge modifiée' => (static function () use ($token, $b64, $now, $clientId): string {
        [$h, , $s] = explode('.', $token());
        return "$h." . $b64(json_encode(['iss' => 'accounts.google.com', 'aud' => $clientId, 'sub' => '666', 'email' => 'x@gmail.com', 'email_verified' => true, 'iat' => $now, 'exp' => $now + 60])) . ".$s";
    })(),
] as $what => $bad) {
    assert_status($camille->post('/google', ['credential' => $bad, 'adulte' => true]), 401, "jeton refusé : $what");
}
assert_true(!$camille->session->active(), 'aucune session ouverte avec un jeton invalide');
assert_true((int) $db->query("SELECT COUNT(*) FROM comptes WHERE email = 'camille@gmail.com'")->fetchColumn() === 0, 'aucun compte créé avec un jeton invalide');
assert_status($camille->post('/google', ['credential' => $token(['email_verified' => false]), 'adulte' => true]), 422, 'adresse Google non vérifiée : pas de création');
assert_status($camille->post('/google', ['credential' => $token()]), 422, 'création : mention « adulte » obligatoire');

$r = $camille->post('/google', ['credential' => $token(), 'adulte' => true]);
assert_status($r, 201, 'nouveau compte créé avec Google');
assert_true($r->data['email'] === 'camille@gmail.com' && $r->data['google'] === true && $r->data['motDePasse'] === false, 'compte Google sans mot de passe');
assert_true($camille->session->regenerations === 1, 'nouvel identifiant de session');
$r = $camille->post('/profils', ['pseudo' => 'Jade', 'avatar' => 'chat-noir', 'niveau' => 'eveil']);
assert_status($r, 201, 'profil sur un compte Google (même système de profils)');
$jade = $r->data['profils'][0];
$now += 30;
assert_status($camille->post('/resultats', $result($jade['id'])), 201, 'résultat sur un compte Google');
assert_status($camille->post('/deconnexion'), 200, 'déconnexion du compte Google');
assert_status($camille->post('/connexion', ['email' => 'camille@gmail.com', 'motDePasse' => '']), 401, 'pas de connexion par mot de passe vide');
assert_status($camille->post('/connexion', ['email' => 'camille@gmail.com', 'motDePasse' => 'nimporte-quoi-1']), 401, 'compte Google : connexion classique impossible');
assert_status($gClient('198.51.100.21')->post('/inscription', ['email' => 'camille@gmail.com', 'motDePasse' => 'assez-long-pour-passer', 'adulte' => true]), 409, 'inscription classique avec la même adresse : refusée');
$r = $camille->post('/google', ['credential' => $token(['email' => 'camille.nouvelle@gmail.com'])]);
assert_status($r, 200, 'reconnexion avec Google (même identifiant, même si l’adresse Google a changé)');
assert_true(count($r->data['profils']) === 1 && $r->data['profils'][0]['pseudo'] === 'Jade', 'profil retrouvé');
assert_true(count($camille->get("/profils/{$jade['id']}/resultats")->data['resultats']) === 1, 'résultats retrouvés');
assert_status($camille->post('/mot-de-passe', ['ancien' => '', 'nouveau' => 'nouveau-mot-de-passe']), 403, 'compte Google : pas de changement de mot de passe sans l’ancien');
assert_status($camille->post('/google/dissocier', ['motDePasse' => '']), 422, 'compte Google sans mot de passe : dissociation refusée');

section('Associer Google à un compte existant');
$bobG = $gClient('198.51.100.30');
$r = $bobG->post('/google', ['credential' => $token(['sub' => '2200000000000000002', 'email' => 'bob@exemple.fr']), 'adulte' => true]);
assert_status($r, 409, 'même adresse qu’un compte existant : jamais de fusion automatique');
assert_true(!$bobG->session->active() && (int) $db->query("SELECT COUNT(*) FROM comptes WHERE email = 'bob@exemple.fr' AND google_sub IS NULL")->fetchColumn() === 1, 'compte existant intact, non associé');
assert_status($bobG->post('/connexion', ['email' => 'bob@exemple.fr', 'motDePasse' => 'un-autre-mot-de-passe']), 200, 'Bob se connecte avec son mot de passe');
$saved = $bobG->csrf;
$bobG->csrf = '';
assert_status($bobG->post('/google/associer', ['credential' => $token(['sub' => '2200000000000000002', 'email' => 'bob@exemple.fr'])]), 403, 'association protégée par le jeton CSRF');
$bobG->csrf = $saved;
assert_status($bobG->post('/google/associer', ['credential' => $token(['sub' => '1100000000000000001'])]), 409, 'compte Google déjà associé à un autre compte : refus');
assert_status($bobG->post('/google/associer', ['credential' => $token([], $other)]), 401, 'association : jeton invalide refusé');
$r = $bobG->post('/google/associer', ['credential' => $token(['sub' => '2200000000000000002', 'email' => 'bob@exemple.fr'])]);
assert_status($r, 200, 'Google associé au compte de Bob');
assert_true($r->data['google'] === true && $r->data['motDePasse'] === true, 'Bob garde aussi son mot de passe');
$bobG->post('/deconnexion');
$r = $gClient('198.51.100.31')->post('/google', ['credential' => $token(['sub' => '2200000000000000002', 'email' => 'bob@exemple.fr'])]);
assert_status($r, 200, 'Bob se connecte désormais avec Google');
assert_true(count($r->data['profils']) === 1 && $r->data['profils'][0]['pseudo'] === 'Sam', 'profils de Bob conservés');
assert_status($bobG->post('/connexion', ['email' => 'bob@exemple.fr', 'motDePasse' => 'un-autre-mot-de-passe']), 200, 'et toujours avec son mot de passe');
assert_status($bobG->post('/google/dissocier', ['motDePasse' => 'faux-faux-faux']), 403, 'dissociation protégée par le mot de passe');
$r = $bobG->post('/google/dissocier', ['motDePasse' => 'un-autre-mot-de-passe']);
assert_true($r->status === 200 && $r->data['google'] === false, 'Google dissocié');
assert_status($gClient('198.51.100.32')->post('/google', ['credential' => $token(['sub' => '2200000000000000002', 'email' => 'bob@exemple.fr']), 'adulte' => true]), 409, 'après dissociation : plus de connexion Google');

section('Suppression d’un compte Google');
assert_status($camille->post('/supprimer-compte', ['confirmation' => 'autre@gmail.com']), 403, 'confirmation par l’adresse exacte');
assert_status($camille->post('/supprimer-compte', ['confirmation' => ' Camille@gmail.com ']), 200, 'compte Google supprimé');
assert_true((int) $db->query("SELECT COUNT(*) FROM profils WHERE pseudo = 'Jade'")->fetchColumn() === 0, 'ses profils sont effacés');
assert_status($gClient('198.51.100.20')->post('/google', ['credential' => $token()]), 422, 'après suppression, Google ne retrouve plus de compte (nouvelle création seulement)');
@unlink($certs);

// ---------------------------------------------------------------------------------------------
section('Suivi d’audience (invité)');
$now += 86400;
$aConfig = Config::fromArray(['DB_DSN' => $dsn, 'DB_USER' => getenv('TEST_DB_USER') ?: '', 'DB_PASSWORD' => getenv('TEST_DB_PASSWORD') ?: '',
    'ADMIN_TOKEN_SHA256' => hash('sha256', 'jeton-admin-de-test'), 'SUIVI_CONSERVATION_JOURS' => '30']);
$aClient = static fn (string $ip): Client => Client::make($db, new MemorySession(), $aConfig, $clock, $ip);
$track = static fn (Client $c, array $body, array $headers = []): Response => $c->call('POST', '/suivi', $body, ['x-calcoolos' => ''] + $headers);
$V = 'visiteurAAAAAAAAAAAA1';
$S = 'visiteAAAAAAAAAAAAAA1';
$P = 'partieAAAAAAAAAAAAAA1';
$inv = $aClient('192.0.2.50');
$r = $track($inv, ['v' => $V, 's' => $S, 'appareil' => 'tablette', 'page' => 'accueil', 'actif' => 0, 'ev' => [['type' => 'page']]]);
assert_status($r, 200, 'première visite d’un invité');
assert_true(!$inv->session->active(), 'le suivi ne crée aucune session (aucun cookie)');
$row = $db->query("SELECT * FROM visites WHERE cle = '$S'")->fetch();
assert_true($row && $row['appareil'] === 'tablette' && $row['entree'] === 'accueil' && (int) $row['pages'] === 1 && $row['compte_id'] === null, 'visite enregistrée (appareil, page d’entrée)');
assert_status($track($inv, ['v' => 'court', 's' => $S]), 422, 'identifiant invalide refusé');
assert_status($track($inv, ['v' => $V, 's' => $S], ['origin' => 'https://mechant.example']), 403, 'autre origine refusée');
assert_status($track($aClient('192.0.2.51'), ['v' => 'autreVisiteurBBBBBBBB', 's' => $S]), 422, 'la visite d’un autre navigateur ne peut pas être reprise');
assert_status($track($inv, ['v' => $V, 's' => $S, 'ev' => [['type' => 'debut', 'p' => $P, 'jeu' => 'pirate', 'niveau' => 'eveil', 'mode' => 'defi']]]), 422, 'jeu inconnu refusé');
assert_true((int) $db->query('SELECT SUM(refuses) FROM suivi_journal')->fetchColumn() >= 3, 'envois refusés comptés (santé)');
$now += 5;
$r = $track($inv, ['v' => $V, 's' => $S, 'actif' => 5, 'ev' => [['type' => 'niveau'], ['type' => 'debut', 'p' => $P, 'jeu' => 'fusee', 'niveau' => 'eveil', 'mode' => 'tranquille']]]);
assert_status($r, 200, 'début de partie');
$track($inv, ['v' => $V, 's' => $S, 'ev' => [['type' => 'debut', 'p' => $P, 'jeu' => 'fusee', 'niveau' => 'eveil', 'mode' => 'tranquille']]]);
assert_true((int) $db->query("SELECT COUNT(*) FROM parties WHERE cle = '$P'")->fetchColumn() === 1, 'début envoyé deux fois : une seule partie');
$now += 100;
$track($inv, ['v' => $V, 's' => $S, 'actif' => 9000, 'ev' => [['type' => 'jeu', 'p' => $P, 'actif' => 5000]]]);
$row = $db->query("SELECT actif FROM parties WHERE cle = '$P'")->fetch();
assert_true((int) $row['actif'] === 145, 'temps actif borné par le temps réellement écoulé (+ 45 s de marge), reçu ' . $row['actif']);
$db->exec("UPDATE parties SET actif = 0 WHERE cle = '$P'");
$track($inv, ['v' => $V, 's' => $S, 'ev' => [['type' => 'jeu', 'p' => $P, 'actif' => 60]]]);
$track($inv, ['v' => $V, 's' => $S, 'ev' => [['type' => 'jeu', 'p' => $P, 'actif' => 90]]]);
$track($inv, ['v' => $V, 's' => $S, 'ev' => [['type' => 'jeu', 'p' => $P, 'actif' => 80]]]);
assert_true((int) $db->query("SELECT actif FROM parties WHERE cle = '$P'")->fetchColumn() === 90, 'cumul : on garde le plus grand (signal en retard sans effet)');
$now += 20;
$track($inv, ['v' => $V, 's' => $S, 'actif' => 110, 'ev' => [['type' => 'fin', 'p' => $P, 'actif' => 95, 'issue' => 'terminee', 'gagne' => true, 'score' => 1234]]]);
$track($inv, ['v' => $V, 's' => $S, 'ev' => [['type' => 'fin', 'p' => $P, 'actif' => 400, 'issue' => 'abandon']]]);
$row = $db->query("SELECT * FROM parties WHERE cle = '$P'")->fetch();
assert_true($row['etat'] === 'terminee' && (int) $row['actif'] === 95 && (int) $row['score'] === 1234 && (int) $row['gagne'] === 1, 'fin enregistrée une seule fois (envoi répété sans effet)');
assert_true((int) $db->query("SELECT actif FROM visites WHERE cle = '$S'")->fetchColumn() === 150, 'temps actif de la visite : cumul le plus grand, borné (9 000 annoncées → 105 s écoulées + 45)');
// Partie perdue (onglet fermé brutalement, plus aucun signal).
$P2 = 'partieAAAAAAAAAAAAAA2';
$track($inv, ['v' => $V, 's' => $S, 'ev' => [['type' => 'debut', 'p' => $P2, 'jeu' => 'cubes', 'niveau' => 'maitre', 'mode' => 'defi']]]);
$now += 30;
$track($inv, ['v' => $V, 's' => $S, 'ev' => [['type' => 'jeu', 'p' => $P2, 'actif' => 25]]]);
// Fin dont le début s'est perdu en route : la partie est reconstituée.
$P3 = 'partieAAAAAAAAAAAAAA3';
$track($inv, ['v' => $V, 's' => $S, 'ev' => [['type' => 'fin', 'p' => $P3, 'actif' => 20, 'issue' => 'abandon', 'jeu' => 'meteores', 'niveau' => 'stratege', 'mode' => 'defi']]]);
assert_true($db->query("SELECT etat FROM parties WHERE cle = '$P3'")->fetchColumn() === 'abandon', 'fin sans début : partie reconstituée');

section('Suivi d’audience (profil connecté)');
$dad = $aClient('192.0.2.60');
assert_status($dad->post('/inscription', ['email' => 'papa@exemple.fr', 'motDePasse' => 'mot-de-passe-papa', 'adulte' => true]), 201, 'inscription papa');
$lea = $dad->post('/profils', ['pseudo' => 'Léa', 'avatar' => 'renard', 'niveau' => 'explorateur'])->data['profils'][0];
$other = $aClient('192.0.2.61');
$other->post('/inscription', ['email' => 'autre@exemple.fr', 'motDePasse' => 'mot-de-passe-autre', 'adulte' => true]);
$tom = $other->post('/profils', ['pseudo' => 'Tom', 'avatar' => 'robot', 'niveau' => 'eveil'])->data['profils'][0];
$V2 = 'visiteurPAPAAAAAAAAA1';
$S2 = 'visitePAPAAAAAAAAAAA1';
$track($dad, ['v' => $V2, 's' => $S2, 'page' => 'compte', 'ev' => [['type' => 'inscription']]]);
assert_true((int) $db->query("SELECT compte_id FROM visites WHERE cle = '$S2'")->fetchColumn() > 0, 'visite reliée au compte (lu dans la session du serveur)');
$P4 = 'partiePAPAAAAAAAAAAA1';
$track($dad, ['v' => $V2, 's' => $S2, 'profil' => $tom['id'], 'ev' => [['type' => 'debut', 'p' => $P4, 'jeu' => 'dragon', 'niveau' => 'explorateur', 'mode' => 'defi']]]);
assert_true($db->query("SELECT profil_id FROM parties WHERE cle = '$P4'")->fetchColumn() === null, 'profil d’une autre famille ignoré');
$P5 = 'partiePAPAAAAAAAAAAA2';
$track($dad, ['v' => $V2, 's' => $S2, 'profil' => $lea['id'], 'ev' => [['type' => 'debut', 'p' => $P5, 'jeu' => 'dragon', 'niveau' => 'explorateur', 'mode' => 'defi']]]);
assert_true((int) $db->query("SELECT profil_id FROM parties WHERE cle = '$P5'")->fetchColumn() === $lea['id'], 'partie rattachée au profil de la famille');
$now += 200;
$track($dad, ['v' => $V2, 's' => $S2, 'profil' => $lea['id'], 'ev' => [['type' => 'fin', 'p' => $P5, 'actif' => 180, 'issue' => 'terminee', 'gagne' => true, 'score' => 8000]]]);
assert_status($dad->post('/resultats', $result($lea['id'], ['duree' => 200, 'partie' => $P5])), 201, 'résultat relié à la partie suivie');
$now += 30;
assert_status($dad->post('/resultats', $result($lea['id'], ['jeu' => 'cubes', 'duree' => 300])), 201, 'résultat sans suivi (historique, ancienne version)');

section('Statistiques d’administration (accès)');
$adm = static fn (string $path, array $query = [], string $ip = '127.0.0.1', string $tok = 'jeton-admin-de-test', string $m = 'GET'): Response =>
    (new Api($db, new MemorySession(), $aConfig, $clock))->handle(new Request($m, $path, $query, '', ['authorization' => "Bearer $tok"], $ip));
assert_status($adm('/admin/resume', [], '203.0.113.9'), 404, 'statistiques invisibles depuis l’extérieur, même avec le jeton');
assert_status($adm('/admin/resume', [], '127.0.0.1', 'mauvais'), 404, 'mauvais jeton : 404');
assert_status($adm('/admin/resume', [], '127.0.0.1', ''), 404, 'sans jeton : 404');
assert_status($adm('/admin/resume', [], '127.0.0.1', 'jeton-admin-de-test', 'POST'), 404, 'lecture seule (GET)');
assert_status($inv->get('/admin/resume'), 404, 'API normale : pas de statistiques');
assert_status((new Api($db, new MemorySession(), $config, $clock))->handle(new Request('GET', '/admin/resume', [], '', ['authorization' => 'Bearer jeton-admin-de-test'], '127.0.0.1')), 404, 'sans empreinte configurée : désactivé');

section('Statistiques d’administration (chiffres)');
$now += 700; // la partie P2 n'a plus donné signe de vie depuis plus de 10 minutes
$per = ['debut' => gmdate('Y-m-d', $now - 5 * 86400), 'fin' => gmdate('Y-m-d', $now + 86400)];
$r = $adm('/admin/resume', $per);
assert_status($r, 200, 'résumé');
$c = $r->data['chiffres'];
assert_true($db->query("SELECT etat FROM parties WHERE cle = '$P2'")->fetchColumn() === 'abandon', 'partie sans nouvelles fermée comme abandonnée');
assert_true($c['partiesCommencees'] === 5, 'parties commencées (suivies) : 5, reçu ' . $c['partiesCommencees']);
$hist = (int) $db->query('SELECT COUNT(*) FROM resultats WHERE partie_cle IS NULL')->fetchColumn();
assert_true($c['partiesTerminees'] === 2 + $hist, 'terminées = 2 suivies + historique (résultat relié compté une fois), reçu ' . $c['partiesTerminees']);
assert_true($c['partiesAbandonnees'] === 3, 'abandons : 3 (P2 perdue, P3, P4), reçu ' . $c['partiesAbandonnees']);
$tempsHist = (int) $db->query('SELECT SUM(duree) FROM resultats WHERE partie_cle IS NULL')->fetchColumn();
$tempsSuivi = (int) $db->query('SELECT SUM(actif) FROM parties')->fetchColumn();
assert_true($c['tempsJeu'] === $tempsHist + $tempsSuivi, 'temps de jeu = actif suivi + durées historiques');
assert_true($c['sessions'] === 2 && $c['visiteurs'] === 2, 'sessions et visiteurs de la période');
assert_true($c['visiteursAujourdhui'] >= 1, 'visiteurs aujourd’hui');
$jeux = array_column($r->data['jeux']['liste'], null, 'jeu');
assert_true($jeux['fusee']['commencees'] === 1 && $jeux['fusee']['terminees'] === 1 && $jeux['fusee']['temps'] === 95, 'Décollage ! : 1 partie suivie, 95 s actives');
assert_true($jeux['dragon']['tauxTerminees'] === 0.5 && $jeux['dragon']['abandons'] === 1, 'Dragon : P4 abandonnée, P5 terminée');
assert_true($r->data['jeux']['prefere'] !== null, 'jeu préféré estimé');
$e = array_column($r->data['entonnoir']['tous'], 'n', 'etape');
assert_true($e['visite'] === 2 && $e['lancee'] === 2 && $e['terminee'] === 2 && $e['inscription'] === 1, 'entonnoir de conversion ' . json_encode($e));
assert_true($r->data['invites']['parties'] === 3 && $r->data['invites']['sessions'] === 2, 'invités : 3 parties (la visite d’inscription compte comme invitée)');
assert_true(array_sum($r->data['series']['commencees']) === 5, 'courbe : parties commencées par jour');
assert_true($r->data['appareils'][1]['sessions'] === 1, 'appareils : une tablette');
$r = $adm('/admin/resume', ['debut' => '2020-01-01', 'fin' => '2020-01-31']);
assert_true($r->data['chiffres']['partiesCommencees'] === 0 && count($r->data['series']['jours']) === 31, 'période sans données : zéros, 31 jours');
$r = $adm('/admin/joueur', ['id' => (string) $lea['id']]);
assert_status($r, 200, 'fiche joueur');
assert_true($r->data['pseudo'] === 'Léa' && $r->data['parJeu']['dragon']['temps'] === 180 && $r->data['parJeu']['cubes']['temps'] === 300, 'temps par jeu de Léa (180 s suivies, 300 s historiques)');
assert_true($r->data['favori'] === 'cubes' && $r->data['parties'] === 2, 'jeu favori estimé et parties (résultat relié non compté deux fois)');
assert_true(!array_key_exists('email', $r->data['compte']), 'aucune adresse e-mail dans la fiche');
assert_status($adm('/admin/joueur', ['id' => '999999']), 404, 'profil inconnu');
$r = $adm('/admin/joueurs');
assert_true(!str_contains($r->body(), '@exemple.fr'), 'liste des joueurs sans adresse e-mail');
assert_true(count($r->data['invites']) >= 1, 'invités résumés sous un numéro court');
$r = $adm('/admin/historique', ['jeu' => 'dragon'] + $per);
$types = array_count_values(array_column($r->data['evenements'], 'type'));
assert_true(($types['debut'] ?? 0) === 2 && ($types['fin'] ?? 0) >= 1 && ($types['abandon'] ?? 0) === 1, 'historique filtré par jeu ' . json_encode($types));
$r = $adm('/admin/historique', ['profil' => (string) $lea['id']] + $per);
assert_true(count($r->data['evenements']) >= 3 && count(array_filter($r->data['evenements'], static fn ($e) => ($e['profil'] ?? null) !== $lea['id'])) === 0, 'historique filtré par joueur');
assert_status($adm('/admin/sante'), 200, 'santé de la collecte');

section('Suivi : direct, conservation et suppression');
// Visite commencée en invité, compte créé en cours de route sans l'étape « inscription » : déduit par le serveur.
$neo = $aClient('192.0.2.62');
$S3 = 'visiteNEOAAAAAAAAAAA1';
$track($neo, ['v' => 'visiteurNEOAAAAAAAAA1', 's' => $S3, 'page' => 'accueil', 'ev' => [['type' => 'page']]]);
$now += 60;
$neo->post('/inscription', ['email' => 'neo@exemple.fr', 'motDePasse' => 'mot-de-passe-neo', 'adulte' => true]);
$track($neo, ['v' => 'visiteurNEOAAAAAAAAA1', 's' => $S3, 'page' => 'compte', 'ev' => [['type' => 'page']]]);
assert_true((int) $db->query("SELECT inscription FROM visites WHERE cle = '$S3'")->fetchColumn() === 1, 'compte créé pendant la visite : inscription comptée');
$S4 = 'visitePAPAAAAAAAAAAA9';
$now += 60;
$track($dad, ['v' => $V2, 's' => $S4, 'page' => 'accueil', 'ev' => [['type' => 'page']]]);
assert_true((int) $db->query("SELECT inscription FROM visites WHERE cle = '$S4'")->fetchColumn() === 0, 'compte plus ancien que la visite : pas une inscription');
$track($inv, ['v' => $V, 's' => 'visiteDIRECTAAAAAAAA1', 'ev' => [['type' => 'debut', 'p' => 'partieDIRECTAAAAAAA1', 'jeu' => 'meteores', 'niveau' => 'eveil', 'mode' => 'defi']]]);
$d = $adm('/admin/direct')->data;
assert_true($d['enJeu'] === 1 && $d['parJeu']['meteores'] === 1, 'activité en direct');
$avant = $adm('/admin/resume', $per)->data['chiffres'];
$now += 40 * 86400;
(new Suivi($db, $aConfig, $clock))->entretien();
assert_true((int) $db->query('SELECT COUNT(*) FROM visites')->fetchColumn() === 0 && (int) $db->query('SELECT COUNT(*) FROM parties')->fetchColumn() === 0, 'détails effacés après la durée de conservation');
$apres = $adm('/admin/resume', ['debut' => $per['debut'], 'fin' => gmdate('Y-m-d', $now)])->data;
assert_true(array_sum($apres['series']['commencees']) === $avant['partiesCommencees'] && $avant['partiesCommencees'] === 6, 'les totaux par jour restent (bilans)');
assert_true((int) $db->query('SELECT COUNT(*) FROM resultats WHERE profil_id = ' . $lea['id'])->fetchColumn() === 2, 'les résultats des joueurs ne sont jamais effacés par la conservation');
$track($dad, ['v' => $V2, 's' => 'visitePAPAAAAAAAAAAA2', 'profil' => $lea['id'], 'ev' => [['type' => 'debut', 'p' => 'partiePAPAAAAAAAAAAA3', 'jeu' => 'fusee', 'niveau' => 'eveil', 'mode' => 'defi']]]);
assert_status($dad->post('/supprimer-compte', ['motDePasse' => 'mot-de-passe-papa']), 200, 'suppression du compte');
assert_true((int) $db->query("SELECT COUNT(*) FROM parties WHERE cle = 'partiePAPAAAAAAAAAAA3'")->fetchColumn() === 0, 'ses parties suivies sont effacées');
assert_true($db->query("SELECT compte_id FROM visites WHERE cle = 'visitePAPAAAAAAAAAAA2'")->fetchColumn() === null, 'ses visites deviennent anonymes');

section('Profil personnel du titulaire');
$solo = $aClient('192.0.2.70');
assert_status($solo->post('/inscription', ['email' => 'solo@exemple.fr', 'motDePasse' => 'mot-de-passe-solo', 'adulte' => false]), 422, 'compte réservé à un adulte');
$r = $solo->post('/inscription', ['email' => 'solo@exemple.fr', 'motDePasse' => 'mot-de-passe-solo', 'adulte' => true]);
assert_true($r->data['profils'] === [], 'compte neuf sans profil imposé');
$r = $solo->post('/profils', ['pseudo' => 'Solo', 'avatar' => 'robot', 'niveau' => 'maitre', 'personnel' => true]);
assert_status($r, 201, 'profil personnel créé');
assert_true($r->data['profils'][0]['personnel'] === true, 'profil marqué personnel');
$moi = $r->data['profils'][0];
assert_status($solo->post('/profils', ['pseudo' => 'Solo2', 'avatar' => 'robot', 'niveau' => 'maitre', 'personnel' => true]), 422, 'un seul profil personnel');
for ($i = 1; $i <= 6; $i++) {
    assert_status($solo->post('/profils', ['pseudo' => "Enfant $i", 'avatar' => 'robot', 'niveau' => 'eveil']), 201, "enfant $i : le profil personnel ne compte pas dans les six");
}
assert_status($solo->post('/profils', ['pseudo' => 'Enfant 7', 'avatar' => 'robot', 'niveau' => 'eveil']), 422, 'sept enfants refusés');
$r = $solo->get('/etat');
assert_true(count($r->data['profils']) === 7 && $r->data['profils'][0]['id'] === $moi['id'], 'titulaire en premier');
$enfant = $r->data['profils'][1];
assert_true($enfant['personnel'] === false, 'les autres restent des enfants');
assert_status($solo->post("/profils/{$enfant['id']}/personnel", ['personnel' => true]), 422, 'pas de second profil personnel par désignation');
$autre = $aClient('192.0.2.72');
$autre->post('/inscription', ['email' => 'voisin@exemple.fr', 'motDePasse' => 'mot-de-passe-voisin', 'adulte' => true]);
assert_status($autre->post("/profils/{$moi['id']}/personnel", ['personnel' => true]), 404, 'le profil d’un autre compte reste invisible');
$solo->post("/profils/{$moi['id']}/personnel", ['personnel' => false]);
$r = $solo->post("/profils/{$enfant['id']}/personnel", ['personnel' => true]);
assert_true($r->data['profils'][0]['id'] === $enfant['id'], 'le titulaire peut désigner son profil lui-même');
$r = $solo->post("/profils/{$enfant['id']}/supprimer");
assert_true(array_filter($r->data['profils'], static fn ($p) => $p['personnel']) === [], 'profil personnel supprimé : le compte peut en recréer un');
assert_true($db->query("SELECT profil_personnel FROM comptes WHERE email = 'solo@exemple.fr'")->fetchColumn() === null, 'lien remis à zéro');
assert_status($solo->post('/profils', ['pseudo' => 'Solo', 'avatar' => 'robot', 'niveau' => 'maitre', 'personnel' => true]), 201, 'nouveau profil personnel');
assert_true($solo->get('/export')->data['profils'][0]['personnel'] === true, 'export complet avec le profil personnel');

echo "\n" . ($failures === 0 ? "OK : $count vérifications ($dsn)\n" : "$failures échec(s) sur $count vérifications\n");
exit($failures === 0 ? 0 : 1);
