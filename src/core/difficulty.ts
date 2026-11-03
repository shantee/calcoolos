/**
 * Les six niveaux scolaires de Calcoolos (03/11/2026) : CP, CE1, CE2, CM1, CM2 et Aventurier.
 * Grille pédagogique de référence : doc/NIVEAUX_SCOLAIRES.md. Chaque jeu garde sa mécanique ; ce fichier ne règle
 * que Panique au phare ! (énigmes de cubes) et nomme les niveaux. Les calculs viennent de calculs.ts et
 * multiplications.ts.
 */
import type { PuzzleConfig } from './puzzle';

export type TierId = 'cp' | 'ce1' | 'ce2' | 'cm1' | 'cm2' | 'aventurier';

/** Les six niveaux, dans l'ordre de la scolarité. */
export const NIVEAUX: readonly TierId[] = ['cp', 'ce1', 'ce2', 'cm1', 'cm2', 'aventurier'];

/**
 * Anciens niveaux à piments (avant le 03/11/2026). Les parties jouées à ces niveaux gardent leur niveau d'origine :
 * elles restent dans l'historique et les statistiques sous leur ancien nom, jamais dans un classement scolaire.
 */
export type AncienNiveau = 'eveil' | 'explorateur' | 'stratege' | 'maitre';
export const ANCIENS_NIVEAUX: readonly AncienNiveau[] = ['eveil', 'explorateur', 'stratege', 'maitre'];
export const NOMS_ANCIENS: Record<AncienNiveau, string> = {
  eveil: 'Doux (ancien)',
  explorateur: 'Relevé (ancien)',
  stratege: 'Piquant (ancien)',
  maitre: 'Explosif (ancien)',
};

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
  /** Allure des monstres du phare : plus lente quand les sommes demandent plus de réflexion. */
  allure: number;
}

function tier(id: TierId, label: string, pub: string, cols: number, rows: number, p: Omit<PuzzleConfig, 'cubeCount'>, parSeconds: number, allure: number): Tier {
  return { id, label, public: pub, cols, rows, puzzle: { ...p, cubeCount: cols * rows }, parSeconds, allure };
}

/**
 * Panique au phare ! : on additionne toujours des cubes. Le niveau règle la valeur des cubes, la taille de la cible et
 * le nombre de cubes de la meilleure solution (2 au CP, jusqu'à 4 en CM2 et Aventurier).
 */
export const TIERS: Record<TierId, Tier> = {
  cp: tier('cp', 'CP', 'additions jusqu’à 20', 3, 3, { minValue: 1, maxValue: 9, targetMin: 6, targetMax: 18, minOptimal: 2, maxOptimal: 2 }, 20, 0.85),
  ce1: tier('ce1', 'CE1', 'nombres jusqu’à 100, premières tables', 4, 4, { minValue: 2, maxValue: 19, targetMin: 12, targetMax: 40, minOptimal: 2, maxOptimal: 3 }, 16, 0.9),
  ce2: tier('ce2', 'CE2', 'toutes les tables, premières divisions', 4, 4, { minValue: 3, maxValue: 29, targetMin: 20, targetMax: 60, minOptimal: 2, maxOptimal: 3 }, 14, 0.95),
  cm1: tier('cm1', 'CM1', 'grands nombres, × 5, × 25, distributivité', 4, 4, { minValue: 5, maxValue: 45, targetMin: 30, targetMax: 100, minOptimal: 2, maxOptimal: 3 }, 13, 0.95),
  cm2: tier('cm2', 'CM2', '× 50, ÷ 4, ÷ 8, calculs en plusieurs étapes', 4, 4, { minValue: 8, maxValue: 69, targetMin: 50, targetMax: 120, minOptimal: 2, maxOptimal: 3 }, 16, 0.9),
  aventurier: tier('aventurier', 'Aventurier', 'pour aller plus loin, à tout âge', 4, 4, { minValue: 11, maxValue: 99, targetMin: 80, targetMax: 240, minOptimal: 3, maxOptimal: 4 }, 12, 0.85),
};

export const estNiveauScolaire = (v: unknown): v is TierId => typeof v === 'string' && (NIVEAUX as readonly string[]).includes(v);
export const estAncienNiveau = (v: unknown): v is AncienNiveau => typeof v === 'string' && (ANCIENS_NIVEAUX as readonly string[]).includes(v);

/** Nom affiché d'un niveau, ancien compris (« Explosif (ancien) ») ; un identifiant inconnu s'affiche tel quel. */
export function nomNiveau(id: string): string {
  if (estNiveauScolaire(id)) return TIERS[id].label;
  if (estAncienNiveau(id)) return NOMS_ANCIENS[id];
  return id;
}

/** Rang du niveau (0 = CP … 5 = Aventurier). */
export const rangNiveau = (id: TierId): number => NIVEAUX.indexOf(id);
