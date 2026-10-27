/**
 * « Décollage ! » : toute la logique, sans rendu.
 *
 * Une petite fusée part du village et doit monter jusqu'à la planète Bonbon.
 * Des calculs apparaissent sans arrêt, chacun avec un temps limité (court pour
 * les calculs faciles). Chaque bonne réponse donne une poussée ; entre deux
 * poussées, la gravité reprend ses droits et il faut se poser sur une plateforme.
 * On pilote à gauche et à droite pendant le vol.
 *
 * Chaque calcul a une couleur (vert facile, orange moyen, rouge difficile, voir
 * core/calc-grade) : plus il est dur, plus il donne de temps et de points. En Défi,
 * un calcul raté (faux ou temps écoulé) coûte un demi-cœur, un cœur entier s'il était vert.
 *
 * Repère : x de 0 à WORLD_W (pixels de la scène), y = altitude en pixels (vers le haut).
 * La position de la fusée est celle du milieu de sa base.
 */
import { createRng, type Rng } from '../../core/rng';
import type { Expression } from '../../core/expressions';
import { gradeOf, pickGrade, pickGraded, type Grade } from '../../core/calc-grade';
import type { TierId } from '../../core/difficulty';
import type { Mode } from '../../core/waves';

export const WORLD_W = 1280;
/** Couloir où se trouvent les plateformes (le pavé et les flèches occupent les bords). */
export const LANE = { x0: 150, x1: 990 };
export const GRAVITY = 640;
export const BOOST = 600;
export const TURBO_FACTOR = 1.35;
export const STEER_ACCEL = 1150;
export const MAX_VX = 310;
export const MAX_FALL = 720;
/** Chute (depuis le plus haut point du saut) au-delà de laquelle l'atterrissage est brutal : plus de deux étages. */
export const HARD_DROP = 520;
/** Chute (sous la dernière plateforme sûre) au-delà de laquelle on est perdu. */
export const FALL_LIMIT = 820;
export const ROCKET_HALF_W = 18;
/** Une plateforme fragile se reforme quelques secondes après sa chute (on n'est jamais coincé). */
export const REGROW = 4;
/** Limites de vol (l'altimètre et le pavé occupent les bords). */
export const FLY = { x0: LANE.x0 - 50, x1: LANE.x1 + 8 };

/** Les cinq étages du monde vertical. */
export const ZONES = [
  { name: 'Le village', top: 1300 },
  { name: 'La mer de nuages', top: 3000 },
  { name: 'Le ciel des dirigeables', top: 4800 },
  { name: 'L’espace', top: 6900 },
  { name: 'La planète Bonbon', top: 7600 },
] as const;
export const SUMMIT = ZONES[ZONES.length - 1].top;

export type PlatformKind = 'sol' | 'normale' | 'mobile' | 'fragile' | 'planete';
export type PowerKind = 'bouclier' | 'sablier' | 'turbo' | 'etoile' | 'coeur';
export type Friend = 'vache' | 'enfant' | 'nuageux' | 'mouton' | 'oiseau' | 'roi' | 'robot' | 'alien' | 'astronaute' | 'ourson';

export interface Platform {
  id: number;
  x: number;
  y: number;
  w: number;
  kind: PlatformKind;
  zone: number;
  /** Plateforme mobile : centre, amplitude, vitesse (rad/s), phase. */
  baseX: number;
  range: number;
  speed: number;
  phase: number;
  /** Plateforme fragile : instant (s) où elle tombe une fois touchée, puis où elle se reforme. */
  crumbleAt: number | null;
  regrowAt: number | null;
  gone: boolean;
  power: PowerKind | null;
  friend: Friend | null;
}

/** Petites étoiles à attraper en vol. */
export interface Star {
  id: number;
  x: number;
  y: number;
  taken: boolean;
}

export interface Question {
  expr: Expression;
  grade: Grade;
  /** Temps total accordé (s). */
  time: number;
  left: number;
}

export interface Rocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Plateforme sous la fusée, ou null en vol. */
  on: number | null;
}

