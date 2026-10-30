/**
 * Paliers de difficulté (réglés à la main, sans date de naissance).
 * Le moteur adaptatif viendra à l'étape C ; ces paliers en sont le socle.
 */
import type { PuzzleConfig } from './puzzle';

export type TierId = 'eveil' | 'explorateur' | 'stratege' | 'maitre';

export interface Tier {
  id: TierId;
  label: string;
  public: string;
  /** Colonnes × lignes de la grille. */
  cols: number;
  rows: number;
  puzzle: PuzzleConfig;
  /** Temps « confortable » par cible en mode chronométré. */
  parSeconds: number;
}

function tier(id: TierId, label: string, pub: string, cols: number, rows: number, p: Omit<PuzzleConfig, 'cubeCount'>, parSeconds: number): Tier {
  return { id, label, public: pub, cols, rows, puzzle: { ...p, cubeCount: cols * rows }, parSeconds };
}

export const TIERS: Record<TierId, Tier> = {
  eveil: tier('eveil', 'Doux', '+ − jusqu’à 20', 3, 3, { minValue: 1, maxValue: 9, targetMin: 6, targetMax: 18, minOptimal: 2, maxOptimal: 2 }, 20),
  explorateur: tier('explorateur', 'Relevé', '+ − jusqu’à 50, × faciles', 4, 4, { minValue: 1, maxValue: 12, targetMin: 10, targetMax: 30, minOptimal: 2, maxOptimal: 3 }, 15),
  stratege: tier('stratege', 'Piquant', '+ − jusqu’à 100, × ÷ des tables', 4, 4, { minValue: 2, maxValue: 19, targetMin: 15, targetMax: 50, minOptimal: 2, maxOptimal: 3 }, 12),
  maitre: tier('maitre', 'Explosif', '+ − jusqu’à 200, × ÷ jusqu’à 12', 4, 4, { minValue: 3, maxValue: 29, targetMin: 25, targetMax: 80, minOptimal: 2, maxOptimal: 4 }, 10),
};
