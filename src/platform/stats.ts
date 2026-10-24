/**
 * Calculs du tableau de bord, à partir d'une liste de résultats (historique
 * local de l'invité ou historique d'un profil renvoyé par le serveur).
 * Logique pure, testée.
 */
import type { GameId, StoredResult } from './results';

export const GAME_NAMES: Record<GameId, string> = {
  cubes: 'Cubes de siège',
  meteores: 'Pluie de météores',
  dragon: 'Le Dragon gourmand',
};

export const TIER_NAMES: Record<string, string> = {
  eveil: 'Éveil',
  explorateur: 'Explorateur',
  stratege: 'Stratège',
  maitre: 'Maître',
};

export const MODE_NAMES: Record<string, string> = { tranquille: 'Tranquille', defi: 'Défi' };

export const OP_NAMES: Record<string, string> = { '+': 'Additions', '−': 'Soustractions', '×': 'Multiplications', '÷': 'Divisions' };

export interface Badge {
  id: string;
  name: string;
  hint: string;
  earned: boolean;
}

export interface Summary {
  games: number;
  wins: number;
  stars: number;
  seconds: number;
  /** Meilleur score par jeu / niveau / mode. */
  records: Array<{ jeu: GameId; niveau: string; mode: string; score: number; etoiles: number; date: string }>;
  ops: Array<{ op: string; ok: number; ko: number; rate: number }>;
  /** Un point par jour joué (30 derniers jours), du plus ancien au plus récent. */
  days: Array<{ day: string; games: number; precision: number; stars: number }>;
  recent: StoredResult[];
  badges: Badge[];
}

const dayOf = (iso: string): string => iso.slice(0, 10);

export function summarize(results: readonly StoredResult[], now = new Date()): Summary {
  const sorted = [...results].sort((a, b) => b.date.localeCompare(a.date));
  const games = sorted.length;
  const wins = sorted.filter((r) => r.gagne).length;
  const stars = sorted.reduce((a, r) => a + r.etoiles, 0);
  const seconds = sorted.reduce((a, r) => a + r.duree, 0);

  const recMap = new Map<string, Summary['records'][number]>();
  for (const r of sorted) {
    const key = `${r.jeu}|${r.niveau}|${r.mode}`;
    const cur = recMap.get(key);
    if (!cur || r.score > cur.score) recMap.set(key, { jeu: r.jeu, niveau: r.niveau, mode: r.mode, score: r.score, etoiles: r.etoiles, date: r.date });
  }
  const order = Object.keys(GAME_NAMES);
  const records = [...recMap.values()].sort((a, b) => order.indexOf(a.jeu) - order.indexOf(b.jeu) || b.score - a.score);

  const opTotals = new Map<string, { ok: number; ko: number }>();
  for (const r of sorted) {
    for (const [op, [ok, ko]] of Object.entries(r.ops ?? {})) {
      const t = opTotals.get(op) ?? { ok: 0, ko: 0 };
      t.ok += ok;
      t.ko += ko;
      opTotals.set(op, t);
    }
  }
  const ops = Object.keys(OP_NAMES)
    .filter((op) => opTotals.has(op))
    .map((op) => {
      const t = opTotals.get(op)!;
      return { op, ok: t.ok, ko: t.ko, rate: t.ok + t.ko === 0 ? 0 : t.ok / (t.ok + t.ko) };
    });

  const since = new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  const byDay = new Map<string, { games: number; prec: number; stars: number }>();
  for (const r of sorted) {
    const d = dayOf(r.date);
    if (d < since) continue;
    const t = byDay.get(d) ?? { games: 0, prec: 0, stars: 0 };
    t.games++;
    t.prec += r.precision;
    t.stars += r.etoiles;
    byDay.set(d, t);
  }
  const days = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, t]) => ({ day, games: t.games, precision: t.prec / t.games, stars: t.stars }));

  const wonGame = (g: GameId) => sorted.some((r) => r.jeu === g && r.gagne);
  const mul = opTotals.get('×');
  const distinctDays = new Set(sorted.map((r) => dayOf(r.date))).size;
  const badges: Badge[] = [
    { id: 'premiere', name: 'Première partie', hint: 'Jouer une partie', earned: games >= 1 },
    { id: 'dix', name: 'Dix parties', hint: 'Jouer dix parties', earned: games >= 10 },
    { id: 'phare', name: 'Gardien du phare', hint: 'Gagner à Cubes de siège', earned: wonGame('cubes') },
    { id: 'station', name: 'Pilote de la station', hint: 'Gagner à Pluie de météores', earned: wonGame('meteores') },
    { id: 'dragon', name: 'Ami du dragon', hint: 'Gagner au Dragon gourmand', earned: wonGame('dragon') },
    { id: 'trois-jeux', name: 'Tour de l’archipel', hint: 'Gagner aux trois jeux', earned: wonGame('cubes') && wonGame('meteores') && wonGame('dragon') },
    { id: 'etoiles', name: 'Trois étoiles', hint: 'Finir une partie avec 3 étoiles', earned: sorted.some((r) => r.etoiles >= 3) },
    { id: 'defi', name: 'Défi relevé', hint: 'Gagner une partie en mode Défi', earned: sorted.some((r) => r.gagne && r.mode === 'defi') },
    { id: 'tables', name: 'As des tables', hint: '50 multiplications justes à 90 %', earned: !!mul && mul.ok >= 50 && mul.ok / (mul.ok + mul.ko) >= 0.9 },
    { id: 'regulier', name: 'Régulier', hint: 'Jouer cinq jours différents', earned: distinctDays >= 5 },
  ];

  return { games, wins, stars, seconds, records, ops, days, recent: sorted.slice(0, 10), badges };
}

/** « 1 h 05 », « 12 min », « 40 s ». */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
