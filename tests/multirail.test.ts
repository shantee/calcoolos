import { describe, expect, it } from 'vitest';
import { mulberry32, seriesOf, starsFor, TIER_SPEED } from '../src/game/multirail/model';
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
