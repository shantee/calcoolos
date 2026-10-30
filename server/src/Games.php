<?php

declare(strict_types=1);

namespace Calcoolos;

/**
 * Catalogue des mini-jeux et contrôle des résultats envoyés par le navigateur.
 *
 * Le jeu tourne chez le joueur : le serveur ne peut pas prouver qu'un score est
 * honnête. Il vérifie la forme (sinon refus) puis la vraisemblance (sinon le
 * résultat est gardé dans l'historique mais marqué « non vérifié » et exclu des
 * classements). C'est un garde-fou, pas une protection parfaite contre la triche.
 */
final class Games
{
    public const TIERS = ['eveil', 'explorateur', 'stratege', 'maitre'];
    public const MODES = ['tranquille', 'defi'];
    public const OPS = ['+', '−', '×', '÷'];

    /**
     * Bornes larges, calculées d'après les règles de chaque jeu (voir doc/ARCHITECTURE.md).
     * maxScore : score maximal raisonnable ; minWin : durée minimale d'une victoire (s) ;
     * maxPerSecond : points par seconde au-delà desquels c'est invraisemblable.
     */
    public const CATALOG = [
        'cubes' => ['nom' => 'Panique au phare !', 'maxScore' => 60000, 'minWin' => 40, 'maxPerSecond' => 400],
        'meteores' => ['nom' => 'Pluie de météores', 'maxScore' => 40000, 'minWin' => 60, 'maxPerSecond' => 300],
        'dragon' => ['nom' => 'Le Dragon gourmand', 'maxScore' => 40000, 'minWin' => 40, 'maxPerSecond' => 300],
        'fusee' => ['nom' => 'Décollage !', 'maxScore' => 30000, 'minWin' => 60, 'maxPerSecond' => 200],
        // Neon Flight (chantier 3) : vol sans fin, score par réponse au plus 200 × 6 (combo) × 1,5 (éclair)
        // × 2 (arc-en-ciel) ; « victoire » = village atteint (2,6 km). Les mesures communes sont obligatoires.
        'neon' => ['nom' => 'Neon Flight', 'maxScore' => 3_000_000, 'minWin' => 20, 'maxPerSecond' => 2500, 'maxPerAnswer' => 3600,
            'mesures' => true, 'variantes' => self::NEON_SERIES, 'classes' => ['defi']],
        // MULTIRAIL (chantier 4) : voyage sans fin ; par réponse au plus (100 + 100) × 4 (série) × 2 (ébullition)
        // + 500 (voyageur sauvé) + 300 (grand pont), et 500 points par kilomètre en Voyage Zen ;
        // « victoire » = deux régions traversées. Classé en Aventure, séparé par série de tables ou Voyage Zen.
        'multirail' => ['nom' => 'MULTIRAIL', 'maxScore' => 3_000_000, 'minWin' => 40, 'maxPerSecond' => 2500, 'maxPerAnswer' => 3000,
            'mesures' => true, 'variantes' => self::MULTIRAIL_VARIANTES, 'classes' => ['defi']],
    ];

    /** MULTIRAIL : le Voyage Zen (calcul mental varié) et trois séries de tables ont un classement. */
    public const MULTIRAIL_VARIANTES = ['zen', 'petites', 'grandes', 'toutes'];

    /**
     * Neon Flight : séries de tables qui ont un classement (les autres choix donnent « perso », gardé dans
     * les statistiques du joueur mais hors classement). Comparer 2 à 5 avec 2 à 12 n'aurait pas de sens.
     */
    public const NEON_SERIES = ['petites', 'grandes', 'toutes', 'expert'];

    /** Variantes acceptées pour un jeu (la chaîne vide pour les jeux sans variante). */
    public static function variants(string $jeu): array
    {
        $v = self::CATALOG[$jeu]['variantes'] ?? null;
        return $v === null ? [''] : [...$v, 'perso'];
    }

    /** Couples (mode, variante) qui ont un classement public pour ce jeu. */
    public static function boards(string $jeu): array
    {
        $modes = self::CATALOG[$jeu]['classes'] ?? self::MODES;
        $variants = self::CATALOG[$jeu]['variantes'] ?? [''];
        $out = [];
        foreach ($modes as $mode) {
            foreach ($variants as $variante) {
                $out[] = [$mode, $variante];
            }
        }
        return $out;
    }

