import { describe, expect, it } from 'vitest';
import { SiegeSession } from '../src/game/siege/session';
import { TIERS } from '../src/core/difficulty';
import { ARCHETYPES, WAVES, damageTo } from '../src/core/waves';

function solve(s: SiegeSession): void {
  s.round.puzzle.solution.forEach((i) => s.round.toggle(i));
}

/** Joue toute la partie parfaitement ; renvoie le nombre de tirs. */
function playPerfect(s: SiegeSession): number {
  let shots = 0;
  let t = 0;
  for (;;) {
    if (!s.nextEnemy(t)) {
      if (!s.nextWave()) break;
      continue;
    }
    while (s.enemyHp > 0) {
      solve(s);
      t += 2000;
      const r = s.validate(t);
      expect(r.outcome.kind).toBe('hit');
      shots++;
    }
  }
  return shots;
}

describe('partie complète', () => {
  it('jouée parfaitement : victoire, tous les monstres vaincus', () => {
    for (const tier of Object.values(TIERS)) {
      const s = new SiegeSession(tier, 42, 'defi');
      const shots = playPerfect(s);
      const total = WAVES.flat().length;
      expect(s.phase).toBe('won');
      expect(s.stats.defeated).toBe(total);
      expect(s.stats.perfects).toBe(shots);
      expect(s.accuracy()).toBe(1);
      expect(s.hearts).toBe(3);
      // Une partie dure une petite trentaine de tirs.
      expect(shots).toBeGreaterThan(15);
      expect(shots).toBeLessThan(40);
      expect(s.score).toBeGreaterThan(0);
      expect(s.medianTime()).toBe(2);
    }
  });

  it('mode Défi : trois monstres au phare et c’est perdu', () => {
    const s = new SiegeSession(TIERS.explorateur, 1, 'defi');
    for (let i = 0; i < 3; i++) {
      expect(s.nextEnemy(0)).not.toBeNull();
      expect(s.enemyReachedTower()).toBe(true);
      if (!s.waveCleared) continue;
      s.nextWave();
    }
    expect(s.hearts).toBe(0);
    expect(s.phase).toBe('lost');
    expect(s.nextEnemy(0)).toBeNull();
  });

  it('mode Tranquille : on ne perd jamais de cœur', () => {
    const s = new SiegeSession(TIERS.eveil, 1, 'tranquille');
    s.nextEnemy(0);
    for (let i = 0; i < 20; i++) expect(s.enemyReachedTower()).toBe(false);
    expect(s.hearts).toBeNull();
    expect(s.phase).toBe('play');
    expect(s.enemySpeed).toBeLessThan(ARCHETYPES.mordillon.speed);
  });

  it('le Carapaçon encaisse moitié moins des coups imparfaits', () => {
    expect(damageTo('carapacon', 75, false)).toBe(38);
    expect(damageTo('carapacon', 100, true)).toBe(100);
    expect(damageTo('mordillon', 75, false)).toBe(75);
  });

  it('les erreurs comptent dans la précision mais ne touchent pas le monstre', () => {
    const s = new SiegeSession(TIERS.explorateur, 3, 'tranquille');
    s.nextEnemy(0);
    s.round.toggle(0);
    const r = s.validate(1000);
    expect(r.outcome.kind).toBe('miss');
    expect(s.enemyHp).toBe(ARCHETYPES.mordillon.hp);
    expect(s.stats.misses).toBe(1);
    expect(s.accuracy()).toBe(0);
  });
});
