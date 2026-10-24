import { describe, expect, it } from 'vitest';
import { comboMultiplier, efficiency, scoreHit } from '../src/core/scoring';

describe('barème', () => {
  it('deux solutions optimales ex æquo rapportent exactement pareil', () => {
    const a = scoreHit({ target: 18, optimalCount: 2, usedCount: 2, combo: 0, seconds: null, parSeconds: 15 });
    const b = scoreHit({ target: 18, optimalCount: 2, usedCount: 2, combo: 0, seconds: null, parSeconds: 15 });
    expect(a).toEqual(b);
    expect(a.perfect).toBe(true);
    expect(a.damage).toBe(100);
  });

  it('chaque cube en trop réduit les dégâts, avec un plancher', () => {
    expect(efficiency(2, 2)).toBe(1);
    expect(efficiency(2, 3)).toBe(0.75);
    expect(efficiency(2, 4)).toBe(0.5);
    expect(efficiency(2, 9)).toBe(0.4);
    expect(() => efficiency(3, 2)).toThrow();
  });

  it('9+9 frappe plus fort que 7+6+5', () => {
    const opt = scoreHit({ target: 18, optimalCount: 2, usedCount: 2, combo: 0, seconds: null, parSeconds: 15 });
    const long = scoreHit({ target: 18, optimalCount: 2, usedCount: 3, combo: 0, seconds: null, parSeconds: 15 });
    expect(opt.damage).toBeGreaterThan(long.damage);
    expect(opt.points).toBeGreaterThan(long.points);
  });

  it('la série monte avec les coups parfaits et retombe sinon', () => {
    const hit = scoreHit({ target: 20, optimalCount: 2, usedCount: 2, combo: 3, seconds: null, parSeconds: 15 });
    expect(hit.combo).toBe(4);
    const meh = scoreHit({ target: 20, optimalCount: 2, usedCount: 3, combo: 3, seconds: null, parSeconds: 15 });
    expect(meh.combo).toBe(0);
    expect(comboMultiplier(99)).toBe(2);
  });

  it('pas de bonus de vitesse sans chronomètre, bonus borné sinon', () => {
    expect(scoreHit({ target: 20, optimalCount: 2, usedCount: 2, combo: 0, seconds: null, parSeconds: 15 }).speedBonus).toBe(0);
    expect(scoreHit({ target: 20, optimalCount: 2, usedCount: 2, combo: 0, seconds: 0, parSeconds: 15 }).speedBonus).toBe(50);
    expect(scoreHit({ target: 20, optimalCount: 2, usedCount: 2, combo: 0, seconds: 30, parSeconds: 15 }).speedBonus).toBe(0);
  });
});
