<?php
// Calcoolos Analytics — module du portail tool.zfx.fr, servi sous /calcoolos/.
//
// Appelé par le routeur du portail (portail/app/front.php) APRÈS sa vérification de session :
// aucune page ni API de ce module n'est joignable sans être connecté au portail (Nginx auth_request
// puis contrôle PHP du portail). Pas de second système de connexion.
//
// Les chiffres viennent de l'API de Calcoolos (/api/admin/…), appelée ici côté serveur sur
// 127.0.0.1 avec un jeton connu de ce seul fichier de configuration : le navigateur ne voit ni le
// jeton, ni la base de données.
declare(strict_types=1);

if (session_status() === PHP_SESSION_ACTIVE) {
    session_write_close(); // la session du portail n'est que lue : ne pas bloquer les appels parallèles
}

$module = dirname(__DIR__);
$cfg = is_file($module . '/config.php') ? require $module . '/config.php' : [];
$sous = substr($path, strlen('/calcoolos'));

if ($sous === '' || $sous === false) {
    header('Location: /calcoolos/', true, 301);
    exit;
}

if ($sous === '/' || $sous === '/index.php') {
    require __DIR__ . '/vue.php';
    exit;
}

if (preg_match('#^/api/(resume|joueurs|joueur|historique|direct|sante)$#', $sous, $m)) {
    calcoolos_relais($m[1], $cfg);
    exit;
}

http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
echo '<!doctype html><meta charset="utf-8"><title>Introuvable</title><p style="font-family:sans-serif">Cette page n\'existe pas. <a href="/calcoolos/">Retour à Calcoolos Analytics</a></p>';

/** Relaie une lecture vers l'API d'administration de Calcoolos (GET seulement, paramètres filtrés). */
function calcoolos_relais(string $quoi, array $cfg): void
{
    header('Content-Type: application/json; charset=utf-8');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        http_response_code(405);
        echo '{"erreur":"Lecture seule."}';
        return;
    }
    if (empty($cfg['jeton']) || empty($cfg['api'])) {
        http_response_code(503);
        echo '{"erreur":"Module non configuré (config.php)."}';
        return;
    }
    $params = [];
    foreach (['debut', 'fin', 'jeu', 'profil', 'qui', 'id'] as $k) {
        $v = $_GET[$k] ?? null;
        if (is_string($v) && preg_match('/^[a-z0-9-]{1,20}$/', $v)) {
            $params[$k] = $v;
        }
    }
    $url = rtrim((string) $cfg['api'], '/') . '/api/admin/' . $quoi . ($params ? '?' . http_build_query($params) : '');
    $entetes = ['Host: ' . ($cfg['hote'] ?? 'calculos.zfx.fr'), 'Authorization: Bearer ' . $cfg['jeton'], 'Accept: application/json'];
    $statut = 0;
    $corps = false;
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $entetes, CURLOPT_TIMEOUT => 20,
            CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_FOLLOWLOCATION => false]);
        $corps = curl_exec($c);
        $statut = (int) curl_getinfo($c, CURLINFO_RESPONSE_CODE);
    } else {
        $ctx = stream_context_create(['http' => ['header' => implode("\r\n", $entetes), 'timeout' => 20, 'ignore_errors' => true]]);
        $corps = @file_get_contents($url, false, $ctx);
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $mm)) {
            $statut = (int) $mm[1];
        }
    }
    if ($corps === false || $statut === 0) {
        http_response_code(502);
        echo '{"erreur":"L’API de Calcoolos ne répond pas."}';
        return;
    }
    if ($statut === 404 && $quoi !== 'joueur') {
        // L'API répond 404 à un jeton refusé (ou à une version trop ancienne) : on le dit clairement.
        http_response_code(502);
        echo '{"erreur":"L’API de Calcoolos refuse l’accès (jeton ou version à vérifier)."}';
        return;
    }
    http_response_code($statut);
    echo $corps;
}