export const ROCKET_MODES: Record<Mode, { lives: number | null; timeFactor: number }> = {
  tranquille: { lives: null, timeFactor: 1.5 },
  defi: { lives: 8, timeFactor: 1 },
};
/** Cœurs au plus (le bonus cœur ne dépasse pas le départ). */
export const MAX_LIVES = 8;
/** Cœurs perdus pour un calcul raté (faux ou temps écoulé), en Défi : rater un vert coûte plus cher. */
export const MISS_COST: Record<Grade, number> = { facile: 1, moyen: 0.5, difficile: 0.5 };
/** Multiplicateur de points : un calcul difficile vaut le risque. */
export const GRADE_POINTS: Record<Grade, number> = { facile: 1, moyen: 1.5, difficile: 2 };
/** Secondes en plus selon la couleur (le calcul lui-même compte déjà dans la base). */
const GRADE_TIME: Record<Grade, number> = { facile: 0, moyen: 1, difficile: 2 };

const TIER_TIME: Record<TierId, number> = { eveil: 1.6, explorateur: 1.3, stratege: 1.12, maitre: 1 };

export type RocketEvent =
  | { type: 'question'; q: Question }
  | { type: 'timeout'; q: Question; lifeLost: number }
  | { type: 'land'; platform: Platform; impact: number; hard: boolean; record: boolean; lifeLost: boolean }
  | { type: 'power'; kind: PowerKind; platform: Platform }
  | { type: 'star'; star: Star }
  | { type: 'crumble'; platform: Platform }
  | { type: 'regrow'; platform: Platform }
  | { type: 'fall'; lifeLost: boolean; shieldUsed: boolean; to: Platform }
  | { type: 'zone'; zone: number }
  | { type: 'won' }
  | { type: 'lost' };

export type InputResult =
  | { kind: 'pending' }
  | { kind: 'wrong'; typed: string; expected: number; lifeLost: number }
  | { kind: 'correct'; points: number; turbo: boolean };

export interface RocketStats {
  correct: number;
  wrong: number;
  timeouts: number;
  falls: number;
  hardLandings: number;
  powers: number;
  stars: number;
  bestCombo: number;
  /** Par opération : [justes, ratés]. */
  byOp: Record<string, [number, number]>;
}

/**
 * Temps accordé pour un calcul : court pour les calculs faciles, plus long pour
 * les tables difficiles et les divisions ; un peu plus court en altitude. Une seconde
 * de plus pour tout le monde, deux en Éveil ou en Tranquille, et un supplément selon la couleur.
 */
export function timeFor(e: Expression, tier: TierId, mode: Mode, altitude: number): number {
  const big = Math.max(e.a, e.b);
  let base: number;
  switch (e.op) {
    case '+':
    case '−':
      base = 2.2 + Math.min(4, big / 25) + (e.answer >= 10 && e.a % 10 + e.b % 10 >= 10 ? 0.8 : 0);
      break;
    case '×':
      base = [2, 5, 10].includes(e.a) || [2, 5, 10].includes(e.b) ? 3 : 3.6 + Math.min(e.a, e.b) * 0.25;
      break;
    case '÷':
      base = 4.2 + e.b * 0.25;
      break;
  }
  const height = 1 - 0.18 * Math.min(1, altitude / SUMMIT);
  const extra = (tier === 'eveil' || mode === 'tranquille' ? 2 : 1) + GRADE_TIME[gradeOf(e, tier)];
  return Math.round(Math.min(13, Math.max(3, base * TIER_TIME[tier] * ROCKET_MODES[mode].timeFactor * height + extra)) * 10) / 10;
}

export function zoneAt(y: number): number {
  const i = ZONES.findIndex((z) => y < z.top);
  return i < 0 ? ZONES.length - 1 : i;
}

