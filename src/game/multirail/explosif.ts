// Le calcul mental du niveau Explosif : des calculs qui combinent plusieurs opérations, de plus en plus élaborés au fil
// du voyage, mais qui plafonnent et laissent respirer. Il remplace les tables en Aventure à ce niveau et les calculs du
// Voyage Zen. L'Entraînement et les autres niveaux gardent les tables simples : c'est là qu'on les apprend.
import { clamp, factDifficulty, type Rng } from './model';
import { boring, countOps, evaluate, format, numbers, ZEN_MAX, type Expr, type Op, type ZenProblem } from './zen';

/** Palier le plus élaboré : 1 s'échauffe, 5 demande de vraiment s'accrocher */
export const PALIER_MAX = 5;

/** Le Voyage Zen laisse plus de temps à calcul égal : la menace y est la pression, pas le vide */
export const TEMPS_ZEN = 1.4;

// ---------------------------------------------------------------- effort d'un calcul

const retenues = (a: number, b: number): number => {
  let n = 0;
  for (let r = 0; a > 0 || b > 0; a = Math.floor(a / 10), b = Math.floor(b / 10)) {
    r = a % 10 + b % 10 + r >= 10 ? 1 : 0;
    n += r;
  }
  return n;
};

const emprunts = (a: number, b: number): number => {
  let n = 0;
  for (let r = 0; a > 0 || b > 0; a = Math.floor(a / 10), b = Math.floor(b / 10)) {
    r = a % 10 - b % 10 - r < 0 ? 1 : 0;
    n += r;
  }
  return n;
};

/** 99, 198, 299… : on passe par la centaine ronde, c'est plus simple que ça n'en a l'air */
const presDeLaCentaine = (n: number): boolean => n >= 98 && n % 100 >= 98;

function coutAddition(a: number, b: number): number {
  if (presDeLaCentaine(a) || presDeLaCentaine(b)) return 1.2;
  const petit = Math.min(a, b);
  return 0.6 + 0.7 * retenues(a, b) + (petit >= 100 ? 0.6 : petit >= 10 ? 0.3 : 0);
}

function coutSoustraction(a: number, b: number): number {
  if (presDeLaCentaine(b)) return 1.4;
  // 300 − 137 : un complément, moins lourd que trois emprunts posés
  if (a % 100 === 0) return 1.9;
  return 0.7 + 0.9 * emprunts(a, b) + (b >= 100 ? 0.6 : b >= 10 ? 0.3 : 0);
}

function coutProduit(a: number, b: number): number {
  const petit = Math.min(a, b);
  const grand = Math.max(a, b);
  if (grand <= 10) return 0.6 + 1.1 * factDifficulty(petit, grand);
  if (grand % 10 === 0) return 0.8 + 0.1 * petit;
  if (grand === 11) return 1.2;
  if (grand === 12) return 1.3 + 0.1 * petit;
  if (grand === 25) return petit % 4 === 0 ? 1 : 1.9;
  return 1.5 + 0.2 * petit + 0.25 * retenues(grand % 10 * petit, (grand - grand % 10) * petit);
}

/**
 * Effort d'un calcul, en secondes pour quelqu'un d'à l'aise : la somme de ses opérations (retenues, emprunts, grands
 * facteurs), plus ce qu'il faut garder en tête d'une étape à l'autre.
 */
export function charge(e: Expr): number {
  if (typeof e === 'number') return 0;
  const a = evaluate(e.l) ?? 0;
  const b = evaluate(e.r) ?? 0;
  const parOp = { '+': coutAddition, '−': coutSoustraction, '×': coutProduit, '÷': (n: number, d: number) => 0.4 + coutProduit(d, Math.max(1, n / d)) };
  const etapes = (typeof e.l === 'number' ? 0 : 1) + (typeof e.r === 'number' ? 0 : 1);
  return charge(e.l) + charge(e.r) + parOp[e.op](a, b) + [0, 0.4, 1.4][etapes];
}

