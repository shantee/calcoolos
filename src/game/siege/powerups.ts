/**
 * Bonus volants de « Cubes de siège », sans aucun rendu.
 *
 * Deux fois par partie, un engin (soucoupe ou dirigeable) traverse le ciel avec un
 * calcul. Bonne réponse avant qu'il ne parte : son chargement tombe et donne un
 * bonus, rangé dans l'un des deux emplacements, à utiliser quand on veut. Un échec
 * ne coûte rien : l'engin repart avec son chargement.
 */
import { createRng, type Rng } from '../../core/rng';
import { pickExpression, type Expression } from '../../core/expressions';
import type { TierId } from '../../core/difficulty';
import { WAVES, type EnemyKind, type Mode } from '../../core/waves';

export type PowerKind = 'poussee' | 'gel' | 'supertir';

export const POWERS: Record<PowerKind, { name: string; hint: string }> = {
  poussee: { name: 'Super Poussée', hint: 'envoie le monstre tout au fond' },
  gel: { name: 'Gel', hint: 'le monstre reste figé quelques secondes' },
  supertir: { name: 'Méga-tir', hint: 'ton prochain tir frappe deux fois plus fort' },
};

export const MAX_SLOTS = 2;
/** Nombre de passages d'engins par partie : un ou deux bonus, pas plus. */
export const PASSES_PER_GAME = 2;
/** Erreurs permises sur un calcul bonus (la deuxième fait fuir l'engin). */
export const MAX_ERRORS = 2;

export type Vehicle = 'soucoupe' | 'dirigeable';

export interface Flight {
  expr: Expression;
  cargo: PowerKind;
  vehicle: Vehicle;
  /** Temps laissé pour répondre (ms) : la durée de la traversée. */
  durationMs: number;
  typed: string;
  errors: number;
  state: 'flying' | 'caught' | 'escaped';
}

export type TypeResult = 'typing' | 'caught' | 'wrong' | 'escaped' | 'ignored';

/** Durée de la traversée : plus de temps en Tranquille, un peu moins pour les grands. */
export function flightMs(tier: TierId, mode: Mode): number {
  const base: Record<TierId, number> = { eveil: 7000, explorateur: 7000, stratege: 6500, maitre: 6000 };
  return mode === 'tranquille' ? base[tier] : base[tier] - 1500;
}

/** Durée du gel (ms). */
export function freezeMs(mode: Mode): number {
  return mode === 'tranquille' ? 6000 : 5000;
}

/** Bornes de la Super Poussée (abscisses de la scène, 1280 px de large). */
export const PUSH = {
  /** Point le plus lointain où l'on peut renvoyer un monstre (sa pancarte reste visible). */
  farX: 1170,
  /** Il faut que le monstre ait avancé d'au moins cette distance depuis le fond. */
  minAdvance: 110,
};

/** Où retombe un monstre frappé par la Super Poussée. Le Roi, trop lourd, ne recule qu'à moitié. */
export function pushTarget(x: number, kind: EnemyKind): number {
  if (x >= PUSH.farX) return x;
  return kind === 'roi' ? Math.round(x + (PUSH.farX - x) * 0.5) : PUSH.farX;
}

/** État du monstre au moment où l'on veut utiliser un bonus. */
export interface UseContext {
  /** Abscisse du monstre, ou null s'il n'y en a pas. */
  enemyX: number | null;
  entering: boolean;
  frozen: boolean;
  pushing: boolean;
  charged: boolean;
}

export type UseCheck = { ok: true; kind: PowerKind } | { ok: false; reason: string };

/** Un calcul bonus ne doit pas être trivial (pas de « 3 + 1 » ni de « × 1 »). */
function bonusExpression(tier: TierId, rng: Rng): Expression {
  let e = pickExpression(tier, rng);
  for (let k = 0; k < 40 && (e.a <= 1 || e.b <= 1 || e.answer < 5); k++) e = pickExpression(tier, rng);
  return e;
}

export class PowerUps {
  readonly tier: TierId;
  readonly mode: Mode;
  readonly slots: Array<PowerKind | null> = Array(MAX_SLOTS).fill(null);
  flight: Flight | null = null;
  /** Monstre (rang dans la partie) à partir duquel chaque passage peut avoir lieu. */
  readonly plan: number[];
  launched = 0;
  caught = 0;
  private rng: Rng;

