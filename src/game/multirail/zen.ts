// Le Voyage Zen : calcul mental varié, celui de la grille commune du niveau (additions et soustractions au CP, les
// quatre opérations à partir du CE2, calculs en plusieurs étapes au CM2), temps de réflexion généreux. Les outils
// d'écriture (Expr, evaluate, format…) servent au calcul mental combiné de l'Aventurier (explosif.ts).
import { clamp, type Rng } from './model';
import type { TierId } from '../../core/difficulty';
import type { Rng as RngCommun } from '../../core/rng';
import { TirageCalculs, tempsDeReflexion } from '../../core/calculs';

export type Op = '+' | '−' | '×' | '÷';
export type Expr = number | { op: Op; l: Expr; r: Expr };

/** aucun nombre affiché, aucune étape ni aucun résultat ne dépasse cette limite */
export const ZEN_MAX = 500;

export interface ZenProblem {
  /** écriture affichée, avec parenthèses : « 27 + 33 + (2 × 6) » */
  text: string;
  answer: number;
  /** niveau de 1 (facile) à 5 (corsé) */
  tier: number;
  /** nombre d'opérations */
  ops: number;
  /** temps de réflexion accordé (s) */
  think: number;
  /** calcul d'une seule opération × ou ÷ : le fait de table travaillé (relevé de Calcoolos) */
  fait?: { op: '×' | '÷'; a: number; b: number };
}

/** dans Calcoolos, le niveau du Voyage Zen est celui de la plateforme */
export type ZenLevel = TierId;

/** Texte court de chaque niveau dans le Voyage Zen (écran titre). */
export const ZEN_LEVELS: Record<ZenLevel, { label: string; hint: string }> = {
  cp: { label: 'CP', hint: 'Additions et soustractions jusqu’à 100' },
  ce1: { label: 'CE1', hint: 'Jusqu’à 1 000, premières tables' },
  ce2: { label: 'CE2', hint: 'Les quatre opérations' },
  cm1: { label: 'CM1', hint: 'Grands nombres, × 25, distributivité' },
  cm2: { label: 'CM2', hint: 'Calculs en plusieurs étapes' },
  aventurier: { label: 'Aventurier', hint: 'Calcul mental combiné, pour aller plus loin' },
};

/** Le Voyage Zen laisse plus de temps qu'un jeu chronométré : la menace y est la pression, pas le vide. */
export const LARGESSE_ZEN = 2;

/** Écart entre les paliers de la grille commune (1 à 3) et les niveaux de points du Voyage Zen (1 à 5). */
const DECALAGE_POINTS: Record<TierId, number> = { cp: 0, ce1: 0, ce2: 1, cm1: 1, cm2: 2, aventurier: 2 };

// ---------------------------------------------------------------- évaluation et écriture

/** valeur d'une expression, ou null si une étape sort des règles (négatif, > 500, division non exacte…) */
export function evaluate(e: Expr): number | null {
  if (typeof e === 'number') return Number.isInteger(e) && e >= 0 && e <= ZEN_MAX ? e : null;
  const a = evaluate(e.l);
  const b = evaluate(e.r);
  if (a === null || b === null) return null;
  let v: number;
  if (e.op === '+') v = a + b;
  else if (e.op === '−') v = a - b;
  else if (e.op === '×') v = a * b;
  else {
    if (b === 0 || a % b !== 0) return null;
    v = a / b;
  }
  return v >= 0 && v <= ZEN_MAX ? v : null;
}

const additive = (op: Op): boolean => op === '+' || op === '−';

/**
 * écriture sans ambiguïté : une chaîne d'additions et de soustractions se lit de gauche à droite sans parenthèses ;
 * toute autre opération imbriquée est mise entre parenthèses, même quand la priorité la rendrait facultative.
 */
export function format(e: Expr, top = true): string {
  if (typeof e === 'number') return String(e);
  const left = typeof e.l !== 'number' && additive(e.l.op) && additive(e.op) ? format(e.l, true) : format(e.l, false);
  const s = `${left} ${e.op} ${format(e.r, false)}`;
  return top ? s : `(${s})`;
}

export function countOps(e: Expr): number {
  return typeof e === 'number' ? 0 : 1 + countOps(e.l) + countOps(e.r);
}

export function numbers(e: Expr): number[] {
  return typeof e === 'number' ? [e] : [...numbers(e.l), ...numbers(e.r)];
}

/** opérations sans intérêt : × 1, ÷ 1, + 0, résultat nul… */
export function boring(e: Expr): boolean {
  if (typeof e === 'number') return false;
  const r = typeof e.r === 'number' ? e.r : null;
  const l = typeof e.l === 'number' ? e.l : null;
  if ((e.op === '×' || e.op === '÷') && (r === 1 || l === 1)) return true;
  if (r === 0 || l === 0) return true;
  if (evaluate(e) === 0) return true;
  return boring(e.l) || boring(e.r);
}

// ---------------------------------------------------------------- rythme

/**
 * Calculs du Voyage Zen, du CP au CM2 : ceux de la grille commune du niveau (core/calculs.ts, doc/NIVEAUX_SCOLAIRES.md),
 * avec sa montée vers un plateau, sa respiration après un calcul de découverte et son recul après des erreurs. Le
 * temps de réflexion vient de l'effort du calcul, en plus large qu'un jeu chronométré. L'Aventurier a son propre
 * paquet de calcul mental combiné (explosif.ts).
 */
export class ZenDeck {
  private tirage: TirageCalculs;

  constructor(
    readonly level: ZenLevel,
    rng: Rng,
  ) {
    this.tirage = new TirageCalculs(level, versRng(rng));
  }

  get asked(): number {
    return this.tirage.n;
  }

  next(): ZenProblem {
    const c = this.tirage.suivant();
    const think = clamp(Math.round(tempsDeReflexion(c, this.level) * LARGESSE_ZEN * 2) / 2, 6, 30);
    const p: ZenProblem = { text: c.text, answer: c.answer, tier: c.palier + DECALAGE_POINTS[this.level], ops: c.ops, think };
    if (c.ops === 1 && (c.op === '×' || c.op === '÷')) p.fait = { op: c.op, a: c.a, b: c.b };
    return p;
  }

  /** résultat d'un calcul (la rapidité ne change rien : on ne presse pas dans le Voyage Zen) */
  record(correct: boolean, _quick?: boolean): void {
    this.tirage.resultat(correct);
  }
}

/** le hasard de MULTIRAIL (une fonction) sous la forme attendue par la grille commune */
function versRng(r: Rng): RngCommun {
  return {
    next: r,
    int: (min, max) => min + Math.floor(r() * (max - min + 1)),
    pick: (xs) => xs[Math.floor(r() * xs.length)],
  };
}

// ---------------------------------------------------------------- pression

/** trois soupapes : quand les trois sifflent, un wagon saute (ou Bouillotte tombe) */
export const PRESSURE_MAX = 3;
/** à l'arrêt au bord du vide, la pression monte d'un cran toutes les… (s) */
export const PRESSURE_WAIT = 8;

/** points d'un calcul réussi : niveau, petite prime de rapidité, régularité */
export function zenPoints(tier: number, seconds: number, think: number, streak: number, boiling: boolean): number {
  const quick = clamp(1 - seconds / think, 0, 1);
  const series = streak >= 10 ? 2 : streak >= 5 ? 1.5 : 1;
  return Math.round(((60 + 40 * tier) * (1 + 0.2 * quick) * series * (boiling ? 2 : 1)) / 10) * 10;
}

/** points de voyage : 500 par kilomètre */
export const travelPoints = (meters: number): number => Math.floor(meters / 10) * 5;
