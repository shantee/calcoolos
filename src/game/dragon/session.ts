/**
 * « Le Dragon gourmand » : toute la logique, sans rendu.
 *
 * Un dragon-lanterne vole dans le ciel de l'archipel. Des lanternes portant un
 * nombre flottent autour de lui. Il doit en avaler pour atteindre EXACTEMENT le
 * nombre demandé (en additionnant, ou en multipliant aux niveaux avancés).
 * Les lanternes avalées restent visibles dans son corps : le calcul se fait de
 * tête, sans total affiché. S'il dépasse, il a le hoquet et recrache tout.
 *
 * Garanties :
 * - il y a toujours le même nombre de lanternes dans le ciel (une lanterne
 *   avalée est aussitôt remplacée ailleurs) ;
 * - chaque objectif est atteignable avec les lanternes présentes, et après
 *   chaque bouchée le reste à trouver l'est encore (au besoin, une lanterne
 *   lointaine change de valeur sans bruit) : on n'est jamais coincé.
 *
 * Les positions sont en pixels de la scène (1280 × 720) pour que le placement
 * des lanternes soit testé ici, pas dans le rendu.
 */
import { createRng, type Rng } from '../../core/rng';
import { minCubesTable } from '../../core/puzzle';
import type { TierId } from '../../core/difficulty';
import type { Mode } from '../../core/waves';

export type DragonOp = '+' | '×';

export interface Orb {
  id: number;
  value: number;
  x: number;
  y: number;
}

export interface Goal {
  target: number;
  op: DragonOp;
  /** Nombre minimal de lanternes possible au moment où l'objectif apparaît. */
  optimal: number;
}

interface OpRule {
  targetMin: number;
  targetMax: number;
  minOptimal: number;
  maxOptimal: number;
}

export interface DragonTier {
  orbs: number;
  minValue: number;
  maxValue: number;
  add: OpRule;
  mul: OpRule | null;
  /** Part des objectifs en multiplication (si `mul`). */
  mulShare: number;
  /** Secondes par objectif en mode Défi. */
  hunger: number;
}

export const DRAGON_TIERS: Record<TierId, DragonTier> = {
  eveil: { orbs: 6, minValue: 1, maxValue: 9, add: { targetMin: 6, targetMax: 15, minOptimal: 2, maxOptimal: 2 }, mul: null, mulShare: 0, hunger: 40 },
  explorateur: { orbs: 7, minValue: 1, maxValue: 12, add: { targetMin: 10, targetMax: 25, minOptimal: 2, maxOptimal: 3 }, mul: null, mulShare: 0, hunger: 34 },
  stratege: { orbs: 8, minValue: 2, maxValue: 10, add: { targetMin: 14, targetMax: 36, minOptimal: 2, maxOptimal: 3 }, mul: { targetMin: 12, targetMax: 90, minOptimal: 2, maxOptimal: 2 }, mulShare: 0.4, hunger: 30 },
  maitre: { orbs: 9, minValue: 2, maxValue: 12, add: { targetMin: 24, targetMax: 60, minOptimal: 2, maxOptimal: 4 }, mul: { targetMin: 24, targetMax: 240, minOptimal: 2, maxOptimal: 3 }, mulShare: 0.5, hunger: 27 },
};

export interface StagePlan {
  goals: number;
  /** Chauves-souris en même temps (0 = aucune). */
  bats: number;
  /** Nuages d'orage et éclairs. */
  storm: boolean;
}

/** Trois ciels : crépuscule, nuit (chauves-souris), orage. */
export const DRAGON_STAGES: readonly StagePlan[] = [
  { goals: 5, bats: 0, storm: false },
  { goals: 6, bats: 2, storm: false },
  { goals: 6, bats: 3, storm: true },
];

export const DRAGON_MODES: Record<Mode, { speed: number; hearts: number | null }> = {
  tranquille: { speed: 0.82, hearts: null },
  defi: { speed: 1, hearts: 3 },
};

/** Zone où flottent les lanternes (pixels de la scène). */
export const FIELD = { x0: 70, x1: 1210, y0: 165, y1: 600 };
const MIN_GAP = 104;
const AVOID_GAP = 190;

export interface Moves {
  /** Lanternes apparues. */
  added: Orb[];
  /** Lanternes disparues (ids). */
  removed: number[];
}

export type EatResult =
  | ({ kind: 'progress'; orb: Orb } & Moves)
  | ({ kind: 'complete'; orb: Orb; points: number; perfect: boolean; eaten: number[]; goal: Goal; next: Goal | null; stageUp: boolean; won: boolean } & Moves)
  | ({ kind: 'overshoot'; orb: Orb; spat: number[] } & Moves)
  | { kind: 'ignored' };