/** Fabrique le monde vertical : plateformes, bonus, habitants et étoiles. */
export function buildWorld(seed: number): { platforms: Platform[]; stars: Star[] } {
  const rng = createRng(seed ^ 0x5eed);
  const platforms: Platform[] = [];
  const stars: Star[] = [];
  let id = 1;
  const mk = (x: number, y: number, w: number, kind: PlatformKind, zone: number): Platform => ({
    id: id++, x, y, w, kind, zone, baseX: x, range: 0, speed: 0, phase: 0, crumbleAt: null, regrowAt: null, gone: false, power: null, friend: null,
  });
  // Le pas de tir.
  platforms.push(mk((LANE.x0 + LANE.x1) / 2, 0, LANE.x1 - LANE.x0 + 120, 'sol', 0));
  const friendsByZone: Friend[][] = [
    ['vache', 'enfant', 'enfant'],
    ['nuageux', 'mouton', 'oiseau', 'nuageux'],
    ['oiseau', 'roi', 'nuageux'],
    ['robot', 'alien', 'astronaute'],
  ];
  const powers: PowerKind[] = ['bouclier', 'sablier', 'turbo', 'etoile', 'etoile', 'coeur'];
  let x = (LANE.x0 + LANE.x1) / 2;
  let y = 0;
  let sinceMoving = 0;
  while (true) {
    const zone = zoneAt(y + 200);
    const t = Math.min(1, y / SUMMIT);
    const gap = rng.int(165, 215) + Math.round(t * 20);
    y += gap;
    if (y > SUMMIT - 230) break;
    // Décalage horizontal : de plus en plus audacieux en montant.
    const shift = rng.int(110, 250 + Math.round(t * 130)) * (rng.next() < 0.5 ? -1 : 1);
    const w = Math.round(230 - t * 110 + rng.int(-15, 15));
    x = Math.min(LANE.x1 - w / 2, Math.max(LANE.x0 + w / 2, x + shift));
    let kind: PlatformKind = 'normale';
    const roll = rng.next();
    if (zone >= 1 && roll < 0.12 + t * 0.2 && sinceMoving > 1) kind = 'mobile';
    else if (zone >= 1 && roll > 0.9 - t * 0.12) kind = 'fragile';
    sinceMoving = kind === 'mobile' ? 0 : sinceMoving + 1;
    const p = mk(x, y, w, kind, zone);
    if (kind === 'mobile') {
      p.range = rng.int(60, 120);
      p.speed = 0.9 + rng.next() * 0.8;
      p.phase = rng.next() * Math.PI * 2;
      p.baseX = Math.min(LANE.x1 - p.range - w / 2, Math.max(LANE.x0 + p.range + w / 2, x));
      p.x = p.baseX;
    }
    if (kind !== 'fragile' && rng.next() < 0.2) p.power = rng.pick(powers);
    else if (kind === 'normale' && zone < 4 && rng.next() < 0.45) p.friend = rng.pick(friendsByZone[Math.min(3, zone)]);
    platforms.push(p);
    // Petit chapelet d'étoiles entre deux plateformes, à aller chercher en vol.
    if (rng.next() < 0.45) {
      const sx = Math.min(LANE.x1, Math.max(LANE.x0, x + rng.int(-200, 200)));
      for (let k = 0; k < 3; k++) stars.push({ id: stars.length + 1, x: sx + (k - 1) * 34, y: y + 90 + (k === 1 ? 18 : 0), taken: false });
    }
  }
  // Dernières marches : la planète doit rester à portée d'une poussée.
  let last = platforms[platforms.length - 1];
  while (SUMMIT - last.y > 230) {
    const ny = last.y + Math.min(205, Math.round((SUMMIT - last.y) / 2));
    const nx = Math.min(LANE.x1 - 90, Math.max(LANE.x0 + 90, last.x + rng.int(-200, 200)));
    last = mk(nx, ny, 150, 'normale', zoneAt(ny));
    platforms.push(last);
  }
  // La planète Bonbon, tout en haut : une grande surface où se poser.
  platforms.push(mk((LANE.x0 + LANE.x1) / 2, SUMMIT, LANE.x1 - LANE.x0 + 120, 'planete', ZONES.length - 1));
  return { platforms, stars };
}

