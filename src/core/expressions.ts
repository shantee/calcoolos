/**
 * Générateur de calculs pour les jeux d'arcade (« Pluie de météores »).
 * Chaque palier a son menu d'opérations ; tous les résultats sont des entiers
 * positifs ou nuls, et chaque calcul se vérifie (voir tests).
 */
import type { Rng } from './rng';
import type { TierId } from './difficulty';

export type Op = '+' | '−' | '×' | '÷';

export interface Expression {
  a: number;
  b: number;
  op: Op;
  answer: number;
  /** Texte affiché, avec espaces fines autour de l'opérateur. */
  text: string;
}

interface OpRule {
  op: Op;
  weight: number;
  make(rng: Rng): [number, number];
}

const add = (max: number, min = 1): OpRule => ({
  op: '+',
  weight: 3,
  make: (rng) => {
    const a = rng.int(min, max - min);
    return [a, rng.int(min, max - a)];
  },
});

const sub = (max: number): OpRule => ({
  op: '−',
  weight: 2,
  make: (rng) => {
    const a = rng.int(3, max);
    return [a, rng.int(1, a - 1)];
  },
});

const mul = (tables: number[], maxFactor: number): OpRule => ({
  op: '×',
  weight: 4,
  make: (rng) => {
    const t = rng.pick(tables);
    const k = rng.int(2, maxFactor);
    return rng.next() < 0.5 ? [t, k] : [k, t];
  },
});

const div = (tables: number[], maxQuotient: number): OpRule => ({
  op: '÷',
  weight: 2,
  make: (rng) => {
    const t = rng.pick(tables);
    const q = rng.int(2, maxQuotient);
    return [t * q, t];
  },
});

export const MENUS: Record<TierId, OpRule[]> = {
  eveil: [add(20), sub(20)],
  explorateur: [add(50, 2), sub(50), mul([2, 5, 10], 10)],
  stratege: [add(100, 5), sub(100), mul([2, 3, 4, 5, 6, 7, 8, 9], 9), div([2, 3, 4, 5, 6, 7, 8, 9], 9)],
  maitre: [add(200, 10), sub(200), mul([3, 4, 6, 7, 8, 9, 11, 12], 12), div([3, 4, 6, 7, 8, 9, 11, 12], 12)],
};

export function evaluate(a: number, op: Op, b: number): number {
  switch (op) {
    case '+':
      return a + b;
    case '−':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return a / b;
  }
}

export function makeExpression(a: number, op: Op, b: number): Expression {
  return { a, b, op, answer: evaluate(a, op, b), text: `${a} ${op} ${b}` };
}

/** Deux réponses entrent en conflit si l'une est le début de l'autre (ex. 3 et 36). */
export function conflicts(x: number, y: number): boolean {
  const s = String(x);
  const t = String(y);
  return s.startsWith(t) || t.startsWith(s);
}

/**
 * Tire un calcul du palier dont la réponse n'entre en conflit avec aucune des
 * réponses déjà à l'écran : taper une réponse ne peut jamais en déclencher une autre.
 */
export function pickExpression(tier: TierId, rng: Rng, active: readonly number[] = []): Expression {
  const menu = MENUS[tier];
  const total = menu.reduce((s, r) => s + r.weight, 0);
  let fallback: Expression | null = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    let roll = rng.next() * total;
    let rule = menu[0];
    for (const r of menu) {
      roll -= r.weight;
      if (roll <= 0) {
        rule = r;
        break;
      }
    }
    const [a, b] = rule.make(rng);
    const e = makeExpression(a, rule.op, b);
    fallback ??= e;
    if (active.every((x) => !conflicts(x, e.answer))) return e;
  }
  return fallback!;
}
