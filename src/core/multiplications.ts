/**
 * Multiplications de Neon Flight et de MULTIRAIL (Aventure et Entraînement), classe par classe
 * (grille de doc/NIVEAUX_SCOLAIRES.md § 5). Ces deux jeux restent consacrés aux multiplications : pas d'addition ni
 * de division ajoutée pour remplir un niveau.
 *
 * - Les **faits de table** (table choisie × un facteur) : le niveau règle les facteurs. Au CP, de petits groupements
 *   (facteurs 1 à 5, produits ≤ 30) montrés avec des points ; au CE1, les facteurs 1 à 5 d'abord puis jusqu'à 10 ;
 *   en Aventurier, jusqu'à 12.
 * - Les **multiplications élaborées**, à partir du CE2, toujours bâties sur une table choisie : × dizaines, × 11 à 19,
 *   × 25, × 50, deux chiffres × un chiffre, trois facteurs… Résultat ≤ 999 (les claviers ont trois chiffres).
 */
import type { TierId } from './difficulty';

type Alea = () => number;
const ri = (r: Alea, a: number, b: number): number => a + Math.floor(r() * (b - a + 1));
const pick = <T>(r: Alea, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

/** Facteurs des faits de table : `min`..`max`, et produit plafonné au CP. */
export interface Facteurs {
  min: number;
  max: number;
  /** produit maximal (hors table de 10) */
  produitMax: number;
  /** au CE1, les premiers calculs d'une partie restent sur les facteurs 1 à 5 */
  debutMax?: number;
}

export const FACTEURS: Record<TierId, Facteurs> = {
  cp: { min: 1, max: 5, produitMax: 30 },
  ce1: { min: 1, max: 10, produitMax: 100, debutMax: 5 },
  ce2: { min: 2, max: 10, produitMax: 100 },
  cm1: { min: 2, max: 10, produitMax: 100 },
  cm2: { min: 3, max: 10, produitMax: 100 },
  aventurier: { min: 3, max: 12, produitMax: 144 },
};

/** Calculs « de départ » pendant lesquels le CE1 garde les petits facteurs. */
export const DEBUT_CE1 = 8;

/** Faits d'une table permis au niveau, pour la question n° `numero` de la partie. */
export function facteursPermis(niveau: TierId, table: number, numero = 99): number[] {
  const f = FACTEURS[niveau];
  const max = f.debutMax !== undefined && numero <= DEBUT_CE1 ? f.debutMax : f.max;
  const out: number[] = [];
  for (let k = f.min; k <= max; k++) {
    const plafond = table === 10 ? Math.max(f.produitMax, 50) : f.produitMax;
    if (table * k <= plafond) out.push(k);
  }
  // Une table trop grande pour le plafond du CP garde au moins ses deux premiers multiples.
  return out.length ? out : [1, 2];
}

/** Les petits voient les groupements dessinés : au CP, la multiplication est d'abord un nombre de groupes. */
export const aideVisuelle = (niveau: TierId): boolean => niveau === 'cp';

/** Part des multiplications élaborées dans une partie (mode classé seulement). */
export const PART_ELABOREES: Record<TierId, number> = { cp: 0, ce1: 0, ce2: 0.2, cm1: 0.3, cm2: 0.4, aventurier: 0.55 };

/** Les deux premiers calculs d'une partie restent des tables, pour entrer dans le rythme. */
const CALMES_AU_DEPART = 2;

export interface Elaboree {
  text: string;
  answer: number;
  /** 2 = cœur de l'année, 3 = découverte */
  palier: 2 | 3;
  /** effort estimé (s) */
  effort: number;
  /** multiplicateur du temps accordé, par rapport à un fait de table */
  temps: number;
  famille: string;
}

export const MAX_PRODUIT = 999;

/** Faut-il poser une multiplication élaborée pour la question n° `numero` ? */
export function poserElaboree(niveau: TierId, numero: number, r: Alea): boolean {
  return numero > CALMES_AU_DEPART && r() < PART_ELABOREES[niveau];
}

type Brut = { text: string; answer: number } | null;
interface Famille {
  nom: string;
  palier: 2 | 3;
  effort: number;
  tire(t: number, r: Alea): Brut;
}

const fois = (r: Alea, a: number, b: number): Brut => (a * b <= MAX_PRODUIT ? (r() < 0.5 ? { text: `${a} × ${b}`, answer: a * b } : { text: `${b} × ${a}`, answer: a * b }) : null);
/** un nombre de dizaines dont le produit par t reste ≤ 999 */
const dizainesPour = (r: Alea, t: number, min = 2): number | null => {
  const max = Math.min(9, Math.floor(MAX_PRODUIT / (10 * t)));
  return max >= min ? 10 * ri(r, min, max) : null;
};
const deuxChiffresPour = (r: Alea, t: number, min: number, max: number): number | null => {
  const m = Math.min(max, Math.floor(MAX_PRODUIT / t));
  return m >= min ? ri(r, min, m) : null;
};

const fam = (nom: string, palier: 2 | 3, effort: number, tire: Famille['tire']): Famille => ({ nom, palier, effort, tire });

const DIZAINES = fam('table × dizaines', 2, 2.5, (t, r) => { const d = dizainesPour(r, t); return d ? fois(r, t, d) : null; });
const ONZE_A_DIXNEUF = fam('table × 11 à 19', 3, 4, (t, r) => fois(r, t, ri(r, 11, 19)));
const FOIS_25 = fam('table × 25', 2, 2.5, (t, r) => fois(r, t, 25));
const FOIS_50 = fam('table × 50', 2, 2.5, (t, r) => fois(r, t, 50));

export const ELABOREES: Record<TierId, readonly Famille[]> = {
  cp: [],
  ce1: [],
  ce2: [
    DIZAINES,
    fam('table × 100', 2, 1.5, (t, r) => (t <= 9 ? fois(r, t, 100) : fois(r, t, 10 * ri(r, 2, 8)))),
    ONZE_A_DIXNEUF,
    fam('4 × ou 8 × deux chiffres (doubler)', 3, 4, (t, r) => { const n = deuxChiffresPour(r, t === 8 ? 8 : 4, 12, t === 8 ? 39 : 49); return n ? fois(r, t === 8 ? 8 : 4, n) : null; }),
  ],
  cm1: [
    DIZAINES,
    fam('table × centaines', 2, 2.5, (t, r) => { const max = Math.floor(9 / t); return max >= 1 && t <= 4 ? fois(r, t, 100 * ri(r, Math.min(2, max), max)) : fois(r, t, 10 * ri(r, 3, Math.max(3, Math.min(9, Math.floor(99 / t))))); }),
    FOIS_25,
    fam('× 5 d’un grand nombre, table × multiple de 5', 2, 3, (t, r) => (t === 5 ? fois(r, 5, ri(r, 14, 199)) : fois(r, t, 5 * ri(r, 3, Math.max(3, Math.min(19, Math.floor(MAX_PRODUIT / (5 * t)))))))),
    fam('table × deux chiffres', 3, 4.5, (t, r) => { const n = deuxChiffresPour(r, t, 14, 59); return n ? fois(r, t, n) : null; }),
    ONZE_A_DIXNEUF,
  ],
  cm2: [
    FOIS_25,
    FOIS_50,
    fam('dizaines × dizaines', 2, 2.5, (t, r) => { const k = t <= 4 ? ri(r, 2, Math.floor(9 / t)) : 0; return k >= 2 && t * k <= 9 ? fois(r, 10 * t, 10 * k) : fois(r, t, 10 * ri(r, 2, Math.max(2, Math.min(9, Math.floor(99 / t))))); }),
    fam('table × deux chiffres', 3, 4.5, (t, r) => { const n = deuxChiffresPour(r, t, 23, 99); return n ? fois(r, t, n) : null; }),
    fam('12 × ou 15 × la table', 3, 4, (t, r) => fois(r, pick(r, [12, 15]), t)),
  ],
  aventurier: [
    fam('table × 13 à 19', 2, 3, (t, r) => fois(r, t, ri(r, 13, 19))),
    FOIS_25,
    FOIS_50,
    fam('table × 15', 2, 3, (t, r) => fois(r, t, 15)),
    fam('deux facteurs de 11 à 19', 3, 5.5, (t, r) => { const a = t >= 11 ? t : ri(r, 11, 19); return fois(r, a, ri(r, 12, 19)); }),
    fam('trois facteurs avec 25', 3, 4, (t, r) => { const a = pick(r, [2, 4, 8]); return a * t * 25 <= MAX_PRODUIT ? { text: `${a} × ${t} × 25`, answer: a * t * 25 } : { text: `4 × ${Math.min(t, 9)} × 25`, answer: 100 * Math.min(t, 9) }; }),
    fam('× 99', 3, 4, (t, r) => fois(r, 99, Math.min(t, 10))),
    fam('table × deux chiffres', 3, 4.5, (t, r) => { const n = deuxChiffresPour(r, t, 23, 99); return n ? fois(r, t, n) : null; }),
  ],
};

/** Temps accordé, en multiple de celui d'un fait de table : 1,5 pour un effort de 3 s, 2 pour 5 s. */
export const multiplicateurDeTemps = (effort: number): number => Math.round((1 + 0.25 * (effort - 1)) * 100) / 100;

/**
 * Une multiplication élaborée bâtie sur une des tables choisies (1 et les tables trop grandes pour la famille sont
 * écartées). `palier` impose le palier (le joueur en difficulté reste au palier 2).
 */
export function tirerElaboree(niveau: TierId, tables: readonly number[], r: Alea, palier?: 2 | 3): Elaboree | null {
  const familles = ELABOREES[niveau].filter((f) => palier === undefined || f.palier === palier);
  if (!familles.length) return null;
  const utiles = tables.filter((t) => t >= 2);
  const choix = utiles.length ? utiles : [2, 3, 4, 5];
  for (let k = 0; k < 60; k++) {
    const f = pick(r, familles);
    const t = pick(r, choix);
    const b = f.tire(t, r);
    if (!b || !Number.isInteger(b.answer) || b.answer < 2 || b.answer > MAX_PRODUIT) continue;
    return { text: b.text, answer: b.answer, palier: f.palier, effort: f.effort, temps: multiplicateurDeTemps(f.effort), famille: f.nom };
  }
  return null;
}

/** Temps de base d'un fait de table (s), par niveau, en mode classé de Neon Flight. */
export const TEMPS_TABLE: Record<TierId, number> = { cp: 18, ce1: 15, ce2: 12, cm1: 10, cm2: 9, aventurier: 8 };
