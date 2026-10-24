import { describe, expect, it } from 'vitest';
import {
  DragonSession,
  DRAGON_STAGES,
  DRAGON_TIERS,
  FIELD,
  admissibleGoals,
  combine,
  minFactorsTable,
  reachable,
  remainderOf,
  type Goal,
  type Orb,
} from '../src/game/dragon/session';
import { createRng } from '../src/core/rng';
import type { TierId } from '../src/core/difficulty';

const TIERS: TierId[] = ['eveil', 'explorateur', 'stratege', 'maitre'];

/** Une solution minimale (ids) pour le reste de l'objectif, par force brute. */
function solve(goal: Goal, belly: number[], orbs: Orb[]): number[] | null {
  const rest = remainderOf(goal, belly);
  if (rest === null) return null;
  let best: number[] | null = null;
  const n = orbs.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const pick = orbs.filter((_, i) => mask & (1 << i));
    if (best && pick.length >= best.length) continue;
    const v = combine(goal.op, pick.map((o) => o.value));
    if (v === rest) best = pick.map((o) => o.id);
  }
  return best;
}

describe('table des produits', () => {
  it('égale une force brute sur 400 ensembles', () => {
    const rng = createRng(7);
    for (let k = 0; k < 400; k++) {
      const values = Array.from({ length: rng.int(2, 8) }, () => rng.int(1, 12));
      const table = minFactorsTable(values, 300);
      const brute = new Map<number, number>();
      for (let mask = 0; mask < 1 << values.length; mask++) {
        const pick = values.filter((_, i) => mask & (1 << i));
        const p = pick.reduce((a, b) => a * b, 1);
        if (p <= 300 && (brute.get(p) ?? Infinity) > pick.length) brute.set(p, pick.length);
      }
      expect(new Map([...table].sort())).toEqual(new Map([...brute].sort()));
    }
  });

  it('reste et atteignabilité', () => {
    expect(remainderOf({ target: 17, op: '+', optimal: 2 }, [8, 4])).toBe(5);
    expect(remainderOf({ target: 17, op: '+', optimal: 2 }, [8, 10])).toBeNull();
    expect(remainderOf({ target: 24, op: '×', optimal: 2 }, [3])).toBe(8);
    expect(remainderOf({ target: 24, op: '×', optimal: 2 }, [5])).toBeNull();
    expect(reachable('+', [3, 4, 9], 13)).toBe(true);
    expect(reachable('+', [3, 4, 9], 8)).toBe(false);
    expect(reachable('×', [3, 4, 9], 36)).toBe(true);
    expect(reachable('×', [3, 4, 9], 27)).toBe(true);
    expect(reachable('×', [3, 4, 9], 8)).toBe(false);
  });

  it('objectifs admissibles dans les bornes', () => {
    const goals = admissibleGoals('×', [2, 3, 4, 7, 9], DRAGON_TIERS.stratege.mul!);
    for (const g of goals) {
      expect(g.target).toBeGreaterThanOrEqual(12);
      expect(g.target).toBeLessThanOrEqual(90);
      expect(g.optimal).toBe(2);
    }
    expect(goals.map((g) => g.target)).toContain(63);
  });
});

