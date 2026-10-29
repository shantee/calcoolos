// Le Voyage Zen : calcul mental varié (additions, soustractions, multiplications, divisions exactes, calculs
// en plusieurs étapes), difficulté en vagues qui ne monte pas avec la distance, temps de réflexion généreux.
import { clamp, type Rng } from './model';
import type { TierId } from '../../core/difficulty';

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

export const ZEN_LEVELS: Record<ZenLevel, { label: string; hint: string; base: number; time: number }> = {
  eveil: { label: 'Éveil', hint: 'Petits calculs', base: 1, time: 1.4 },
  explorateur: { label: 'Explorateur', hint: 'Calculs simples', base: 1.8, time: 1.25 },
  stratege: { label: 'Stratège', hint: 'Un peu de tout', base: 2.6, time: 1.1 },
  maitre: { label: 'Maître', hint: 'Pour les têtes bien faites', base: 3.5, time: 1 },
};

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

function countOps(e: Expr): number {
  return typeof e === 'number' ? 0 : 1 + countOps(e.l) + countOps(e.r);
}

function numbers(e: Expr): number[] {
  return typeof e === 'number' ? [e] : [...numbers(e.l), ...numbers(e.r)];
}

/** opérations sans intérêt : × 1, ÷ 1, + 0, résultat nul… */
function boring(e: Expr): boolean {
  if (typeof e === 'number') return false;
  const r = typeof e.r === 'number' ? e.r : null;
  const l = typeof e.l === 'number' ? e.l : null;
  if ((e.op === '×' || e.op === '÷') && (r === 1 || l === 1)) return true;
  if (r === 0 || l === 0) return true;
  if (evaluate(e) === 0) return true;
  return boring(e.l) || boring(e.r);
}

// ---------------------------------------------------------------- familles de calculs

const ri = (rng: Rng, a: number, b: number): number => a + Math.floor(rng() * (b - a + 1));
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const N = (op: Op, l: Expr, r: Expr): Expr => ({ op, l, r });

/** produit d'une table (2..max) */
function mul(rng: Rng, max = 10): Expr {
  return N('×', ri(rng, 2, max), ri(rng, 2, 10));
}

/** division exacte : (d × q) ÷ d */
function div(rng: Rng, dMax = 10, qMax = 10): Expr {
  const d = ri(rng, 2, dMax);
  const q = ri(rng, 2, qMax);
  return N('÷', d * q, d);
}

type Family = (rng: Rng) => Expr;

/** familles classées par niveau : chaque niveau puise dans les siennes */
const FAMILIES: Record<number, Family[]> = {
  1: [
    (r) => N('+', ri(r, 11, 49), ri(r, 3, 40)),
    (r) => N('−', ri(r, 20, 90), ri(r, 3, 19)),
    (r) => mul(r, 9),
    (r) => div(r, 9, 9),
    (r) => N('+', 10 * ri(r, 2, 15), 10 * ri(r, 1, 12)),
  ],
  2: [
    // avec retenue : 88 + 77
    (r) => N('+', ri(r, 35, 95), ri(r, 26, 89)),
    (r) => N('−', ri(r, 61, 160), ri(r, 17, 59)),
    (r) => N('×', ri(r, 11, 25), ri(r, 2, 5)),
    (r) => div(r, 10, 12),
    (r) => N('+', N('+', ri(r, 11, 49), ri(r, 11, 49)), ri(r, 5, 30)),
  ],
  3: [
    // compléments : 27 + 33 + 15
    (r) => { const a = ri(r, 12, 88); return N('+', N('+', a, 10 * ri(r, Math.ceil(a / 10), 12) - a), ri(r, 6, 45)); },
    (r) => N('+', mul(r), ri(r, 8, 60)),
    (r) => N('−', mul(r), ri(r, 3, 20)),
    (r) => N('+', div(r, 9, 12), ri(r, 11, 60)),
    (r) => N('+', ri(r, 120, 380), ri(r, 25, 99)),
    (r) => N('−', ri(r, 150, 420), ri(r, 26, 99)),
    (r) => div(r, 12, 15),
  ],
  4: [
    // 27 + 33 + (2 × 6)
    (r) => N('+', N('+', ri(r, 12, 60), ri(r, 12, 60)), mul(r)),
    // (9 × 8) − 13
    (r) => N('−', mul(r), ri(r, 11, 39)),
    // (84 ÷ 7) + 25
    (r) => N('+', div(r, 12, 12), ri(r, 15, 80)),
    (r) => N('+', mul(r), mul(r)),
    (r) => N('−', ri(r, 60, 200), mul(r)),
    (r) => N('×', ri(r, 13, 40), ri(r, 3, 9)),
  ],
  5: [
    // (240 ÷ 6) + 36
    (r) => N('+', div(r, 12, 40), ri(r, 15, 99)),
    (r) => N('−', mul(r), div(r, 9, 9)),
    (r) => N('×', N('+', ri(r, 4, 25), ri(r, 3, 20)), ri(r, 2, 9)),
    (r) => N('−', N('+', ri(r, 40, 180), ri(r, 25, 120)), mul(r)),
    (r) => N('+', mul(r), N('÷', 10 * ri(r, 2, 20), 10)),
    (r) => N('×', div(r, 8, 8), ri(r, 3, 9)),
  ],
};

