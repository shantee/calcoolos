<?php
// Page unique de Calcoolos Analytics : le contenu est construit par assets/calcoolos/app.js.
declare(strict_types=1);

$assets = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), '/') . '/assets/calcoolos';
$v = static fn (string $f): string => '/assets/calcoolos/' . $f . '?v=' . (is_file("$assets/$f") ? substr(md5((string) filemtime("$assets/$f") . $f), 0, 10) : '0');
header('Content-Type: text/html; charset=utf-8');
?><!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#16203a">
<title>Calcoolos Analytics</title>
<link rel="icon" href="<?= $v('icone.svg') ?>" type="image/svg+xml">
<link rel="stylesheet" href="/assets/public/fonts.css">
<link rel="stylesheet" href="<?= $v('app.css') ?>">
</head>
<body>
<div class="fond-etoiles" aria-hidden="true"></div>
<header class="entete">
  <div class="entete-ligne">
    <a class="marque" href="/calcoolos/" aria-label="Calcoolos Analytics, accueil">
      <img src="<?= $v('icone.svg') ?>" alt="" width="44" height="44">
      <span><b>Calcoolos</b> Analytics</span>
    </a>
    <div class="direct" id="direct" role="status" aria-live="polite"><span class="pastille-direct"></span><span id="direct-texte">Activité en direct…</span></div>
    <a class="retour-portail" href="/" title="Retour au portail tool.zfx.fr">Portail</a>
  </div>
  <nav class="onglets" id="onglets" aria-label="Rubriques">
    <button type="button" data-vue="ensemble" aria-current="page">Vue d’ensemble</button>
    <button type="button" data-vue="jeux">Jeux</button>
    <button type="button" data-vue="visiteurs">Visiteurs</button>
    <button type="button" data-vue="joueurs">Joueurs</button>
    <button type="button" data-vue="historique">Historique</button>
    <button type="button" data-vue="sante">Santé</button>
  </nav>
  <div class="periode" id="periode" role="group" aria-label="Période">
    <button type="button" data-p="aujourdhui">Aujourd’hui</button>
    <button type="button" data-p="hier">Hier</button>
    <button type="button" data-p="7">7 jours</button>
    <button type="button" data-p="30" aria-pressed="true">30 jours</button>
    <button type="button" data-p="90">90 jours</button>
    <span class="plage">
      <label><span class="sr">Du</span><input type="date" id="du" aria-label="Du"></label>
      <span aria-hidden="true">→</span>
      <label><span class="sr">Au</span><input type="date" id="au" aria-label="Au"></label>
    </span>
  </div>
</header>
<main id="contenu" class="contenu" tabindex="-1"><p class="chargement">Chargement des statistiques…</p></main>
<div class="fiche-fond" id="fiche-fond" hidden></div>
<aside class="fiche" id="fiche" hidden aria-modal="true" role="dialog" aria-labelledby="fiche-titre"></aside>
<script src="<?= $v('vendor/echarts.min.js') ?>"></script>
<script type="module" src="<?= $v('app.js') ?>"></script>
</body>
</html>
