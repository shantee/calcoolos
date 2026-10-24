import { describe, expect, it } from 'vitest';
import { SiegeRound } from '../src/game/siege/round';
import { minCubesFor } from '../src/core/puzzle';
import { TIERS } from '../src/core/difficulty';

describe('partie de Cubes de siège', () => {
  it('une partie entière jouée parfaitement : toujours jouable, score croissant, série qui monte', () => {
    const round = new SiegeRound(TIERS.explorateur, 123);
    let last = 0;
    for (let k = 0; k < 200; k++) {
      expect(minCubesFor(round.cubes, round.target)).toBe(round.puzzle.optimalCount);
      round.puzzle.solution.forEach((i) => round.toggle(i));
      expect(round.sum).toBe(round.target);
      const out = round.validate(0);
      expect(out.kind).toBe('hit');
      if (out.kind === 'hit') expect(out.result.perfect).toBe(true);
      expect(round.score).toBeGreaterThan(last);
      last = round.score;
    }
    expect(round.combo).toBe(200);
    expect(round.hits).toBe(200);
  });

  it('une validation fausse ne rapporte rien, casse la série et garde la sélection', () => {
    const round = new SiegeRound(TIERS.explorateur, 5);
    round.puzzle.solution.forEach((i) => round.toggle(i));
    round.validate(0);
    expect(round.combo).toBe(1);
    const score = round.score;
    // Un seul cube ne peut jamais suffire (optimum ≥ 2).
    round.toggle(0);
    const out = round.validate(0);
    expect(out.kind).toBe('miss');
    expect(round.score).toBe(score);
    expect(round.combo).toBe(0);
    expect(round.selected).toEqual([0]);
  });

  it('sélection vide : rien ne se passe', () => {
    const round = new SiegeRound(TIERS.eveil, 9);
    expect(round.validate(0).kind).toBe('empty');
    expect(round.misses).toBe(0);
  });

  it('toggle sélectionne puis désélectionne', () => {
    const round = new SiegeRound(TIERS.eveil, 9);
    expect(round.toggle(2)).toBe(true);
    expect(round.toggle(2)).toBe(false);
    expect(round.selected).toEqual([]);
    expect(round.toggle(99)).toBe(false);
  });

  it('même graine, même partie', () => {
    const a = new SiegeRound(TIERS.stratege, 77);
    const b = new SiegeRound(TIERS.stratege, 77);
    expect(a.cubes).toEqual(b.cubes);
    expect(a.target).toBe(b.target);
  });
});