export class RocketSession {
  readonly rng: Rng;
  readonly platforms: Platform[];
  readonly stars: Star[];
  readonly rocket: Rocket = { x: 640, y: 0, vx: 0, vy: 0, on: 1 };
  question: Question | null = null;
  typed = '';
  score = 0;
  combo = 0;
  lives: number | null;
  phase: 'play' | 'won' | 'lost' = 'play';
  /** Bouclier : sauve d'une chute (une fois). */
  shield = false;
  /** Prochaine poussée renforcée. */
  turbo = false;
  /** Nombre de calculs restants avec plus de temps (sablier). */
  slow = 0;
  /** Plus haute altitude atteinte, et dernière plateforme sûre. */
  best = 0;
  safe = 1;
  zone = 0;
  /** Plus haut point atteint depuis le dernier atterrissage. */
  private peak = 0;
  time = 0;
  /** Délai avant le prochain calcul (s). */
  private wait = 0.6;
  readonly stats: RocketStats = { correct: 0, wrong: 0, timeouts: 0, falls: 0, hardLandings: 0, powers: 0, stars: 0, bestCombo: 0, byOp: {} };

  constructor(
    readonly tier: TierId,
    seed: number,
    readonly mode: Mode,
  ) {
    this.rng = createRng(seed);
    const w = buildWorld(seed);
    this.platforms = w.platforms;
    this.stars = w.stars;
    this.lives = ROCKET_MODES[mode].lives;
  }

  get altitude(): number {
    return Math.max(0, this.rocket.y);
  }

  /** Part de calculs justes. */
  accuracy(): number {
    const n = this.stats.correct + this.stats.wrong + this.stats.timeouts;
    return n === 0 ? 1 : this.stats.correct / n;
  }

  platform(id: number | null): Platform | undefined {
    return id === null ? undefined : this.platforms.find((p) => p.id === id);
  }

  /** Un pas de simulation. `steer` : -1 gauche, 0, 1 droite. */
  step(dt: number, steer: -1 | 0 | 1): RocketEvent[] {
    const ev: RocketEvent[] = [];
    if (this.phase !== 'play') return ev;
    this.time += dt;
    this.movePlatforms(ev);
    this.tickQuestion(dt, ev);
    this.moveRocket(dt, steer, ev);
    return ev;
  }

  /** Le joueur tape un chiffre. La réponse est jugée dès qu'elle a le bon nombre de chiffres. */
  input(digit: string): InputResult {
    const q = this.question;
    if (this.phase !== 'play' || !q || !/^[0-9]$/.test(digit)) return { kind: 'pending' };
    this.typed += digit;
    const expected = q.expr.answer;
    if (this.typed.length < String(expected).length) return { kind: 'pending' };
    const typed = this.typed;
    this.typed = '';
    this.question = null;
    const op = q.expr.op;
    const tally = (this.stats.byOp[op] ??= [0, 0]);
    if (Number(typed) !== expected) {
      tally[1]++;
      this.stats.wrong++;
      this.combo = 0;
      this.wait = 0.7;
      const lifeLost = this.miss(q);
      this.checkLost([]);
      return { kind: 'wrong', typed, expected, lifeLost };
    }
    tally[0]++;
    this.stats.correct++;
    this.combo++;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    // Points : rapidité et série.
    const quick = q.left / q.time;
    const points = Math.round((20 + 30 * quick) * (1 + Math.min(10, this.combo - 1) * 0.1) * GRADE_POINTS[q.grade]);
    this.score += points;
    const turbo = this.turbo;
    this.turbo = false;
    this.boost(turbo);
    this.wait = 0.25;
    return { kind: 'correct', points, turbo };
  }

  backspace(): void {
    this.typed = this.typed.slice(0, -1);
  }

  // --- interne ---------------------------------------------------------------------------------

