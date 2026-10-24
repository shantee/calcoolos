/**
 * Adaptation prudente de la difficulté, à l'intérieur d'un palier.
 *
 * Règles déterministes et lisibles :
 * - 3 coups parfaits d'affilée → un cran plus difficile (au plus +2) ;
 * - 2 erreurs parmi les 3 dernières tentatives → un cran plus facile (au plus −1) ;
 * - après un changement, on repart d'un historique vide (pas d'effet yo-yo).
 * Un cran agrandit (ou réduit) la plage des cibles de 20 % ; au cran +2, la
 * meilleure solution peut demander un cube de plus.
 */
import { validateConfig, type PuzzleConfig } from './puzzle';

export type Outcome = 'perfect' | 'hit' | 'miss';

export const MIN_OFFSET = -1;
export const MAX_OFFSET = 2;

export class AdaptiveDifficulty {
  offset = 0;
  private history: Outcome[] = [];

  record(outcome: Outcome): number {
    this.history.push(outcome);
    if (this.history.length > 3) this.history.shift();
    const last3 = this.history;
    const misses = last3.filter((o) => o === 'miss').length;
    if (last3.length === 3 && last3.every((o) => o === 'perfect') && this.offset < MAX_OFFSET) {
      this.offset++;
      this.history = [];
    } else if (misses >= 2 && this.offset > MIN_OFFSET) {
      this.offset--;
      this.history = [];
    }
    return this.offset;
  }
}

/** Configuration d'énigme ajustée au cran donné ; toujours valide. */
export function adjustConfig(base: PuzzleConfig, offset: number): PuzzleConfig {
  const k = 1 + 0.2 * Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, offset));
  const minSum = base.minValue * base.minOptimal + 1;
  const targetMax = Math.max(minSum + 2, Math.round(base.targetMax * k));
  const targetMin = Math.min(targetMax - 2, Math.max(minSum, Math.round(base.targetMin * k)));
  const maxOptimal = Math.min(base.cubeCount, Math.max(base.minOptimal, base.maxOptimal + (offset >= 2 ? 1 : 0) - (offset < 0 ? 1 : 0)));
  const cfg: PuzzleConfig = { ...base, targetMin, targetMax, maxOptimal };
  validateConfig(cfg);
  return cfg;
}
