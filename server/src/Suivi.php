<?php

declare(strict_types=1);

namespace Calcoolos;

use PDO;

/**
 * Mesure d'audience maison : reçoit les petits envois du navigateur (src/platform/suivi.ts).
 *
 * Aucun cookie, aucune adresse IP, aucun clic ni mouvement : un identifiant aléatoire de
 * navigateur (« visiteur »), un identifiant de visite, le type d'appareil (ordinateur, tablette,
 * téléphone), et pour chaque partie le jeu, le niveau, le mode, le temps de jeu actif et l'issue.
 *
 * Tout est idempotent : les durées envoyées sont des cumuls (on garde le plus grand, borné par le
 * temps réellement écoulé côté serveur) et chaque partie a une clé unique ; un envoi répété ou
 * arrivé dans le désordre ne compte jamais deux fois.
 */
final class Suivi
{
    public const APPAREILS = ['ordinateur', 'tablette', 'telephone'];
    public const PAGES = ['accueil', 'compte', 'tableau', 'classements', 'confidentialite', 'cubes', 'meteores', 'dragon', 'fusee', 'autre'];
    public const ISSUES = ['terminee', 'abandon'];
    /** Une partie sans nouvelles depuis ce délai (s) est considérée comme abandonnée. */
    public const PERDUE_APRES = 600;
    private const MAX_EVENEMENTS = 40;
    /** Nouvelles visites ou parties acceptées par heure et par empreinte d'adresse. */
    private const NOUVEAUX_PAR_HEURE = 240;
    /** Marge tolérée (s) entre le temps actif annoncé et le temps écoulé vu par le serveur. */
    private const MARGE = 45;
    private const CLE = '/^[A-Za-z0-9_-]{16,32}$/';

    /** @param \Closure(): int $clock */
    public function __construct(
        private readonly PDO $db,
        private readonly Config $config,
        private readonly \Closure $clock,
    ) {
    }

    private function now(): int
    {
        return ($this->clock)();
    }

    private function stamp(?int $t = null): string
    {
        return gmdate('Y-m-d H:i:s', $t ?? $this->now());
    }

    private static function epoch(string $dt): int
    {
        return (int) strtotime($dt . ' UTC');
    }

    /**
     * Traite un envoi. $compteId vient de la session du serveur (jamais du navigateur) ; le profil
     * annoncé n'est retenu que s'il appartient à ce compte.
     * @param array<string, mixed> $in
     * @return array{ok: true, parties: int}
     */
    public function recevoir(array $in, ?int $compteId, string $ipKey): array
    {
        try {
            return $this->traiter($in, $compteId, $ipKey);
        } catch (HttpError $e) {
            $this->journal(false, $e->getMessage());
            throw $e;
        }
    }

