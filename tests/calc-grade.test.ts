import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { makeExpression, type Op } from '../src/core/expressions';
import { GRADES, GRADE_WEIGHTS, gradeOf, pickGrade, pickGraded, type Grade } from '../src/core/calc-grade';
import type { TierId } from '../src/core/difficulty';

const TIERS: TierId[] = ['eveil', 'explorateur', 'stratege', 'maitre'];
const g = (a: number, op: Op, b: number, tier: TierId): Grade => gradeOf(makeExpression(a, op, b), tier);

describe('couleur des calculs', () => {
  it('Éveil : faire 10 est vert, passer la dizaine orange, un vrai emprunt rouge', () => {
    expect(g(4, '+', 3, 'eveil')).toBe('facile');
    expect(g(15, '+', 3, 'eveil')).toBe('facile');
    expect(g(8, '+', 2, 'eveil')).toBe('facile');
    expect(g(16, '−', 10, 'eveil')).toBe('facile');
    expect(g(8, '+', 5, 'eveil')).toBe('moyen');
    expect(g(10, '−', 6, 'eveil')).toBe('moyen');
    expect(g(13, '−', 8, 'eveil')).toBe('difficile');
  });

  it('exemples de Philippe : 2 × 8 facile, 35 − 27 plus compliqué', () => {
    expect(g(2, '×', 8, 'explorateur')).toBe('facile');
    expect(g(2, '×', 8, 'stratege')).toBe('facile');
    expect(g(35, '−', 27, 'explorateur')).toBe('difficile');
    expect(g(35, '−', 27, 'stratege')).toBe('difficile');
  });

  it('tables : 7 × 8 rouge en Stratège, 6 × 4 orange, 5 × 7 vert ; divisions plus dures que les produits', () => {
    expect(g(7, '×', 8, 'stratege')).toBe('difficile');
    expect(g(6, '×', 4, 'stratege')).toBe('moyen');
    expect(g(5, '×', 7, 'stratege')).toBe('facile');
    expect(g(56, '÷', 8, 'stratege')).toBe('difficile');
  });

  it('la couleur dépend du niveau : 13 − 8 est rouge en Éveil, orange en Maître ; 8 + 5 orange puis vert', () => {
    expect(g(13, '−', 8, 'eveil')).toBe('difficile');
    expect(g(13, '−', 8, 'maitre')).toBe('moyen');
    expect(g(8, '+', 5, 'eveil')).toBe('moyen');
    expect(g(8, '+', 5, 'maitre')).toBe('facile');
  });

  it('chaque niveau sait tirer un calcul de chaque couleur', () => {
    const rng = createRng(5);
    for (const tier of TIERS) {
      for (const grade of GRADES) {
        for (let i = 0; i < 200; i++) expect(gradeOf(pickGraded(tier, rng, grade), tier)).toBe(grade);
      }
    }
  });

  it('les couleurs sortent dans les proportions du niveau, avec plus de rouge en altitude', () => {
    const rng = createRng(9);
    for (const tier of TIERS) {
      const count = (harder: number) => {
        const n: Record<Grade, number> = { facile: 0, moyen: 0, difficile: 0 };
        for (let i = 0; i < 6000; i++) n[pickGrade(tier, rng, harder)]++;
        return n;
      };
      const low = count(0);
      for (const grade of GRADES) expect(Math.abs(low[grade] / 6000 - GRADE_WEIGHTS[tier][grade])).toBeLessThan(0.03);
      const high = count(1);
      expect(high.difficile).toBeGreaterThan(low.difficile + 500);
      expect(high.facile).toBeLessThan(low.facile - 500);
    }
  });
});
