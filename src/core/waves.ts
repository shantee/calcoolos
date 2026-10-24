/**
 * Monstres et vagues de « Cubes de siège ».
 * Les valeurs sont des réglages de jeu, pas des constantes physiques : elles
 * se retouchent ici sans toucher au reste.
 */
export type EnemyKind = 'mordillon' | 'trotteur' | 'carapacon' | 'roi';

export interface Archetype {
  kind: EnemyKind;
  name: string;
  hp: number;
  /** Vitesse de marche en pixels par seconde (scène de 1280 px de large). */
  speed: number;
  /** Blindé : un coup qui n'est pas parfait ne fait que la moitié des dégâts. */
  armored: boolean;
  /** Points bonus quand il est vaincu. */
  bounty: number;
}

export const ARCHETYPES: Record<EnemyKind, Archetype> = {
  mordillon: { kind: 'mordillon', name: 'Mordillon', hp: 200, speed: 20, armored: false, bounty: 50 },
  trotteur: { kind: 'trotteur', name: 'Trotte-menu', hp: 100, speed: 36, armored: false, bounty: 40 },
  carapacon: { kind: 'carapacon', name: 'Carapaçon', hp: 300, speed: 12, armored: true, bounty: 90 },
  roi: { kind: 'roi', name: 'Roi Mordillon', hp: 400, speed: 14, armored: false, bounty: 200 },
};

/** Quatre vagues courtes ; la dernière est un petit boss. */
export const WAVES: readonly (readonly EnemyKind[])[] = [
  ['mordillon', 'trotteur', 'mordillon'],
  ['trotteur', 'mordillon', 'carapacon', 'trotteur'],
  ['carapacon', 'mordillon', 'trotteur', 'carapacon'],
  ['roi'],
];

export type Mode = 'tranquille' | 'defi';

export const MODES: Record<Mode, { label: string; speedFactor: number; hearts: number | null; timed: boolean }> = {
  // Pas de cœurs perdus ni de chronomètre : on apprend à son rythme.
  tranquille: { label: 'Tranquille', speedFactor: 0.55, hearts: null, timed: false },
  defi: { label: 'Défi', speedFactor: 1, hearts: 3, timed: true },
};

/** Dégâts réellement infligés à un monstre. */
export function damageTo(kind: EnemyKind, damage: number, perfect: boolean): number {
  return ARCHETYPES[kind].armored && !perfect ? Math.round(damage / 2) : damage;
}
