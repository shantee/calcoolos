/**
 * Calcul mental varié, classe par classe (grille de doc/NIVEAUX_SCOLAIRES.md § 4).
 *
 * Utilisé par Pluie de météores, Décollage !, les bonus de Panique au phare !, le Voyage Zen de MULTIRAIL et le logo.
 * Chaque niveau a trois paliers : 1 = acquis et faits mémorisés, 2 = cœur de l'année, 3 = ce que l'on découvre dans
 * l'année. Chaque famille donne un effort estimé (secondes de réflexion pour un élève de la classe à l'aise) : les jeux
 * chronométrés en tirent leur délai.
 *
 * Règles communes, vérifiées par les tests sur de grands échantillons : réponses entières de 1 à 999, jamais de
 * négatif ni d'étape négative, divisions exactes, aucun nombre affiché au-delà de 999, et seulement les opérations
 * du niveau (CP : + −, CE1 : + − ×, CE2 et au-delà : + − × ÷).
 */
import type { Rng } from './rng';
import type { TierId } from './difficulty';

export type Op = '+' | '−' | '×' | '÷';
export type Palier = 1 | 2 | 3;

export interface Calcul {
  /** Texte affiché, par exemple « 47 + 8 » ou « (7 × 8) + 23 ». */
  text: string;
  answer: number;
  /** Opération principale (statistiques par opération) : la première du calcul. */
  op: Op;
  /** Les deux nombres d'un calcul à une opération (pour un calcul à plusieurs étapes : les deux premiers). */
  a: number;
  b: number;
  /** Nombre d'opérations du calcul. */
  ops: number;
  palier: Palier;
  /** Effort estimé, en secondes de réflexion. */
  effort: number;
  /** Famille d'origine (tests et relevés). */
  famille: string;
}

/** Plus grande réponse et plus grand nombre affiché : les claviers des jeux acceptent trois chiffres. */
export const MAX_REPONSE = 999;

/** Opérations permises à chaque niveau. */
export const OPERATIONS: Record<TierId, readonly Op[]> = {
  cp: ['+', '−'],
  ce1: ['+', '−', '×'],
  ce2: ['+', '−', '×', '÷'],
  cm1: ['+', '−', '×', '÷'],
  cm2: ['+', '−', '×', '÷'],
  aventurier: ['+', '−', '×', '÷'],
};

type Brut = { text: string; answer: number; op: Op; a: number; b: number; ops: number; nombres: number[] } | null;

interface Famille {
  nom: string;
  palier: Palier;
  effort: number;
  poids?: number;
  tire(r: Rng): Brut;
}

// ---------------------------------------------------------------- outils d'écriture

const val = (op: Op, a: number, b: number): number | null => {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b >= 0 ? a - b : null;
    case '×': return a * b;
    case '÷': return b !== 0 && a % b === 0 ? a / b : null;
  }
};

/** a op b */
function bin(op: Op, a: number, b: number): Brut {
  const v = val(op, a, b);
  return v === null ? null : { text: `${a} ${op} ${b}`, answer: v, op, a, b, ops: 1, nombres: [a, b] };
}

/** Même calcul, facteurs dans un ordre ou dans l'autre (7 × 3 et 3 × 7 sont à connaître). */
function prod(r: Rng, a: number, b: number): Brut {
  return r.next() < 0.5 ? bin('×', a, b) : bin('×', b, a);
}

/** (a op1 b) op2 c, avec parenthèses autour de tout × ou ÷ (écriture sans ambiguïté). */
function deux(op1: Op, a: number, b: number, op2: Op, c: number, avant = true): Brut {
  const x = val(op1, a, b);
  if (x === null) return null;
  const v = avant ? val(op2, x, c) : val(op2, c, x);
  if (v === null) return null;
  const g = op1 === '×' || op1 === '÷' ? `(${a} ${op1} ${b})` : `${a} ${op1} ${b}`;
  const text = avant ? `${g} ${op2} ${c}` : `${c} ${op2} (${a} ${op1} ${b})`;
  return { text, answer: v, op: avant ? op1 : op2, a: avant ? a : c, b: avant ? b : x, ops: 2, nombres: [a, b, c, x] };
}