export interface Setback extends Moves {
  /** Valeurs recrachées (le ventre se vide). */
  spat: number[];
  heartLost: boolean;
  lost: boolean;
  next: Goal | null;
}

export type DragonEvent = { type: 'hungry'; setback: Setback };

export interface DragonStats {
  goals: number;
  perfect: number;
  overshoots: number;
  hurts: number;
  hungers: number;
  orbsEaten: number;
  bestCombo: number;
  batsBurned: number;
  bonuses: number;
  /** Par opération : [objectifs réussis, indigestions]. */
  byOp: Record<string, [number, number]>;
}

type Point = { x: number; y: number };

const dist2 = (a: Point, b: Point): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Pour chaque produit ≤ maxProduct : nombre minimal de lanternes distinctes (0/1). */
export function minFactorsTable(values: readonly number[], maxProduct: number): Map<number, number> {
  const best = new Map<number, number>([[1, 0]]);
  for (const v of values) {
    if (v < 1) throw new Error(`valeur invalide : ${v}`);
    for (const [p, n] of [...best]) {
      const q = p * v;
      if (q > maxProduct) continue;
      const cur = best.get(q);
      if (cur === undefined || n + 1 < cur) best.set(q, n + 1);
    }
  }
  return best;
}

export function combine(op: DragonOp, values: readonly number[]): number {
  return op === '+' ? values.reduce((a, b) => a + b, 0) : values.reduce((a, b) => a * b, 1);
}

/** Ce qui reste à trouver, ou null si l'objectif est déjà dépassé (impossible à atteindre). */
export function remainderOf(goal: Goal, belly: readonly number[]): number | null {
  const got = combine(goal.op, belly);
  if (goal.op === '+') return got <= goal.target ? goal.target - got : null;
  return goal.target % got === 0 ? goal.target / got : null;
}

/** Le reste est-il atteignable avec ces valeurs ? (un reste « neutre » vaut atteint). */
export function reachable(op: DragonOp, values: readonly number[], rest: number): boolean {
  if (op === '+') return rest === 0 || Number.isFinite(minCubesTable(values, rest)[rest]);
  return rest === 1 || minFactorsTable(values, rest).has(rest);
}

/** Objectifs possibles pour une opération, avec leur optimum. */
export function admissibleGoals(op: DragonOp, values: readonly number[], rule: OpRule): Goal[] {
  const out: Goal[] = [];
  if (op === '+') {
    const table = minCubesTable(values, rule.targetMax);
    for (let t = rule.targetMin; t <= rule.targetMax; t++) {
      const n = table[t];
      if (Number.isFinite(n) && n >= rule.minOptimal && n <= rule.maxOptimal) out.push({ target: t, op, optimal: n });
    }
  } else {
    for (const [t, n] of minFactorsTable(values, rule.targetMax)) {
      if (t >= rule.targetMin && n >= rule.minOptimal && n <= rule.maxOptimal) out.push({ target: t, op, optimal: n });
    }
    out.sort((a, b) => a.target - b.target);
  }
  return out;
}

export class DragonSession {
  readonly cfg: DragonTier;
  readonly rng: Rng;
  orbs: Orb[] = [];
  goal!: Goal;
  /** Valeurs avalées pour l'objectif en cours, dans l'ordre. */
  belly: number[] = [];
  score = 0;
  combo = 0;
  stage = 0;
  goalsInStage = 0;
  hearts: number | null;
  hunger = 0;
  phase: 'play' | 'won' | 'lost' = 'play';
  elapsed = 0;
  readonly stats: DragonStats = { goals: 0, perfect: 0, overshoots: 0, hurts: 0, hungers: 0, orbsEaten: 0, bestCombo: 0, batsBurned: 0, bonuses: 0, byOp: {} };
  private nextId = 1;
  private lastTarget = 0;

  constructor(
    readonly tier: TierId,
    seed: number,
    readonly mode: Mode,
    start: Point = { x: 640, y: 380 },
  ) {
    this.cfg = DRAGON_TIERS[tier];
    this.rng = createRng(seed);
    this.hearts = DRAGON_MODES[mode].hearts;
    for (let i = 0; i < this.cfg.orbs; i++) this.orbs.push(this.newOrb(this.randomValue(), start));
    this.goal = this.nextGoal(start, { added: [], removed: [] });
    this.hunger = this.cfg.hunger;
  }

  get plan(): StagePlan {
    return DRAGON_STAGES[Math.min(this.stage, DRAGON_STAGES.length - 1)];
  }

  get totalGoals(): number {
    return DRAGON_STAGES.reduce((a, s) => a + s.goals, 0);
  }

