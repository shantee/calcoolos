<?php

declare(strict_types=1);

namespace Calcoolos;

use DateTimeImmutable;
use DateTimeZone;
use PDO;

/**
 * Statistiques pour Calcoolos Analytics (https://tool.zfx.fr/calcoolos/).
 *
 * Lecture seule des données de jeu, sauf l'entretien du suivi (parties perdues, conservation).
 * Jamais d'adresse e-mail : les comptes sont désignés par leur numéro, les joueurs par leur pseudo.
 *
 * Deux sources de parties :
 * - « suivi » (table parties, depuis l'installation du suivi) : invités et profils, parties
 *   commencées, terminées ou abandonnées, temps de jeu ACTIF ;
 * - « historique » (table resultats, avant le suivi) : parties terminées des profils seulement,
 *   avec la durée déclarée par le jeu. Un résultat relié à une partie suivie n'est compté qu'une fois.
 *
 * Les jours sont ceux de l'heure de Paris ; les dates renvoyées sont en UTC (ISO 8601, « Z »).
 */
final class Stats
{
    public const FUSEAU = 'Europe/Paris';
    /** Un navigateur ou une partie est « actif maintenant » s'il a donné signe de vie depuis ce délai (s). */
    public const ACTIF_DEPUIS = 120;
    private DateTimeZone $tz;
    private Suivi $suivi;

    /** @param \Closure(): int $clock */
    public function __construct(
        private readonly PDO $db,
        private readonly Config $config,
        private readonly \Closure $clock,
    ) {
        $this->tz = new DateTimeZone(self::FUSEAU);
        $this->suivi = new Suivi($db, $config, $clock);
    }

    private function now(): int
    {
        return ($this->clock)();
    }

    private static function stamp(int $t): string
    {
        return gmdate('Y-m-d H:i:s', $t);
    }

    private static function epoch(?string $dt): ?int
    {
        return $dt === null ? null : (int) strtotime($dt . ' UTC');
    }

    private static function iso(?int $t): ?string
    {
        return $t === null ? null : gmdate('Y-m-d\TH:i:s\Z', $t);
    }

    /** Jour local (AAAA-MM-JJ) d'un instant. */
    private function jour(int $t): string
    {
        return (new DateTimeImmutable('@' . $t))->setTimezone($this->tz)->format('Y-m-d');
    }

    /** Minuit local d'un jour, en secondes UTC. */
    private function minuit(string $jour): int
    {
        return (new DateTimeImmutable($jour . ' 00:00:00', $this->tz))->getTimestamp();
    }

