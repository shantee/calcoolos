import { describe, expect, it } from 'vitest';
import { QuestionDeck, SERIES, factDifficulty, factPool, factsDuNiveau, mulberry32, seriesOf, starsFor, tablesDuNiveau, TIER_SPEED, type Fact } from '../src/game/multirail/model';
import type { TierId } from '../src/core/difficulty';
import { ZenDeck, ZEN_LEVELS, ZEN_MAX } from '../src/game/multirail/zen';
import { NIVEAUX } from '../src/platform/niveau';

describe('MULTIRAIL dans Calcoolos', () => {
  it('chaque niveau de Calcoolos a sa vitesse et son niveau Zen', () => {
    for (const n of NIVEAUX) {
      expect(TIER_SPEED[n]).toBeTruthy();
      expect(ZEN_LEVELS[n]).toBeTruthy();
    }
  });

  it('séries de tables classées, tables au choix hors classement', () => {
    expect(seriesOf([2, 3, 4, 5])).toBe('petites');
    expect(seriesOf([1, 2, 3, 4, 5])).toBe('petites');
    expect(seriesOf([6, 7, 8, 9])).toBe('grandes');
    expect(seriesOf([2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe('toutes');
    expect(seriesOf([7, 8])).toBe('perso');
  });

  it('étoiles selon les régions traversées', () => {
    expect(starsFor(1)).toBe(0);
    expect(starsFor(2)).toBe(1);
    expect(starsFor(7)).toBe(3);
  });

  it('Voyage Zen : réponses entières, ≤ 500, faits de tables bien écrits', () => {
    for (const n of NIVEAUX) {
      const deck = new ZenDeck(n, mulberry32(11));
      for (let k = 0; k < 400; k++) {
        const p = deck.next();
        expect(Number.isInteger(p.answer) && p.answer >= 0 && p.answer <= ZEN_MAX).toBe(true);
        if (p.fait) expect(p.fait.a).toBeGreaterThan(0);
        deck.record(true, false);
      }
    }
  });
});

describe('difficulté des calculs selon le niveau', () => {
  const pose = (niveau: TierId, tables: number[], n = 200): Fact[] => {
    const deck = new QuestionDeck(tables, mulberry32(7), {}, 3, niveau);
    return Array.from({ length: n }, () => deck.next(0));
  };
  const toutes = [2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('Explosif : jamais de 2 × 2, ni de × 1, × 2, × 5 ou × 10, dès le premier calcul', () => {
    for (const f of pose('maitre', toutes)) for (const n of [f.a, f.b]) expect([1, 2, 5, 10]).not.toContain(n);
  });

  it('Explosif commence par des calculs plus durs que Doux', () => {
    const moyenne = (faits: Fact[]) => faits.reduce((t, f) => t + factDifficulty(f.a, f.b), 0) / faits.length;
    expect(moyenne(pose('maitre', toutes, 10))).toBeGreaterThan(moyenne(pose('eveil', toutes, 10)) + 0.2);
  });

  it('dès Relevé, plus de × 1 ; en Doux il peut en rester', () => {
    expect(pose('explorateur', toutes).some((f) => f.a === 1 || f.b === 1)).toBe(false);
    expect(pose('eveil', toutes).some((f) => f.a === 1 || f.b === 1)).toBe(true);
  });

  it('des tables choisies à la main restent respectées, même en Explosif', () => {
    const faits = pose('maitre', [2], 40);
    expect(faits.every((f) => f.a === 2 || f.b === 2)).toBe(true);
    expect(faits.some((f) => f.a === 1 || f.b === 1)).toBe(false);
    expect(factsDuNiveau(factPool([1]), 'maitre').length).toBeGreaterThan(0);
  });

  it('chaque niveau garde ses tables : Doux ne laisse pas ses tables à Explosif', () => {
    expect(tablesDuNiveau({ eveil: [2, 3] }, 'maitre')).toEqual([...SERIES.toutes.tables]);
    expect(tablesDuNiveau({ maitre: [7, 8] }, 'maitre')).toEqual([7, 8]);
    expect(tablesDuNiveau(undefined, 'eveil')).toEqual([...SERIES.petites.tables]);
  });
});