  /** Objectifs réussis depuis le début (pour la barre de progression). */
  get goalsDone(): number {
    return DRAGON_STAGES.slice(0, this.stage).reduce((a, s) => a + s.goals, 0) + this.goalsInStage;
  }

  /** Part des objectifs réussis sans indigestion. */
  accuracy(): number {
    const tries = this.stats.goals + this.stats.overshoots;
    return tries === 0 ? 1 : this.stats.goals / tries;
  }

  update(dt: number): DragonEvent[] {
    if (this.phase !== 'play') return [];
    this.elapsed += dt;
    if (this.mode !== 'defi') return [];
    this.hunger -= dt;
    if (this.hunger > 0) return [];
    this.stats.hungers++;
    const setback = this.setback({ x: 640, y: 380 }, true);
    return [{ type: 'hungry', setback }];
  }

  /** Le dragon avale la lanterne `id`. `head` : position de la tête (les nouvelles lanternes l'évitent). */
  eat(id: number, head: Point = { x: 640, y: 380 }): EatResult {
    if (this.phase !== 'play') return { kind: 'ignored' };
    const orb = this.orbs.find((o) => o.id === id);
    if (!orb) return { kind: 'ignored' };
    this.orbs = this.orbs.filter((o) => o !== orb);
    this.belly.push(orb.value);
    this.stats.orbsEaten++;
    // Le ciel garde toujours le même nombre de lanternes.
    const moves: Moves = { added: [], removed: [] };
    this.add(moves, this.newOrb(this.randomValue(), head));
    const rest = remainderOf(this.goal, this.belly);

    if (rest === null) {
      // Dépassé : hoquet, le ventre se vide ; l'objectif reste le même.
      this.stats.overshoots++;
      (this.stats.byOp[this.goal.op] ??= [0, 0])[1]++;
      this.combo = 0;
      const spat = this.belly;
      this.belly = [];
      this.keepReachable(this.goal.target, head, moves);
      return { kind: 'overshoot', orb, spat, ...moves };
    }

    const done = this.goal.op === '+' ? rest === 0 : rest === 1;
    if (!done) {
      this.keepReachable(rest, head, moves);
      return { kind: 'progress', orb, ...moves };
    }

    // Objectif atteint.
    const goal = this.goal;
    const eaten = this.belly;
    const perfect = eaten.length <= goal.optimal;
    this.belly = [];
    this.combo++;
    this.stats.goals++;
    (this.stats.byOp[goal.op] ??= [0, 0])[0]++;
    if (perfect) this.stats.perfect++;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    const comboMul = Math.min(2, 1 + 0.1 * (this.combo - 1));
    const speed = this.mode === 'defi' ? Math.round(Math.max(0, this.hunger) * 4) : 0;
    const points = Math.round((150 + 50 * eaten.length) * (perfect ? 1.5 : 1) * comboMul) + speed;
    this.score += points;
    this.goalsInStage++;
    let stageUp = false;
    let won = false;
    if (this.goalsInStage >= this.plan.goals) {
      this.stage++;
      this.goalsInStage = 0;
      stageUp = true;
      if (this.stage >= DRAGON_STAGES.length) {
        won = true;
        this.phase = 'won';
        this.score += 1000;
      }
    }
    let next: Goal | null = null;
    if (!won) {
      next = this.nextGoal(head, moves);
      this.hunger = this.cfg.hunger;
    }
    return { kind: 'complete', orb, points, perfect, eaten, goal, next, stageUp, won, ...moves };
  }

  /**
   * Touché par une chauve-souris ou un éclair : le ventre se vide, le combo
   * tombe, et en Défi un cœur est perdu. L'objectif reste le même.
   */
  hurt(head: Point = { x: 640, y: 380 }): Setback {
    if (this.phase !== 'play') return { spat: [], heartLost: false, lost: false, next: null, added: [], removed: [] };
    this.stats.hurts++;
    return this.setback(head, false);
  }

  /** Points bonus (gâteau de lune, chauve-souris brûlée…). */
  bonus(points: number, kind: 'bat' | 'cake' = 'cake'): void {
    if (this.phase === 'lost') return;
    this.score += points;
    if (kind === 'bat') this.stats.batsBurned++;
    else this.stats.bonuses++;
  }

  // --- interne ----------------------------------------------------------------------------------

  private add(moves: Moves, o: Orb): void {
    this.orbs.push(o);
    moves.added.push(o);
  }

  private remove(moves: Moves, id: number): void {
    this.orbs = this.orbs.filter((o) => o.id !== id);
    const i = moves.added.findIndex((o) => o.id === id);
    if (i >= 0) moves.added.splice(i, 1);
    else moves.removed.push(id);
  }