/** Effort attendu à chaque palier : un calcul n'y entre que s'il tombe dans sa bande */
export const BANDES: Record<number, readonly [number, number]> = {
  1: [1.5, 3],
  2: [2.6, 4.2],
  3: [3.8, 5.8],
  4: [5.3, 7.8],
  5: [7.2, 11],
};

/** temps pour lire le calcul et taper la réponse */
const LECTURE = 2.5;
export const TEMPS_MIN = 5.5;
export const TEMPS_MAX = 24;

/**
 * Temps accordé (s) : proportionnel à l'effort du calcul. La marge se resserre doucement de région en région, et
 * s'élargit quand le joueur peine (`adapt` négatif).
 */
export function tempsAccorde(effort: number, region = 0, adapt = 0, facteur = 1): number {
  const marge = (1.85 - 0.08 * Math.min(region, 5)) * (1 - Math.min(0, adapt) * 0.1);
  return Math.round(clamp(LECTURE + marge * effort, TEMPS_MIN, TEMPS_MAX) * facteur * 2) / 2;
}

/**
 * Points d'un calcul : un palier élaboré rapporte plus. Au sommet, 36 % de plus : au-delà, le maximum d'une réponse
 * (série × 4, Ébullition × 2, Grand Pont, voyageur) dépasserait la borne du serveur (`maxPerAnswer`, Games.php).
 */
export const poidsDuPalier = (palier: number): number => 1 + 0.09 * (palier - 1);

/** Une réponse trouvée dans ce délai fait progresser la série (jauge d'Ébullition) */
export const PART_RAPIDE = 0.55;

// ---------------------------------------------------------------- familles de calculs

const N = (op: Op, l: Expr, r: Expr): Expr => ({ op, l, r });

/** Outils d'une famille : le hasard et les tables de la partie */
class Outils {
  private utiles: number[];

  constructor(
    private rng: Rng,
    tables: readonly number[],
  ) {
    // × 10 et × 2 n'apprennent rien ici ; ils restent seulement si le joueur n'a choisi que ces tables
    const interessantes = tables.filter((t) => t >= 3 && t !== 10);
    this.utiles = interessantes.length ? interessantes : tables.filter((t) => t >= 2);
  }

  n(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  choix<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.rng() * xs.length)];
  }

  /** une table de la partie */
  table(): number {
    return this.utiles.length ? this.choix(this.utiles) : this.n(3, 9);
  }

  /** a × b, dans un sens ou dans l'autre ; les grandes tables n'arrivent qu'aux paliers élevés */
  produit(p: number): Expr {
    const a = this.table();
    const b = p === 1 ? this.n(2, 9) : p === 2 ? this.n(3, 9) : this.choix([4, 5, 6, 7, 8, 9, 11, 12]);
    return this.rng() < 0.5 ? N('×', a, b) : N('×', b, a);
  }

  /** division exacte, écrite (d × q) ÷ d */
  quotient(p: number): Expr {
    const d = p <= 2 ? this.n(3, 9) : this.choix([4, 5, 6, 7, 8, 9, 11, 12]);
    return N('÷', d * this.n(3, p <= 2 ? 9 : 12), d);
  }
}

interface Famille {
  id: string;
  /** paliers où elle peut sortir */
  de: number;
  a: number;
  /** moins souvent tirée : les calculs à une seule opération restent l'exception */
  rare?: boolean;
  faire(o: Outils, p: number): Expr;
}

