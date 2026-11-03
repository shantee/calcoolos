import { describe, expect, it } from 'vitest';
import { MAX_ERRORS, MAX_SLOTS, PASSES_PER_GAME, POWERS, PUSH, PowerUps, flightMs, freezeMs, pushTarget, type UseContext } from '../src/game/siege/powerups';
import { SiegeSession } from '../src/game/siege/session';
import { OPERATIONS } from '../src/core/calculs';
import { lire } from './outils-calculs';
import { TIERS, type TierId } from '../src/core/difficulty';
import { WAVES } from '../src/core/waves';

const TIER_IDS = Object.keys(TIERS) as TierId[];
const ready: UseContext = { enemyX: 800, entering: false, frozen: false, pushing: false, charged: false };

/** Répond juste au calcul de l'engin en cours. */
function answer(p: PowerUps): string {
  let last = '';
  for (const d of String(p.flight!.expr.answer)) last = p.type(d);
  return last;
}

describe('passages des engins', () => {
  it('deux passages par partie, le premier en vague 2, le second en vague 3 ou 4', () => {
    const w1 = WAVES[0].length;
    const w2 = w1 + WAVES[1].length;
    const total = WAVES.flat().length;
    for (let seed = 1; seed < 300; seed++) {
      const p = new PowerUps('ce1', 'defi', seed);
      expect(p.plan).toHaveLength(PASSES_PER_GAME);
      expect(p.plan[0]).toBeGreaterThanOrEqual(w1);
      expect(p.plan[0]).toBeLessThan(w2);
      expect(p.plan[1]).toBeGreaterThanOrEqual(w2);
      expect(p.plan[1]).toBeLessThan(total);
    }
  });

  it('aucun passage avant le monstre prévu, ni au-delà du nombre prévu', () => {
    const p = new PowerUps('cp', 'tranquille', 7);
    expect(p.due(p.plan[0] - 1)).toBe(false);
    expect(p.due(p.plan[0])).toBe(true);
    // Si le monstre prévu disparaît trop vite, le passage reste dû pour les suivants.
    expect(p.due(p.plan[0] + 1)).toBe(true);
    for (let k = 0; k < PASSES_PER_GAME; k++) {
      expect(p.launch()).not.toBeNull();
      p.expire();
      p.endFlight();
    }
    expect(p.due(99)).toBe(false);
    expect(p.launch()).toBeNull();
  });

  it('un seul engin à la fois', () => {
    const p = new PowerUps('ce2', 'defi', 3);
    expect(p.launch()).not.toBeNull();
    expect(p.due(99)).toBe(false);
    expect(p.launch(true)).toBeNull();
  });

  it('calculs justes, adaptés au niveau et jamais triviaux', () => {
    for (const tier of TIER_IDS) {
      for (let seed = 1; seed < 400; seed++) {
        const p = new PowerUps(tier, 'defi', seed);
        const f = p.launch(true)!;
        const e = f.expr;
        expect(lire(e.text).valeur, e.text).toBe(e.answer);
        expect(OPERATIONS[tier]).toContain(e.op);
        expect(e.a).toBeGreaterThan(1);
        expect(e.b).toBeGreaterThan(1);
        expect(e.answer).toBeGreaterThanOrEqual(5);
        // Le bonus passe vite : un calcul acquis ou du cœur de l'année, jamais de découverte.
        expect(e.palier).toBeLessThanOrEqual(2);
        if (tier === 'cp') expect(e.answer).toBeLessThanOrEqual(100);
      }
    }
  });

  it('durée : 5,5 à 11 secondes selon l’effort du calcul et la classe, plus longue en Tranquille', () => {
    for (const tier of TIER_IDS) {
      expect(flightMs(tier, 'tranquille')).toBeGreaterThan(flightMs(tier, 'defi'));
      expect(flightMs(tier, 'defi', 3)).toBeGreaterThan(flightMs(tier, 'defi', 1));
      for (const mode of ['tranquille', 'defi'] as const) {
        for (const effort of [1, 2, 3]) {
          expect(flightMs(tier, mode, effort)).toBeGreaterThanOrEqual(5500);
          expect(flightMs(tier, mode, effort)).toBeLessThanOrEqual(11000);
        }
      }
    }
    expect(flightMs('cp', 'defi', 2)).toBeGreaterThan(flightMs('aventurier', 'defi', 2));
    expect(freezeMs('tranquille')).toBe(8000);
    expect(freezeMs('defi')).toBe(8000);
  });

  it('deux engins différents, et le premier chargement est la Super Poussée', () => {
    const p = new PowerUps('ce1', 'defi', 11);
    const a = p.launch(true)!;
    expect(a.cargo).toBe('poussee');
    expect(a.vehicle).toBe('soucoupe');
    p.expire();
    p.endFlight();
    // Raté : le suivant apporte encore la Super Poussée.
    const b = p.launch(true)!;
    expect(b.vehicle).toBe('dirigeable');
    expect(b.cargo).toBe('poussee');
  });
});