/** (a × b) op (c × d) ou (a × b) op (c ÷ d) */
function paire(g1: [Op, number, number], op: Op, g2: [Op, number, number]): Brut {
  const x = val(...g1);
  const y = val(...g2);
  if (x === null || y === null) return null;
  const v = val(op, x, y);
  if (v === null) return null;
  return { text: `(${g1[1]} ${g1[0]} ${g1[2]}) ${op} (${g2[1]} ${g2[0]} ${g2[2]})`, answer: v, op: g1[0], a: g1[1], b: g1[2], ops: 3, nombres: [g1[1], g1[2], g2[1], g2[2], x, y] };
}

const ri = (r: Rng, a: number, b: number): number => r.int(a, b);
const dizaine = (r: Rng, a: number, b: number): number => 10 * r.int(a, b);
/** n dont le chiffre des unités vérifie `ok` */
const avecUnites = (r: Rng, min: number, max: number, ok: (u: number) => boolean): number => {
  for (let k = 0; k < 40; k++) {
    const n = r.int(min, max);
    if (ok(n % 10)) return n;
  }
  return min;
};

// Faits d'une même table : 2, 3, 4, 5, 10 sont plus faciles que 6, 7, 8, 9.
const FACILES = [2, 3, 4, 5, 10];
const DURES = [6, 7, 8, 9];
const table = (r: Rng, tables: readonly number[], kMin = 2, kMax = 10): Brut => prod(r, r.pick(tables), ri(r, kMin, kMax));
/** division réciproque d'une table : (t × q) ÷ t */
const divTable = (r: Rng, tables: readonly number[], qMin = 2, qMax = 10): Brut => {
  const t = r.pick(tables);
  return bin('÷', t * ri(r, qMin, qMax), t);
};
const DOUBLES_CE1 = [11, 12, 13, 14, 15, 20, 25, 30, 35, 40, 45, 50, 100, 150, 200, 250, 300, 500];
const DOUBLES_CE2 = [16, 17, 18, 19, 20, 25, 35, 45, 60, 75, 150, 250, 300, 400, 450];

// ---------------------------------------------------------------- la grille

const f = (nom: string, palier: Palier, effort: number, tire: (r: Rng) => Brut, poids = 1): Famille => ({ nom, palier, effort, tire, poids });