const FAMILLES: readonly Famille[] = [
  // (7 × 8) + 23
  { id: 'p+n', de: 1, a: 3, faire: (o, p) => N('+', o.produit(p), o.n(7, 20 + p * 15)) },
  { id: 'n+p', de: 1, a: 3, faire: (o, p) => N('+', o.n(7, 20 + p * 15), o.produit(p)) },
  { id: 'p-n', de: 1, a: 3, faire: (o, p) => N('−', o.produit(p), o.n(4, 10 + p * 8)) },
  // (25 × 8) − 38 : un joli résultat rond, puis un peu de calcul
  { id: 'vingt-cinq', de: 1, a: 3, faire: (o) => N(o.choix(['+', '−'] as const), N('×', 25, 4 * o.n(1, 4)), o.n(11, 89)) },
  // (40 × 7) − 26
  { id: 'dizaines', de: 1, a: 3, faire: (o) => N(o.choix(['+', '−'] as const), N('×', 10 * o.n(2, 9), o.n(3, 5)), o.n(13, 79)) },
  // (9 × 9) + 16
  { id: 'carre', de: 1, a: 3, faire: (o, p) => { const k = p > 2 && o.n(0, 1) ? o.choix([11, 12]) : o.table(); return N(o.choix(['+', '−'] as const), N('×', k, k), o.n(7, 15 + k)); } },
  // 88 + 77
  { id: 'somme', de: 1, a: 2, rare: true, faire: (o) => N('+', o.n(38, 95), o.n(37, 95)) },
  { id: 'difference', de: 1, a: 3, rare: true, faire: (o) => N('−', o.n(91, 240), o.n(27, 88)) },
  // 288 + 147 : une seule opération, de quoi souffler sans s'ennuyer
  { id: 'grande-somme', de: 2, a: 3, rare: true, faire: (o) => N('+', o.n(126, 289), o.n(117, 199)) },
  { id: 'grande-difference', de: 2, a: 3, rare: true, faire: (o) => N('−', o.n(312, 487), o.n(118, 289)) },
  // 199 + 47 : on passe par la centaine
  { id: 'centaine+', de: 1, a: 3, rare: true, faire: (o) => N('+', 100 * o.n(1, 3) - o.n(1, 2), o.n(23, 97)) },
  // 300 − 137 : le complément
  { id: 'complement', de: 2, a: 3, rare: true, faire: (o) => N('−', 100 * o.n(2, 5), o.n(113, 189)) },
  // 27 + 33 + 15
  { id: 'dizaine-pleine', de: 1, a: 3, faire: (o) => { const a = o.n(1, 7) * 10 + o.n(2, 8); return N('+', N('+', a, 10 * (Math.floor(a / 10) + o.n(1, 3)) - a), o.n(6, 45)); } },
  // (144 ÷ 12) + 87
  { id: 'q+n', de: 2, a: 4, faire: (o, p) => N('+', o.quotient(p), o.n(13, 40 + p * 15)) },
  { id: 'n+q', de: 2, a: 4, faire: (o, p) => N('+', o.n(13, 40 + p * 15), o.quotient(p)) },
  { id: 'q-n', de: 2, a: 3, faire: (o, p) => N('−', o.quotient(p), o.n(3, 9)) },
  // 120 − (7 × 6)
  { id: 'n-p', de: 2, a: 4, faire: (o, p) => N('−', o.n(61, 120 + p * 25), o.produit(p)) },
  // (6 × 7) + (4 × 8)
  { id: 'p+p', de: 3, a: 4, faire: (o, p) => N('+', o.produit(p), o.produit(p)) },
  { id: 'p-p', de: 3, a: 4, faire: (o, p) => N('−', o.produit(p), o.produit(p)) },
  // (84 ÷ 7) × 6
  { id: 'q×k', de: 3, a: 4, faire: (o) => N('×', o.quotient(2), o.n(3, 9)) },
  // (14 + 9) × 4
  { id: 's×k', de: 3, a: 5, faire: (o) => N('×', N('+', o.n(11, 29), o.n(6, 18)), o.n(3, 7)) },
  { id: 'd×k', de: 3, a: 5, faire: (o) => N('×', N('−', o.n(31, 62), o.n(12, 28)), o.n(3, 7)) },
  // (7 × 9) + (96 ÷ 8)
  { id: 'p+q', de: 3, a: 5, faire: (o, p) => N('+', o.produit(p), o.quotient(p)) },
  { id: 'p-q', de: 4, a: 5, faire: (o, p) => N('−', o.produit(p), o.quotient(2)) },
  // 250 − (9 × 8) + 17
  { id: 'n-p+n', de: 3, a: 5, faire: (o, p) => N('+', N('−', o.n(13, 40) * 10, o.produit(p)), o.n(12, 49)) },
  { id: 'n+p-n', de: 3, a: 5, faire: (o, p) => N('−', N('+', o.n(23, 88), o.produit(p)), o.n(14, 59)) },
  { id: 'p+n-n', de: 3, a: 5, faire: (o, p) => N('−', N('+', o.produit(p), o.n(23, 88)), o.n(14, 59)) },
  // 248 + 87 − 139
  { id: 'n+n-n', de: 3, a: 5, faire: (o) => N('−', N('+', o.n(113, 289), o.n(36, 95)), o.n(47, 139)) },
  // (6 × 7) + (9 × 8) − 38
  { id: 'p+p-n', de: 4, a: 5, faire: (o, p) => N('−', N('+', o.produit(p), o.produit(p)), o.n(17, 68)) },
  // 300 − (7 × 8) − (6 × 9)
  { id: 'n-p-p', de: 4, a: 5, faire: (o, p) => N('−', N('−', o.n(15, 45) * 10, o.produit(p)), o.produit(p)) },
  // (58 + 38) ÷ 8 : la somme doit tomber juste
  { id: 's÷d', de: 4, a: 5, faire: (o) => { const d = o.n(4, 9); const t = d * o.n(9, 19); const x = o.n(Math.floor(t * 0.3), Math.floor(t * 0.7)); return N('÷', N('+', x, t - x), d); } },
  // (48 ÷ 6) × 7 + 15
  { id: 'q×k+n', de: 4, a: 5, faire: (o) => N('+', N('×', o.quotient(2), o.n(3, 9)), o.n(13, 58)) },
];

