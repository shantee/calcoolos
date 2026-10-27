/**
 * Difficulté d'un calcul : facile (vert), moyen (orange) ou difficile (rouge).
 *
 * `effort()` estime le travail de tête demandé, indépendamment du niveau : une retenue,
 * un emprunt, deux nombres à deux chiffres, une table difficile (7 × 8) coûtent ; un
 * nombre rond, une table de 2, 5 ou 10, un carré aident. `gradeOf()` le traduit en
 * couleur selon le niveau du joueur : 13 − 7 est difficile en Éveil, facile en Maître.
 */
import type { Rng } from './rng';
import type { TierId } from './difficulty';
import { pickExpression, type Expression } from './expressions';

export type Grade = 'facile' | 'moyen' | 'difficile';
export const GRADES: readonly Grade[] = ['facile', 'moyen', 'difficile'];

/** Difficulté d'un fait de table, par facteur (7 et 8 sont les plus redoutés). */
const TABLE: Record<number, number> = { 1: 0, 2: 0, 10: 0, 5: 0.5, 11: 0.5, 3: 1, 4: 1.5, 9: 2, 6: 2.5, 7: 3, 8: 3, 12: 3.5 };

function tableFact(x: number, y: number): number {
  const fx = TABLE[x] ?? 3;
  const fy = TABLE[y] ?? 3;
  // Le petit facteur compte le plus (2 × 8, c'est la table de 2) ; les carrés se retiennent mieux.
  return Math.min(fx, fy) + 0.3 * Math.max(fx, fy) - (x === y ? 0.5 : 0);
}

export function effort(e: Expression): number {
  const { a, b } = e;
  switch (e.op) {
    case '+': {
      const carry = (a % 10) + (b % 10) >= 10;
      // Faire 10 (6 + 4, 18 + 2) : la retenue tombe juste ; les doubles se retiennent.
      const complement = carry && e.answer % 10 === 0;
      return (carry ? (complement ? 0.5 : 2) : 0) + (Math.min(a, b) >= 10 ? 1 : 0) + (e.answer > 20 ? 1 : 0) + (e.answer > 100 ? 1 : 0)
        - (a % 10 === 0 || b % 10 === 0 ? 1 : 0) - (a === b ? 1 : 0);
    }
    case '−': {
      const borrow = a % 10 < b % 10;
      // Enlever à un nombre rond (10 − 3, 40 − 6) : c'est un complément, plus simple qu'un emprunt.
      return 0.5 + (borrow ? (a % 10 === 0 ? 1 : 2) : 0) + (b >= 10 ? 1 : 0) + (a > 20 ? 1 : 0) + (a > 100 ? 1 : 0) - (b % 10 === 0 ? 1 : 0);
    }
    case '×':
      return tableFact(a, b);
    case '÷':
      return tableFact(b, e.answer) + 1;
  }
}

/** Seuils par niveau : en dessous du premier, facile ; en dessous du second, moyen ; sinon difficile. */
const THRESHOLDS: Record<TierId, [number, number]> = {
  eveil: [1, 2.5],
  explorateur: [1.5, 3.5],
  stratege: [2, 3.5],
  maitre: [2.5, 4],
};

export function gradeOf(e: Expression, tier: TierId): Grade {
  const x = effort(e);
  const [t1, t2] = THRESHOLDS[tier];
  return x < t1 ? 'facile' : x < t2 ? 'moyen' : 'difficile';
}

/** Part de chaque couleur, par niveau : surtout du vert pour les petits, toujours un peu de défi. */
export const GRADE_WEIGHTS: Record<TierId, Record<Grade, number>> = {
  eveil: { facile: 0.55, moyen: 0.3, difficile: 0.15 },
  explorateur: { facile: 0.45, moyen: 0.35, difficile: 0.2 },
  stratege: { facile: 0.4, moyen: 0.35, difficile: 0.25 },
  maitre: { facile: 0.35, moyen: 0.4, difficile: 0.25 },
};

/** Tire une couleur ; `harder` (0 à 1) fait glisser du vert vers le rouge (en altitude). */
export function pickGrade(tier: TierId, rng: Rng, harder = 0): Grade {
  const w = { ...GRADE_WEIGHTS[tier] };
  const shift = Math.min(w.facile - 0.15, harder * 0.15);
  w.facile -= shift;
  w.difficile += shift;
  let roll = rng.next();
  for (const g of GRADES) {
    roll -= w[g];
    if (roll < 0) return g;
  }
  return 'difficile';
}

/** Un calcul du niveau, de la couleur voulue (si le tirage n'y arrive pas, le plus proche). */
export function pickGraded(tier: TierId, rng: Rng, grade: Grade): Expression {
  const want = GRADES.indexOf(grade);
  let best: Expression | null = null;
  let bestGap = Infinity;
  for (let attempt = 0; attempt < 120; attempt++) {
    const e = pickExpression(tier, rng);
    const gap = Math.abs(GRADES.indexOf(gradeOf(e, tier)) - want);
    if (gap === 0) return e;
    if (gap < bestGap) {
      best = e;
      bestGap = gap;
    }
  }
  return best!;
}