export const GRILLE: Record<TierId, readonly Famille[]> = {
  // Nombres jusqu'à 100 ; additions et soustractions seulement (le × arrive au CE1).
  cp: [
    f('table d’addition ≤ 10', 1, 1, (r) => { const a = ri(r, 1, 8); return bin('+', a, ri(r, 1, 9 - a + 1)); }, 2),
    f('+ 1 ou + 2', 1, 1, (r) => bin('+', ri(r, 5, 60), ri(r, 1, 2))),
    f('− 1 ou − 2', 1, 1, (r) => bin('−', ri(r, 5, 60), ri(r, 1, 2))),
    f('double', 1, 1, (r) => { const d = ri(r, 2, 10); return bin('+', d, d); }),
    f('table d’addition avec passage de dizaine', 2, 2, (r) => { const a = ri(r, 3, 9); return bin('+', a, ri(r, 11 - a, 9)); }, 2),
    f('+ 10 ou − 10', 2, 1.5, (r) => bin(r.next() < 0.5 ? '+' : '−', ri(r, 11, 89), 10)),
    f('complément à 10', 2, 1.5, (r) => bin('−', 10, ri(r, 1, 9))),
    f('dizaines + dizaines', 2, 1.5, (r) => { const a = ri(r, 1, 8); return bin('+', 10 * a, 10 * ri(r, 1, 9 - a)); }),
    f('deux chiffres + un chiffre, sans retenue', 2, 1.5, (r) => { const n = avecUnites(r, 21, 88, (u) => u <= 7); return bin('+', n, ri(r, 1, 9 - (n % 10))); }),
    f('deux chiffres + un chiffre, avec retenue', 3, 2.5, (r) => { const n = avecUnites(r, 13, 88, (u) => u >= 3); return bin('+', n, ri(r, 11 - (n % 10), 9)); }, 2),
    f('soustraction ≤ 20 avec passage de dizaine', 3, 2.5, (r) => { const a = ri(r, 11, 17); return bin('−', a, ri(r, a - 9, 9)); }, 2),
    f('dizaine − unités', 3, 2, (r) => bin('−', dizaine(r, 2, 9), ri(r, 2, 9))),
    f('− dizaines', 3, 2, (r) => { const n = ri(r, 31, 99); return bin('−', n, dizaine(r, 1, Math.floor(n / 10) - 1)); }),
    f('+ 9', 3, 2.5, (r) => bin('+', ri(r, 11, 80), 9)),
    f('deux nombres < 100', 3, 3, (r) => { const a = ri(r, 11, 59); return bin('+', a, ri(r, 11, Math.min(49, 99 - a))); }),
  ],

  // Nombres jusqu'à 1 000 ; tables de multiplication apprises toute l'année (6 à 9 encore fragiles).
  ce1: [
    f('table d’addition', 1, 1, (r) => bin('+', ri(r, 3, 9), ri(r, 3, 9)), 2),
    f('± dizaines', 1, 1.5, (r) => { const n = ri(r, 21, 89); return r.next() < 0.5 ? bin('+', n, dizaine(r, 1, Math.floor((99 - n) / 10) || 1)) : bin('−', n, dizaine(r, 1, Math.floor(n / 10) - 1)); }),
    f('tables de 2, 5 et 10', 1, 1, (r) => table(r, [2, 5, 10], 2, 10), 2),
    f('± dizaines sur des centaines', 2, 2, (r) => { const n = avecUnites(r, 120, 860, () => true); return r.next() < 0.5 ? bin('+', n, dizaine(r, 1, 9 - Math.floor((n % 100) / 10) || 1)) : bin('−', n, dizaine(r, 1, Math.floor((n % 100) / 10) || 1)); }),
    f('± centaines', 2, 1.5, (r) => { const n = ri(r, 120, 480); return r.next() < 0.5 ? bin('+', n, 100 * ri(r, 1, 5)) : bin('−', n + 400, 100 * ri(r, 1, 4)); }),
    f('tables de 3 et 4', 2, 2, (r) => table(r, [3, 4], 2, 10), 2),
    f('× 10 d’un nombre < 100', 2, 1.5, (r) => prod(r, ri(r, 11, 99), 10)),
    f('multiples de 25', 2, 1.5, (r) => prod(r, 25, ri(r, 2, 4))),
    f('double', 2, 1.5, (r) => prod(r, 2, r.pick(DOUBLES_CE1))),
    f('+ 9, + 19, + 29', 2, 2, (r) => bin('+', ri(r, 21, 70), r.pick([9, 19, 29]))),
    f('− 9', 2, 2, (r) => bin('−', ri(r, 21, 99), 9)),
    f('soustraire un chiffre en passant la dizaine', 2, 2, (r) => { const n = avecUnites(r, 121, 989, (u) => u <= 6); return bin('−', n, ri(r, (n % 10) + 1, 9)); }),
    f('deux nombres à deux chiffres, avec retenue', 3, 3, (r) => { const a = avecUnites(r, 15, 79, (u) => u >= 4); return bin('+', a, avecUnites(r, 15, 79, (u) => u + (a % 10) >= 10)); }),
    f('+ dizaines avec retenue', 3, 3, (r) => { const n = avecUnites(r, 150, 860, () => true); const d = Math.floor((n % 100) / 10); return bin('+', n, 10 * ri(r, Math.max(1, 10 - d), 9)); }),
    f('tables de 6 à 9', 3, 3, (r) => table(r, DURES, 2, 9), 2),
    f('11 à 19 × un chiffre (distributivité)', 3, 4, (r) => prod(r, ri(r, 11, 19), ri(r, 2, 9))),
  ],

  // Nombres jusqu'à 10 000 ; toutes les tables, sens de la division.
  ce2: [
    f('tables faciles', 1, 1, (r) => table(r, FACILES, 2, 10), 2),
    f('± dizaines ou centaines', 1, 1.5, (r) => { const n = ri(r, 110, 690); return r.next() < 0.5 ? bin('+', n, r.next() < 0.5 ? dizaine(r, 2, 9) : 100 * ri(r, 1, 3)) : bin('−', n, dizaine(r, 1, 9)); }),
    f('double', 1, 1.5, (r) => prod(r, 2, r.pick(DOUBLES_CE2))),
    f('× 10 ou × 100', 1, 1.5, (r) => (r.next() < 0.6 ? prod(r, ri(r, 11, 99), 10) : prod(r, ri(r, 2, 9), 100))),
    f('tables de 6 à 9', 2, 2, (r) => table(r, DURES, 2, 10), 2),
    f('+ 8, 9, 18, 19, 28, 29, 38, 39', 2, 2.5, (r) => bin('+', ri(r, 23, 260), r.pick([8, 9, 18, 19, 28, 29, 38, 39]))),
    f('− 9, 19, 29, 39', 2, 2.5, (r) => bin('−', ri(r, 52, 300), r.pick([9, 19, 29, 39]))),
    f('division des tables faciles', 2, 2, (r) => divTable(r, [2, 3, 4, 5, 10], 2, 10)),
    f('trois chiffres + deux chiffres', 2, 2.5, (r) => { const a = avecUnites(r, 120, 480, (u) => u >= 3); return bin('+', a, avecUnites(r, 15, 89, (u) => u + (a % 10) >= 10)); }),
    f('division des tables de 6 à 9', 3, 3, (r) => divTable(r, DURES, 2, 10), 2),
    f('× 4 ou × 8 (doubler)', 3, 4, (r) => (r.next() < 0.6 ? prod(r, 4, ri(r, 12, 49)) : prod(r, 8, ri(r, 12, 39)))),
    f('un chiffre × dizaines', 3, 3, (r) => prod(r, ri(r, 2, 9), dizaine(r, 2, 9))),
    f('deux chiffres × un chiffre (distributivité)', 3, 4.5, (r) => prod(r, ri(r, 13, 49), ri(r, 3, 9))),
  ],

  // Tables fluides ; × 5, × 4, × 8, distributivité, premiers calculs enchaînés.
  cm1: [
    f('tables', 1, 1.5, (r) => table(r, [3, 4, 6, 7, 8, 9], 3, 10), 2),
    f('division des tables', 1, 1.5, (r) => divTable(r, [3, 4, 5, 6, 7, 8, 9], 3, 10)),
    f('× 10 ou × 100', 1, 1, (r) => (r.next() < 0.5 ? prod(r, ri(r, 21, 99), 10) : prod(r, ri(r, 2, 9), 100))),
    f('± dizaines avec retenue', 1, 2, (r) => { const n = avecUnites(r, 150, 860, () => true); const d = Math.floor((n % 100) / 10); return bin('+', n, 10 * ri(r, Math.max(1, 10 - d), 9)); }),
    f('± 8, 9, 18, 19… 39', 2, 2.5, (r) => (r.next() < 0.5 ? bin('+', ri(r, 120, 900), r.pick([8, 9, 18, 19, 28, 29, 38, 39])) : bin('−', ri(r, 140, 950), r.pick([8, 9, 18, 19, 28, 29, 38, 39])))),
    f('un chiffre × dizaines ou centaines', 2, 2.5, (r) => (r.next() < 0.6 ? prod(r, ri(r, 3, 9), dizaine(r, 3, 9)) : prod(r, ri(r, 2, 4), 100 * ri(r, 2, 3)))),
    f('× 5 (× 10 puis moitié)', 2, 3, (r) => prod(r, 5, ri(r, 14, 199))),
    f('× 4 ou × 8', 2, 3.5, (r) => (r.next() < 0.6 ? prod(r, 4, ri(r, 15, 60)) : prod(r, 8, ri(r, 13, 40)))),
    f('multiples de 25 et 50', 2, 2, (r) => (r.next() < 0.5 ? prod(r, 25, ri(r, 3, 8)) : prod(r, 50, ri(r, 3, 9)))),
    f('décompositions de 60', 2, 2, (r) => r.pick([prod(r, 4, 15), prod(r, 5, 12), prod(r, 3, 20), prod(r, 2, 30)])),
    f('distributivité (21 × 35)', 3, 5, (r) => prod(r, r.pick([11, 12, 21, 31]), ri(r, 13, 32))),
    f('deux chiffres × un chiffre', 3, 4.5, (r) => prod(r, ri(r, 14, 59), ri(r, 3, 9))),
    f('trois chiffres + trois chiffres', 3, 4, (r) => { const a = ri(r, 145, 560); return bin('+', a, ri(r, 116, 980 - a)); }),
    f('(table) + nombre', 3, 4.5, (r) => (r.next() < 0.6 ? deux('×', ri(r, 4, 9), ri(r, 4, 9), '+', ri(r, 12, 48)) : deux('×', ri(r, 4, 9), ri(r, 4, 9), '−', ri(r, 82, 99), false))),
    f('division avec quotient jusqu’à 12', 3, 3, (r) => divTable(r, [6, 7, 8, 9], 11, 12)),
  ],

  // × 50, × 25, ÷ 4, ÷ 8, ± 98 ou 99, calculs en plusieurs étapes.
  cm2: [
    f('tables', 1, 1.5, (r) => table(r, [6, 7, 8, 9], 3, 10), 2),
    f('division des tables', 1, 1.5, (r) => divTable(r, [4, 6, 7, 8, 9], 3, 10)),
    f('× 100 ou ± centaines', 1, 1, (r) => (r.next() < 0.5 ? prod(r, ri(r, 2, 9), 100) : bin('+', ri(r, 120, 590), 100 * ri(r, 1, 4)))),
    f('± 98, 99, 49… (passer par le rond)', 2, 2.5, (r) => (r.next() < 0.5 ? bin('+', ri(r, 120, 800), r.pick([19, 29, 49, 59, 98, 99])) : bin('−', ri(r, 230, 980), r.pick([19, 29, 49, 59, 98, 99])))),
    f('× 50', 2, 2.5, (r) => prod(r, 50, ri(r, 11, 19))),
    f('× 25', 2, 3, (r) => prod(r, 25, ri(r, 8, 39))),
    f('dizaines × dizaines', 2, 2.5, (r) => { const a = ri(r, 2, 4); return prod(r, 10 * a, 10 * ri(r, 2, Math.floor(9 / a))); }),
    f('÷ 4 ou ÷ 8 (moitié de la moitié)', 2, 3.5, (r) => (r.next() < 0.6 ? bin('÷', 4 * ri(r, 13, 60), 4) : bin('÷', 8 * ri(r, 13, 40), 8))),
    f('× 5 d’un grand nombre', 2, 2.5, (r) => prod(r, 5, ri(r, 44, 199))),
    f('distributivité (12 × 42)', 3, 5, (r) => prod(r, ri(r, 11, 15), ri(r, 23, 66))),
    f('(table) ± nombre', 3, 5, (r) => (r.next() < 0.5 ? deux('×', ri(r, 6, 9), ri(r, 6, 9), '+', ri(r, 17, 89)) : deux('×', ri(r, 6, 9), ri(r, 6, 9), '−', dizaine(r, 10, 30), false))),
    f('(division) + nombre', 3, 5, (r) => { const d = ri(r, 6, 9); return deux('÷', d * ri(r, 7, 12), d, '+', ri(r, 24, 88)); }),
    f('trois chiffres − trois chiffres', 3, 4.5, (r) => { const a = avecUnites(r, 412, 980, (u) => u <= 5); return bin('−', a, avecUnites(r, 128, a - 50, (u) => u > a % 10)); }),
    f('moitié d’un nombre pair', 3, 3, (r) => bin('÷', 2 * ri(r, 61, 499), 2)),
  ],

  // Pour aller plus loin : facteurs 11 à 19, 25, 50, 99, calculs à trois étapes.
  aventurier: [
    f('tables de 11 et 12', 1, 2, (r) => prod(r, r.pick([11, 12]), ri(r, 3, 12)), 2),
    f('× 25 ou × 50', 1, 1.5, (r) => (r.next() < 0.5 ? prod(r, 25, ri(r, 3, 12)) : prod(r, 50, ri(r, 3, 12)))),
    f('trois chiffres + deux chiffres', 1, 2.5, (r) => { const a = avecUnites(r, 280, 880, (u) => u >= 4); return bin('+', a, avecUnites(r, 37, Math.min(99, 999 - a), (u) => u + (a % 10) >= 10)); }),
    f('13 à 19 × un chiffre', 2, 3, (r) => prod(r, ri(r, 13, 19), ri(r, 4, 9)), 2),
    f('× 25 d’un nombre à deux chiffres', 2, 3, (r) => prod(r, 25, ri(r, 13, 39))),
    f('× 50 d’un nombre à deux chiffres', 2, 2.5, (r) => prod(r, 50, ri(r, 11, 19))),
    f('grandes divisions (144 ÷ 12)', 2, 3, (r) => { const d = r.pick([11, 12, 15, 25]); return bin('÷', d * ri(r, 4, d === 25 ? 9 : 12), d); }),
    f('carrés', 2, 3.5, (r) => { const n = ri(r, 11, 25); return bin('×', n, n); }),
    f('(table) + nombre', 2, 4.5, (r) => deux('×', ri(r, 6, 12), ri(r, 6, 12), '+', ri(r, 17, 99))),
    f('deux nombres de 11 à 19', 3, 5.5, (r) => prod(r, ri(r, 11, 19), ri(r, 12, 19)), 2),
    f('(produit) − (division)', 3, 7, (r) => { const d = ri(r, 6, 12); return paire(['×', ri(r, 11, 15), ri(r, 6, 15)], '−', ['÷', d * ri(r, 6, 12), d]); }),
    f('trois facteurs avec 25', 3, 4, (r) => { const a = r.pick([2, 4, 8]); const b = ri(r, 3, 9); const v = a * b * 25; return v <= MAX_REPONSE ? { text: `${a} × ${b} × 25`, answer: v, op: '×', a, b, ops: 2, nombres: [a, b, 25, a * b] } : null; }),
    f('× 99 ou × 11', 3, 4, (r) => (r.next() < 0.5 ? prod(r, 99, ri(r, 3, 9)) : prod(r, 11, ri(r, 23, 89)))),
    f('trois chiffres ÷ un chiffre', 3, 5, (r) => { const d = ri(r, 3, 9); return bin('÷', d * ri(r, 21, Math.floor(999 / d)), d); }),
    f('(table) − (table)', 3, 5, (r) => paire(['×', ri(r, 7, 12), ri(r, 7, 12)], '−', ['×', ri(r, 3, 6), ri(r, 3, 6)])),
  ],
};

