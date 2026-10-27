import { describe, expect, it } from 'vitest';
import {
  BOOST,
  GRAVITY,
  LANE,
  FLY,
  MAX_LIVES,
  MISS_COST,
  MAX_VX,
  RocketSession,
  SUMMIT,
  buildWorld,
  timeFor,
  zoneAt,
  type Platform,
  type RocketEvent,
} from '../src/game/rocket/session';
import { makeExpression } from '../src/core/expressions';
import type { TierId } from '../src/core/difficulty';

const TIERS: TierId[] = ['eveil', 'explorateur', 'stratege', 'maitre'];
const APEX = (BOOST * BOOST) / (2 * GRAVITY);

/** Pilote automatique : vise une plateforme, freine avant d'arriver. */
function steerTo(s: RocketSession, target: Platform | undefined): -1 | 0 | 1 {
  if (!target) return 0;
  const r = s.rocket;
  const want = Math.max(-MAX_VX, Math.min(MAX_VX, (target.x - r.x) * 3));
  if (Math.abs(want - r.vx) < 25) return 0;
  return want > r.vx ? 1 : -1;
}

function answer(s: RocketSession): void {
  if (!s.question) return;
  for (const d of String(s.question.expr.answer)) s.input(d);
}

describe('monde vertical', () => {
  it('toujours le même monde pour une même graine', () => {
    expect(buildWorld(7)).toEqual(buildWorld(7));
    expect(buildWorld(7)).not.toEqual(buildWorld(8));
  });

  it('chaque plateforme est à portée d’une poussée, dans le couloir, et la planète est au sommet', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { platforms } = buildWorld(seed);
      expect(platforms[0].kind).toBe('sol');
      const top = platforms[platforms.length - 1];
      expect(top.kind).toBe('planete');
      expect(top.y).toBe(SUMMIT);
      for (let i = 1; i < platforms.length; i++) {
        const gap = platforms[i].y - platforms[i - 1].y;
        expect(gap).toBeGreaterThan(100);
        expect(gap).toBeLessThan(APEX - 40);
        const p = platforms[i];
        if (p.kind === 'planete') continue;
        expect(p.x - p.w / 2 - p.range).toBeGreaterThanOrEqual(LANE.x0 - 1);
        expect(p.x + p.w / 2 + p.range).toBeLessThanOrEqual(LANE.x1 + 61);
        if (p.kind === 'fragile') expect(p.power).toBeNull();
      }
      expect(platforms.length).toBeGreaterThan(30);
    }
  });

  it('les cinq étages se suivent', () => {
    expect(zoneAt(0)).toBe(0);
    expect(zoneAt(2000)).toBe(1);
    expect(zoneAt(4000)).toBe(2);
    expect(zoneAt(6000)).toBe(3);
    expect(zoneAt(7300)).toBe(4);
  });
});

describe('temps de réponse', () => {
  it('plus court pour les calculs simples, borné entre 3 et 13 s', () => {
    const easy = timeFor(makeExpression(4, '+', 3), 'explorateur', 'defi', 0);
    const table = timeFor(makeExpression(7, '×', 8), 'explorateur', 'defi', 0);
    const two = timeFor(makeExpression(2, '×', 6), 'explorateur', 'defi', 0);
    const div = timeFor(makeExpression(56, '÷', 8), 'explorateur', 'defi', 0);
    expect(easy).toBeLessThanOrEqual(4.5);
    expect(table).toBeGreaterThan(two);
    expect(div).toBeGreaterThan(table);
    expect(timeFor(makeExpression(4, '+', 3), 'eveil', 'tranquille', 0)).toBeGreaterThan(easy);
    expect(timeFor(makeExpression(7, '×', 8), 'explorateur', 'defi', SUMMIT)).toBeLessThan(table);
    for (const t of TIERS) expect(timeFor(makeExpression(199, '+', 1), t, 'tranquille', 0)).toBeLessThanOrEqual(13);
    expect(timeFor(makeExpression(1, '+', 1), 'maitre', 'defi', SUMMIT)).toBeGreaterThanOrEqual(3);
  });

  it('une à deux secondes de plus qu’avant : deux en Éveil ou en Tranquille', () => {
    // Avant (27/10/2026) : 4 + 3 = 3,8 s en Éveil Défi, 3,1 s en Explorateur Défi, 4,6 s en Explorateur Tranquille.
    expect(timeFor(makeExpression(4, '+', 3), 'eveil', 'defi', 0)).toBeGreaterThanOrEqual(5.8);
    expect(timeFor(makeExpression(4, '+', 3), 'explorateur', 'defi', 0)).toBeGreaterThanOrEqual(4.1);
    expect(timeFor(makeExpression(4, '+', 3), 'explorateur', 'tranquille', 0)).toBeGreaterThanOrEqual(6.6);
  });

  it('un calcul difficile laisse plus de temps qu’un facile du même genre', () => {
    // 15 + 3 (vert) et 13 − 8 (rouge, emprunt) en Éveil.
    expect(timeFor(makeExpression(13, '−', 8), 'eveil', 'defi', 0)).toBeGreaterThan(timeFor(makeExpression(15, '+', 3), 'eveil', 'defi', 0) + 1);
  });
});

