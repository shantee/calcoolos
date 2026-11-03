import { expect, it } from 'vitest';
import { SiegeRound } from '../src/game/siege/round';
import { TIERS, NIVEAUX } from '../src/core/difficulty';
import { minCubesFor } from '../src/core/puzzle';
import { FREEZE_MS } from '../src/game/siege/powerups';
it('gel : huit secondes dans les deux modes', () => {
  expect(FREEZE_MS).toBe(8000);
  expect(FREEZE_MS).toBe(8000);
});
it('météorite et indice restent solubles dans les six classes', () => {
  for (const level of NIVEAUX) for (let seed = 0; seed < 60; seed++) {
    const r = new SiegeRound(TIERS[level], seed);
    r.toggle(0);
    const before = r.target, cubes = r.cubes.slice(), misses = r.misses;
    const changed = r.simplify();
    if (changed) {
      expect(r.target).toBeLessThan(before);
      expect(r.selected).toEqual([]);
      expect(r.cubes).toEqual(cubes);
    }
    expect(r.misses).toBe(misses);
    expect(minCubesFor(r.cubes, r.target)).toBe(r.puzzle.optimalCount);
    r.clear();
    const hint = r.hint()!;
    expect(r.puzzle.solution).toContain(hint);
    r.toggle(hint);
    const next = r.hint();
    if (next !== null) {
      expect(next).not.toBe(hint);
      expect(r.puzzle.solution).toContain(next);
    }
  }
});
it('CM2 commence avec des cibles au plus à 120 et trois cubes', () => {
  for (let seed = 0; seed < 100; seed++) {
    const r = new SiegeRound(TIERS.cm2, seed);
    expect(r.target).toBeLessThanOrEqual(120);
    expect(r.puzzle.optimalCount).toBeLessThanOrEqual(3);
  }
});
