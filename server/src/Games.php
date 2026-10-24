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
        'cubes' => ['nom' => 'Cubes de siège', 'maxScore' => 60000, 'minWin' => 40, 'maxPerSecond' => 400],
        'meteores' => ['nom' => 'Pluie de météores', 'maxScore' => 40000, 'minWin' => 60, 'maxPerSecond' => 300],
        'dragon' => ['nom' => 'Le Dragon gourmand', 'maxScore' => 40000, 'minWin' => 40, 'maxPerSecond' => 300],
    ];

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
        $score = self::int($in['score'] ?? null, 0, 1_000_000, 'score');
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
        ];
    }

    /**
     * Vraisemblance : renvoie null si tout va bien, sinon la raison du doute.
     * @param array{jeu: string, score: int, gagne: bool, etoiles: int, duree: int, ops: array<string, array{int, int}>} $r
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

/** Noms publics générés (jamais le pseudo choisi par la famille). */
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
