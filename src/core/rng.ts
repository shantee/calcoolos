/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * Une même graine donne toujours la même suite : indispensable pour les tests
 * et pour rejouer une partie à l'identique.
 */
export interface Rng {
  /** Flottant dans [0, 1[. */
  next(): number;
  /** Entier dans [min, max] (bornes incluses). */
  int(min: number, max: number): number;
  /** Élément au hasard d'un tableau non vide. */
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick() sur un tableau vide');
      return items[Math.floor(next() * items.length)];
    },
  };
}