describe('partie', () => {
  for (const tier of TIERS) {
    it(`${tier} : une seule poussée par plateforme suffit pour atteindre la planète (20 mondes)`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const s = new RocketSession(tier, seed * 37, 'defi');
        let guard = 0;
        while (s.phase === 'play' && guard++ < 60 * 900) {
          const on = s.platform(s.rocket.on);
          // Prochaine plateforme : la plus basse au-dessus de la dernière plateforme sûre.
          const safe = s.platform(s.safe)!;
          const target = s.platforms.filter((p) => !p.gone && p.y > safe.y).sort((a, b) => a.y - b.y)[0];
          if (on && s.question && guard % 20 === 0) answer(s);
          s.step(1 / 60, on ? 0 : steerTo(s, target));
        }
        expect(s.phase, `graine ${seed * 37}, altitude ${Math.round(s.best)}`).toBe('won');
        expect(s.stats.falls).toBe(0);
        expect(s.lives).toBeGreaterThanOrEqual(MAX_LIVES - 1);
      }
    });
  }

  it('sans réponse, la fusée reste au sol ; rien n’est perdu en Tranquille', () => {
    const s = new RocketSession('explorateur', 3, 'tranquille');
    let timeouts = 0;
    for (let i = 0; i < 60 * 90; i++) for (const e of s.step(1 / 60, 0)) if (e.type === 'timeout') timeouts++;
    expect(timeouts).toBeGreaterThan(5);
    expect(s.rocket.y).toBe(0);
    expect(s.phase).toBe('play');
    expect(s.lives).toBeNull();
    expect(s.accuracy()).toBe(0);
  });

  it('Défi : un calcul laissé filer coûte ½ cœur, 1 cœur s’il était vert ; attendre les faciles ne paie pas', () => {
    const s = new RocketSession('eveil', 3, 'defi');
    expect(s.lives).toBe(8);
    let lives = 8;
    let seen = 0;
    while (s.phase === 'play') {
      for (const e of s.step(1 / 60, 0)) {
        if (e.type !== 'timeout') continue;
        seen++;
        expect(e.lifeLost).toBe(Math.min(lives, MISS_COST[e.q.grade]));
        lives -= e.lifeLost;
        expect(s.lives).toBe(lives);
      }
    }
    expect(s.phase).toBe('lost');
    expect(s.lives).toBe(0);
    expect(seen).toBeGreaterThanOrEqual(8);
    expect(seen).toBeLessThanOrEqual(16);
  });

  it('une mauvaise réponse ne donne pas de poussée et casse la série', () => {
    const s = new RocketSession('stratege', 4, 'defi');
    while (!s.question) s.step(1 / 60, 0);
    answer(s);
    expect(s.combo).toBe(1);
    expect(s.rocket.on).toBeNull();
    for (let i = 0; i < 300; i++) s.step(1 / 60, 0);
    while (!s.question) s.step(1 / 60, 0);
    const wrong = String((s.question.expr.answer + 1) % 10 === s.question.expr.answer % 10 ? s.question.expr.answer + 2 : s.question.expr.answer + 1);
    let r;
    for (const d of wrong.padStart(String(s.question.expr.answer).length, '9').slice(0, String(s.question.expr.answer).length)) r = s.input(d);
    expect(r?.kind).toBe('wrong');
    expect(s.combo).toBe(0);
    expect(s.stats.wrong).toBe(1);
    expect(r?.kind === 'wrong' && r.lifeLost).toBeGreaterThan(0);
    expect(s.lives).toBe(MAX_LIVES - (r?.kind === 'wrong' ? r.lifeLost : 0));
  });

  it('tomber dans le vide coûte une vie en Défi (le bouclier protège), jamais en Tranquille', () => {
    for (const mode of ['defi', 'tranquille'] as const) {
      const s = new RocketSession('explorateur', 5, mode);
      const fallFrom = (p: Platform) => {
        s.rocket.x = FLY.x0;
        s.rocket.y = p.y + 5;
        s.rocket.on = null;
        s.safe = p.id;
        const evs: RocketEvent[] = [];
        for (let i = 0; i < 60 * 8 && !evs.some((e) => e.type === 'fall'); i++) evs.push(...s.step(1 / 60, -1));
        return evs.find((e) => e.type === 'fall');
      };
      const p = s.platforms[12];
      const first = fallFrom(p);
      expect(first).toBeDefined();
      expect(s.rocket.on).toBe(p.id);
      if (mode === 'defi') {
        expect(s.lives).toBe(7);
        s.shield = true;
        fallFrom(p);
        expect(s.lives).toBe(7);
        expect(s.shield).toBe(false);
        s.lives = 1;
        fallFrom(p);
        expect(s.phase).toBe('lost');
      } else {
        expect(s.lives).toBeNull();
        expect(s.phase).toBe('play');
      }
    }
  });

  it('bonus : turbo, sablier, bouclier, cœur', () => {
    const s = new RocketSession('eveil', 9, 'defi');
    s.lives = 5;
    const p = s.platforms[3];
    for (const kind of ['turbo', 'sablier', 'bouclier', 'coeur'] as const) {
      p.power = kind;
      s.rocket.x = p.x;
      s.rocket.y = p.y + 30;
      s.rocket.vy = -100;
      s.rocket.on = null;
      for (let i = 0; i < 30 && s.rocket.on === null; i++) s.step(1 / 60, 0);
    }
    expect(s.turbo).toBe(true);
    expect(s.slow).toBeGreaterThanOrEqual(4);
    expect(s.shield).toBe(true);
    expect(s.lives).toBe(6);
    while (!s.question) s.step(1 / 60, 0);
    expect(s.question.time).toBeGreaterThan(timeFor(s.question.expr, 'eveil', 'defi', s.altitude));
    answer(s);
    expect(s.rocket.vy).toBeGreaterThan(BOOST);
  });

  it('atterrissage brutal : seulement après une chute de plus de deux étages (Défi : −1 cœur)', () => {
    const s = new RocketSession('explorateur', 6, 'defi');
    const land = (from: number, p: Platform) => {
      s.rocket.x = p.x;
      s.rocket.y = from;
      s.rocket.vy = 0;
      s.rocket.on = null;
      (s as unknown as { peak: number }).peak = from;
      const evs: RocketEvent[] = [];
      for (let i = 0; i < 60 * 4 && s.rocket.on === null; i++) evs.push(...s.step(1 / 60, 0));
      return evs.find((e) => e.type === 'land');
    };
    const p = s.platforms[5];
    const small = land(p.y + 300, p);
    expect(small && small.type === 'land' && small.hard).toBe(false);
    expect(s.lives).toBe(8);
    // Grande chute, droit au-dessus de la plateforme (rien entre les deux).
    s.platforms.filter((q) => q.y > p.y).forEach((q) => (q.gone = true));
    const big = land(p.y + 600, p);
    expect(big && big.type === 'land' && big.hard).toBe(true);
    expect(s.lives).toBe(7);
  });

  it('plateforme fragile : elle tombe peu après qu’on s’y est posé', () => {
    const s = new RocketSession('maitre', 11, 'tranquille');
    const p = s.platforms.find((x) => x.kind === 'fragile')!;
    expect(p).toBeDefined();
    s.rocket.x = p.x;
    s.rocket.y = p.y + 20;
    s.rocket.on = null;
    s.safe = p.id;
    const evs: RocketEvent[] = [];
    for (let i = 0; i < 60 * 3; i++) evs.push(...s.step(1 / 60, 0));
    expect(evs.some((e) => e.type === 'land')).toBe(true);
    expect(evs.some((e) => e.type === 'crumble')).toBe(true);
    expect(p.gone).toBe(true);
    // Elle se reforme : on n'est jamais coincé.
    for (let i = 0; i < 60 * 5; i++) evs.push(...s.step(1 / 60, 0));
    expect(evs.some((e) => e.type === 'regrow')).toBe(true);
    expect(p.gone).toBe(false);
  });
});
