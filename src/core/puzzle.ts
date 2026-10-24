/**
 * Moteur d'énigmes de « Cubes de siège ».
 *
 * Une grille de cubes chiffrés ; une cible ; le joueur choisit des cubes
 * (chacun au plus une fois) dont la somme vaut exactement la cible.
 * Le moteur garantit qu'une solution existe et connaît le nombre minimal de
 * cubes nécessaire (l'« optimum »), qui sert au barème.
 *
 * Tout ici est pur et déterministe (pas de Phaser, pas de DOM) : testable seul.
 */
import type { Rng } from './rng';

export interface PuzzleConfig {
  /** Nombre de cubes dans la grille (ex. 16 pour 4×4). */
  cubeCount: number;
  /** Valeur minimale d'un cube. */
  minValue: number;
  /** Valeur maximale d'un cube. */
  maxValue: number;
  /** Bornes de la cible. */
  targetMin: number;
  targetMax: number;
  /**
   * Nombre minimal de cubes de la meilleure solution. 2 interdit les cibles
   * atteignables avec un seul cube (réponse triviale qui ruinerait le mode).
   */
  minOptimal: number;
  /** Nombre maximal de cubes de la meilleure solution (évite les cibles trop dures). */
  maxOptimal: number;
}

export interface Puzzle {
  cubes: number[];
  target: number;
  /** Nombre minimal de cubes permettant d'atteindre la cible. */
  optimalCount: number;
  /** Une solution optimale (indices dans `cubes`). */
  solution: number[];
}

/**
 * Pour chaque somme s de 0 à maxSum : nombre minimal de cubes distincts dont
 * la somme vaut s (Infinity si impossible). Sac à dos 0/1, O(n × maxSum).
 */
export function minCubesTable(cubes: readonly number[], maxSum: number): number[] {
  const best = new Array<number>(maxSum + 1).fill(Infinity);
  best[0] = 0;
  for (const v of cubes) {
    if (v <= 0) throw new Error(`valeur de cube invalide : ${v}`);
    for (let s = maxSum; s >= v; s--) {
      const candidate = best[s - v] + 1;
      if (candidate < best[s]) best[s] = candidate;
    }
  }
  return best;
}

/** Nombre minimal de cubes pour atteindre `target`, ou null si impossible. */
export function minCubesFor(cubes: readonly number[], target: number): number | null {
  if (target <= 0) return null;
  const n = minCubesTable(cubes, target)[target];
  return Number.isFinite(n) ? n : null;
}

/** Une solution optimale (indices), ou null si la cible est inatteignable. */
export function findOptimalSolution(cubes: readonly number[], target: number): number[] | null {
  if (target <= 0) return null;
  // best[i][s] = minimum avec les i premiers cubes ; on garde les lignes pour reconstruire.
  const n = cubes.length;
  const rows: number[][] = [new Array<number>(target + 1).fill(Infinity)];
  rows[0][0] = 0;
  for (let i = 0; i < n; i++) {
    const prev = rows[i];
    const row = prev.slice();
    const v = cubes[i];
    for (let s = v; s <= target; s++) {
      if (prev[s - v] + 1 < row[s]) row[s] = prev[s - v] + 1;
    }
    rows.push(row);
  }
  if (!Number.isFinite(rows[n][target])) return null;
  const picked: number[] = [];
  let s = target;
  for (let i = n; i > 0 && s > 0; i--) {
    if (rows[i][s] !== rows[i - 1][s]) {
      picked.push(i - 1);
      s -= cubes[i - 1];
    }
  }
  return picked.reverse();
}

export interface SelectionResult {
  /** La sélection est-elle bien formée (indices distincts et existants) ? */
  wellFormed: boolean;
  sum: number;
  count: number;
  /** Somme exactement égale à la cible. */
  exact: boolean;
  /** Exacte ET avec le nombre minimal de cubes (les ex æquo optimaux sont égaux). */
  optimal: boolean;
}

export function evaluateSelection(
  cubes: readonly number[],
  indices: readonly number[],
  target: number,
  optimalCount: number,
): SelectionResult {
  const unique = new Set(indices);
  const wellFormed =
    unique.size === indices.length && indices.every((i) => Number.isInteger(i) && i >= 0 && i < cubes.length);
  const sum = wellFormed ? indices.reduce((acc, i) => acc + cubes[i], 0) : 0;
  const exact = wellFormed && indices.length > 0 && sum === target;
  return {
    wellFormed,
    sum,
    count: indices.length,
    exact,
    optimal: exact && indices.length === optimalCount,
  };
}

/** Cibles admissibles pour une grille donnée, avec leur optimum. */
export function admissibleTargets(cubes: readonly number[], cfg: PuzzleConfig): Array<{ target: number; optimal: number }> {
  const table = minCubesTable(cubes, cfg.targetMax);
  const out: Array<{ target: number; optimal: number }> = [];
  for (let t = Math.max(1, cfg.targetMin); t <= cfg.targetMax; t++) {
    const k = table[t];
    if (Number.isFinite(k) && k >= cfg.minOptimal && k <= cfg.maxOptimal) out.push({ target: t, optimal: k });
  }
  return out;
}