// ---------------------------------------------------------------- rythme du voyage

/** dans une région : on y entre doucement, on monte, on souffle, on atteint le sommet, on souffle */
export const VAGUE = [-1.5, -0.5, 0, 1, -1, 0.5, 1.5, -1.5, 0];

/** niveau autour duquel oscillent les calculs d'une fois le voyage bien lancé : la difficulté ne monte plus au-delà */
export const PLATEAU = 3.6;

/** niveau d'une région : il monte, puis il ondule autour du plateau au lieu de grimper sans fin */
export function niveauDuVoyage(region: number): number {
  const montee = 1.7 + 0.55 * region;
  return montee < PLATEAU ? montee : PLATEAU + [0, 0.3, -0.5][region % 3];
}

/** calculs creux : (36 ÷ 4) × 4, 123 + 38 − 123 ne demandent rien, un seul nombre s'annule */
function creux(e: Expr): boolean {
  if (typeof e === 'number') return false;
  const { l, r } = e;
  if (typeof l !== 'number' && typeof r === 'number') {
    if (l.op === '÷' && e.op === '×' && l.r === r) return true;
    if (e.op === '−' && l.op === '+' && (l.l === r || l.r === r)) return true;
  }
  return creux(l) || creux(r);
}

/** ce qu'il faut éviter de reposer de sitôt */
const FORMES_RECENTES = 4;
/** au-delà, le calcul ne tient plus sur la plaque d'un téléphone en restant lisible */
export const TEXTE_MAX = 24;
const TEXTES_RECENTS = 40;
const PRODUITS_RECENTS = 6;

/** produits d'un calcul, pour ne pas remettre deux fois de suite 7 × 8 */
function produitsDe(e: Expr): string[] {
  if (typeof e === 'number') return [];
  const ici = e.op === '×' && typeof e.l === 'number' && typeof e.r === 'number' ? [`${Math.min(e.l, e.r)}x${Math.max(e.l, e.r)}`] : [];
  return [...ici, ...produitsDe(e.l), ...produitsDe(e.r)];
}

/** Un calcul du niveau Explosif et son effort estimé */
export interface CalculExplosif extends ZenProblem {
  effort: number;
}