  constructor(tier: TierId, mode: Mode, seed: number) {
    this.tier = tier;
    this.mode = mode;
    this.rng = createRng(seed ^ 0x5eed);
    // Premier passage pendant la vague 2, second pendant les vagues 3 ou 4 : la vague 1 reste calme.
    const start = (w: number) => WAVES.slice(0, w).reduce((n, wave) => n + wave.length, 0);
    const total = start(WAVES.length);
    this.plan = [this.rng.int(start(1), start(2) - 1), this.rng.int(start(2), total - 1)].slice(0, PASSES_PER_GAME);
  }

  get slotsFull(): boolean {
    return this.slots.every((s) => s !== null);
  }

  /** Un passage est-il dû pour le monstre de rang `enemyIndex` ? (sans regarder le reste de l'écran) */
  due(enemyIndex: number): boolean {
    return this.flight === null && this.launched < this.plan.length && enemyIndex >= this.plan[this.launched] && !this.slotsFull;
  }

  /** Délai (ms) entre l'entrée du monstre et le passage, tiré au hasard. */
  delayAfterEnemy(): number {
    return this.rng.int(1500, 4000);
  }

  /** Lance un passage (le premier chargement est toujours la Super Poussée). */
  launch(force = false): Flight | null {
    if (this.flight || this.slotsFull) return null;
    if (!force && this.launched >= this.plan.length) return null;
    const cargo: PowerKind = this.caught === 0 && !this.slots.includes('poussee') ? 'poussee' : this.rollCargo();
    this.flight = {
      expr: bonusExpression(this.tier, this.rng),
      cargo,
      vehicle: this.launched % 2 === 0 ? 'soucoupe' : 'dirigeable',
      durationMs: flightMs(this.tier, this.mode),
      typed: '',
      errors: 0,
      state: 'flying',
    };
    this.launched++;
    return this.flight;
  }

  private rollCargo(): PowerKind {
    const r = this.rng.next();
    return r < 0.4 ? 'poussee' : r < 0.7 ? 'gel' : 'supertir';
  }

  /** Un chiffre tapé pour le calcul bonus. */
  type(digit: string): TypeResult {
    const f = this.flight;
    if (!f || f.state !== 'flying' || !/^[0-9]$/.test(digit)) return 'ignored';
    const answer = String(f.expr.answer);
    f.typed += digit;
    if (f.typed.length < answer.length) return 'typing';
    if (f.typed === answer) {
      f.state = 'caught';
      return 'caught';
    }
    f.errors++;
    f.typed = '';
    if (f.errors >= MAX_ERRORS) {
      f.state = 'escaped';
      return 'escaped';
    }
    return 'wrong';
  }

  /** Efface le dernier chiffre ; false s'il n'y avait rien à effacer. */
  erase(): boolean {
    const f = this.flight;
    if (!f || f.state !== 'flying' || f.typed === '') return false;
    f.typed = f.typed.slice(0, -1);
    return true;
  }

  /** L'engin a quitté l'écran sans réponse juste. */
  expire(): void {
    if (this.flight?.state === 'flying') this.flight.state = 'escaped';
  }

  /** Range le chargement d'un engin attrapé ; renvoie l'emplacement, ou -1 si tout est plein. */
  collect(): number {
    const f = this.flight;
    if (!f || f.state !== 'caught') return -1;
    const i = this.slots.indexOf(null);
    if (i < 0) return -1;
    this.slots[i] = f.cargo;
    this.caught++;
    return i;
  }

  /** L'engin est sorti de scène (attrapé ou non) : on peut en lancer un autre. */
  endFlight(): void {
    this.flight = null;
  }

  /** Vérifie qu'un bonus peut servir maintenant, sans le consommer. */
  check(slot: number, ctx: UseContext): UseCheck {
    const kind = this.slots[slot];
    if (!kind) return { ok: false, reason: 'Cet emplacement est vide' };
    if (kind === 'supertir') return ctx.charged ? { ok: false, reason: 'Ton tir est déjà chargé !' } : { ok: true, kind };
    if (ctx.enemyX === null || ctx.entering) return { ok: false, reason: 'Attends que le monstre arrive' };
    if (ctx.pushing) return { ok: false, reason: 'Un instant…' };
    if (kind === 'gel') return ctx.frozen ? { ok: false, reason: 'Il est déjà gelé !' } : { ok: true, kind };
    if (ctx.enemyX > PUSH.farX - PUSH.minAdvance) return { ok: false, reason: 'Il est encore loin : garde ta Super Poussée !' };
    return { ok: true, kind };
  }

  /** Consomme le bonus (après check). */
  take(slot: number): PowerKind | null {
    const kind = this.slots[slot];
    this.slots[slot] = null;
    return kind;
  }
}
