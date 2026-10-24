/**
 * « Pluie de météores » : toute la logique, sans rendu.
 *
 * Des météores (et des robots) tombent vers la station en portant un calcul.
 * Le joueur tape le résultat chiffre par chiffre ; dès que la saisie correspond
 * exactement à une réponse à l'écran, le vaisseau tire. Une saisie qui ne peut
 * plus devenir aucune réponse est une erreur : elle s'efface et casse le combo.
 *
 * Les positions sont abstraites : x dans [0, 1] (largeur du terrain), p dans
 * [0, 1] (0 = en haut, 1 = sur la station).
 */
import { createRng, type Rng } from '../../core/rng';
import { pickExpression, type Expression } from '../../core/expressions';
import type { TierId } from '../../core/difficulty';
import type { Mode } from '../../core/waves';

export type MeteorKind = 'rocher' | 'robot' | 'dore' | 'boss';

export interface Meteor {
  id: number;
  kind: MeteorKind;
  expr: Expression;
  x: number;
  p: number;
  /** Secondes pour tomber du haut jusqu'à la station. */
  fall: number;
  /** Pour le boss : calculs restants après le courant. */
  queue: Expression[];
  /** Pour le robot : phase de son zigzag. */
  phase: number;
  alive: boolean;
}

export interface WavePlan {
  rocks: number;
  robots: number;
  gold: number;
  /** Intervalle entre deux apparitions (s). */
  every: number;
  /** Durée de chute d'un rocher (s). */
  fall: number;
}

/** Trois vagues puis le boss. Les durées sont ajustées par le mode. */
export const METEOR_WAVES: readonly WavePlan[] = [
  { rocks: 7, robots: 0, gold: 1, every: 3.2, fall: 15 },
  { rocks: 8, robots: 3, gold: 1, every: 2.7, fall: 13 },
  { rocks: 9, robots: 4, gold: 1, every: 2.3, fall: 11.5 },
];
export const BOSS_CALCS = 6;
export const BOSS_FALL = 70;

export const METEOR_MODES: Record<Mode, { speed: number; shields: number | null }> = {
  tranquille: { speed: 0.6, shields: null },
  defi: { speed: 1, shields: 3 },
};

export type MeteorEvent =
  | { type: 'wave'; wave: number }
  | { type: 'spawn'; meteor: Meteor }
  | { type: 'boss'; meteor: Meteor }
  | { type: 'impact'; meteor: Meteor; shieldLost: boolean }
  | { type: 'won' }
  | { type: 'lost' };

export type InputResult =
  | { kind: 'pending' }
  | { kind: 'error'; typed: string }
  | { kind: 'hit'; meteor: Meteor; points: number; destroyed: Meteor[]; bossDone: boolean };

export interface MeteorStats {
  hits: number;
  errors: number;
  impacts: number;
  bestCombo: number;
  /** Hauteur moyenne (p) au moment du tir : plus c'est bas, plus on a tiré tôt. */
  heights: number[];
  /** Par opération : [réussis, ratés (arrivés sur la station)]. */
  byOp: Record<string, [number, number]>;
}

export class MeteorSession {
  readonly tier: TierId;
  readonly mode: Mode;
  private rng: Rng;
  meteors: Meteor[] = [];
  typed = '';
  wave = 0;
  phase: 'play' | 'won' | 'lost' = 'play';
  shields: number | null;
  score = 0;
  combo = 0;
  stats: MeteorStats = { hits: 0, errors: 0, impacts: 0, bestCombo: 0, heights: [], byOp: {} };
  private nextId = 1;
  private toSpawn: MeteorKind[] = [];
  private spawnTimer = 1.5;
  private waveStarted = false;
  private bossPhase = false;
  private lastX = 0.5;

  constructor(tier: TierId, seed: number, mode: Mode) {
    this.tier = tier;
    this.mode = mode;
    this.rng = createRng(seed);
    this.shields = METEOR_MODES[mode].shields;
  }

  get waveCount(): number {
    return METEOR_WAVES.length + 1;
  }

  get alive(): Meteor[] {
    return this.meteors.filter((m) => m.alive);
  }

  private activeAnswers(): number[] {
    return this.alive.map((m) => m.expr.answer);
  }

  private plan(): WavePlan {
    return METEOR_WAVES[this.wave];
  }

  private buildQueue(p: WavePlan): MeteorKind[] {
    const q: MeteorKind[] = [...Array(p.rocks).fill('rocher'), ...Array(p.robots).fill('robot')];
    // Mélange déterministe, puis le météore doré vers le milieu de la vague.
    for (let i = q.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [q[i], q[j]] = [q[j], q[i]];
    }
    for (let g = 0; g < p.gold; g++) q.splice(Math.floor(q.length / 2) + g, 0, 'dore');
    return q;
  }

  /** Abscisse d'apparition : jamais trop près de la précédente. */
  private pickX(): number {
    let x = 0.5;
    for (let k = 0; k < 10; k++) {
      x = 0.1 + this.rng.next() * 0.8;
      if (Math.abs(x - this.lastX) > 0.22) break;
    }
    this.lastX = x;
    return x;
  }