    /** @param array<string, mixed> $in */
    private function traiter(array $in, ?int $compteId, string $ipKey): array
    {
        $visiteur = $in['v'] ?? null;
        $cle = $in['s'] ?? null;
        if (!is_string($visiteur) || !is_string($cle) || !preg_match(self::CLE, $visiteur) || !preg_match(self::CLE, $cle)) {
            throw new HttpError(422, 'Identifiants de suivi invalides.');
        }
        $appareil = in_array($in['appareil'] ?? null, self::APPAREILS, true) ? (string) $in['appareil'] : 'ordinateur';
        $page = in_array($in['page'] ?? null, self::PAGES, true) ? (string) $in['page'] : 'autre';
        $actif = is_int($in['actif'] ?? null) ? max(0, (int) $in['actif']) : 0;
        $events = $in['ev'] ?? [];
        if (!is_array($events) || !array_is_list($events) || count($events) > self::MAX_EVENEMENTS) {
            throw new HttpError(422, 'Événements invalides.');
        }
        $profilId = null;
        if ($compteId !== null && is_int($in['profil'] ?? null)) {
            $q = $this->db->prepare('SELECT id FROM profils WHERE id = ? AND compte_id = ?');
            $q->execute([$in['profil'], $compteId]);
            $profilId = $q->fetchColumn() !== false ? (int) $in['profil'] : null;
        }

        $visite = $this->visite($cle, $visiteur, $compteId, $appareil, $page, $ipKey);
        $sets = ['dernier = ?'];
        $args = [$this->stamp()];
        // Temps actif sur le site : cumul annoncé, jamais plus que le temps écoulé depuis le début.
        $plafond = $this->now() - self::epoch($visite['debut']) + self::MARGE;
        if (min($actif, $plafond) > (int) $visite['actif']) {
            $sets[] = 'actif = ?';
            $args[] = min($actif, $plafond);
        }
        if ($compteId !== null && $visite['compte_id'] === null) {
            $sets[] = 'compte_id = ?';
            $args[] = $compteId;
            // Compte créé pendant cette visite (même sans l'étape « inscription » envoyée par la page).
            $q = $this->db->prepare('SELECT cree_le FROM comptes WHERE id = ?');
            $q->execute([$compteId]);
            $cree = $q->fetchColumn();
            if (is_string($cree) && self::epoch($cree) >= self::epoch($visite['debut'])) {
                $sets[] = 'inscription = 1';
            }
        }
        $pages = 0;
        $parties = 0;
        foreach ($events as $ev) {
            if (!is_array($ev) || !is_string($ev['type'] ?? null)) {
                throw new HttpError(422, 'Événement invalide.');
            }
            switch ($ev['type']) {
                case 'page':
                    $pages++;
                    break;
                case 'niveau':
                    $sets[] = 'niveau_choisi = 1';
                    break;
                case 'inscription':
                    $sets[] = 'inscription = 1';
                    break;
                case 'debut':
                case 'jeu':
                case 'fin':
                    $this->partie($ev, $visite, $visiteur, $profilId, $compteId, $ipKey);
                    $parties++;
                    break;
                default:
                    throw new HttpError(422, 'Événement inconnu.');
            }
        }
        if ($pages > 0) {
            $sets[] = 'pages = pages + ?';
            $args[] = min($pages, 20);
        }
        $args[] = $visite['id'];
        $this->db->prepare('UPDATE visites SET ' . implode(', ', array_unique($sets)) . ' WHERE id = ?')->execute($args);
        $this->journal(true);
        if (random_int(1, 400) === 1) {
            $this->entretien();
        }
        return ['ok' => true, 'parties' => $parties];
    }

    /** @return array{id: int, debut: string, actif: int, compte_id: int|null} */
    private function visite(string $cle, string $visiteur, ?int $compteId, string $appareil, string $page, string $ipKey): array
    {
        $q = $this->db->prepare('SELECT id, visiteur, debut, actif, compte_id FROM visites WHERE cle = ?');
        $q->execute([$cle]);
        $row = $q->fetch();
        if ($row) {
            if ($row['visiteur'] !== $visiteur) {
                throw new HttpError(422, 'Visite inconnue.');
            }
        } else {
            $this->limite($ipKey);
            try {
                $this->db->prepare('INSERT INTO visites (cle, visiteur, compte_id, debut, dernier, actif, pages, appareil, entree)
                    VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)')->execute([$cle, $visiteur, $compteId, $this->stamp(), $this->stamp(), $appareil, $page]);
            } catch (\PDOException) {
                // Deux onglets ont créé la même visite au même instant : on reprend celle qui existe.
            }
            $q->execute([$cle]);
            $row = $q->fetch();
            if (!$row || $row['visiteur'] !== $visiteur) {
                throw new HttpError(422, 'Visite inconnue.');
            }
        }
        return ['id' => (int) $row['id'], 'debut' => (string) $row['debut'], 'actif' => (int) $row['actif'],
            'compte_id' => $row['compte_id'] === null ? null : (int) $row['compte_id']];
    }