// ---------------------------------------------------------------- tirage

/** Un calcul valide de la famille (réessaie tant qu'un tirage sort des règles). */
function depuis(fam: Famille, r: Rng): Calcul | null {
  for (let k = 0; k < 60; k++) {
    const b = fam.tire(r);
    if (!b) continue;
    if (!Number.isInteger(b.answer) || b.answer < 1 || b.answer > MAX_REPONSE) continue;
    if (b.nombres.some((n) => !Number.isInteger(n) || n < 0 || n > MAX_REPONSE)) continue;
    return { text: b.text, answer: b.answer, op: b.op, a: b.a, b: b.b, ops: b.ops, palier: fam.palier, effort: fam.effort, famille: fam.nom };
  }
  return null;
}

/** Un calcul du niveau et du palier demandés. `refus` écarte une réponse (conflits d'écran, répétitions). */
export function tirerCalcul(niveau: TierId, palier: Palier, r: Rng, refus: (c: Calcul) => boolean = () => false): Calcul {
  const familles = GRILLE[niveau].filter((x) => x.palier === palier);
  const total = familles.reduce((s, x) => s + (x.poids ?? 1), 0);
  let secours: Calcul | null = null;
  for (let essai = 0; essai < 80; essai++) {
    let tirage = r.next() * total;
    let fam = familles[0];
    for (const x of familles) {
      tirage -= x.poids ?? 1;
      if (tirage <= 0) {
        fam = x;
        break;
      }
    }
    const c = depuis(fam, r);
    if (!c) continue;
    secours ??= c;
    if (!refus(c)) return c;
  }
  return secours ?? { text: '2 + 2', answer: 4, op: '+', a: 2, b: 2, ops: 1, palier: 1, effort: 1, famille: 'secours' };
}