  private spawn(kind: MeteorKind): Meteor {
    const speed = METEOR_MODES[this.mode].speed;
    const base = this.bossPhase ? BOSS_FALL : this.plan().fall;
    const fall = (kind === 'robot' ? base * 1.15 : kind === 'dore' ? base * 0.85 : base) / speed;
    const m: Meteor = {
      id: this.nextId++,
      kind,
      expr: pickExpression(this.tier, this.rng, this.activeAnswers()),
      x: kind === 'boss' ? 0.5 : this.pickX(),
      p: 0,
      fall,
      queue: [],
      phase: this.rng.next() * Math.PI * 2,
      alive: true,
    };
    if (kind === 'boss') {
      for (let i = 1; i < BOSS_CALCS; i++) m.queue.push(pickExpression(this.tier, this.rng, []));
    }
    this.meteors.push(m);
    return m;
  }

  /** Fait avancer le temps de `dt` secondes. */
  update(dt: number): MeteorEvent[] {
    const events: MeteorEvent[] = [];
    if (this.phase !== 'play') return events;
    if (!this.waveStarted && !this.bossPhase) {
      this.waveStarted = true;
      this.toSpawn = this.buildQueue(this.plan());
      events.push({ type: 'wave', wave: this.wave });
    }
    // Apparitions.
    this.spawnTimer -= dt;
    if (!this.bossPhase && this.toSpawn.length > 0 && this.spawnTimer <= 0) {
      const kind = this.toSpawn.shift()!;
      events.push({ type: 'spawn', meteor: this.spawn(kind) });
      this.spawnTimer = this.plan().every / METEOR_MODES[this.mode].speed;
    }
    // Chute et impacts.
    for (const m of this.alive) {
      m.p += dt / m.fall;
      if (m.kind === 'robot') {
        m.phase += dt * 1.6;
        m.x = Math.min(0.92, Math.max(0.08, m.x + Math.cos(m.phase) * dt * 0.12));
      }
      if (m.p >= 1) {
        const lost = this.shields !== null;
        if (m.kind === 'boss') {
          // Le boss qui touche la station recule et revient à la charge.
          m.p = 0.15;
        } else {
          m.alive = false;
        }
        this.stats.impacts++;
        this.countOp(m.expr.op, false);
        this.combo = 0;
        if (lost) this.shields = (this.shields ?? 0) - 1;
        events.push({ type: 'impact', meteor: m, shieldLost: lost });
        if (this.shields !== null && this.shields <= 0) {
          this.phase = 'lost';
          events.push({ type: 'lost' });
          return events;
        }
      }
    }
    // Fin de vague, puis boss, puis victoire.
    if (this.toSpawn.length === 0 && this.alive.length === 0) {
      if (this.bossPhase) {
        this.phase = 'won';
        events.push({ type: 'won' });
      } else if (this.wave + 1 < METEOR_WAVES.length) {
        this.wave++;
        this.waveStarted = false;
        this.spawnTimer = 2.5;
      } else {
        this.bossPhase = true;
        this.wave = METEOR_WAVES.length;
        events.push({ type: 'wave', wave: this.wave });
        events.push({ type: 'boss', meteor: this.spawn('boss') });
      }
    }
    return events;
  }

  /** Le joueur tape un chiffre. */
  input(digit: string): InputResult {
    if (this.phase !== 'play' || !/^[0-9]$/.test(digit)) return { kind: 'pending' };
    if (this.typed.length >= 4) this.typed = '';
    this.typed += digit;
    const value = Number(this.typed);
    const targets = this.alive.filter((m) => m.expr.answer === value && String(m.expr.answer) === this.typed);
    if (targets.length > 0) {
      // Le plus menaçant d'abord (le plus bas).
      const m = targets.sort((a, b) => b.p - a.p)[0];
      return this.hit(m);
    }
    if (this.alive.some((m) => String(m.expr.answer).startsWith(this.typed))) return { kind: 'pending' };
    const typed = this.typed;
    this.typed = '';
    this.combo = 0;
    this.stats.errors++;
    return { kind: 'error', typed };
  }

  backspace(): void {
    this.typed = this.typed.slice(0, -1);
  }

  private hit(m: Meteor): InputResult {
    this.typed = '';
    this.combo++;
    this.stats.hits++;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    this.stats.heights.push(m.p);
    this.countOp(m.expr.op, true);
    const multiplier = 1 + 0.1 * Math.min(this.combo - 1, 20);
    let points = Math.round((50 + 100 * (1 - Math.min(1, m.p))) * multiplier);
    const destroyed: Meteor[] = [];
    let bossDone = false;
    if (m.kind === 'boss') {
      points += 100;
      const next = m.queue.shift();
      if (next) {
        m.expr = next;
        // Chaque coup repousse un peu le boss.
        m.p = Math.max(0, m.p - 0.08);
      } else {
        m.alive = false;
        bossDone = true;
        points += 1000;
        destroyed.push(m);
      }
    } else {
      m.alive = false;
      destroyed.push(m);
      if (m.kind === 'dore') {
        // Onde de choc : tous les autres météores à l'écran explosent aussi (pas le boss).
        points *= 3;
        for (const o of this.alive) {
          if (o.kind === 'boss') continue;
          o.alive = false;
          destroyed.push(o);
          points += 50;
        }
      }
    }
    this.score += points;
    return { kind: 'hit', meteor: m, points, destroyed, bossDone };
  }

  private countOp(op: string, ok: boolean): void {
    const c = (this.stats.byOp[op] ??= [0, 0]);
    c[ok ? 0 : 1]++;
  }

  /** Points bonus hors calcul (canard de l'espace attrapé). */
  bonus(points: number): void {
    if (this.phase === 'play') this.score += points;
  }

  accuracy(): number {
    const tries = this.stats.hits + this.stats.errors;
    return tries === 0 ? 0 : this.stats.hits / tries;
  }
}