export class ExplosifDeck {
  asked = 0;
  /** de −1,5 (on souffle) à +0,5 (le joueur est à l'aise) */
  adapt = 0;
  private outils: Outils;
  private region = -1;
  private rang = 0;
  private dernier = 0;
  private fautes = 0;
  private formes: string[] = [];
  private textes: string[] = [];
  private produits: string[] = [];

  constructor(
    private rng: Rng,
    tables: readonly number[] = [],
    private facteurTemps = 1,
  ) {
    this.outils = new Outils(rng, tables);
  }

  /** palier du prochain calcul : le voyage, la vague, un peu de hasard et la forme du joueur */
  palier(region: number, plafond = PALIER_MAX): number {
    if (region !== this.region) {
      this.region = region;
      this.rang = 0;
    }
    const vague = VAGUE[this.rang++ % VAGUE.length];
    let p = Math.round(niveauDuVoyage(region) + vague + (this.rng() - 0.5) * 0.8 + this.adapt);
    // après un calcul compliqué, toujours plus modéré ; après le sommet, une vraie respiration
    if (this.dernier >= 4) p = Math.min(p, this.dernier - 1);
    if (this.dernier === PALIER_MAX) p = Math.min(p, this.rng() < 0.6 ? 2 : 3);
    if (this.fautes >= 1) p = Math.min(p, Math.max(1, this.dernier - 1));
    if (this.fautes >= 2) p = Math.min(p, 2);
    // les deux premières régions ne vont pas au sommet
    return clamp(p, 1, Math.min(plafond, 3 + region));
  }

  /** un calcul du palier demandé, valide (entier, jamais au-delà de 500) et différent des précédents */
  private tirer(p: number): Expr {
    const [bas, haut] = BANDES[p];
    for (const jeu of [0, 0.5, 1.5]) {
      for (let i = 0; i < 150; i++) {
        const possibles = FAMILLES.filter((f) => p >= f.de && p <= f.a && !this.formes.includes(f.id));
        const famille = this.outils.choix(possibles);
        if (famille.rare && this.rng() < 0.3) continue;
        const e = famille.faire(this.outils, p);
        const valeur = evaluate(e);
        if (valeur === null || valeur < 2 || boring(e) || creux(e) || numbers(e).some((n) => n > ZEN_MAX)) continue;
        const effort = charge(e);
        if (effort < bas - jeu || effort > haut + jeu) continue;
        if (format(e).length > TEXTE_MAX || this.textes.includes(format(e))) continue;
        if (produitsDe(e).some((k) => this.produits.includes(k))) continue;
        this.retenir(famille.id, e);
        return e;
      }
    }
    // repli (en pratique jamais atteint) : un calcul combiné tout simple, jamais une table isolée
    const e = N('+', N('×', this.outils.n(3, 9), this.outils.n(3, 9)), this.outils.n(11, 49));
    this.retenir('p+n', e);
    return e;
  }

  private retenir(forme: string, e: Expr): void {
    this.formes = [...this.formes, forme].slice(-FORMES_RECENTES);
    this.textes = [...this.textes, format(e)].slice(-TEXTES_RECENTS);
    this.produits = [...this.produits, ...produitsDe(e)].slice(-PRODUITS_RECENTS);
  }

  /** `plafond` : le Grand Pont enchaîne trois calculs, il ne va pas au sommet */
  next(region = 0, plafond = PALIER_MAX): CalculExplosif {
    const p = this.palier(region, plafond);
    const e = this.tirer(p);
    this.asked++;
    this.dernier = p;
    const effort = charge(e);
    return { text: format(e), answer: evaluate(e) ?? 0, tier: p, ops: countOps(e), think: tempsAccorde(effort, region, this.adapt, this.facteurTemps), effort };
  }

  /** résultat d'un calcul : `rapide` = réussi nettement avant la fin du temps accordé */
  record(juste: boolean, rapide: boolean): void {
    if (juste) {
      this.fautes = 0;
      this.adapt = Math.min(0.5, this.adapt + (rapide ? 0.15 : 0.05));
    } else {
      this.fautes++;
      this.adapt = Math.max(-1.5, this.adapt - 0.6);
    }
  }
}
