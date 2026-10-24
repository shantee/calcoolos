/**
 * État d'une partie de « Cubes de siège », sans aucun rendu.
 * Les scènes Phaser lisent cet état et jouent les animations correspondantes.
 */
import { createRng, type Rng } from '../../core/rng';
import { evaluateSelection, generatePuzzle, refillAndNext, type Puzzle } from '../../core/puzzle';
import { scoreHit, type HitResult } from '../../core/scoring';
import type { Tier } from '../../core/difficulty';

export type ValidateOutcome =
  | { kind: 'empty' }
  | { kind: 'miss'; sum: number; diff: number }
  | { kind: 'hit'; used: number[]; values: number[]; target: number; optimal: number; result: HitResult };

export class SiegeRound {
  readonly tier: Tier;
  private rng: Rng;
  puzzle: Puzzle;
  selected: number[] = [];
  combo = 0;
  score = 0;
  hits = 0;
  misses = 0;
  /** Horodatage (ms) d'apparition de la cible courante ; null = mode sans chrono. */
  private targetShownAt: number | null = null;
  timed: boolean;

  constructor(tier: Tier, seed: number, timed = false) {
    this.tier = tier;
    this.rng = createRng(seed);
    this.timed = timed;
    this.puzzle = generatePuzzle(tier.puzzle, this.rng);
  }

  get cubes(): number[] {
    return this.puzzle.cubes;
  }

  get target(): number {
    return this.puzzle.target;
  }

  get sum(): number {
    return this.selected.reduce((acc, i) => acc + this.puzzle.cubes[i], 0);
  }

  markTargetShown(nowMs: number): void {
    this.targetShownAt = nowMs;
  }

  /** Ajoute ou retire un cube de la sélection. Renvoie true s'il est désormais sélectionné. */
  toggle(index: number): boolean {
    if (index < 0 || index >= this.puzzle.cubes.length) return false;
    const at = this.selected.indexOf(index);
    if (at >= 0) {
      this.selected.splice(at, 1);
      return false;
    }
    this.selected.push(index);
    return true;
  }

  clear(): void {
    this.selected = [];
  }

  validate(nowMs: number): ValidateOutcome {
    if (this.selected.length === 0) return { kind: 'empty' };
    const r = evaluateSelection(this.puzzle.cubes, this.selected, this.puzzle.target, this.puzzle.optimalCount);
    if (!r.exact) {
      this.misses++;
      this.combo = 0;
      return { kind: 'miss', sum: r.sum, diff: this.puzzle.target - r.sum };
    }
    const seconds = this.timed && this.targetShownAt !== null ? (nowMs - this.targetShownAt) / 1000 : null;
    const result = scoreHit({
      target: this.puzzle.target,
      optimalCount: this.puzzle.optimalCount,
      usedCount: this.selected.length,
      combo: this.combo,
      seconds,
      parSeconds: this.tier.parSeconds,
    });
    this.combo = result.combo;
    this.score += result.points;
    this.hits++;
    const used = this.selected.slice();
    const values = used.map((i) => this.puzzle.cubes[i]);
    const target = this.puzzle.target;
    const optimal = this.puzzle.optimalCount;
    this.selected = [];
    this.puzzle = refillAndNext(this.puzzle.cubes, used, this.tier.puzzle, this.rng);
    return { kind: 'hit', used, values, target, optimal, result };
  }
}