describe('réponse au calcul bonus', () => {
  it('bonne réponse : attrapé, puis rangé dans le premier emplacement libre', () => {
    const p = new PowerUps('ce1', 'defi', 5);
    p.launch(true);
    expect(answer(p)).toBe('caught');
    expect(p.collect()).toBe(0);
    expect(p.slots[0]).toBe('poussee');
    expect(p.caught).toBe(1);
  });

  it('un chiffre à la fois, effacement possible, rien d’autre n’est accepté', () => {
    let seed = 9;
    let p = new PowerUps('aventurier', 'defi', seed);
    while (p.launch(true)!.expr.answer < 10) p = new PowerUps('aventurier', 'defi', ++seed);
    const ans = String(p.flight!.expr.answer);
    expect(p.type('x')).toBe('ignored');
    expect(p.type(ans[0])).toBe('typing');
    expect(p.flight!.typed).toBe(ans[0]);
    expect(p.erase()).toBe(true);
    expect(p.erase()).toBe(false);
    expect(p.flight!.typed).toBe('');
  });

  it('mauvaise réponse : on peut réessayer une fois, puis l’engin s’enfuit (sans pénalité)', () => {
    const p = new PowerUps('ce2', 'defi', 21);
    const f = p.launch(true)!;
    // Même nombre de chiffres, dernier chiffre changé.
    const ans = String(f.expr.answer);
    const bad = ans.slice(0, -1) + String((Number(ans.at(-1)) + 1) % 10);
    let r = '';
    for (const d of bad) r = p.type(d);
    expect(r).toBe('wrong');
    expect(p.flight!.typed).toBe('');
    expect(MAX_ERRORS).toBe(2);
    for (const d of bad) r = p.type(d);
    expect(r).toBe('escaped');
    expect(p.flight!.state).toBe('escaped');
    expect(p.type('1')).toBe('ignored');
    expect(p.collect()).toBe(-1);
    expect(p.slots.every((s) => s === null)).toBe(true);
  });

  it('temps écoulé : rien n’est gagné, rien n’est perdu', () => {
    const p = new PowerUps('cp', 'tranquille', 2);
    p.launch(true);
    p.expire();
    expect(p.collect()).toBe(-1);
    p.endFlight();
    expect(p.flight).toBeNull();
  });
});