  /** Calcul raté (faux ou temps écoulé) : en Défi, un demi-cœur, un cœur entier s'il était facile. */
  private miss(q: Question): number {
    if (this.lives === null) return 0;
    const cost = Math.min(this.lives, MISS_COST[q.grade]);
    this.lives -= cost;
    return cost;
  }

  private boost(turbo: boolean): void {
    const r = this.rocket;
    const v = BOOST * (turbo ? TURBO_FACTOR : 1);
    r.vy = Math.max(r.vy, 0) * 0.25 + v;
    r.on = null;
  }

  private tickQuestion(dt: number, ev: RocketEvent[]): void {
    if (!this.question) {
      this.wait -= dt;
      if (this.wait > 0) return;
      // On tire d'abord la couleur (plus de rouge en altitude), puis un calcul de cette couleur.
      const zone = zoneAt(this.altitude);
      const grade = pickGrade(this.tier, this.rng, Math.max(0, zone - 1) / 3);
      const expr = pickGraded(this.tier, this.rng, grade);
      let time = timeFor(expr, this.tier, this.mode, this.altitude);
      if (this.slow > 0) {
        time = Math.round(time * 1.6 * 10) / 10;
        this.slow--;
      }
      this.question = { expr, grade: gradeOf(expr, this.tier), time, left: time };
      this.typed = '';
      ev.push({ type: 'question', q: this.question });
      return;
    }
    this.question.left -= dt;
    if (this.question.left <= 0) {
      const q = this.question;
      this.question = null;
      this.typed = '';
      this.stats.timeouts++;
      (this.stats.byOp[q.expr.op] ??= [0, 0])[1]++;
      this.combo = 0;
      this.wait = 0.5;
      ev.push({ type: 'timeout', q, lifeLost: this.miss(q) });
      this.checkLost(ev);
    }
  }

  private movePlatforms(ev: RocketEvent[]): void {
    const r = this.rocket;
    for (const p of this.platforms) {
      if (p.gone) {
        if (p.regrowAt !== null && this.time >= p.regrowAt) {
          p.gone = false;
          p.regrowAt = null;
          p.crumbleAt = null;
          ev.push({ type: 'regrow', platform: p });
        }
        continue;
      }
      if (p.kind === 'mobile') {
        const before = p.x;
        p.x = p.baseX + Math.sin(this.time * p.speed + p.phase) * p.range;
        if (r.on === p.id) r.x += p.x - before;
      }
      if (p.crumbleAt !== null && this.time >= p.crumbleAt) {
        p.gone = true;
        p.crumbleAt = null;
        p.regrowAt = this.time + REGROW;
        ev.push({ type: 'crumble', platform: p });
        if (r.on === p.id) r.on = null;
      }
    }
  }

  private moveRocket(dt: number, steer: -1 | 0 | 1, ev: RocketEvent[]): void {
    const r = this.rocket;
    if (r.on !== null) {
      // Posée : elle ne bouge qu'avec sa plateforme.
      r.vx = 0;
      r.vy = 0;
      return;
    }
    // Pilotage horizontal, avec un peu de glisse.
    if (steer !== 0) r.vx += steer * STEER_ACCEL * dt;
    else r.vx *= Math.exp(-2.6 * dt);
    r.vx = Math.max(-MAX_VX, Math.min(MAX_VX, r.vx));
    const prevY = r.y;
    r.vy = Math.max(-MAX_FALL, r.vy - GRAVITY * dt);
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    this.peak = Math.max(this.peak, r.y);
    if (r.x < FLY.x0 || r.x > FLY.x1) {
      r.x = Math.max(FLY.x0, Math.min(FLY.x1, r.x));
      r.vx *= -0.4;
    }
    // Étoiles attrapées au passage.
    for (const s of this.stars) {
      if (!s.taken && Math.abs(s.x - r.x) < 26 && s.y - r.y > -10 && s.y - r.y < 70) {
        s.taken = true;
        this.stats.stars++;
        this.score += 25;
        ev.push({ type: 'star', star: s });
      }
    }
    if (r.vy <= 0) {
      // Atterrissage : la base traverse le dessus d'une plateforme en descendant.
      for (const p of this.platforms) {
        if (p.gone || prevY < p.y || r.y > p.y) continue;
        if (Math.abs(r.x - p.x) > p.w / 2 + 6) continue;
        this.land(p, -r.vy, ev);
        return;
      }
    }
    if (r.y > this.best) this.best = r.y;
    const z = zoneAt(r.y);
    if (z > this.zone) {
      this.zone = z;
      ev.push({ type: 'zone', zone: z });
    }
    // Chute trop longue : on est rattrapé, mais cela peut coûter une vie.
    const safe = this.platform(this.safe);
    const floor = safe && !safe.gone ? safe.y : 0;
    if (r.y < floor - FALL_LIMIT || r.y < -80) this.fall(ev);
  }

