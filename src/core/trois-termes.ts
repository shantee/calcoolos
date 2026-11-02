/**
 * Calculs à trois nombres de Neon Flight et MULTIRAIL : 3 × 8 + 2, 15 + 27 + 22, 40 − 3 × 6…
 * Ils s'intercalent entre les tables en mode Défi, jamais à Doux ni à l'entraînement, où l'on révise une table
 * précise. Le résultat reste positif et tient en trois chiffres : les deux claviers n'en acceptent pas plus.
 */
import type { TierId } from './difficulty';

type Alea = () => number;

export interface TroisTermes {
  text: string;
  answer: number;
}

/** Part des calculs à trois nombres dans une partie, par niveau */
export const PART_TROIS_TERMES: Record<TierId, number> = { eveil: 0, explorateur: 0.15, stratege: 0.25, maitre: 0.35 };

/** Ces calculs demandent plus de réflexion : le temps accordé est multiplié d'autant */
export const TEMPS_TROIS_TERMES = 1.5;

/** Les deux premiers calculs d'une partie restent des tables, pour entrer dans le rythme */
const CALMES_AU_DEPART = 2;

type Bornes = readonly [number, number];
type Forme = 'a×b+c' | 'a×b−c' | 'c+a×b' | 'c−a×b' | 'a+b+c' | 'a+b−c' | 'a−b+c' | 'a×b×c';

interface Reglage {
  /** second facteur de a × b (le premier vient des tables de la partie) */
  facteur: Bornes;
  /** nombre ajouté à un produit */
  ajout: Bornes;
  /** termes d'une addition ou d'une soustraction */
  terme: Bornes;
  /** facteurs de a × b × c */
  triple: Bornes;
  /** plus petite table utilisée */
  tableMin: number;
  formes: readonly Forme[];
}

const COURANTES: readonly Forme[] = ['a×b+c', 'a×b−c', 'a+b+c', 'a+b−c'];

const REGLAGES: Record<Exclude<TierId, 'eveil'>, Reglage> = {
  explorateur: { facteur: [2, 5], ajout: [1, 9], terme: [2, 12], triple: [2, 3], tableMin: 2, formes: COURANTES },
  stratege: {
    facteur: [2, 9], ajout: [2, 20], terme: [6, 29], triple: [2, 5], tableMin: 2,
    formes: [...COURANTES, 'c+a×b', 'a×b×c'],
  },
  maitre: {
    facteur: [3, 12], ajout: [3, 40], terme: [11, 49], triple: [2, 6], tableMin: 3,
    formes: [...COURANTES, 'c+a×b', 'a×b×c', 'c−a×b', 'a−b+c'],
  },
};

const ri = (rng: Alea, [min, max]: Bornes): number => min + Math.floor(rng() * (max - min + 1));
const pick = <T>(rng: Alea, liste: readonly T[]): T => liste[Math.floor(rng() * liste.length)];

/** Faut-il poser un calcul à trois nombres pour la question n° `numero` de la partie ? */
export function poserTroisTermes(niveau: TierId, numero: number, rng: Alea): boolean {
  return numero > CALMES_AU_DEPART && rng() < PART_TROIS_TERMES[niveau];
}

/** Un calcul à trois nombres, dont les produits viennent des tables de la partie */
export function tirerTroisTermes(niveau: TierId, tables: readonly number[], rng: Alea): TroisTermes {
  const r = REGLAGES[niveau === 'eveil' ? 'explorateur' : niveau];
  const utiles = tables.filter((t) => t >= r.tableMin);
  const table = (): number => (utiles.length ? pick(rng, utiles) : ri(rng, [r.tableMin, 9]));
  for (;;) {
    const forme = pick(rng, r.formes);
    const a = table();
    const b = ri(rng, r.facteur);
    const c = ri(rng, r.ajout);
    const [x, y, z] = [ri(rng, r.terme), ri(rng, r.terme), ri(rng, r.terme)];
    const [p, q, s] = [ri(rng, r.triple), ri(rng, r.triple), ri(rng, r.triple)];
    const calcul = ((): TroisTermes | null => {
      switch (forme) {
        case 'a×b+c': return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
        case 'a×b−c': return a * b > c ? { text: `${a} × ${b} − ${c}`, answer: a * b - c } : null;
        case 'c+a×b': return { text: `${c} + ${a} × ${b}`, answer: c + a * b };
        case 'c−a×b': {
          // on part d'un nombre assez grand pour que le résultat reste positif
          const depart = a * b + c;
          return { text: `${depart} − ${a} × ${b}`, answer: c };
        }
        case 'a+b+c': return { text: `${x} + ${y} + ${z}`, answer: x + y + z };
        case 'a+b−c': return x + y > z ? { text: `${x} + ${y} − ${z}`, answer: x + y - z } : null;
        case 'a−b+c': return x > y ? { text: `${x} − ${y} + ${z}`, answer: x - y + z } : null;
        case 'a×b×c': return { text: `${p} × ${q} × ${s}`, answer: p * q * s };
      }
    })();
    if (calcul) return calcul;
  }
}
