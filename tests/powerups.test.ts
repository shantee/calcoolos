import { describe, it, expect } from 'vitest';
import { MagicPowers, MAX_CHARGES, PASSES_PER_GAME, RECHARGE_HITS } from '../src/game/siege/powerups';
import { WAVES } from '../src/core/waves';

describe('arsenal magique unique', () => {
  it('une charge initiale par sort, utilisation et recharge bornées', () => {
    const p = new MagicPowers('defi', 7);
    expect(p.charges).toEqual([1, 1, 1]);
    expect(p.use(0)).toBe(true);
    expect(p.use(0)).toBe(false);
    for (let i = 0; i < RECHARGE_HITS[0]; i++) p.recordHit();
    expect(p.charges[0]).toBe(1);
    for (let i = 0; i < 100; i++) p.recordHit();
    expect(p.charges).toEqual([MAX_CHARGES, MAX_CHARGES, MAX_CHARGES]);
    p.use(2);
    p.recordHit();
    expect(p.charges[2]).toBe(1); // Pas de réserve cachée quand les charges sont pleines.
  });

  it('deux livraisons naturelles, hors première vague, reproductibles', () => {
    for (let seed = 0; seed < 100; seed++) {
      const p = new MagicPowers('tranquille', seed);
      expect(p.plan).toEqual(new MagicPowers('tranquille', seed).plan);
      expect(p.plan[0]).toBeGreaterThanOrEqual(WAVES[0].length);
      expect(p.due(0)).toBe(false);
      for (const index of p.plan) {
        expect(p.due(index)).toBe(true);
        expect(p.launch()).not.toBeNull();
        expect(p.launch()).toBeNull();
        p.expire(); p.endFlight();
      }
      expect(p.launched).toBe(PASSES_PER_GAME);
      expect(p.due(100)).toBe(false);
      expect(p.launch()).toBeNull();
    }
  });

  it('collecte une fois, recharge seulement un des trois sorts', () => {
    const p = new MagicPowers('defi', 4);
    const f = p.launch()!;
    const i = p.collect()!;
    expect(i).toBe(f.cargo);
    expect(p.charges[i]).toBe(2);
    expect(p.charges.reduce((a, b) => a + b)).toBe(4);
    expect(p.collect()).toBeNull();
    expect(p.caught).toBe(1);
  });

  it('un passage ignoré ne change ni les charges ni leur progression', () => {
    const p = new MagicPowers('defi', 13);
    p.launch(); p.expire();
    expect(p.collect()).toBeNull();
    expect(p.charges).toEqual([1, 1, 1]);
    expect(p.progress).toEqual([0, 0, 0]);
    expect(p.caught).toBe(0);
  });

  it('redirige le cadeau si le sort prévu est rempli entre-temps', () => {
    const p = new MagicPowers('defi', 13);
    const f = p.launch()!;
    p.charges[f.cargo] = 2;
    const other = p.collect()!;
    expect(other).not.toBe(f.cargo);
    expect(p.charges[other]).toBe(2);
    expect(p.charges.every(n => n <= 2)).toBe(true);
  });

  it('tout plein : pas de livraison inutile ni de charge au-delà du plafond', () => {
    const p = new MagicPowers('defi', 1);
    p.launch();
    p.charges.fill(2);
    expect(p.collect()).toBeNull();
    p.endFlight();
    expect(p.due(100)).toBe(false);
    expect(p.launch(true)).toBeNull();
  });
});