/** temps de réflexion (s) : généreux, et d'autant plus que le calcul a d'étapes */
export function thinkTime(tier: number, ops: number, timeFactor = 1): number {
  return Math.round((6 + tier * 2.6 + (ops - 1) * 4) * timeFactor * 2) / 2;
}

/** un calcul valide du niveau demandé (jamais faux, jamais au-delà de 500, jamais de reste) */
export function generate(tier: number, rng: Rng, timeFactor = 1): ZenProblem {
  const t = clamp(Math.round(tier), 1, 5);
  const fams = FAMILIES[t];
  for (let i = 0; i < 200; i++) {
    const e = pick(rng, fams)(rng);
    const v = evaluate(e);
    if (v === null || v < 2 || boring(e)) continue;
    if (numbers(e).some((n) => n > ZEN_MAX)) continue;
    const ops = countOps(e);
    const p: ZenProblem = { text: format(e), answer: v, tier: t, ops, think: thinkTime(t, ops, timeFactor) };
    if (typeof e !== 'number' && (e.op === '×' || e.op === '÷') && typeof e.l === 'number' && typeof e.r === 'number') p.fait = { op: e.op, a: e.l, b: e.r };
    return p;
  }
  // repli (en pratique jamais atteint) : une multiplication simple
  const a = ri(rng, 2, 9), b = ri(rng, 2, 9);
  return { text: `${a} × ${b}`, answer: a * b, tier: 1, ops: 1, think: thinkTime(1, 1, timeFactor) };
}

// ---------------------------------------------------------------- rythme

/** une vague : concentration, montée, sommet, puis respiration — elle ne dépend pas de la distance */
export const WAVE = [0, 0.5, 1, -0.5, 0, 1.5, -1, 0.5, -1.5];

/**
 * choisit le niveau de chaque calcul : niveau de base du joueur + vague + adaptation douce à ses résultats récents.
 * Un calcul difficile est toujours suivi d'un plus facile ; deux erreurs d'affilée offrent une respiration.
 */
export class ZenDeck {
  /** adaptation : de -1,5 (on souffle) à +1 (le joueur est à l'aise) */
  adapt = 0;
  asked = 0;
  private lastTier = 0;
  private wrongRow = 0;

  constructor(
    readonly level: ZenLevel,
    private rng: Rng,
  ) {}

  nextTier(): number {
    const base = ZEN_LEVELS[this.level].base;
    let t = Math.round(base + WAVE[this.asked % WAVE.length] + this.adapt);
    // on entre doucement dans le voyage
    if (this.asked < 2) t -= 1;
    if (this.wrongRow >= 2) t = Math.min(t, Math.floor(base - 0.5));
    if (this.lastTier >= 4) t = Math.min(t, this.lastTier - 1);
    return clamp(t, 1, 5);
  }

  next(): ZenProblem {
    const tier = this.nextTier();
    this.asked++;
    this.lastTier = tier;
    return generate(tier, this.rng, ZEN_LEVELS[this.level].time);
  }

  /** résultat d'un calcul : `quick` = réussi en moins de la moitié du temps accordé */
  record(correct: boolean, quick: boolean): void {
    if (correct) {
      this.wrongRow = 0;
      this.adapt = Math.min(1, this.adapt + (quick ? 0.25 : 0.1));
    } else {
      this.wrongRow++;
      this.adapt = Math.max(-1.5, this.adapt - 0.6);
    }
  }
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