  private land(p: Platform, impact: number, ev: RocketEvent[]): void {
    const r = this.rocket;
    r.y = p.y;
    r.vy = 0;
    r.vx = 0;
    r.on = p.id;
    const hard = this.peak - p.y > HARD_DROP;
    this.peak = p.y;
    let lifeLost = false;
    if (hard) {
      this.stats.hardLandings++;
      this.combo = 0;
      if (this.lives !== null) {
        if (this.shield) this.shield = false;
        else {
          this.lives--;
          lifeLost = true;
        }
      }
    }
    const record = p.y > (this.platform(this.safe)?.y ?? 0) && p.kind !== 'sol';
    if (record) this.score += 50;
    this.safe = p.id;
    if (p.kind === 'fragile' && p.crumbleAt === null) p.crumbleAt = this.time + 1.6;
    ev.push({ type: 'land', platform: p, impact, hard, record, lifeLost });
    if (p.power) {
      const kind = p.power;
      p.power = null;
      this.stats.powers++;
      this.applyPower(kind);
      ev.push({ type: 'power', kind, platform: p });
    }
    if (p.kind === 'planete') {
      this.phase = 'won';
      this.score += 1000 + Math.round((this.lives ?? 0) * 300);
      ev.push({ type: 'won' });
      return;
    }
    this.checkLost(ev);
  }

  private applyPower(kind: PowerKind): void {
    switch (kind) {
      case 'bouclier':
        this.shield = true;
        break;
      case 'sablier':
        this.slow = 5;
        break;
      case 'turbo':
        this.turbo = true;
        break;
      case 'etoile':
        this.score += 200;
        break;
      case 'coeur':
        if (this.lives !== null) this.lives = Math.min(MAX_LIVES, this.lives + 1);
        else this.score += 100;
        break;
    }
  }

  /** Rattrapé après une chute : retour sur la dernière plateforme sûre (ou une plus basse). */
  private fall(ev: RocketEvent[]): void {
    const r = this.rocket;
    this.stats.falls++;
    this.combo = 0;
    let lifeLost = false;
    let shieldUsed = false;
    if (this.shield) {
      this.shield = false;
      shieldUsed = true;
    } else if (this.lives !== null) {
      this.lives--;
      lifeLost = true;
    }
    let to = this.platform(this.safe);
    if (!to || to.gone) {
      // La plateforme sûre s'est effondrée : la plus haute encore debout en dessous.
      to = this.platforms.filter((p) => !p.gone && p.y <= r.y + FALL_LIMIT).sort((a, b) => b.y - a.y)[0] ?? this.platforms[0];
    }
    r.x = to.x;
    r.y = to.y;
    r.vx = 0;
    r.vy = 0;
    r.on = to.id;
    this.safe = to.id;
    this.peak = to.y;
    if (to.kind === 'fragile') to.crumbleAt = null;
    ev.push({ type: 'fall', lifeLost, shieldUsed, to });
    this.checkLost(ev);
  }

  private checkLost(ev: RocketEvent[]): void {
    if (this.lives !== null && this.lives <= 0) {
      this.lives = 0;
      this.phase = 'lost';
      this.question = null;
      ev.push({ type: 'lost' });
    }
  }
}
