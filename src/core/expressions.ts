/**
 * Calculs des jeux d'arcade (Pluie de météores, bonus de Panique au phare !, logo) : une façade sur la grille commune
 * de calculs.ts. Tous les résultats sont des entiers de 1 à 999, et aucune réponse tirée n'entre en conflit avec
 * celles déjà à l'écran (aucune n'est le début d'une autre).
 */
import type { Rng } from './rng';
import type { TierId } from './difficulty';
import { PART_PLATEAU, tirerCalcul, type Calcul, type Op, type Palier } from './calculs';

export type { Op } from './calculs';
export type Expression = Calcul;

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

/** Deux réponses entrent en conflit si l'une est le début de l'autre (ex. 3 et 36). */
export function conflicts(x: number, y: number): boolean {
  const s = String(x);
  const t = String(y);
  return s.startsWith(t) || t.startsWith(s);
}

/** Palier tiré selon les parts du plateau (calcul isolé, sans suite de partie). */
export function palierAuHasard(rng: Rng): Palier {
  let x = rng.next();
  for (const p of [1, 2, 3] as Palier[]) {
    x -= PART_PLATEAU[p];
    if (x < 0) return p;
  }
  return 3;
}

/**
 * Un calcul du niveau dont la réponse n'entre en conflit avec aucune des réponses déjà à l'écran : taper une réponse
 * ne peut jamais en déclencher une autre.
 */
export function pickExpression(tier: TierId, rng: Rng, active: readonly number[] = [], palier: Palier = palierAuHasard(rng)): Expression {
  return tirerCalcul(tier, palier, rng, (c) => active.some((x) => conflicts(x, c.answer)));
}

/** Fait de table à verser au relevé : seulement pour un calcul à une opération (7 × 8, 56 ÷ 7). */
export function faitDe(e: Expression): Expression | undefined {
  return e.ops === 1 ? e : undefined;
}