    /**
     * Vérifie la forme d'un résultat. Lève une HttpError 422 si c'est invalide.
     * @param array<string, mixed> $in
     * @return array{jeu: string, niveau: string, mode: string, score: int, gagne: bool, etoiles: int, duree: int, precision: float, ops: array<string, array{int, int}>, details: array<string, int>}
     */
    public static function parse(array $in): array
    {
        $jeu = $in['jeu'] ?? null;
        $niveau = $in['niveau'] ?? null;
        $mode = $in['mode'] ?? null;
        if (!is_string($jeu) || !isset(self::CATALOG[$jeu])) {
            throw new HttpError(422, 'Jeu inconnu.');
        }
        if (!is_string($niveau) || !in_array($niveau, self::TIERS, true) || !is_string($mode) || !in_array($mode, self::MODES, true)) {
            throw new HttpError(422, 'Niveau ou mode inconnu.');
        }
        $score = self::int($in['score'] ?? null, 0, 5_000_000, 'score');
        $etoiles = self::int($in['etoiles'] ?? 0, 0, 3, 'étoiles');
        $duree = self::int($in['duree'] ?? null, 1, 7200, 'durée');
        if (!is_bool($in['gagne'] ?? null)) {
            throw new HttpError(422, 'Résultat incomplet.');
        }
        $precision = $in['precision'] ?? null;
        if (!is_int($precision) && !is_float($precision) || $precision < 0 || $precision > 1) {
            throw new HttpError(422, 'Précision invalide.');
        }
        $ops = [];
        $rawOps = $in['ops'] ?? [];
        if (!is_array($rawOps) || count($rawOps) > 4) {
            throw new HttpError(422, 'Opérations invalides.');
        }
        foreach ($rawOps as $op => $pair) {
            if (!in_array($op, self::OPS, true) || !is_array($pair) || count($pair) !== 2 || !array_is_list($pair)) {
                throw new HttpError(422, 'Opérations invalides.');
            }
            $ops[$op] = [self::int($pair[0], 0, 5000, 'opérations'), self::int($pair[1], 0, 5000, 'opérations')];
        }
        $details = [];
        $rawDetails = $in['details'] ?? [];
        if (!is_array($rawDetails) || count($rawDetails) > 16) {
            throw new HttpError(422, 'Détails invalides.');
        }
        foreach ($rawDetails as $k => $v) {
            if (!is_string($k) || !preg_match('/^[a-zA-Z]{1,24}$/', $k)) {
                throw new HttpError(422, 'Détails invalides.');
            }
            $details[$k] = self::int($v, 0, 1_000_000, 'détails');
        }
        $variante = $in['variante'] ?? '';
        if (!is_string($variante) || !in_array($variante, self::variants($jeu), true)) {
            throw new HttpError(422, 'Variante inconnue.');
        }
        $actif = isset($in['actif']) ? self::int($in['actif'], 0, 7200, 'temps actif') : null;
        $debut = null;
        if (isset($in['debut'])) {
            $t = is_string($in['debut']) && preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/', $in['debut']) ? strtotime($in['debut']) : false;
            if ($t === false) {
                throw new HttpError(422, 'Début de partie invalide.');
            }
            $debut = $t;
        }
        return [
            'jeu' => $jeu,
            'niveau' => $niveau,
            'mode' => $mode,
            'score' => $score,
            'gagne' => $in['gagne'],
            'etoiles' => $etoiles,
            'duree' => $duree,
            'precision' => (float) $precision,
            'ops' => $ops,
            'details' => $details,
            'variante' => $variante,
            'actif' => $actif,
            'debut' => $debut,
            'mesures' => isset($in['mesures']) ? self::measures($in['mesures']) : null,
        ];
    }

    /**
     * Indicateurs communs (src/platform/releve.ts) : forme stricte, sinon refus.
     * @return array{calculs: int, justes: int, fausses: int, serie: int, tempsMoyen: ?int, tempsMedian: ?int, faits: array<string, array{int, int, int, int}>}
     */
    private static function measures(mixed $m): array
    {
        if (!is_array($m)) {
            throw new HttpError(422, 'Mesures invalides.');
        }
        $calculs = self::int($m['calculs'] ?? null, 0, 5000, 'calculs');
        $justes = self::int($m['justes'] ?? null, 0, 5000, 'justes');
        $fausses = self::int($m['fausses'] ?? null, 0, 5000, 'fausses');
        $serie = self::int($m['serie'] ?? 0, 0, 5000, 'série');
        if ($justes + $fausses !== $calculs || $serie > $justes) {
            throw new HttpError(422, 'Mesures incohérentes.');
        }
        $moyen = isset($m['tempsMoyen']) ? self::int($m['tempsMoyen'], 1, 60000, 'temps moyen') : null;
        $median = isset($m['tempsMedian']) ? self::int($m['tempsMedian'], 1, 60000, 'temps médian') : null;
        if (($moyen === null) !== ($median === null) || ($moyen !== null && $justes === 0)) {
            throw new HttpError(422, 'Mesures incohérentes.');
        }
        $faits = [];
        $raw = $m['faits'] ?? [];
        if (!is_array($raw) || count($raw) > 144) {
            throw new HttpError(422, 'Faits invalides.');
        }
        $dans = 0;
        foreach ($raw as $k => $f) {
            if (!is_string($k) || !preg_match('/^(\d{1,2})×(\d{1,2})$/u', $k, $mm) || (int) $mm[1] > (int) $mm[2] || (int) $mm[2] > 20
                || !is_array($f) || count($f) !== 4 || !array_is_list($f)) {
                throw new HttpError(422, 'Faits invalides.');
            }
            $f = [self::int($f[0], 0, 5000, 'faits'), self::int($f[1], 0, 5000, 'faits'), self::int($f[2], 0, 60000 * 5000, 'faits'), self::int($f[3], 0, 5000, 'faits')];
            if ($f[3] > $f[0] || $f[2] > $f[3] * 60000) {
                throw new HttpError(422, 'Faits incohérents.');
            }
            $dans += $f[0] + $f[1];
            $faits[$k] = $f;
        }
        if ($dans > $calculs) {
            throw new HttpError(422, 'Faits incohérents.');
        }
        return ['calculs' => $calculs, 'justes' => $justes, 'fausses' => $fausses, 'serie' => $serie, 'tempsMoyen' => $moyen, 'tempsMedian' => $median, 'faits' => $faits];
    }