    /**
     * Début, signal ou fin d'une partie.
     * @param array<string, mixed> $ev
     * @param array{id: int, debut: string, actif: int, compte_id: int|null} $visite
     */
    private function partie(array $ev, array $visite, string $visiteur, ?int $profilId, ?int $compteId, string $ipKey): void
    {
        $cle = $ev['p'] ?? null;
        if (!is_string($cle) || !preg_match(self::CLE, $cle)) {
            throw new HttpError(422, 'Partie invalide.');
        }
        $actif = is_int($ev['actif'] ?? null) ? max(0, min(7200, (int) $ev['actif'])) : 0;
        $q = $this->db->prepare('SELECT id, visiteur, debut, actif, etat FROM parties WHERE cle = ?');
        $q->execute([$cle]);
        $row = $q->fetch();
        if ($row && $row['visiteur'] !== $visiteur) {
            throw new HttpError(422, 'Partie inconnue.');
        }
        if (!$row) {
            if ($ev['type'] === 'jeu' && $actif === 0) {
                return;
            }
            // Début (ou signal/fin dont le début s'est perdu en route : on le reconstitue).
            $jeu = $ev['jeu'] ?? null;
            $niveau = $ev['niveau'] ?? null;
            $mode = $ev['mode'] ?? null;
            if (!is_string($jeu) || !isset(Games::CATALOG[$jeu]) || !in_array($niveau, Games::TIERS, true) || !in_array($mode, Games::MODES, true)) {
                throw new HttpError(422, 'Jeu, niveau ou mode inconnu.');
            }
            $this->limite($ipKey);
            $debut = $this->now() - $actif;
            try {
                $this->db->prepare('INSERT INTO parties (cle, visite_id, visiteur, profil_id, compte_id, jeu, niveau, mode, debut, dernier, actif, etat)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)')
                    ->execute([$cle, $visite['id'], $visiteur, $profilId, $compteId, $jeu, $niveau, $mode, $this->stamp($debut), $this->stamp(), 'en_cours']);
            } catch (\PDOException) {
                // Même partie envoyée deux fois en même temps : la première suffit.
            }
            $q->execute([$cle]);
            $row = $q->fetch();
            if (!$row) {
                return;
            }
        }
        if ($row['etat'] !== 'en_cours') {
            return; // déjà terminée : un envoi répété ne change rien
        }
        $plafond = $this->now() - self::epoch((string) $row['debut']) + self::MARGE;
        $sets = ['dernier = ?'];
        $args = [$this->stamp()];
        if (min($actif, $plafond) > (int) $row['actif']) {
            $sets[] = 'actif = ?';
            $args[] = min($actif, $plafond);
        }
        if ($profilId !== null) {
            $sets[] = 'profil_id = COALESCE(profil_id, ?)';
            $args[] = $profilId;
        }
        if ($ev['type'] === 'fin') {
            $issue = in_array($ev['issue'] ?? null, self::ISSUES, true) ? (string) $ev['issue'] : 'abandon';
            $sets[] = 'etat = ?';
            $args[] = $issue;
            $sets[] = 'fin = ?';
            $args[] = $this->stamp();
            if (is_bool($ev['gagne'] ?? null)) {
                $sets[] = 'gagne = ?';
                $args[] = $ev['gagne'] ? 1 : 0;
            }
            if (is_int($ev['score'] ?? null)) {
                $sets[] = 'score = ?';
                $args[] = max(0, min(1_000_000, (int) $ev['score']));
            }
        }
        $args[] = $row['id'];
        $this->db->prepare('UPDATE parties SET ' . implode(', ', $sets) . " WHERE id = ? AND etat = 'en_cours'")->execute($args);
    }

    private function limite(string $ipKey): void
    {
        $key = 'suivi:' . $ipKey;
        $q = $this->db->prepare('SELECT COUNT(*) FROM tentatives WHERE cle = ? AND moment > ?');
        $q->execute([$key, $this->stamp($this->now() - 3600)]);
        if ((int) $q->fetchColumn() >= self::NOUVEAUX_PAR_HEURE) {
            throw new HttpError(429, 'Trop d’envois.');
        }
        $this->db->prepare('INSERT INTO tentatives (cle, moment) VALUES (?, ?)')->execute([$key, $this->stamp()]);
    }

