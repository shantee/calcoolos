import { describe, expect, it } from 'vitest';
import { AdaptiveDifficulty, adjustConfig, MAX_OFFSET, MIN_OFFSET } from '../src/core/adaptive';
import { generatePuzzle } from '../src/core/puzzle';
import { createRng } from '../src/core/rng';
import { TIERS } from '../src/core/difficulty';

describe('difficulté adaptative', () => {
  it('monte après 3 coups parfaits, sans dépasser +2', () => {
    const a = new AdaptiveDifficulty();
    for (let i = 0; i < 3; i++) a.record('perfect');
    expect(a.offset).toBe(1);
    for (let i = 0; i < 30; i++) a.record('perfect');
    expect(a.offset).toBe(MAX_OFFSET);
  });

  it('descend après 2 erreurs sur 3 tentatives, sans passer sous −1', () => {
    const a = new AdaptiveDifficulty();
    a.record('miss');
    a.record('hit');
    a.record('miss');
    expect(a.offset).toBe(-1);
    for (let i = 0; i < 10; i++) a.record('miss');
    expect(a.offset).toBe(MIN_OFFSET);
  });

  it('ne bouge pas sur des résultats mitigés', () => {
    const a = new AdaptiveDifficulty();
    for (const o of ['perfect', 'hit', 'perfect', 'hit', 'miss', 'perfect', 'hit'] as const) a.record(o);
    expect(a.offset).toBe(0);
  });

  it('chaque cran donne une configuration valide et des énigmes solubles, pour tous les paliers', () => {
    for (const tier of Object.values(TIERS)) {
      for (let off = MIN_OFFSET; off <= MAX_OFFSET; off++) {
        const cfg = adjustConfig(tier.puzzle, off);
        const rng = createRng(off + 10);
        for (let k = 0; k < 60; k++) {
          const p = generatePuzzle(cfg, rng);
          expect(p.target).toBeGreaterThanOrEqual(cfg.targetMin);
          expect(p.target).toBeLessThanOrEqual(cfg.targetMax);
          expect(p.optimalCount).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('un cran plus haut élargit la plage des cibles', () => {
    const base = TIERS.explorateur.puzzle;
    expect(adjustConfig(base, 1).targetMax).toBeGreaterThan(base.targetMax);
    expect(adjustConfig(base, -1).targetMax).toBeLessThan(base.targetMax);
    expect(adjustConfig(base, 0)).toEqual(base);
  });
});