function randomCube(cfg: PuzzleConfig, rng: Rng): number {
  return rng.int(cfg.minValue, cfg.maxValue);
}

export function validateConfig(cfg: PuzzleConfig): void {
  const problems: string[] = [];
  if (cfg.cubeCount < 2) problems.push('au moins deux cubes');
  if (cfg.minValue < 1 || cfg.maxValue < cfg.minValue) problems.push('valeurs de cubes incohérentes');
  if (cfg.targetMin > cfg.targetMax) problems.push('bornes de cible inversées');
  if (cfg.minOptimal < 1 || cfg.maxOptimal < cfg.minOptimal) problems.push('bornes d’optimum incohérentes');
  if (cfg.maxOptimal > cfg.cubeCount) problems.push('optimum supérieur au nombre de cubes');
  if (cfg.minOptimal * cfg.minValue > cfg.targetMax) problems.push('cible maximale trop petite pour l’optimum minimal');
  if (problems.length) throw new Error(`Configuration d’énigme invalide : ${problems.join(', ')}`);
}

/**
 * Choisit une cible jouable pour la grille actuelle. Si aucune n'existe,
 * relance un cube au hasard et recommence jusqu'à en obtenir une. Modifie `cubes` sur place si nécessaire.
 */
export function pickTarget(cubes: number[], cfg: PuzzleConfig, rng: Rng): Puzzle {
  validateConfig(cfg);
  for (let attempt = 0; attempt < 200; attempt++) {
    const options = admissibleTargets(cubes, cfg);
    if (options.length > 0) {
      const choice = rng.pick(options);
      const solution = findOptimalSolution(cubes, choice.target);
      if (!solution || solution.length !== choice.optimal) throw new Error('incohérence interne du solveur');
      return { cubes: cubes.slice(), target: choice.target, optimalCount: choice.optimal, solution };
    }
    // Aucune cible : on relance un cube au hasard.
    cubes[rng.int(0, cubes.length - 1)] = randomCube(cfg, rng);
  }
  throw new Error('Impossible de produire une énigme avec cette configuration');
}

/** Nouvelle grille complète + cible. */
export function generatePuzzle(cfg: PuzzleConfig, rng: Rng): Puzzle {
  validateConfig(cfg);
  const cubes = Array.from({ length: cfg.cubeCount }, () => randomCube(cfg, rng));
  diversify(cubes, cfg, rng);
  return pickTarget(cubes, cfg, rng);
}

/**
 * Remplace les cubes utilisés par de nouveaux cubes, puis choisit la cible suivante.
 * Les cubes non utilisés restent à leur place (le joueur garde ses repères).
 */
export function refillAndNext(cubes: readonly number[], used: readonly number[], cfg: PuzzleConfig, rng: Rng): Puzzle {
  const next = cubes.slice();
  // Les solutions optimales consomment surtout les gros cubes : si ceux qui
  // restent sont trop petits en moyenne, on remplace plutôt par de grandes valeurs.
  const kept = cubes.filter((_, i) => !used.includes(i));
  const mid = (cfg.minValue + cfg.maxValue) / 2;
  const keptMean = kept.length ? kept.reduce((a, b) => a + b, 0) / kept.length : mid;
  for (const i of used) {
    next[i] = keptMean < mid && rng.next() < 0.7 ? rng.int(Math.ceil(mid), cfg.maxValue) : randomCube(cfg, rng);
  }
  diversify(next, cfg, rng);
  return pickTarget(next, cfg, rng);
}

/** Nombre maximal d'exemplaires d'une même valeur dans une grille. */
export function maxDuplicates(cubeCount: number): number {
  return Math.max(2, Math.ceil(cubeCount / 6));
}

/**
 * Évite qu'une grille s'appauvrisse au fil des tirs : les meilleures solutions
 * consomment surtout les gros cubes, et les petits finiraient par s'accumuler.
 * Une valeur présente trop souvent voit ses exemplaires en trop relancés.
 */
export function diversify(cubes: number[], cfg: PuzzleConfig, rng: Rng): void {
  const max = maxDuplicates(cubes.length);
  const range = cfg.maxValue - cfg.minValue + 1;
  if (range * max < cubes.length) return; // impossible de respecter la limite avec si peu de valeurs
  for (let guard = 0; guard < 200; guard++) {
    const counts = new Map<number, number[]>();
    cubes.forEach((v, i) => counts.set(v, [...(counts.get(v) ?? []), i]));
    const over = [...counts.values()].find((idx) => idx.length > max);
    if (!over) return;
    const i = over[over.length - 1];
    let v = randomCube(cfg, rng);
    for (let k = 0; k < 20 && (counts.get(v)?.length ?? 0) >= max; k++) v = randomCube(cfg, rng);
    cubes[i] = v;
  }
}