// ---------------------------------------------------------------- progression dans une partie

/** Part de chaque palier au départ d'une partie et une fois le plateau atteint. */
export const PART_DEPART: Record<Palier, number> = { 1: 0.65, 2: 0.35, 3: 0 };
export const PART_PLATEAU: Record<Palier, number> = { 1: 0.3, 2: 0.45, 3: 0.25 };
/** Premiers calculs d'une partie, jamais au palier 3. */
export const CALCULS_CALMES = 4;
/** Nombre de calculs pour atteindre le plateau ; ensuite la difficulté n'augmente plus. */
export const CALCULS_AVANT_PLATEAU = 12;

/** Parts des paliers après `n` calculs, avec un léger recul tant que le joueur peine (`aide` de 0 à 1). */
export function partsDesPaliers(n: number, aide = 0): Record<Palier, number> {
  const t = Math.min(1, n / CALCULS_AVANT_PLATEAU);
  const p = { 1: 0, 2: 0, 3: 0 } as Record<Palier, number>;
  for (const k of [1, 2, 3] as Palier[]) p[k] = PART_DEPART[k] + (PART_PLATEAU[k] - PART_DEPART[k]) * t;
  // Un joueur en difficulté retrouve surtout des calculs du palier 1.
  const recul = Math.min(1, Math.max(0, aide)) * 0.8;
  const vers1 = p[3] * recul + p[2] * recul * 0.5;
  p[3] -= p[3] * recul;
  p[2] -= p[2] * recul * 0.5;
  p[1] += vers1;
  return p;
}

