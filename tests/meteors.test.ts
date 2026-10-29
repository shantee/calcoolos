import { describe, expect, it } from 'vitest';
import { conflicts, evaluate, MENUS, pickExpression } from '../src/core/expressions';
import { createRng } from '../src/core/rng';
import { MeteorSession, METEOR_WAVES, BOSS_CALCS } from '../src/game/meteors/session';
import type { TierId } from '../src/core/difficulty';

const TIERS: TierId[] = ['eveil', 'explorateur', 'stratege', 'maitre'];

describe('générateur de calculs', () => {
  for (const tier of TIERS) {
    it(`${tier} : 2 000 calculs justes, entiers, positifs`, () => {
      const rng = createRng(tier.length * 31);
      const ops = new Set<string>();
      for (let k = 0; k < 2000; k++) {
        const e = pickExpression(tier, rng);
        ops.add(e.op);
        expect(Number.isInteger(e.answer)).toBe(true);
        expect(e.answer).toBeGreaterThanOrEqual(0);
        expect(evaluate(e.a, e.op, e.b)).toBe(e.answer);
        expect(e.text).toBe(`${e.a} ${e.op} ${e.b}`);
        if (tier === 'eveil') expect(e.answer).toBeLessThanOrEqual(20);
      }
      // Toutes les opérations du menu apparaissent.
      expect(ops.size).toBe(new Set(MENUS[tier].map((r) => r.op)).size);
    });
  }

  it('les petits (Éveil) n’ont ni multiplication ni division', () => {
    const rng = createRng(1);
    for (let k = 0; k < 500; k++) expect(['+', '−']).toContain(pickExpression('eveil', rng).op);
  });

  it('aucune réponse à l’écran n’est le début d’une autre', () => {
    for (const tier of TIERS) {
      const rng = createRng(7);
      for (let round = 0; round < 200; round++) {
        const active: number[] = [];
        for (let k = 0; k < 6; k++) active.push(pickExpression(tier, rng, active).answer);
        for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) expect(conflicts(active[i], active[j])).toBe(false);
      }
    }
  });

  it('conflicts : 3 et 36 oui, 36 et 63 non', () => {
    expect(conflicts(3, 36)).toBe(true);
    expect(conflicts(36, 3)).toBe(true);
    expect(conflicts(36, 63)).toBe(false);
    expect(conflicts(12, 12)).toBe(true);
  });
});

/** Joueur parfait : vise le météore le plus bas dès qu'il devient « menaçant ». */
function play(s: MeteorSession, opts: { reactAt: number; maxSeconds: number }): number {
  let t = 0;
  while (s.phase === 'play' && t < opts.maxSeconds) {
    s.update(0.1);
    t += 0.1;
    const target = s.alive.sort((a, b) => b.p - a.p)[0];
    if (target && target.p >= opts.reactAt) {
      for (const d of String(target.expr.answer)) s.input(d);
    }
  }
  return t;
}

describe('partie de Pluie de météores', () => {
  for (const tier of TIERS) {
    it(`${tier} : un joueur sans faute gagne, boss compris, sans perdre de bouclier`, () => {
      const s = new MeteorSession(tier, 11, 'defi');
      const t = play(s, { reactAt: 0.2, maxSeconds: 600 });
      expect(s.phase).toBe('won');
      expect(s.shields).toBe(3);
      expect(s.stats.errors).toBe(0);
      // Relevé commun : autant de calculs que de tirs, temps mesurés sur la chute des météores.
      const m = s.releve.mesures();
      expect(m.calculs).toBe(s.stats.hits);
      expect(m.fausses).toBe(0);
      expect(m.tempsMedian).toBeGreaterThan(0);
      if (tier !== 'eveil') expect(Object.keys(m.faits ?? {}).length).toBeGreaterThan(0);
      const total = METEOR_WAVES.reduce((n, w) => n + w.rocks + w.robots + w.gold, 0);
      // Chaque météore est détruit (par un tir ou par une onde dorée), plus les calculs du boss.
      expect(s.stats.hits).toBeLessThanOrEqual(total + BOSS_CALCS);
      expect(s.stats.hits).toBeGreaterThanOrEqual(BOSS_CALCS + 10);
      // Une partie dure quelques minutes.
      expect(t).toBeGreaterThan(60);
      expect(t).toBeLessThan(300);
    });
  }

  it('mode Défi : sans répondre, les boucliers tombent et la partie est perdue', () => {
    const s = new MeteorSession('explorateur', 3, 'defi');
    let t = 0;
    while (s.phase === 'play' && t < 300) {
      s.update(0.1);
      t += 0.1;
    }
    expect(s.phase).toBe('lost');
    expect(s.shields).toBe(0);
    expect(s.stats.impacts).toBe(3);
  });

  it('mode Tranquille : on ne perd jamais', () => {
    const s = new MeteorSession('eveil', 3, 'tranquille');
    let t = 0;
    while (t < 400) {
      s.update(0.1);
      t += 0.1;
    }
    expect(s.phase).toBe('play');
    expect(s.shields).toBeNull();
  });

  it('saisie : attente sur un début de réponse, erreur sinon, combo cassé', () => {
    const s = new MeteorSession('stratege', 5, 'tranquille');
    let guard = 0;
    while (s.alive.length === 0 && guard++ < 100) s.update(0.1);
    const m = s.alive[0];
    const ans = String(m.expr.answer);
    // Un chiffre qui ne commence aucune réponse : erreur.
    const bad = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].find((d) => !s.alive.some((o) => String(o.expr.answer).startsWith(d)))!;
    expect(s.input(bad).kind).toBe('error');
    expect(s.typed).toBe('');
    expect(s.combo).toBe(0);
    if (ans.length > 1) expect(s.input(ans[0]).kind).toBe('pending');
    else s.typed = '';
    s.typed = '';
    const r = [...ans].map((d) => s.input(d)).pop()!;
    expect(r.kind).toBe('hit');
    expect(s.combo).toBe(1);
  });

  it('le météore doré fait exploser tous les autres', () => {
    const s = new MeteorSession('explorateur', 8, 'tranquille');
    let gold;
    for (let k = 0; k < 2000 && !gold; k++) {
      s.update(0.1);
      gold = s.alive.find((m) => m.kind === 'dore');
    }
    expect(gold).toBeDefined();
    const others = s.alive.length - 1;
    let r;
    for (const d of String(gold!.expr.answer)) r = s.input(d);
    expect(r!.kind).toBe('hit');
    if (r!.kind === 'hit') expect(r!.destroyed.length).toBe(others + 1);
    expect(s.alive.length).toBe(0);
  });
});