    /**
     * Vraisemblance : renvoie null si tout va bien, sinon la raison du doute.
     * @param array{jeu: string, score: int, gagne: bool, etoiles: int, duree: int, precision?: float, ops: array<string, array{int, int}>, mesures?: ?array, actif?: ?int} $r
     */
    public static function doubt(array $r): ?string
    {
        $g = self::CATALOG[$r['jeu']];
        if ($r['score'] > $g['maxScore']) {
            return 'score supérieur au maximum du jeu';
        }
        if ($r['gagne'] && $r['duree'] < $g['minWin']) {
            return 'victoire trop rapide';
        }
        if (!$r['gagne'] && $r['etoiles'] > 0) {
            return 'étoiles sans victoire';
        }
        if ($r['gagne'] && $r['etoiles'] < 1) {
            return 'victoire sans étoile';
        }
        if ($r['score'] / max(1, $r['duree']) > $g['maxPerSecond']) {
            return 'trop de points par seconde';
        }
        $answers = 0;
        foreach ($r['ops'] as [$ok, $ko]) {
            $answers += $ok + $ko;
        }
        if ($answers / max(1, $r['duree']) > 3) {
            return 'trop de réponses par seconde';
        }
        $m = $r['mesures'] ?? null;
        if (($g['mesures'] ?? false) && $m === null) {
            return 'mesures manquantes';
        }
        if ($m !== null) {
            if ($m['calculs'] / max(1, $r['duree']) > 3) {
                return 'trop de calculs par seconde';
            }
            if (isset($g['maxPerAnswer']) && $r['score'] > $m['justes'] * $g['maxPerAnswer']) {
                return 'score supérieur au maximum des bonnes réponses';
            }
            // Jeu qui mesure tout (Neon Flight, MULTIRAIL) : la précision annoncée doit être celle des mesures.
            if (($g['mesures'] ?? false) && $m['calculs'] > 0 && abs($r['precision'] - $m['justes'] / $m['calculs']) > 0.02) {
                return 'précision incohérente';
            }
        }
        if (($r['actif'] ?? null) !== null && $r['actif'] > $r['duree'] + 5) {
            return 'temps actif supérieur à la durée';
        }
        return null;
    }

    private static function int(mixed $v, int $min, int $max, string $what): int
    {
        if (is_float($v) && floor($v) === $v) {
            $v = (int) $v;
        }
        if (!is_int($v) || $v < $min || $v > $max) {
            throw new HttpError(422, "Valeur invalide : $what.");
        }
        return $v;
    }
}

/**
 * Noms publics générés. Plus affichés depuis le 27/10/2026 (les classements publics montrent le
 * pseudo) ; on remplit encore la colonne `profils.nom_public`, qui est obligatoire.
 */
final class Names
{
    /** Créature et genre grammatical (m/f), pour accorder l'adjectif. */
    private const CREATURES = [
        ['Dragon', 'm'], ['Hibou', 'm'], ['Escargot', 'm'], ['Robot', 'm'], ['Chat', 'm'], ['Poisson', 'm'],
        ['Phare', 'm'], ['Nuage', 'm'], ['Baleine', 'f'], ['Comète', 'f'], ['Lanterne', 'f'], ['Chouette', 'f'],
    ];
    private const ADJECTIFS = [
        ['Rieur', 'Rieuse'], ['Agile', 'Agile'], ['Malin', 'Maligne'], ['Rapide', 'Rapide'], ['Brillant', 'Brillante'],
        ['Curieux', 'Curieuse'], ['Joyeux', 'Joyeuse'], ['Vaillant', 'Vaillante'], ['Futé', 'Futée'],
        ['Paisible', 'Paisible'], ['Étoilé', 'Étoilée'], ['Gourmand', 'Gourmande'],
    ];

    public static function publicName(): string
    {
        [$creature, $genre] = self::CREATURES[random_int(0, count(self::CREATURES) - 1)];
        $adj = self::ADJECTIFS[random_int(0, count(self::ADJECTIFS) - 1)][$genre === 'f' ? 1 : 0];
        return "$creature $adj " . random_int(10, 99);
    }
}
