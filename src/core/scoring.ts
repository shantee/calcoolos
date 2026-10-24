/**
 * Barème de « Cubes de siège » (première version, à affiner à l'étape C).
 *
 * Principes :
 * - Toute solution exacte touche l'ennemi ; les solutions optimales (nombre
 *   minimal de cubes) frappent le plus fort, et deux optimales ex æquo valent
 *   exactement la même chose.
 * - Chaque cube en trop retire 25 % des dégâts, sans descendre sous 40 %.
 * - Une validation fausse ne rapporte rien et casse la série : cliquer au
 *   hasard puis valider n'est jamais rentable.
 * - La vitesse n'apporte un bonus que dans les modes chronométrés.
 */
export const BASE_DAMAGE = 100;
export const EXTRA_CUBE_PENALTY = 0.25;
export const MIN_EFFICIENCY = 0.4;
export const MAX_COMBO_STEPS = 4;
export const COMBO_STEP = 0.25;

export interface HitInput {
  target: number;
  optimalCount: number;
  usedCount: number;
  /** Série de coups parfaits AVANT ce coup. */
  combo: number;
  /** Secondes écoulées depuis l'apparition de la cible (null = mode sans chrono). */
  seconds: number | null;
  /** Temps « confortable » pour cette cible ; au-delà, plus de bonus de vitesse. */
  parSeconds: number;
}

export interface HitResult {
  efficiency: number;
  perfect: boolean;
  damage: number;
  points: number;
  /** Série après ce coup. */
  combo: number;
  speedBonus: number;
}

export function efficiency(optimalCount: number, usedCount: number): number {
  if (usedCount < optimalCount) throw new Error('moins de cubes que l’optimum : sélection impossible');
  return Math.max(MIN_EFFICIENCY, 1 - EXTRA_CUBE_PENALTY * (usedCount - optimalCount));
}

export function comboMultiplier(combo: number): number {
  return 1 + COMBO_STEP * Math.min(Math.max(combo, 0), MAX_COMBO_STEPS);
}

export function scoreHit(input: HitInput): HitResult {
  const eff = efficiency(input.optimalCount, input.usedCount);
  const perfect = input.usedCount === input.optimalCount;
  const combo = perfect ? input.combo + 1 : 0;
  const damage = Math.round(BASE_DAMAGE * eff);
  let speedBonus = 0;
  if (input.seconds !== null && input.parSeconds > 0) {
    const ratio = 1 - input.seconds / input.parSeconds;
    speedBonus = Math.max(0, Math.round(50 * ratio));
  }
  // La cible compte : une grande somme exacte vaut plus qu'une petite.
  const points = Math.round((10 * input.target * eff + speedBonus) * comboMultiplier(perfect ? input.combo : 0));
  return { efficiency: eff, perfect, damage, points, combo, speedBonus };
}

/** Validation fausse : aucun point, série remise à zéro. */
export function scoreMiss(): { points: 0; combo: 0 } {
  return { points: 0, combo: 0 };
}