describe('emplacements', () => {
  it('deux emplacements au plus ; pleins = plus aucun engin, donc aucun bonus perdu', () => {
    const p = new PowerUps('ce1', 'tranquille', 4);
    for (let k = 0; k < MAX_SLOTS; k++) {
      p.launch(true);
      answer(p);
      expect(p.collect()).toBe(k);
      p.endFlight();
    }
    expect(p.slotsFull).toBe(true);
    expect(p.due(99)).toBe(false);
    expect(p.launch(true)).toBeNull();
    // Un bonus utilisé libère sa place.
    expect(p.check(0, ready).ok).toBe(true);
    expect(p.take(0)).toBe('poussee');
    expect(p.slotsFull).toBe(false);
    expect(p.launch(true)).not.toBeNull();
  });

  it('bonus inutilisable au mauvais moment : il est gardé, avec une explication', () => {
    const p = new PowerUps('ce1', 'defi', 4);
    p.slots[0] = 'poussee';
    p.slots[1] = 'gel';
    const no = (slot: number, ctx: Partial<UseContext>) => p.check(slot, { ...ready, ...ctx });
    expect(no(0, { enemyX: null }).ok).toBe(false);
    expect(no(0, { entering: true }).ok).toBe(false);
    expect(no(0, { pushing: true }).ok).toBe(false);
    expect(no(0, { enemyX: PUSH.farX - 20 }).ok).toBe(false);
    expect(no(1, { frozen: true }).ok).toBe(false);
    expect(no(1, {}).ok).toBe(true);
    const r = no(0, { enemyX: null });
    expect(r.ok === false && r.reason.length > 5).toBe(true);
    expect(p.slots).toEqual(['poussee', 'gel']);
    p.slots[0] = 'supertir';
    expect(no(0, { enemyX: null }).ok).toBe(true);
    expect(no(0, { charged: true }).ok).toBe(false);
    expect(p.check(1, { ...ready, frozen: false }).ok).toBe(true);
    p.slots[1] = null;
    expect(p.check(1, ready).ok).toBe(false);
  });

  it('chaque bonus a un nom et une explication', () => {
    for (const v of Object.values(POWERS)) {
      expect(v.name.length).toBeGreaterThan(2);
      expect(v.hint.length).toBeGreaterThan(10);
    }
  });
});

describe('Super Poussée et Méga-tir', () => {
  it('la Super Poussée renvoie vraiment le monstre au fond (le Roi à mi-chemin)', () => {
    expect(pushTarget(650, 'mordillon')).toBe(PUSH.farX);
    expect(pushTarget(700, 'carapacon')).toBe(PUSH.farX);
    const roi = pushTarget(650, 'roi');
    expect(roi).toBeGreaterThan(650 + 200);
    expect(roi).toBeLessThan(PUSH.farX);
    // Jamais vers l'avant.
    expect(pushTarget(PUSH.farX + 30, 'trotteur')).toBe(PUSH.farX + 30);
  });

  it('Méga-tir : le prochain coup réussi fait double dégâts, une seule fois', () => {
    const tier = TIERS.ce1;
    const a = new SiegeSession(tier, 42, 'defi');
    const b = new SiegeSession(tier, 42, 'defi');
    for (const s of [a, b]) s.nextEnemy(0);
    b.charged = true;
    // Un raté ne consomme pas le Méga-tir.
    const wrong = b.round.cubes.findIndex((v) => v !== b.round.target);
    b.round.toggle(wrong);
    if (b.round.sum !== b.round.target) expect(b.validate(500).mega).toBe(false);
    b.round.clear();
    expect(b.charged).toBe(true);
    for (const s of [a, b]) s.round.puzzle.solution.forEach((i) => s.round.toggle(i));
    const ra = a.validate(2000);
    const rb = b.validate(2000);
    expect(rb.mega).toBe(true);
    expect(rb.damage).toBe(Math.min(ra.damage * 2, rb.damage));
    expect(rb.damage).toBe(ra.damage * 2);
    expect(b.charged).toBe(false);
    // Le score (points de calcul) ne change pas : seuls les dégâts doublent.
    expect(b.round.score).toBe(a.round.score);
  });

  it('les bonus ne changent pas la partie sans eux : victoire et score identiques', () => {
    const s = new SiegeSession(TIERS.ce2, 77, 'defi');
    let t = 0;
    for (;;) {
      if (!s.nextEnemy(t)) {
        if (!s.nextWave()) break;
        continue;
      }
      while (s.enemyHp > 0) {
        s.round.puzzle.solution.forEach((i) => s.round.toggle(i));
        t += 2000;
        s.validate(t);
      }
    }
    expect(s.phase).toBe('won');
    expect(s.charged).toBe(false);
  });
});
