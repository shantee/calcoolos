import { describe, expect, it } from 'vitest';
import { formatDuration, summarize } from '../src/platform/stats';
import { cleanResult, type StoredResult } from '../src/platform/results';

const base: StoredResult = {
  jeu: 'dragon',
  niveau: 'explorateur',
  mode: 'defi',
  score: 1000,
  gagne: true,
  etoiles: 2,
  duree: 200,
  precision: 0.8,
  ops: { '+': [8, 2] },
  details: {},
  date: '2026-10-20T10:00:00.000Z',
};

describe('tableau de bord', () => {
  const now = new Date('2026-10-24T12:00:00Z');

  it('compte parties, victoires, étoiles et temps', () => {
    const s = summarize([base, { ...base, gagne: false, etoiles: 0, duree: 100, date: '2026-10-21T10:00:00.000Z' }], now);
    expect(s.games).toBe(2);
    expect(s.wins).toBe(1);
    expect(s.stars).toBe(2);
    expect(s.seconds).toBe(300);
    expect(s.recent[0].date).toBe('2026-10-21T10:00:00.000Z');
  });

  it('garde le meilleur score par jeu, niveau et mode', () => {
    const s = summarize([
      base,
      { ...base, score: 3000 },
      { ...base, mode: 'tranquille', score: 500 },
      { ...base, jeu: 'cubes', score: 9000 },
    ], now);
    expect(s.records).toHaveLength(3);
    expect(s.records[0].jeu).toBe('cubes');
    expect(s.records.find((r) => r.jeu === 'dragon' && r.mode === 'defi')!.score).toBe(3000);
  });

  it('additionne la maîtrise par opération', () => {
    const s = summarize([base, { ...base, ops: { '+': [2, 0], '×': [9, 1] } }], now);
    expect(s.ops.map((o) => o.op)).toEqual(['+', '×']);
    expect(s.ops[0]).toMatchObject({ ok: 10, ko: 2 });
    expect(s.ops[1].rate).toBeCloseTo(0.9);
  });

  it('regroupe par jour sur les 30 derniers jours', () => {
    const s = summarize([
      base,
      { ...base, precision: 0.6, date: '2026-10-20T18:00:00.000Z' },
      { ...base, date: '2026-08-01T10:00:00.000Z' },
    ], now);
    expect(s.days).toEqual([{ day: '2026-10-20', games: 2, precision: 0.7, stars: 4 }]);
  });

  it('attribue les badges', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...base, date: `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00.000Z` }));
    const s = summarize([...many, { ...base, jeu: 'cubes' as const }, { ...base, jeu: 'meteores' as const, etoiles: 3 }, { ...base, jeu: 'fusee' as const }], now);
    const earned = s.badges.filter((b) => b.earned).map((b) => b.id);
    expect(earned).toEqual(expect.arrayContaining(['premiere', 'dix', 'phare', 'station', 'dragon', 'fusee', 'trois-jeux', 'etoiles', 'defi', 'regulier']));
    expect(earned).not.toContain('tables');
    expect(summarize([], now).badges.every((b) => !b.earned)).toBe(true);
  });

  it('formate les durées', () => {
    expect(formatDuration(40)).toBe('40 s');
    expect(formatDuration(720)).toBe('12 min');
    expect(formatDuration(3900)).toBe('1 h 05');
  });

  it('nettoie un résultat avant envoi', () => {
    const r = cleanResult({ ...base, score: 1234.6, duree: 0, precision: 1.4, etoiles: 7, ops: { '+': [3, 0], '×': [0, 0] }, details: { a: 2.4 } });
    expect(r.score).toBe(1235);
    expect(r.duree).toBe(1);
    expect(r.precision).toBe(1);
    expect(r.etoiles).toBe(3);
    expect(r.ops).toEqual({ '+': [3, 0] });
    expect(r.details).toEqual({ a: 2 });
  });
});