describe('partie du dragon', () => {
  for (const tier of TIERS) {
    it(`${tier} : 30 parties jouées au mieux, toujours gagnées, objectifs toujours atteignables`, () => {
      const cfg = DRAGON_TIERS[tier];
      const ops = new Set<string>();
      for (let seed = 1; seed <= 30; seed++) {
        const s = new DragonSession(tier, seed * 101, 'tranquille');
        let guard = 0;
        while (s.phase === 'play' && guard++ < 400) {
          expect(s.orbs.length).toBe(cfg.orbs);
          for (const o of s.orbs) {
            expect(o.value).toBeGreaterThanOrEqual(1);
            expect(o.value).toBeLessThanOrEqual(cfg.maxValue);
            expect(o.x).toBeGreaterThanOrEqual(FIELD.x0);
            expect(o.x).toBeLessThanOrEqual(FIELD.x1);
            expect(o.y).toBeGreaterThanOrEqual(FIELD.y0);
            expect(o.y).toBeLessThanOrEqual(FIELD.y1);
          }
          expect(new Set(s.orbs.map((o) => o.id)).size).toBe(s.orbs.length);
          ops.add(s.goal.op);
          const rule = s.goal.op === '+' ? cfg.add : cfg.mul!;
          expect(s.goal.target).toBeGreaterThanOrEqual(rule.targetMin);
          expect(s.goal.target).toBeLessThanOrEqual(rule.targetMax);
          const sol = solve(s.goal, [], s.orbs);
          expect(sol, `objectif ${s.goal.op}${s.goal.target} avec ${s.orbs.map((o) => o.value)}`).not.toBeNull();
          expect(sol!.length).toBe(s.goal.optimal);
          // On mange une à une en recalculant (de nouvelles lanternes arrivent).
          for (let k = 0; k < 6 && s.belly.length >= 0; k++) {
            const step = solve(s.goal, s.belly, s.orbs);
            if (!step || step.length === 0) break;
            const before = s.stats.goals;
            s.eat(step[0]);
            if (s.stats.goals > before || s.phase !== 'play') break;
          }
        }
        expect(s.phase).toBe('won');
        expect(s.stats.goals).toBe(DRAGON_STAGES.reduce((a, p) => a + p.goals, 0));
        expect(s.stats.overshoots).toBe(0);
        expect(s.accuracy()).toBe(1);
      }
      if (cfg.mul) expect(ops).toEqual(new Set(['+', '×']));
      else expect(ops).toEqual(new Set(['+']));
    });
  }

  it('jamais coincé : après n’importe quelle bouchée possible, le reste reste atteignable', () => {
    for (const tier of TIERS) {
      const rng = createRng(tier.length);
      for (let seed = 1; seed <= 40; seed++) {
        const s = new DragonSession(tier, seed, 'tranquille');
        for (let step = 0; step < 60 && s.phase === 'play'; step++) {
          const o = rng.pick(s.orbs);
          const r = s.eat(o.id, { x: 300, y: 300 });
          expect(r.kind).not.toBe('ignored');
          if (s.phase !== 'play') break;
          const rest = remainderOf(s.goal, s.belly);
          expect(rest).not.toBeNull();
          expect(reachable(s.goal.op, s.orbs.map((x) => x.value), rest!)).toBe(true);
          expect(s.orbs.length).toBe(DRAGON_TIERS[tier].orbs);
        }
      }
    }
  });

  it('dépasser : hoquet, lanternes recrachées, combo perdu', () => {
    const s = new DragonSession('explorateur', 5, 'tranquille');
    // Manger les plus grosses jusqu'à dépasser.
    let r;
    let guard = 0;
    do {
      const big = [...s.orbs].sort((a, b) => b.value - a.value)[0];
      r = s.eat(big.id);
    } while (r.kind === 'progress' && guard++ < 20);
    if (r.kind === 'overshoot') {
      expect(s.belly).toEqual([]);
      expect(s.orbs.length).toBe(DRAGON_TIERS.explorateur.orbs);
      expect(r.spat.length).toBeGreaterThan(1);
      // L'objectif reste atteignable.
      expect(solve(s.goal, [], s.orbs)).not.toBeNull();
      expect(s.stats.overshoots).toBe(1);
      expect(s.combo).toBe(0);
      expect(s.accuracy()).toBe(0);
    } else {
      expect(r.kind).toBe('complete');
    }
  });

  it('Défi : la faim coûte un cœur, trois fois et c’est perdu', () => {
    const s = new DragonSession('eveil', 3, 'defi');
    expect(s.hearts).toBe(3);
    const first = s.goal;
    const ev = s.update(DRAGON_TIERS.eveil.hunger + 0.1);
    expect(ev).toHaveLength(1);
    expect(ev[0].setback.heartLost).toBe(true);
    expect(s.hearts).toBe(2);
    expect(s.goal).toBeDefined();
    expect(s.hunger).toBeCloseTo(DRAGON_TIERS.eveil.hunger);
    void first;
    s.hurt();
    expect(s.hearts).toBe(1);
    const last = s.hurt();
    expect(last.lost).toBe(true);
    expect(s.phase).toBe('lost');
    expect(s.eat(s.orbs[0].id).kind).toBe('ignored');
  });

  it('Tranquille : ni cœurs ni faim', () => {
    const s = new DragonSession('stratege', 9, 'tranquille');
    expect(s.update(500)).toEqual([]);
    const hit = s.hurt();
    expect(hit.heartLost).toBe(false);
    expect(s.phase).toBe('play');
  });

  it('une même graine rejoue la même partie', () => {
    const a = new DragonSession('maitre', 42, 'defi');
    const b = new DragonSession('maitre', 42, 'defi');
    expect(a.orbs).toEqual(b.orbs);
    expect(a.goal).toEqual(b.goal);
  });
});