    /** Compteur du jour : envois reçus et refusés (page Santé de l'administration). */
    private function journal(bool $ok, string $motif = ''): void
    {
        $jour = gmdate('Y-m-d', $this->now());
        try {
            $col = $ok ? 'recus' : 'refuses';
            $u = $this->db->prepare("UPDATE suivi_journal SET $col = $col + 1" . ($ok ? '' : ', dernier_refus = ?') . ' WHERE jour = ?');
            $u->execute($ok ? [$jour] : [mb_substr($motif, 0, 80), $jour]);
            if ($u->rowCount() === 0) {
                $this->db->prepare('INSERT INTO suivi_journal (jour, recus, refuses, dernier_refus) VALUES (?, ?, ?, ?)')
                    ->execute([$jour, $ok ? 1 : 0, $ok ? 0 : 1, $ok ? null : mb_substr($motif, 0, 80)]);
            }
        } catch (\PDOException) {
            // Une ligne créée au même instant par un autre envoi : ce compteur n'est qu'indicatif.
        }
    }

    public function conservation(): int
    {
        return max(30, (int) $this->config->get('SUIVI_CONSERVATION_JOURS', '400'));
    }

    /**
     * Entretien : parties sans nouvelles fermées comme abandonnées ; détails plus vieux que la
     * durée de conservation résumés jour par jour dans suivi_bilans, puis effacés.
     * @return array{fermees: int, jours: int}
     */
    public function entretien(): array
    {
        $u = $this->db->prepare("UPDATE parties SET etat = 'abandon', fin = dernier WHERE etat = 'en_cours' AND dernier < ?");
        $u->execute([$this->stamp($this->now() - self::PERDUE_APRES)]);
        $fermees = $u->rowCount();
        $limite = gmdate('Y-m-d 00:00:00', $this->now() - $this->conservation() * 86400);
        $jours = [];
        $v = $this->db->prepare('SELECT debut, visiteur FROM visites WHERE debut < ?');
        $v->execute([$limite]);
        foreach ($v->fetchAll() as $row) {
            $j = substr((string) $row['debut'], 0, 10);
            $jours[$j]['']['visiteurs'][$row['visiteur']] = true;
            $jours[$j]['']['visites'] = ($jours[$j]['']['visites'] ?? 0) + 1;
        }
        $p = $this->db->prepare('SELECT debut, visiteur, jeu, etat, actif FROM parties WHERE debut < ?');
        $p->execute([$limite]);
        foreach ($p->fetchAll() as $row) {
            $j = substr((string) $row['debut'], 0, 10);
            foreach (['', (string) $row['jeu']] as $jeu) {
                $b = &$jours[$j][$jeu];
                $b['parties'] = ($b['parties'] ?? 0) + 1;
                $b['terminees'] = ($b['terminees'] ?? 0) + ($row['etat'] === 'terminee' ? 1 : 0);
                $b['actif'] = ($b['actif'] ?? 0) + (int) $row['actif'];
                if ($jeu !== '') {
                    $b['visiteurs'][$row['visiteur']] = true;
                }
                unset($b);
            }
        }
        if ($jours) {
            $this->db->beginTransaction();
            try {
                $ins = $this->db->prepare('INSERT INTO suivi_bilans (jour, jeu, visiteurs, visites, parties, terminees, actif) VALUES (?, ?, ?, ?, ?, ?, ?)');
                $del = $this->db->prepare('DELETE FROM suivi_bilans WHERE jour = ? AND jeu = ?');
                foreach ($jours as $j => $parJeu) {
                    foreach ($parJeu as $jeu => $b) {
                        $del->execute([$j, $jeu]);
                        $ins->execute([$j, $jeu, count($b['visiteurs'] ?? []), $b['visites'] ?? 0, $b['parties'] ?? 0, $b['terminees'] ?? 0, $b['actif'] ?? 0]);
                    }
                }
                $this->db->prepare('DELETE FROM parties WHERE debut < ?')->execute([$limite]);
                $this->db->prepare('DELETE FROM visites WHERE debut < ?')->execute([$limite]);
                $this->db->prepare('DELETE FROM suivi_journal WHERE jour < ?')->execute([substr($limite, 0, 10)]);
                $this->db->commit();
            } catch (\Throwable $e) {
                $this->db->rollBack();
                throw $e;
            }
        }
        return ['fermees' => $fermees, 'jours' => count($jours)];
    }
}