    /**
     * Période demandée (jours locaux inclus). Par défaut : les 30 derniers jours.
     * @param array<string, string> $q
     * @return array{debut: string, fin: string, de: int, a: int, jours: list<string>}
     */
    public function periode(array $q): array
    {
        $aujourdhui = $this->jour($this->now());
        $ok = static fn (?string $d): bool => is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) === 1 && checkdate((int) substr($d, 5, 2), (int) substr($d, 8, 2), (int) substr($d, 0, 4));
        $fin = $ok($q['fin'] ?? null) ? $q['fin'] : $aujourdhui;
        $debut = $ok($q['debut'] ?? null) ? $q['debut'] : (new DateTimeImmutable($fin, $this->tz))->modify('-29 days')->format('Y-m-d');
        if ($debut > $fin) {
            [$debut, $fin] = [$fin, $debut];
        }
        $jours = [];
        $d = new DateTimeImmutable($debut, $this->tz);
        while (($j = $d->format('Y-m-d')) <= $fin && count($jours) < 800) {
            $jours[] = $j;
            $d = $d->modify('+1 day');
        }
        $fin = end($jours);
        $a = $this->minuit((new DateTimeImmutable($fin, $this->tz))->modify('+1 day')->format('Y-m-d'));
        return ['debut' => $debut, 'fin' => $fin, 'de' => $this->minuit($debut), 'a' => $a, 'jours' => $jours];
    }

    // --- Chargement des parties ---------------------------------------------------------------------

    /**
     * Parties (suivies + historiques) commencées ou terminées dans [de, a[.
     * @return list<array<string, mixed>>
     */
    private function parties(int $de, int $a, ?int $profil = null): array
    {
        $out = [];
        $sql = 'SELECT p.cle, p.visite_id, p.jeu, p.niveau, p.mode, p.debut, p.dernier, p.fin, p.actif, p.etat, p.gagne, p.score,
                p.profil_id, p.compte_id, p.visiteur, pr.pseudo, pr.avatar
            FROM parties p LEFT JOIN profils pr ON pr.id = p.profil_id WHERE p.debut >= ? AND p.debut < ?';
        $args = [self::stamp($de), self::stamp($a)];
        if ($profil !== null) {
            $sql .= ' AND p.profil_id = ?';
            $args[] = $profil;
        }
        $q = $this->db->prepare($sql . ' ORDER BY p.debut');
        $q->execute($args);
        $vivant = $this->now() - Suivi::PERDUE_APRES;
        foreach ($q->fetchAll() as $r) {
            $etat = (string) $r['etat'];
            $dernier = (int) self::epoch((string) $r['dernier']);
            if ($etat === 'en_cours' && $dernier < $vivant) {
                $etat = 'abandon';
            }
            $out[] = [
                'source' => 'suivi',
                'cle' => (string) $r['cle'],
                'visite' => $r['visite_id'] === null ? null : (int) $r['visite_id'],
                'jeu' => (string) $r['jeu'],
                'niveau' => (string) $r['niveau'],
                'mode' => (string) $r['mode'],
                'debut' => (int) self::epoch((string) $r['debut']),
                'fin' => $etat === 'en_cours' ? null : (self::epoch($r['fin']) ?? $dernier),
                'dernier' => $dernier,
                'actif' => (int) $r['actif'],
                'etat' => $etat,
                'gagne' => $r['gagne'] === null ? null : (bool) $r['gagne'],
                'score' => $r['score'] === null ? null : (int) $r['score'],
                'profil' => $r['profil_id'] === null ? null : (int) $r['profil_id'],
                'compte' => $r['compte_id'] === null ? null : (int) $r['compte_id'],
                'joueur' => $r['profil_id'] !== null ? 'p' . $r['profil_id'] : ($r['compte_id'] !== null ? 'c' . $r['compte_id'] : 'v' . $r['visiteur']),
                'pseudo' => $r['pseudo'] === null ? null : (string) $r['pseudo'],
                'avatar' => $r['avatar'] === null ? null : (string) $r['avatar'],
            ];
        }
        $sql = 'SELECT r.id, r.jeu, r.niveau, r.mode, r.score, r.gagne, r.duree, r.joue_le, r.profil_id, pr.compte_id, pr.pseudo, pr.avatar
            FROM resultats r JOIN profils pr ON pr.id = r.profil_id
            WHERE r.joue_le >= ? AND r.joue_le < ?
                AND (r.partie_cle IS NULL OR NOT EXISTS (SELECT 1 FROM parties p WHERE p.cle = r.partie_cle))';
        $args = [self::stamp($de), self::stamp($a)];
        if ($profil !== null) {
            $sql .= ' AND r.profil_id = ?';
            $args[] = $profil;
        }
        $q = $this->db->prepare($sql);
        $q->execute($args);
        foreach ($q->fetchAll() as $r) {
            $fin = (int) self::epoch((string) $r['joue_le']);
            $out[] = [
                'source' => 'historique',
                'cle' => 'r' . $r['id'],
                'visite' => null,
                'jeu' => (string) $r['jeu'],
                'niveau' => (string) $r['niveau'],
                'mode' => (string) $r['mode'],
                'debut' => $fin - (int) $r['duree'],
                'fin' => $fin,
                'dernier' => $fin,
                'actif' => (int) $r['duree'],
                'etat' => 'terminee',
                'gagne' => (bool) $r['gagne'],
                'score' => (int) $r['score'],
                'profil' => (int) $r['profil_id'],
                'compte' => (int) $r['compte_id'],
                'joueur' => 'p' . $r['profil_id'],
                'pseudo' => (string) $r['pseudo'],
                'avatar' => (string) $r['avatar'],
            ];
        }
        usort($out, static fn (array $x, array $y): int => $x['debut'] <=> $y['debut']);
        return $out;
    }

    /** @return list<array<string, mixed>> */
    private function visites(int $de, int $a): array
    {
        $q = $this->db->prepare('SELECT id, visiteur, compte_id, debut, dernier, actif, pages, appareil, entree, niveau_choisi, inscription
            FROM visites WHERE debut >= ? AND debut < ? ORDER BY debut');
        $q->execute([self::stamp($de), self::stamp($a)]);
        return array_map(static fn (array $v): array => [
            'id' => (int) $v['id'],
            'visiteur' => (string) $v['visiteur'],
            'compte' => $v['compte_id'] === null ? null : (int) $v['compte_id'],
            'debut' => (int) self::epoch((string) $v['debut']),
            'dernier' => (int) self::epoch((string) $v['dernier']),
            'actif' => (int) $v['actif'],
            'pages' => (int) $v['pages'],
            'appareil' => (string) $v['appareil'],
            'entree' => (string) $v['entree'],
            'niveau' => (bool) $v['niveau_choisi'],
            'inscription' => (bool) $v['inscription'],
        ], $q->fetchAll());
    }

    // --- Petits calculs -----------------------------------------------------------------------------

    /** @param list<int|float> $xs */
    private static function mediane(array $xs): ?float
    {
        if (!$xs) {
            return null;
        }
        sort($xs);
        $n = count($xs);
        return $n % 2 ? (float) $xs[intdiv($n, 2)] : ($xs[$n / 2 - 1] + $xs[$n / 2]) / 2;
    }

    /** @param list<int|float> $xs */
    private static function moyenne(array $xs): ?float
    {
        return $xs ? array_sum($xs) / count($xs) : null;
    }

    private static function taux(int $n, int $sur): ?float
    {
        return $sur > 0 ? round($n / $sur, 4) : null;
    }

    /** Début du suivi détaillé (première visite enregistrée), ou null. */
    private function debutSuivi(): ?int
    {
        $v = $this->db->query('SELECT MIN(debut) FROM visites')->fetchColumn();
        $b = $this->db->query('SELECT MIN(jour) FROM suivi_bilans')->fetchColumn();
        $t = $v ? self::epoch((string) $v) : null;
        if ($b) {
            $tb = $this->minuit((string) $b);
            $t = $t === null ? $tb : min($t, $tb);
        }
        return $t;
    }

    private function distinctVisiteursDepuis(int $t): int
    {
        $q = $this->db->prepare('SELECT COUNT(DISTINCT visiteur) FROM visites WHERE dernier >= ?');
        $q->execute([self::stamp($t)]);
        return (int) $q->fetchColumn();
    }

    // --- Vue d'ensemble -------------------------------------------------------------------------------

    /**
     * Tout le tableau de bord d'une période : chiffres clés, courbes, jeux, visiteurs, difficulté,
     * appareils, heures, entonnoir, fidélisation, activité en direct.
     * @param array<string, string> $q
     */
    public function resume(array $q): array
    {
        $this->suivi->entretien();
        $per = $this->periode($q);
        $parties = $this->parties($per['de'], $per['a']);
        $visites = $this->visites($per['de'], $per['a']);
        $now = $this->now();
        $aujourdhui = $this->jour($now);
        $minuit = $this->minuit($aujourdhui);

        $suivies = array_values(array_filter($parties, static fn ($p) => $p['source'] === 'suivi'));
        $finies = array_values(array_filter($parties, static fn ($p) => $p['etat'] !== 'en_cours'));
        $comptes = (int) $this->db->query('SELECT COUNT(*) FROM comptes')->fetchColumn();
        $q2 = $this->db->prepare('SELECT COUNT(*) FROM comptes WHERE cree_le >= ? AND cree_le < ?');
        $q2->execute([self::stamp($per['de']), self::stamp($per['a'])]);
        $nouveaux = (int) $q2->fetchColumn();
        $q2 = $this->db->prepare('SELECT COUNT(*) FROM profils WHERE cree_le >= ? AND cree_le < ?');
        $q2->execute([self::stamp($per['de']), self::stamp($per['a'])]);
        $nouveauxProfils = (int) $q2->fetchColumn();

        $durees = array_map(static fn ($v) => $v['actif'], $visites);
        $chiffres = [
            'visiteursAujourdhui' => $this->distinctVisiteursDepuis($minuit),
            'visiteurs7j' => $this->distinctVisiteursDepuis($this->minuit((new DateTimeImmutable($aujourdhui, $this->tz))->modify('-6 days')->format('Y-m-d'))),
            'visiteurs30j' => $this->distinctVisiteursDepuis($this->minuit((new DateTimeImmutable($aujourdhui, $this->tz))->modify('-29 days')->format('Y-m-d'))),
            'visiteurs' => count(array_unique(array_map(static fn ($v) => $v['visiteur'], $visites))),
            'sessions' => count($visites),
            'sessionMoyenne' => self::moyenne($durees),
            'sessionMediane' => self::mediane($durees),
            'comptes' => $comptes,
            'profils' => (int) $this->db->query('SELECT COUNT(*) FROM profils')->fetchColumn(),
            'nouveauxComptes' => $nouveaux,
            'nouveauxProfils' => $nouveauxProfils,
            'partiesCommencees' => count($suivies),
            'partiesTerminees' => count(array_filter($parties, static fn ($p) => $p['etat'] === 'terminee')),
            'partiesTermineesHistorique' => count(array_filter($parties, static fn ($p) => $p['source'] === 'historique')),
            'partiesAbandonnees' => count(array_filter($suivies, static fn ($p) => $p['etat'] === 'abandon')),
            'tempsJeu' => array_sum(array_map(static fn ($p) => $p['actif'], $parties)),
            'joueurs' => count(array_unique(array_map(static fn ($p) => $p['joueur'], $parties))),
            'partieMoyenne' => self::moyenne(array_map(static fn ($p) => $p['actif'], array_filter($finies, static fn ($p) => $p['actif'] > 0))),
        ];

        return [
            'periode' => ['debut' => $per['debut'], 'fin' => $per['fin'], 'fuseau' => self::FUSEAU],
            'maintenant' => self::iso($now),
            'debutSuivi' => self::iso($this->debutSuivi()),
            'chiffres' => $chiffres,
            'series' => $this->series($per, $parties, $visites),
            'jeux' => $this->jeux($per, $parties),
            'difficulte' => $this->difficulte($parties),
            'appareils' => $this->appareils($visites),
            'heures' => $this->heures($visites, $parties),
            'entonnoir' => $this->entonnoir($visites, $suivies),
            'invites' => $this->invites($visites, $suivies),
            'fidelite' => $this->fidelite($per),
            'direct' => $this->direct(),
        ];
    }

    /**
     * Courbes jour par jour. Les jours dont le détail a été effacé (conservation) viennent des bilans.
     * @param array{jours: list<string>, de: int, a: int} $per
     */
    private function series(array $per, array $parties, array $visites): array
    {
        $base = array_fill_keys($per['jours'], 0);
        $s = ['jours' => $per['jours'], 'visiteurs' => $base, 'sessions' => $base, 'commencees' => $base, 'terminees' => $base,
            'abandons' => $base, 'tempsJeu' => $base, 'nouveauxComptes' => $base, 'parJeu' => []];
        foreach (array_keys(Games::CATALOG) as $jeu) {
            $s['parJeu'][$jeu] = ['parties' => $base, 'temps' => $base];
        }
        $vus = [];
        foreach ($visites as $v) {
            $j = $this->jour($v['debut']);
            if (!isset($base[$j])) {
                continue;
            }
            $s['sessions'][$j]++;
            $vus[$j][$v['visiteur']] = true;
        }
        foreach ($vus as $j => $set) {
            $s['visiteurs'][$j] = count($set);
        }
        foreach ($parties as $p) {
            $j = $this->jour($p['source'] === 'historique' ? $p['fin'] : $p['debut']);
            if (!isset($base[$j])) {
                continue;
            }
            if ($p['source'] === 'suivi') {
                $s['commencees'][$j]++;
            }
            if ($p['etat'] === 'terminee') {
                $s['terminees'][$j]++;
            }
            if ($p['etat'] === 'abandon') {
                $s['abandons'][$j]++;
            }
            $s['tempsJeu'][$j] += $p['actif'];
            if (isset($s['parJeu'][$p['jeu']])) {
                $s['parJeu'][$p['jeu']]['parties'][$j]++;
                $s['parJeu'][$p['jeu']]['temps'][$j] += $p['actif'];
            }
        }
        $q = $this->db->prepare('SELECT cree_le FROM comptes WHERE cree_le >= ? AND cree_le < ?');
        $q->execute([self::stamp($per['de']), self::stamp($per['a'])]);
        foreach ($q->fetchAll(PDO::FETCH_COLUMN) as $c) {
            $j = $this->jour((int) self::epoch((string) $c));
            if (isset($base[$j])) {
                $s['nouveauxComptes'][$j]++;
            }
        }
        // Jours résumés (détail effacé) : bilans par jour UTC, assez proches pour une courbe.
        $q = $this->db->prepare('SELECT jour, jeu, visiteurs, visites, parties, terminees, actif FROM suivi_bilans WHERE jour >= ? AND jour <= ?');
        $q->execute([$per['jours'][0], end($per['jours'])]);
        foreach ($q->fetchAll() as $b) {
            $j = (string) $b['jour'];
            if (!isset($base[$j])) {
                continue;
            }
            if ($b['jeu'] === '') {
                $s['visiteurs'][$j] += (int) $b['visiteurs'];
                $s['sessions'][$j] += (int) $b['visites'];
                $s['commencees'][$j] += (int) $b['parties'];
                $s['terminees'][$j] += (int) $b['terminees'];
                $s['tempsJeu'][$j] += (int) $b['actif'];
            } elseif (isset($s['parJeu'][$b['jeu']])) {
                $s['parJeu'][$b['jeu']]['parties'][$j] += (int) $b['parties'];
                $s['parJeu'][$b['jeu']]['temps'][$j] += (int) $b['actif'];
            }
        }
        foreach ($s as $k => $v) {
            if (is_array($v) && $k !== 'jours' && $k !== 'parJeu') {
                $s[$k] = array_values($v);
            }
        }
        foreach ($s['parJeu'] as $jeu => $v) {
            $s['parJeu'][$jeu] = ['parties' => array_values($v['parties']), 'temps' => array_values($v['temps'])];
        }
        return $s;
    }

    /**
     * Par jeu : joueurs, parties, temps, durées, terminées / abandons, niveaux, rejouabilité,
     * retour, et un indice de préférence qui combine plusieurs signaux (pas seulement le nombre
     * de parties lancées).
     */
    private function jeux(array $per, array $parties): array
    {
        $out = [];
        foreach (Games::CATALOG as $jeu => $info) {
            $ps = array_values(array_filter($parties, static fn ($p) => $p['jeu'] === $jeu));
            $suivies = array_values(array_filter($ps, static fn ($p) => $p['source'] === 'suivi'));
            $finies = array_values(array_filter($ps, static fn ($p) => $p['etat'] !== 'en_cours' && $p['actif'] > 0));
            $terminees = array_values(array_filter($ps, static fn ($p) => $p['etat'] === 'terminee'));
            $termineesSuivies = count(array_filter($suivies, static fn ($p) => $p['etat'] === 'terminee'));
            $abandons = count(array_filter($suivies, static fn ($p) => $p['etat'] === 'abandon'));
            $joueurs = [];
            foreach ($ps as $p) {
                $joueurs[$p['joueur']][$this->jour($p['debut'])] = true;
            }
            $revenus = count(array_filter($joueurs, static fn ($jours) => count($jours) >= 2));
            $niveaux = array_fill_keys(Games::TIERS, 0);
            $modes = array_fill_keys(Games::MODES, 0);
            foreach ($ps as $p) {
                if (isset($niveaux[$p['niveau']])) {
                    $niveaux[$p['niveau']]++;
                }
                if (isset($modes[$p['mode']])) {
                    $modes[$p['mode']]++;
                }
            }
            $temps = array_sum(array_map(static fn ($p) => $p['actif'], $ps));
            $out[$jeu] = [
                'jeu' => $jeu,
                'nom' => $info['nom'],
                'joueurs' => count($joueurs),
                'commencees' => count($suivies),
                'terminees' => count($terminees),
                'termineesHistorique' => count(array_filter($terminees, static fn ($p) => $p['source'] === 'historique')),
                'abandons' => $abandons,
                'enCours' => count(array_filter($ps, static fn ($p) => $p['etat'] === 'en_cours')),
                'temps' => $temps,
                'moyenne' => self::moyenne(array_map(static fn ($p) => $p['actif'], $finies)),
                'mediane' => self::mediane(array_map(static fn ($p) => $p['actif'], $finies)),
                'tauxTerminees' => self::taux($termineesSuivies, $termineesSuivies + $abandons),
                'tauxAbandon' => self::taux($abandons, $termineesSuivies + $abandons),
                'tauxVictoire' => self::taux(count(array_filter($terminees, static fn ($p) => $p['gagne'] === true)), count($terminees)),
                'rejouabilite' => count($joueurs) ? round(count($ps) / count($joueurs), 2) : null,
                'tauxRetour' => self::taux($revenus, count($joueurs)),
                'niveaux' => $niveaux,
                'modes' => $modes,
                'parties' => count($ps),
            ];
        }
        // Indice de préférence (0-100) : chaque signal est rapporté au meilleur des quatre jeux.
        $poids = ['temps' => 0.3, 'joueurs' => 0.2, 'rejouabilite' => 0.2, 'tauxRetour' => 0.2, 'tauxTerminees' => 0.1];
        $max = [];
        foreach ($poids as $k => $_) {
            $max[$k] = max(array_map(static fn ($g) => (float) ($g[$k] ?? 0), $out)) ?: 0.0;
        }
        foreach ($out as $jeu => $g) {
            $score = 0.0;
            foreach ($poids as $k => $w) {
                $score += $max[$k] > 0 ? $w * ((float) ($g[$k] ?? 0)) / $max[$k] : 0;
            }
            $out[$jeu]['preference'] = $g['parties'] > 0 ? (int) round($score * 100) : 0;
        }
        $total = array_sum(array_map(static fn ($g) => $g['parties'], $out));
        $classes = array_values($out);
        usort($classes, static fn ($x, $y) => $y['preference'] <=> $x['preference']);
        return [
            'liste' => array_values($out),
            'prefere' => $total > 0 ? $classes[0]['jeu'] : null,
            'fiabilite' => $total >= 30 ? 'bonne' : ($total >= 10 ? 'moyenne' : 'faible'),
            'poids' => $poids,
        ];
    }

    private function difficulte(array $parties): array
    {
        $out = [];
        foreach (Games::TIERS as $n) {
            $ps = array_values(array_filter($parties, static fn ($p) => $p['niveau'] === $n));
            $suivies = array_values(array_filter($ps, static fn ($p) => $p['source'] === 'suivi'));
            $ter = count(array_filter($suivies, static fn ($p) => $p['etat'] === 'terminee'));
            $ab = count(array_filter($suivies, static fn ($p) => $p['etat'] === 'abandon'));
            $terminees = array_values(array_filter($ps, static fn ($p) => $p['etat'] === 'terminee'));
            $parJeu = [];
            foreach (array_keys(Games::CATALOG) as $jeu) {
                $parJeu[$jeu] = count(array_filter($ps, static fn ($p) => $p['jeu'] === $jeu));
            }
            $out[] = [
                'niveau' => $n,
                'parties' => count($ps),
                'parJeu' => $parJeu,
                'tauxTerminees' => self::taux($ter, $ter + $ab),
                'tauxAbandon' => self::taux($ab, $ter + $ab),
                'tauxVictoire' => self::taux(count(array_filter($terminees, static fn ($p) => $p['gagne'] === true)), count($terminees)),
                'moyenne' => self::moyenne(array_map(static fn ($p) => $p['actif'], array_filter($ps, static fn ($p) => $p['etat'] !== 'en_cours' && $p['actif'] > 0))),
            ];
        }
        return $out;
    }

    private function appareils(array $visites): array
    {
        $out = [];
        foreach (Suivi::APPAREILS as $a) {
            $vs = array_values(array_filter($visites, static fn ($v) => $v['appareil'] === $a));
            $out[] = [
                'appareil' => $a,
                'sessions' => count($vs),
                'visiteurs' => count(array_unique(array_map(static fn ($v) => $v['visiteur'], $vs))),
                'dureeMoyenne' => self::moyenne(array_map(static fn ($v) => $v['actif'], $vs)),
            ];
        }
        return $out;
    }

    /** Arrivées par heure ; parties par jour de semaine × heure (heure de Paris). */
    private function heures(array $visites, array $parties): array
    {
        $arrivees = array_fill(0, 24, 0);
        foreach ($visites as $v) {
            $arrivees[(int) (new DateTimeImmutable('@' . $v['debut']))->setTimezone($this->tz)->format('G')]++;
        }
        $grille = [];
        foreach ($parties as $p) {
            $d = (new DateTimeImmutable('@' . $p['debut']))->setTimezone($this->tz);
            $k = ((int) $d->format('N') - 1) . ':' . (int) $d->format('G');
            $grille[$k] = ($grille[$k] ?? 0) + 1;
        }
        $cases = [];
        foreach ($grille as $k => $n) {
            [$jour, $heure] = array_map('intval', explode(':', $k));
            $cases[] = [$heure, $jour, $n];
        }
        return ['arrivees' => $arrivees, 'parties' => $cases];
    }

    /** Parcours d'une visite : arrivée → niveau choisi → jeu lancé → partie finie → compte créé. */
    private function entonnoir(array $visites, array $suivies): array
    {
        $calc = function (array $vs) use ($suivies): array {
            $ids = array_fill_keys(array_map(static fn ($v) => $v['id'], $vs), true);
            $lancees = [];
            $finies = [];
            foreach ($suivies as $p) {
                if (isset($p['visite'], $ids[$p['visite']])) {
                    $lancees[$p['visite']] = true;
                    if ($p['etat'] === 'terminee') {
                        $finies[$p['visite']] = true;
                    }
                }
            }
            $niveau = count(array_filter($vs, static fn ($v) => $v['niveau'] || isset($lancees[$v['id']])));
            return [
                ['etape' => 'visite', 'n' => count($vs)],
                ['etape' => 'niveau', 'n' => $niveau],
                ['etape' => 'lancee', 'n' => count($lancees)],
                ['etape' => 'terminee', 'n' => count($finies)],
                ['etape' => 'inscription', 'n' => count(array_filter($vs, static fn ($v) => $v['inscription']))],
            ];
        };
        return [
            'tous' => $calc($visites),
            'invites' => $calc(array_values(array_filter($visites, static fn ($v) => $v['compte'] === null || $v['inscription']))),
        ];
    }

    /** Visiteurs sans compte : durée, jeux lancés, niveaux, retours, inscriptions. */
    private function invites(array $visites, array $suivies): array
    {
        $vs = array_values(array_filter($visites, static fn ($v) => $v['compte'] === null || $v['inscription']));
        $ids = array_fill_keys(array_map(static fn ($v) => $v['id'], $vs), true);
        $ps = array_values(array_filter($suivies, static fn ($p) => $p['profil'] === null && $p['compte'] === null));
        $visitesAvecJeu = [];
        foreach ($ps as $p) {
            if (isset($p['visite'], $ids[$p['visite']])) {
                $visitesAvecJeu[$p['visite']] = true;
            }
        }
        $jeux = array_fill_keys(array_keys(Games::CATALOG), 0);
        $niveaux = array_fill_keys(Games::TIERS, 0);
        $temps = array_fill_keys(array_keys(Games::CATALOG), 0);
        foreach ($ps as $p) {
            $jeux[$p['jeu']] = ($jeux[$p['jeu']] ?? 0) + 1;
            $niveaux[$p['niveau']] = ($niveaux[$p['niveau']] ?? 0) + 1;
            $temps[$p['jeu']] = ($temps[$p['jeu']] ?? 0) + $p['actif'];
        }
        $visiteurs = array_values(array_unique(array_map(static fn ($v) => $v['visiteur'], $vs)));
        // Retours et inscriptions : sur tout l'historique de ces navigateurs (pas seulement la période).
        $revenus = 0;
        $inscrits = 0;
        foreach (array_chunk($visiteurs, 400) as $lot) {
            $q = $this->db->prepare('SELECT visiteur, debut, inscription FROM visites WHERE visiteur IN (' . implode(',', array_fill(0, count($lot), '?')) . ')');
            $q->execute($lot);
            $jours = [];
            $ins = [];
            foreach ($q->fetchAll() as $r) {
                $jours[$r['visiteur']][$this->jour((int) self::epoch((string) $r['debut']))] = true;
                if ((int) $r['inscription'] === 1) {
                    $ins[$r['visiteur']] = true;
                }
            }
            $revenus += count(array_filter($jours, static fn ($j) => count($j) >= 2));
            $inscrits += count($ins);
        }
        $durees = array_map(static fn ($v) => $v['actif'], $vs);
        return [
            'sessions' => count($vs),
            'visiteurs' => count($visiteurs),
            'dureeMoyenne' => self::moyenne($durees),
            'dureeMediane' => self::mediane($durees),
            'tauxLancement' => self::taux(count($visitesAvecJeu), count($vs)),
            'parties' => count($ps),
            'jeux' => $jeux,
            'niveaux' => $niveaux,
            'temps' => $temps,
            'tempsParSession' => count($vs) ? array_sum($temps) / count($vs) : null,
            'revenus' => $revenus,
            'tauxRetour' => self::taux($revenus, count($visiteurs)),
            'inscrits' => $inscrits,
            'tauxInscription' => self::taux($inscrits, count($visiteurs)),
            'entrees' => array_count_values(array_map(static fn ($v) => $v['entree'], $vs)),
        ];
    }

    /**
     * Fidélisation des joueurs dont la première partie tombe dans la période : retour le
     * lendemain, dans les sept jours, plusieurs jours, plusieurs jeux. Un joueur n'est compté
     * pour « le lendemain » (ou « 7 jours ») que si ce délai est déjà écoulé.
     */
    private function fidelite(array $per): array
    {
        $tous = $this->parties(0, $this->now() + 86400);
        $joueurs = [];
        foreach ($tous as $p) {
            $j = $this->jour($p['source'] === 'historique' ? $p['fin'] : $p['debut']);
            $joueurs[$p['joueur']]['jours'][$j] = true;
            $joueurs[$p['joueur']]['jeux'][$p['jeu']] = true;
        }
        $aujourdhui = $this->jour($this->now());
        $plus = static fn (string $j, int $n): string => (new DateTimeImmutable($j))->modify("+$n day")->format('Y-m-d');
        $c = ['nouveaux' => 0, 'eligiblesJ1' => 0, 'revenusJ1' => 0, 'eligiblesJ7' => 0, 'revenusJ7' => 0, 'plusieursJours' => 0, 'plusieursJeux' => 0];
        foreach ($joueurs as $jr) {
            $jours = array_keys($jr['jours']);
            sort($jours);
            $premier = $jours[0];
            if ($premier < $per['debut'] || $premier > $per['fin']) {
                continue;
            }
            $c['nouveaux']++;
            if ($plus($premier, 1) < $aujourdhui || $plus($premier, 1) === $aujourdhui) {
                $c['eligiblesJ1']++;
                if (isset($jr['jours'][$plus($premier, 1)])) {
                    $c['revenusJ1']++;
                }
            }
            if ($plus($premier, 7) <= $aujourdhui) {
                $c['eligiblesJ7']++;
                foreach ($jours as $j) {
                    if ($j > $premier && $j <= $plus($premier, 7)) {
                        $c['revenusJ7']++;
                        break;
                    }
                }
            }
            if (count($jours) >= 2) {
                $c['plusieursJours']++;
            }
            if (count($jr['jeux']) >= 2) {
                $c['plusieursJeux']++;
            }
        }
        // Visiteurs (tous, joueurs ou non) revenus sur le site un autre jour.
        $q = $this->db->query('SELECT visiteur, debut FROM visites');
        $vis = [];
        foreach ($q->fetchAll() as $r) {
            $vis[$r['visiteur']][$this->jour((int) self::epoch((string) $r['debut']))] = true;
        }
        $vPer = 0;
        $vRev = 0;
        foreach ($vis as $jours) {
            $ks = array_keys($jours);
            sort($ks);
            if ($ks[0] >= $per['debut'] && $ks[0] <= $per['fin']) {
                $vPer++;
                if (count($ks) >= 2) {
                    $vRev++;
                }
            }
        }
        return $c + [
            'tauxJ1' => self::taux($c['revenusJ1'], $c['eligiblesJ1']),
            'tauxJ7' => self::taux($c['revenusJ7'], $c['eligiblesJ7']),
            'tauxPlusieursJours' => self::taux($c['plusieursJours'], $c['nouveaux']),
            'tauxPlusieursJeux' => self::taux($c['plusieursJeux'], $c['nouveaux']),
            'nouveauxVisiteurs' => $vPer,
            'visiteursRevenus' => $vRev,
        ];
    }

    /** Qui joue en ce moment (signe de vie depuis moins de 2 minutes), sans aucun détail de la partie. */
    public function direct(): array
    {
        $depuis = self::stamp($this->now() - self::ACTIF_DEPUIS);
        $q = $this->db->prepare('SELECT COUNT(DISTINCT visiteur) FROM visites WHERE dernier >= ?');
        $q->execute([$depuis]);
        $enLigne = (int) $q->fetchColumn();
        $q = $this->db->prepare("SELECT p.jeu, p.niveau, p.mode, p.debut, p.actif, pr.pseudo, pr.avatar
            FROM parties p LEFT JOIN profils pr ON pr.id = p.profil_id
            WHERE p.etat = 'en_cours' AND p.dernier >= ? ORDER BY p.debut");
        $q->execute([$depuis]);
        $joueurs = array_map(fn (array $r): array => [
            'jeu' => (string) $r['jeu'],
            'niveau' => (string) $r['niveau'],
            'mode' => (string) $r['mode'],
            'depuis' => self::iso(self::epoch((string) $r['debut'])),
            'actif' => (int) $r['actif'],
            'pseudo' => $r['pseudo'] === null ? null : (string) $r['pseudo'],
            'avatar' => $r['avatar'] === null ? null : (string) $r['avatar'],
        ], $q->fetchAll());
        $parJeu = array_fill_keys(array_keys(Games::CATALOG), 0);
        foreach ($joueurs as $j) {
            $parJeu[$j['jeu']] = ($parJeu[$j['jeu']] ?? 0) + 1;
        }
        return ['enLigne' => $enLigne, 'enJeu' => count($joueurs), 'parJeu' => $parJeu, 'joueurs' => $joueurs, 'fenetre' => self::ACTIF_DEPUIS];
    }

    // --- Joueurs ----------------------------------------------------------------------------------------

    /** Meilleurs scores vérifiés d'un ou de tous les profils : [profil][jeu] = {score, niveau, mode, date}. */
    private function records(?int $profil = null): array
    {
        $sql = 'SELECT profil_id, jeu, niveau, mode, score, joue_le FROM resultats WHERE verifie = 1' . ($profil !== null ? ' AND profil_id = ?' : '');
        $q = $this->db->prepare($sql);
        $q->execute($profil !== null ? [$profil] : []);
        $out = [];
        foreach ($q->fetchAll() as $r) {
            $cur = $out[(int) $r['profil_id']][$r['jeu']] ?? null;
            if ($cur === null || (int) $r['score'] > $cur['score']) {
                $out[(int) $r['profil_id']][$r['jeu']] = ['score' => (int) $r['score'], 'niveau' => (string) $r['niveau'],
                    'mode' => (string) $r['mode'], 'date' => self::iso(self::epoch((string) $r['joue_le']))];
            }
        }
        return $out;
    }

    /** @param list<array<string, mixed>> $ps parties d'un joueur */
    private function bilanJoueur(array $ps): array
    {
        $parJeu = [];
        foreach (array_keys(Games::CATALOG) as $jeu) {
            $parJeu[$jeu] = ['parties' => 0, 'temps' => 0, 'terminees' => 0];
        }
        $niveaux = [];
        $jours = [];
        $dernier = null;
        foreach ($ps as $p) {
            $parJeu[$p['jeu']]['parties']++;
            $parJeu[$p['jeu']]['temps'] += $p['actif'];
            $parJeu[$p['jeu']]['terminees'] += $p['etat'] === 'terminee' ? 1 : 0;
            $niveaux[$p['niveau']] = ($niveaux[$p['niveau']] ?? 0) + 1;
            $jours[$this->jour($p['debut'])] = true;
            $dernier = max($dernier ?? 0, $p['fin'] ?? $p['dernier']);
        }
        arsort($niveaux);
        $favori = null;
        foreach ($parJeu as $jeu => $g) {
            if ($g['parties'] > 0 && ($favori === null || [$g['temps'], $g['parties']] > [$parJeu[$favori]['temps'], $parJeu[$favori]['parties']])) {
                $favori = $jeu;
            }
        }
        return [
            'parties' => count($ps),
            'temps' => array_sum(array_map(static fn ($p) => $p['actif'], $ps)),
            'parJeu' => $parJeu,
            'niveauHabituel' => $niveaux ? array_key_first($niveaux) : null,
            'jours' => count($jours),
            'favori' => $favori,
            'derniereActivite' => self::iso($dernier),
        ];
    }

    /** Liste des comptes (numéro, dates, profils) et des profils avec leur bilan complet. */
    public function joueurs(): array
    {
        $this->suivi->entretien();
        $toutes = $this->parties(0, $this->now() + 86400);
        $parProfil = [];
        $invites = [];
        foreach ($toutes as $p) {
            if ($p['profil'] !== null) {
                $parProfil[$p['profil']][] = $p;
            } elseif ($p['compte'] === null) {
                $invites[$p['joueur']][] = $p;
            }
        }
        $records = $this->records();
        $profils = [];
        foreach ($this->db->query('SELECT id, compte_id, pseudo, avatar, niveau, cree_le FROM profils ORDER BY id')->fetchAll() as $r) {
            $id = (int) $r['id'];
            $profils[] = [
                'id' => $id,
                'compte' => (int) $r['compte_id'],
                'pseudo' => (string) $r['pseudo'],
                'avatar' => (string) $r['avatar'],
                'niveauProfil' => (string) $r['niveau'],
                'creeLe' => self::iso(self::epoch((string) $r['cree_le'])),
                'records' => $records[$id] ?? (object) [],
            ] + $this->bilanJoueur($parProfil[$id] ?? []);
        }
        $comptes = [];
        $q = $this->db->query('SELECT c.id, c.cree_le, c.derniere_connexion, c.google_sub IS NOT NULL AS google,
                (SELECT MAX(v.dernier) FROM visites v WHERE v.compte_id = c.id) AS vu
            FROM comptes c ORDER BY c.id');
        foreach ($q->fetchAll() as $r) {
            $id = (int) $r['id'];
            $sesProfils = array_values(array_filter($profils, static fn ($p) => $p['compte'] === $id));
            $comptes[] = [
                'id' => $id,
                'creeLe' => self::iso(self::epoch((string) $r['cree_le'])),
                'derniereConnexion' => self::iso(self::epoch($r['derniere_connexion'])),
                'derniereVisite' => self::iso(self::epoch($r['vu'])),
                'google' => (bool) $r['google'],
                'profils' => array_map(static fn ($p) => $p['id'], $sesProfils),
                'parties' => array_sum(array_map(static fn ($p) => $p['parties'], $sesProfils)),
                'temps' => array_sum(array_map(static fn ($p) => $p['temps'], $sesProfils)),
            ];
        }
        // Invités : seulement un résumé, sous un numéro court non réversible.
        $listeInvites = [];
        foreach ($invites as $k => $ps) {
            $listeInvites[] = ['id' => 'Invité ' . strtoupper(substr(hash('sha256', $k), 0, 4))] + $this->bilanJoueur($ps);
        }
        usort($listeInvites, static fn ($x, $y) => strcmp((string) $y['derniereActivite'], (string) $x['derniereActivite']));
        return ['comptes' => $comptes, 'profils' => $profils, 'invites' => array_slice($listeInvites, 0, 100), 'nbInvites' => count($listeInvites)];
    }

    /** Fiche d'un profil : bilan, records, activité des 8 dernières semaines, dernières parties. */
    public function joueur(int $id): ?array
    {
        $q = $this->db->prepare('SELECT id, compte_id, pseudo, avatar, niveau, cree_le FROM profils WHERE id = ?');
        $q->execute([$id]);
        $r = $q->fetch();
        if (!$r) {
            return null;
        }
        $this->suivi->entretien();
        $ps = $this->parties(0, $this->now() + 86400, $id);
        $aujourdhui = $this->jour($this->now());
        $jours = [];
        $d = (new DateTimeImmutable($aujourdhui, $this->tz))->modify('-55 days');
        for ($i = 0; $i < 56; $i++) {
            $jours[$d->format('Y-m-d')] = ['temps' => 0, 'parties' => 0];
            $d = $d->modify('+1 day');
        }
        $heures = array_fill(0, 24, 0);
        foreach ($ps as $p) {
            $j = $this->jour($p['debut']);
            if (isset($jours[$j])) {
                $jours[$j]['temps'] += $p['actif'];
                $jours[$j]['parties']++;
            }
            $heures[(int) (new DateTimeImmutable('@' . $p['debut']))->setTimezone($this->tz)->format('G')]++;
        }
        $q = $this->db->prepare('SELECT id, pseudo, avatar FROM profils WHERE compte_id = ? AND id <> ? ORDER BY id');
        $q->execute([(int) $r['compte_id'], $id]);
        $q2 = $this->db->prepare('SELECT cree_le, derniere_connexion FROM comptes WHERE id = ?');
        $q2->execute([(int) $r['compte_id']]);
        $c = $q2->fetch() ?: [];
        $dernieres = array_slice(array_reverse($ps), 0, 60);
        return [
            'id' => $id,
            'pseudo' => (string) $r['pseudo'],
            'avatar' => (string) $r['avatar'],
            'niveauProfil' => (string) $r['niveau'],
            'creeLe' => self::iso(self::epoch((string) $r['cree_le'])),
            'compte' => [
                'id' => (int) $r['compte_id'],
                'creeLe' => self::iso(self::epoch($c['cree_le'] ?? null)),
                'derniereConnexion' => self::iso(self::epoch($c['derniere_connexion'] ?? null)),
                'autresProfils' => array_map(static fn ($x) => ['id' => (int) $x['id'], 'pseudo' => (string) $x['pseudo'], 'avatar' => (string) $x['avatar']], $q->fetchAll()),
            ],
            'records' => $this->records($id)[$id] ?? (object) [],
            'activite' => ['jours' => array_keys($jours), 'temps' => array_column(array_values($jours), 'temps'), 'parties' => array_column(array_values($jours), 'parties')],
            'heures' => $heures,
            'dernieres' => array_map(fn ($p) => $this->ligne($p), $dernieres),
        ] + $this->bilanJoueur($ps);
    }

    /** Une partie telle que l'affiche l'administration. */
    private function ligne(array $p): array
    {
        return [
            'source' => $p['source'],
            'jeu' => $p['jeu'],
            'niveau' => $p['niveau'],
            'mode' => $p['mode'],
            'debut' => self::iso($p['debut']),
            'fin' => self::iso($p['fin']),
            'actif' => $p['actif'],
            'etat' => $p['etat'],
            'gagne' => $p['gagne'],
            'score' => $p['score'],
            'profil' => $p['profil'],
            'pseudo' => $p['pseudo'],
            'avatar' => $p['avatar'],
            'joueur' => $p['profil'] !== null ? null : ($p['compte'] !== null ? 'Compte n° ' . $p['compte'] : 'Invité ' . strtoupper(substr(hash('sha256', $p['joueur']), 0, 4))),
        ];
    }

    // --- Historique ---------------------------------------------------------------------------------------

    /**
     * Historique chronologique (le plus récent d'abord) : parties commencées, terminées ou
     * abandonnées, comptes et profils créés. Filtres : jeu, profil, qui (invites|profils).
     * @param array<string, string> $q
     */
    public function historique(array $q): array
    {
        $this->suivi->entretien();
        $per = $this->periode($q);
        $jeu = isset(Games::CATALOG[$q['jeu'] ?? '']) ? $q['jeu'] : null;
        $profil = ctype_digit($q['profil'] ?? '') ? (int) $q['profil'] : null;
        $qui = in_array($q['qui'] ?? '', ['invites', 'profils'], true) ? $q['qui'] : null;
        $evts = [];
        foreach ($this->parties($per['de'], $per['a'], $profil) as $p) {
            if ($jeu !== null && $p['jeu'] !== $jeu) {
                continue;
            }
            if ($qui === 'invites' && $p['profil'] !== null || $qui === 'profils' && $p['profil'] === null) {
                continue;
            }
            $l = $this->ligne($p);
            if ($p['source'] === 'suivi') {
                $evts[] = ['type' => 'debut', 'quand' => $l['debut']] + $l;
            }
            if ($p['fin'] !== null) {
                $evts[] = ['type' => $p['etat'] === 'terminee' ? 'fin' : 'abandon', 'quand' => $l['fin']] + $l;
            }
        }
        if ($jeu === null && $qui !== 'invites') {
            $c = $this->db->prepare('SELECT id, cree_le FROM comptes WHERE cree_le >= ? AND cree_le < ?');
            $c->execute([self::stamp($per['de']), self::stamp($per['a'])]);
            foreach ($c->fetchAll() as $r) {
                if ($profil === null) {
                    $evts[] = ['type' => 'compte', 'quand' => self::iso(self::epoch((string) $r['cree_le'])), 'compte' => (int) $r['id']];
                }
            }
            $c = $this->db->prepare('SELECT id, compte_id, pseudo, avatar, cree_le FROM profils WHERE cree_le >= ? AND cree_le < ?' . ($profil !== null ? ' AND id = ?' : ''));
            $c->execute($profil !== null ? [self::stamp($per['de']), self::stamp($per['a']), $profil] : [self::stamp($per['de']), self::stamp($per['a'])]);
            foreach ($c->fetchAll() as $r) {
                $evts[] = ['type' => 'profil', 'quand' => self::iso(self::epoch((string) $r['cree_le'])), 'compte' => (int) $r['compte_id'],
                    'profil' => (int) $r['id'], 'pseudo' => (string) $r['pseudo'], 'avatar' => (string) $r['avatar']];
            }
        }
        usort($evts, static fn ($x, $y) => strcmp((string) $y['quand'], (string) $x['quand']));
        return ['periode' => ['debut' => $per['debut'], 'fin' => $per['fin']], 'total' => count($evts), 'evenements' => array_slice($evts, 0, 500)];
    }

    // --- Santé -----------------------------------------------------------------------------------------------

    public function sante(): array
    {
        $journal = $this->db->query('SELECT jour, recus, refuses, dernier_refus FROM suivi_journal ORDER BY jour DESC LIMIT 14')->fetchAll();
        $derniere = $this->db->query('SELECT MAX(dernier) FROM visites')->fetchColumn();
        $dernierePartie = $this->db->query('SELECT MAX(dernier) FROM parties')->fetchColumn();
        $compte = fn (string $t): int => (int) $this->db->query("SELECT COUNT(*) FROM $t")->fetchColumn();
        return [
            'maintenant' => self::iso($this->now()),
            'apiSuivi' => 'repond',
            'debutSuivi' => self::iso($this->debutSuivi()),
            'derniereVisite' => self::iso(self::epoch($derniere ?: null)),
            'dernierePartie' => self::iso(self::epoch($dernierePartie ?: null)),
            'journal' => array_map(static fn ($j) => ['jour' => (string) $j['jour'], 'recus' => (int) $j['recus'], 'refuses' => (int) $j['refuses'],
                'dernierRefus' => $j['dernier_refus']], $journal),
            'conservationJours' => $this->suivi->conservation(),
            'schema' => (int) $this->db->query('SELECT MAX(version) FROM schema_version')->fetchColumn(),
            'lignes' => ['visites' => $compte('visites'), 'parties' => $compte('parties'), 'resultats' => $compte('resultats'),
                'bilans' => $compte('suivi_bilans'), 'comptes' => $compte('comptes'), 'profils' => $compte('profils')],
            'enCours' => (int) $this->db->query("SELECT COUNT(*) FROM parties WHERE etat = 'en_cours'")->fetchColumn(),
        ];
    }
}