/**
 * Suite de calculs d'une partie : progression jusqu'au plateau, respiration après un calcul de palier 3, recul après
 * des erreurs, pas deux fois le même calcul de suite. Le jeu signale chaque réponse avec `resultat()`.
 */
export class TirageCalculs {
  /** calculs déjà tirés */
  n = 0;
  private dernier: Palier = 1;
  private recents: string[] = [];
  private issues: boolean[] = [];

  constructor(
    readonly niveau: TierId,
    private r: Rng,
  ) {}

  /** De 0 à 1 : la part des dernières réponses ratées (deux erreurs sur quatre = 0,5). */
  get aide(): number {
    const d = this.issues.slice(-4);
    const ratees = d.filter((x) => !x).length;
    return ratees >= 3 ? 1 : ratees === 2 ? 0.75 : 0;
  }

  /** Palier du prochain calcul. `force` impose un palier (Décollage ! choisit la couleur selon l'altitude). */
  palierSuivant(): Palier {
    const p = partsDesPaliers(this.n, this.aide);
    // On entre doucement : aucun calcul de découverte parmi les quatre premiers.
    if (this.n < CALCULS_CALMES) {
      p[2] += p[3];
      p[3] = 0;
    }
    // Respiration : après un calcul de découverte, on souffle.
    if (this.dernier === 3) {
      p[2] += p[3];
      p[3] = 0;
    }
    let x = this.r.next() * (p[1] + p[2] + p[3]);
    for (const k of [1, 2, 3] as Palier[]) {
      x -= p[k];
      if (x < 0) return k;
    }
    return 1;
  }