  private setback(head: Point, newGoal: boolean): Setback {
    this.combo = 0;
    const spat = this.belly;
    this.belly = [];
    let heartLost = false;
    if (this.hearts !== null) {
      this.hearts--;
      heartLost = true;
      if (this.hearts <= 0) {
        this.hearts = 0;
        this.phase = 'lost';
      }
    }
    const moves: Moves = { added: [], removed: [] };
    let next: Goal | null = null;
    if (this.phase === 'play') {
      if (newGoal) next = this.nextGoal(head, moves);
      else this.keepReachable(this.goal.target, head, moves);
      this.hunger = this.cfg.hunger;
    }
    return { spat, heartLost, lost: this.phase === 'lost', next, ...moves };
  }

  private randomValue(): number {
    const { minValue, maxValue, orbs } = this.cfg;
    const limit = Math.max(2, Math.ceil(orbs / 4));
    for (let k = 0; k < 20; k++) {
      const v = this.rng.int(minValue, maxValue);
      if (this.orbs.filter((o) => o.value === v).length < limit) return v;
    }
    return this.rng.int(minValue, maxValue);
  }

  private freeSpot(avoid: Point): Point {
    let best: Point = { x: FIELD.x0, y: FIELD.y0 };
    let bestScore = -1;
    for (let k = 0; k < 60; k++) {
      const p = { x: this.rng.int(FIELD.x0, FIELD.x1), y: this.rng.int(FIELD.y0, FIELD.y1) };
      const near = this.orbs.length ? Math.min(...this.orbs.map((o) => dist2(o, p))) : Infinity;
      const fromHead = dist2(p, avoid);
      if (near >= MIN_GAP ** 2 && fromHead >= AVOID_GAP ** 2) return p;
      const score = Math.min(near, MIN_GAP ** 2) + Math.min(fromHead, AVOID_GAP ** 2);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }

  private newOrb(value: number, avoid: Point): Orb {
    const p = this.freeSpot(avoid);
    return { id: this.nextId++, value, x: p.x, y: p.y };
  }

  /** Remplace la lanterne la plus éloignée de la tête (hors `keep`) par une autre valeur, au même endroit. */
  private replaceFarthest(value: number, head: Point, moves: Moves, keep: Set<number>): number {
    const candidates = this.orbs.filter((o) => !keep.has(o.id));
    if (candidates.length === 0) return -1;
    const far = candidates.reduce((a, b) => (dist2(b, head) > dist2(a, head) ? b : a));
    this.remove(moves, far.id);
    const o = { id: this.nextId++, value, x: far.x, y: far.y };
    this.add(moves, o);
    return o.id;
  }

  /** Découpe `rest` en morceaux possibles (sommes ou facteurs bornés par maxValue). */
  private parts(op: DragonOp, rest: number): number[] {
    const max = this.cfg.maxValue;
    const out: number[] = [];
    let r = rest;
    if (op === '+') {
      while (r > 0) {
        const v = Math.min(r, max);
        out.push(v);
        r -= v;
      }
    } else {
      while (r > 1) {
        let v = r;
        for (let d = Math.min(r, max); d >= 2; d--) {
          if (r % d === 0) {
            v = d;
            break;
          }
        }
        out.push(v);
        r /= v;
      }
    }
    return out;
  }

  /** S'assure que `rest` peut être trouvé avec les lanternes du ciel. */
  private keepReachable(rest: number, head: Point, moves: Moves): void {
    const op = this.goal.op;
    if (reachable(op, this.orbs.map((o) => o.value), rest)) return;
    const keep = new Set<number>();
    for (const v of this.parts(op, rest)) {
      const id = this.replaceFarthest(v, head, moves, keep);
      if (id >= 0) keep.add(id);
    }
  }

  /** Choisit un nouvel objectif ; relance des lanternes si aucun n'est possible. */
  private nextGoal(head: Point, moves: Moves): Goal {
    const cfg = this.cfg;
    for (let attempt = 0; attempt < 80; attempt++) {
      const values = this.orbs.map((o) => o.value);
      const wantMul = cfg.mul !== null && this.rng.next() < cfg.mulShare;
      const op: DragonOp = wantMul ? '×' : '+';
      let goals = admissibleGoals(op, values, op === '+' ? cfg.add : cfg.mul!);
      if (goals.length === 0 && op === '×') goals = admissibleGoals('+', values, cfg.add);
      const fresh = goals.filter((g) => g.target !== this.lastTarget);
      const pool = fresh.length ? fresh : goals;
      if (pool.length) {
        const g = this.rng.pick(pool);
        this.lastTarget = g.target;
        this.goal = g;
        return g;
      }
      // Aucun objectif possible : une lanterne lointaine change de valeur.
      this.replaceFarthest(this.randomValue(), head, moves, new Set());
    }
    throw new Error('aucun objectif possible');
  }
}
