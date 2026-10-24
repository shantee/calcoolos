<?php

declare(strict_types=1);

/**
 * Outil d'administration (sur le serveur seulement) : définit un nouveau mot de
 * passe pour un compte, quand un parent l'a oublié (pas d'envoi d'e-mail pour l'instant).
 * Usage : php server/bin/reset-password.php adresse@exemple.fr
 * Le mot de passe est demandé au clavier, jamais passé en argument.
 */
require dirname(__DIR__) . '/src/bootstrap.php';

use Calcoolos\Config;
use Calcoolos\Db;

if (PHP_SAPI !== 'cli' || $argc !== 2) {
    fwrite(STDERR, "Usage : php server/bin/reset-password.php adresse@exemple.fr\n");
    exit(1);
}
$email = strtolower(trim($argv[1]));
$db = Db::connect(Config::load());
$q = $db->prepare('SELECT id FROM comptes WHERE email = ?');
$q->execute([$email]);
$id = $q->fetchColumn();
if ($id === false) {
    fwrite(STDERR, "Aucun compte avec cette adresse.\n");
    exit(1);
}
fwrite(STDOUT, 'Nouveau mot de passe (10 caractères au moins) : ');
system('stty -echo');
$password = trim((string) fgets(STDIN));
system('stty echo');
fwrite(STDOUT, "\n");
if (mb_strlen($password) < 10) {
    fwrite(STDERR, "Trop court.\n");
    exit(1);
}
$hash = password_hash($password, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT);
$db->prepare('UPDATE comptes SET mot_de_passe = ? WHERE id = ?')->execute([$hash, $id]);
echo "Mot de passe changé.\n";