  suivant(refus: (c: Calcul) => boolean = () => false, force?: Palier): Calcul {
    const palier = force ?? this.palierSuivant();
    const c = tirerCalcul(this.niveau, palier, this.r, (x) => this.recents.includes(x.text) || refus(x));
    this.n++;
    this.dernier = c.palier;
    this.recents.push(c.text);
    if (this.recents.length > 6) this.recents.shift();
    return c;
  }

  resultat(juste: boolean): void {
    this.issues.push(juste);
    if (this.issues.length > 8) this.issues.shift();
  }
}

/**
 * Temps de réflexion accordé à un calcul (s), pour les jeux chronométrés : lecture et frappe, plus l'effort, plus large
 * pour les plus jeunes. Les jeux appliquent ensuite leur propre réglage (mode Tranquille, altitude…).
 */
export const LARGESSE: Record<TierId, number> = { cp: 1.6, ce1: 1.45, ce2: 1.3, cm1: 1.2, cm2: 1.12, aventurier: 1 };
export function tempsDeReflexion(c: Calcul, niveau: TierId): number {
  return (2 + 1.5 * c.effort) * LARGESSE[niveau];
}

/** Exemple représentatif d'un niveau (fenêtre de choix, documentation). */
export const EXEMPLES: Record<TierId, string> = {
  cp: '8 + 5',
  ce1: '47 + 28',
  ce2: '8 × 7',
  cm1: '5 × 36',
  cm2: '50 × 14',
  aventurier: '13 × 14',
};
