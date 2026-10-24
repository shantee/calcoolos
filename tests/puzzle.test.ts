import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import {
  admissibleTargets,
  evaluateSelection,
  findOptimalSolution,
  generatePuzzle,
  minCubesFor,
  refillAndNext,
  maxDuplicates,
  validateConfig,
  type PuzzleConfig,
} from '../src/core/puzzle';
import { TIERS } from '../src/core/difficulty';

/** Référence par force brute : minimum de cubes sur tous les sous-ensembles. */
function bruteMin(cubes: number[], target: number): number | null {
  let best: number | null = null;
  const n = cubes.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += cubes[i];
        count++;
      }
    }
    if (sum === target && (best === null || count < best)) best = count;
  }
  return best;
}

describe('rng', () => {
  it('est déterministe', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('respecte les bornes de int()', () => {
    const r = createRng(1);
    for (let i = 0; i < 5000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });
});

describe('solveur', () => {
  it('exemple du cahier des charges : 9+9 bat 7+6+5', () => {
    const cubes = [9, 7, 6, 5, 9, 1];
    expect(minCubesFor(cubes, 18)).toBe(2);
    const sol = findOptimalSolution(cubes, 18)!;
    expect(sol.map((i) => cubes[i]).reduce((a, b) => a + b, 0)).toBe(18);
    expect(sol).toHaveLength(2);
    const long = evaluateSelection(cubes, [1, 2, 3], 18, 2);
    expect(long.exact).toBe(true);
    expect(long.optimal).toBe(false);
    // Les deux solutions optimales ex æquo sont reconnues de la même façon.
    expect(evaluateSelection(cubes, [0, 4], 18, 2).optimal).toBe(true);
  });

  it('chaque cube ne sert qu’une fois', () => {
    expect(minCubesFor([9], 18)).toBeNull();
    expect(evaluateSelection([9, 9], [0, 0], 18, 2).wellFormed).toBe(false);
    expect(evaluateSelection([9, 9], [0, 0], 18, 2).exact).toBe(false);
  });

  it('refuse les indices hors grille et la sélection vide', () => {
    expect(evaluateSelection([1, 2], [5], 1, 1).wellFormed).toBe(false);
    expect(evaluateSelection([1, 2], [], 0, 1).exact).toBe(false);
  });

  it('concorde avec la force brute sur 600 grilles aléatoires', () => {
    const rng = createRng(2026);
    for (let k = 0; k < 600; k++) {
      const n = rng.int(1, 12);
      const cubes = Array.from({ length: n }, () => rng.int(1, 20));
      const target = rng.int(1, 80);
      const expected = bruteMin(cubes, target);
      expect(minCubesFor(cubes, target)).toBe(expected);
      const sol = findOptimalSolution(cubes, target);
      if (expected === null) {
        expect(sol).toBeNull();
      } else {
        expect(sol).not.toBeNull();
        expect(new Set(sol).size).toBe(sol!.length);
        expect(sol!.reduce((a, i) => a + cubes[i], 0)).toBe(target);
        expect(sol!.length).toBe(expected);
      }
    }
  });
});

describe('générateur', () => {
  for (const tier of Object.values(TIERS)) {
    it(`palier ${tier.label} : 300 énigmes toujours solubles et conformes`, () => {
      const cfg = tier.puzzle;
      const rng = createRng(tier.id.length * 7919);
      for (let k = 0; k < 300; k++) {
        const p = generatePuzzle(cfg, rng);
        expect(p.cubes).toHaveLength(cfg.cubeCount);
        for (const v of p.cubes) {
          expect(v).toBeGreaterThanOrEqual(cfg.minValue);
          expect(v).toBeLessThanOrEqual(cfg.maxValue);
        }
        expect(p.target).toBeGreaterThanOrEqual(cfg.targetMin);
        expect(p.target).toBeLessThanOrEqual(cfg.targetMax);
        // Pas de réponse triviale en un cube.
        expect(p.cubes).not.toContain(p.target);
        expect(p.optimalCount).toBeGreaterThanOrEqual(cfg.minOptimal);
        expect(p.optimalCount).toBeLessThanOrEqual(cfg.maxOptimal);
        expect(p.optimalCount).toBe(bruteMin(p.cubes, p.target));
        const r = evaluateSelection(p.cubes, p.solution, p.target, p.optimalCount);
        expect(r.exact && r.optimal).toBe(true);
      }
    });
  }

  it('une partie enchaînée (remplacement des cubes utilisés) reste toujours jouable', () => {
    const cfg = TIERS.explorateur.puzzle;
    const rng = createRng(7);
    let p = generatePuzzle(cfg, rng);
    for (let k = 0; k < 500; k++) {
      const before = p.cubes.slice();
      const used = p.solution;
      p = refillAndNext(p.cubes, used, cfg, rng);
      // Les cubes non utilisés n'ont pas bougé (sauf relance de secours, très rare).
      const kept = before.filter((_, i) => !used.includes(i) && p.cubes[i] === before[i]).length;
      expect(kept).toBeGreaterThanOrEqual(before.length - used.length - 3);
      expect(minCubesFor(p.cubes, p.target)).toBe(p.optimalCount);
    }
  });

  it('la grille ne se remplit pas de doublons au fil d’une longue partie (tous paliers, jeu parfait)', () => {
    for (const tier of Object.values(TIERS)) {
      const cfg = tier.puzzle;
      const rng = createRng(99);
      let p = generatePuzzle(cfg, rng);
      const max = maxDuplicates(cfg.cubeCount);
      const means: number[] = [];
      for (let k = 0; k < 400; k++) {
        p = refillAndNext(p.cubes, p.solution, cfg, rng);
        const counts = new Map<number, number>();
        for (const v of p.cubes) counts.set(v, (counts.get(v) ?? 0) + 1);
        // pickTarget peut relancer un cube en secours : on tolère un exemplaire de plus.
        expect(Math.max(...counts.values())).toBeLessThanOrEqual(max + 1);
        means.push(p.cubes.reduce((a, b) => a + b, 0) / p.cubes.length);
      }
      // En moyenne sur la partie, la grille reste centrée sur la plage du palier.
      const mid = (cfg.minValue + cfg.maxValue) / 2;
      const avg = means.reduce((a, b) => a + b, 0) / means.length;
      expect(avg).toBeGreaterThan(mid * 0.8);
    }
  });

  it('admissibleTargets ne propose que des cibles dans les bornes', () => {
    const cfg = TIERS.stratege.puzzle;
    const opts = admissibleTargets([2, 3, 5, 7, 11, 13, 17, 19, 4, 6, 8, 9, 10, 12, 14, 15], cfg);
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) {
      expect(o.target).toBeGreaterThanOrEqual(cfg.targetMin);
      expect(o.target).toBeLessThanOrEqual(cfg.targetMax);
      expect(o.optimal).toBeGreaterThanOrEqual(cfg.minOptimal);
    }
  });

  it('rejette une configuration incohérente', () => {
    const bad: PuzzleConfig = { cubeCount: 4, minValue: 5, maxValue: 3, targetMin: 1, targetMax: 2, minOptimal: 2, maxOptimal: 1 };
    expect(() => validateConfig(bad)).toThrow();
  });
});
