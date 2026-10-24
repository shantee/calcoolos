/**
 * « Le Dragon gourmand » — arcade et réflexion.
 *
 * On guide un dragon-lanterne (souris, doigt ou flèches) dans le ciel de
 * l'archipel. Il avale des lanternes numérotées pour faire EXACTEMENT le nombre
 * demandé ; les lanternes avalées brillent dans son corps (le total n'est jamais
 * affiché). Objectif atteint : il crache du feu et gagne une écaille d'or.
 * Trop mangé : hoquet, il recrache tout. Puis viennent la nuit, les
 * chauves-souris, et l'orage.
 *
 * Toute la logique de calcul est dans session.ts ; ici on montre et on anime.
 */
import Phaser from 'phaser';
import * as B from '../../art/variant-b';
import * as Wd from '../../art/world-b';
import * as Sp from '../../art/space';
import * as D from '../../art/dragon';
import { Sfx } from '../sfx';
import { Fireworks } from '../fx';
import { DragonSession, DRAGON_MODES, DRAGON_STAGES, type EatResult, type Goal, type Orb, type Setback } from './session';
import { TIERS, type Tier, type TierId } from '../../core/difficulty';
import type { Mode } from '../../core/waves';
import { reportResult, outcomeText } from '../../platform/results';

export const W = 1280;
export const H = 720;
const K = 1 / B.RES;

const SEA_Y = 652;
const BOUNDS = { x0: 40, x1: 1240, y0: 135, y1: 632 };
const SPEED = 205;
const TURN = 4.2;
const SPACING = 27;
const HEAD_SCALE = 0.78;
const SEG_SCALE = 0.74;
const EAT_RADIUS = 46;
/** À partir de quelle série le dragon devient doré (« en feu »). */
const FEVER_COMBO = 4;
const RECORD_KEY = 'calcoolos.dragon.records';

const STAGE_NAMES = ['Crépuscule', 'Nuit', 'Orage'];
const STAGE_BANNERS = [
  'Ciel 1 : le crépuscule',
  'Ciel 2 : la nuit tombe… attention aux chauves-souris !',
  'Ciel 3 : l’orage gronde ! Évite les éclairs',
];

function style(size: number, color: string, weight = 700, stroke = 0): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: B.FONT, fontSize: `${size}px`, fontStyle: String(weight), color, stroke: B.C.ink, strokeThickness: stroke, resolution: 2 };
}

const wrapAngle = (a: number): number => Phaser.Math.Angle.Wrap(a);

interface OrbView {
  orb: Orb;
  c: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Image;
  phase: number;
  dying: boolean;
}

interface Piece {
  kind: 'ventre' | 'or' | 'corps';
  seg: Phaser.GameObjects.Image;
  lamp?: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  leg?: Phaser.GameObjects.Image;
  slot: number;
}

interface Bat {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  state: 'chasse' | 'fuite' | 'brulee';
  scaredUntil: number;
  phase: number;
}

interface Storm {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  nextStrike: number;
  charging: boolean;
  column: Phaser.GameObjects.Rectangle;
}

interface Firefly {
  img: Phaser.GameObjects.Image;
  hx: number;
  hy: number;
  x: number;
  y: number;
  seed: number;
}

export class DragonScene extends Phaser.Scene {
  private tier!: Tier;
  private seed = 1;
  private session: DragonSession | null = null;
  private sfx = new Sfx();
  private reducedMotion = false;
  private speedBoost = 1;
  private fx!: Fireworks;

  // Dragon
  private head = { x: 640, y: 380, a: 0 };
  private path: Array<{ x: number; y: number }> = [];
  private headImg!: Phaser.GameObjects.Image;
  private whiskers!: Phaser.GameObjects.Graphics;
  private tailImg!: Phaser.GameObjects.Image;
  private belly: Piece[] = [];
  /** Lanternes d'un objectif réussi, en train de se changer en écaille d'or. */
  private celebrating: Piece[] = [];
  private golds: Piece[] = [];
  private base: Piece[] = [];
  private faceOverride: { face: D.DragonFace; until: number } | null = null;
  private invulnerableUntil = 0;
  private breathingUntil = 0;
  private fever = false;
  /** Défaite : le dragon pique vers la mer, les commandes sont coupées. */
  private diving = false;
  /** Après le plouf, seule la tête dépasse de l'eau. */
  private sunk = false;
  private steer: { x: number; y: number } | null = null;
  private wander = { x: 640, y: 380, next: 0 };
  private cursors: Record<string, Phaser.Input.Keyboard.Key> = {};

  // Monde
  private orbViews = new Map<number, OrbView>();
  private bats: Bat[] = [];
  private nextBatAt = 0;
  private storms: Storm[] = [];
  private cake: { img: Phaser.GameObjects.Image; t0: number; dir: number; y: number } | null = null;
  private nextCakeAt = 0;
  private balloon: Phaser.GameObjects.Container | null = null;
  private nextBalloonAt = 0;
  private fireflies: Firefly[] = [];
  private moonImg!: Phaser.GameObjects.Image;
  private moonFace!: Phaser.GameObjects.Image;
  private moonFaceUntil = 0;
  private dusk!: Phaser.GameObjects.Image;
  private veil!: Phaser.GameObjects.Rectangle;
  private auroraImg!: Phaser.GameObjects.Image;
  private flash!: Phaser.GameObjects.Rectangle;
  private rain: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private beamImg: Phaser.GameObjects.Image | null = null;

  // Particules
  private fire!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireSmoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private scales!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hearts!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokePuffs!: Phaser.GameObjects.Particles.ParticleEmitter;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private notes!: Phaser.GameObjects.Particles.ParticleEmitter;

  // Interface
  private scoreText!: Phaser.GameObjects.Text;
  private scoreShown = 0;
  private scoreTween: Phaser.Tweens.Tween | null = null;
  private comboText!: Phaser.GameObjects.Text;
  private goalBox!: Phaser.GameObjects.Container;
  private goalLabel!: Phaser.GameObjects.Text;
  private goalNumber!: Phaser.GameObjects.Text;
  private goalOp!: Phaser.GameObjects.Text;
  private fuse!: Phaser.GameObjects.Graphics;
  private fuseSpark!: Phaser.GameObjects.Image;
  private stageText!: Phaser.GameObjects.Text;
  private stageDots: Phaser.GameObjects.Image[] = [];
  private heartIcons: Phaser.GameObjects.Image[] = [];
  private soundText!: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayButtons: Array<{ c: Phaser.GameObjects.Container; run: () => void }> = [];
  private overlayFocus = 0;
  private keyboardUsed = false;
  private paused = false;
  private ending = false;
  private musicLevel = 0;
  private shownStage = 0;
  private wreck: Phaser.GameObjects.GameObject[] = [];
  private startedAt = 0;
  private stampText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('dragon-gourmand');
  }

  private tex(key: string, make: () => HTMLCanvasElement): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, make());
    return key;
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    this.seed = Number(params.get('graine')) || Math.floor(Math.random() * 1e9);
    this.tier = TIERS[params.get('niveau') as TierId] ?? TIERS.explorateur;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || params.has('calme');
    this.speedBoost = Math.min(10, Math.max(1, Number(params.get('accelere')) || 1));
    this.fx = new Fireworks(this, 70, this.reducedMotion);

    this.buildWorld();
    this.buildParticles();
    this.buildDragon();
    this.buildHud();
    this.bindInput();
    this.startAmbientLife();
    this.showIntro();

    (window as unknown as { __dragon: unknown }).__dragon = {
      session: () => this.session,
      start: (mode: Mode) => this.startGame(mode),
      feed: (id: number) => this.eat(id),
      goto: (x: number, y: number) => (this.steer = { x, y }),
      head: () => ({ ...this.head }),
      overlay: () => this.overlay !== null,
      ending: () => this.ending,
      pause: () => this.pause(),
      resume: () => this.resume(),
      spawnBat: () => this.spawnBat(),
      spawnCake: () => this.spawnCake(),
      spawnBalloon: () => this.spawnBalloon(),
      hurt: () => this.hurt('chauve-souris'),
    };
  }

  // --- Décor ------------------------------------------------------------------------------------------
  private buildWorld(): void {
    this.add.image(0, 0, this.tex('d-sky', () => D.sky(W, H))).setOrigin(0).setDepth(0);
    this.dusk = this.add.image(0, H - 320, this.tex('d-dusk', () => D.duskGlow(W, 320))).setOrigin(0).setDisplaySize(W, 320).setDepth(1);
    this.auroraImg = this.add.image(0, 40, this.tex('d-aurora', () => D.aurora(W, 420))).setOrigin(0).setDisplaySize(W, 420).setDepth(1.5).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    // Étoiles qui scintillent.
    const star = this.tex('d-star', () => B.sparkle('#fff6dc'));
    for (let i = 0; i < 26; i++) {
      const s = this.add.image(Phaser.Math.Between(20, W - 20), Phaser.Math.Between(110, 430), star).setScale(K * Phaser.Math.FloatBetween(0.4, 0.9)).setDepth(2).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD);
      if (!this.reducedMotion) this.tweens.add({ targets: s, alpha: 0.1, scale: s.scale * 0.5, duration: Phaser.Math.Between(900, 2200), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000), ease: 'Sine.easeInOut' });
    }
    // Lune endormie.
    this.moonImg = this.add.image(1078, 222, this.tex('d-moon', () => D.moon(58))).setScale(K).setDepth(2.5).setInteractive({ useHandCursor: true });
    this.add.image(1078, 222, this.tex('d-moonglow', () => B.softGlow(150, '#fff2c8'))).setDepth(2.4).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    (['dort', 'clin', 'rougit'] as const).forEach((s) => this.tex(`d-moonface-${s}`, () => Wd.moonFace(s)));
    this.moonFace = this.add.image(1078, 226, 'd-moonface-dort').setScale(K * 0.85).setDepth(2.6);
    this.moonImg.on('pointerdown', () => {
      this.sfx.unlock();
      this.sfx.chime();
      this.moonMood('rougit', 1500);
      this.say(1078, 150, 'Chut… je dors !', 1400);
    });
    // Nuages lointains qui dérivent.
    for (let i = 0; i < 4; i++) {
      const cl = this.add.image(Phaser.Math.Between(0, W), 150 + i * 70, this.tex(`d-cloud-${i}`, () => D.nightCloud(260 + i * 40, 80, i + 3))).setDepth(3).setAlpha(0.55 - i * 0.07);
      if (!this.reducedMotion) {
        this.tweens.add({ targets: cl, x: { from: -200, to: W + 200 }, duration: 90000 + i * 25000, repeat: -1, delay: -Phaser.Math.Between(0, 80000) });
      }
    }
    // Îles, mer, reflet de lune.
    this.add.image(0, 470, this.tex('d-islands', () => D.farIslands(W, 200))).setOrigin(0).setDepth(6);
    this.add.image(0, SEA_Y, this.tex('d-sea', () => D.sea(W, H - SEA_Y))).setOrigin(0).setDepth(7);
    const path = this.add.image(1078, SEA_Y, this.tex('d-moonpath', () => D.moonPath(160, H - SEA_Y))).setOrigin(0.5, 0).setDepth(7.2).setBlendMode(Phaser.BlendModes.ADD);
    if (!this.reducedMotion) this.tweens.add({ targets: path, scaleX: 1.15, alpha: 0.7, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Le phare de Cubes de siège, sur son île, balaie le ciel.
    const isle = this.add.graphics().setDepth(8);
    isle.fillStyle(0x1e1636, 1);
    isle.fillEllipse(120, SEA_Y + 6, 230, 46);
    this.add.image(120, SEA_Y + 2, this.tex('b-tower', B.tower)).setOrigin(0.5, 1).setScale(K * 0.42).setDepth(8.2).setTint(0x9a86c8);
    this.beamImg = this.add.image(120, SEA_Y - 112, this.tex('w-beam', Wd.beam)).setOrigin(0, 0.5).setScale(0.55).setDepth(8.1).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    if (!this.reducedMotion) this.tweens.add({ targets: this.beamImg, angle: { from: -40, to: 10 }, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Voile de la nuit (s'assombrit de ciel en ciel) et éclair plein écran.
    this.veil = this.add.rectangle(W / 2, H / 2, W, H, 0x0a0820, 0).setDepth(9.5);
    this.flash = this.add.rectangle(W / 2, H / 2, W, H, 0xfff8e0, 0).setDepth(58);
  }

  private buildParticles(): void {
    this.fire = this.add.particles(0, 0, this.tex('d-flame', D.flame), {
      speed: { min: 380, max: 640 },
      lifespan: { min: 380, max: 620 },
      scale: { start: 0.7, end: 2.4 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      frequency: 10,
      quantity: 2,
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(45);
    this.fireSmoke = this.add.particles(0, 0, this.tex('d-smoke', D.smoke), {
      speed: { min: 160, max: 300 },
      lifespan: { min: 700, max: 1100 },
      scale: { start: 0.6, end: 2.6 },
      alpha: { start: 0.5, end: 0 },
      frequency: 40,
      emitting: false,
    }).setDepth(44);
    this.sparks = this.add.particles(0, 0, this.tex('d-spark', () => B.sparkle('#fff6dc')), {
      speed: { min: 100, max: 360 },
      angle: { min: 0, max: 360 },
      rotate: { min: 0, max: 360 },
      lifespan: { min: 300, max: 700 },
      scale: { start: 0.7, end: 0 },
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(46);
    this.scales = this.add.particles(0, 0, this.tex('d-scale', D.scale), {
      speed: { min: 120, max: 320 },
      angle: { min: 0, max: 360 },
      rotate: { min: -360, max: 360 },
      gravityY: 380,
      lifespan: 1100,
      scale: { start: K * 1.2, end: K * 0.5 },
      emitting: false,
    }).setDepth(46);
    this.hearts = this.add.particles(0, 0, this.tex('d-heart', D.tinyHeart), {
      speedY: { min: -140, max: -60 },
      speedX: { min: -60, max: 60 },
      lifespan: 1200,
      scale: { start: K * 1.4, end: 0 },
      emitting: false,
    }).setDepth(46);
    this.smokePuffs = this.add.particles(0, 0, 'd-smoke', {
      speed: { min: 20, max: 80 },
      angle: { min: 0, max: 360 },
      lifespan: 900,
      scale: { start: 0.6, end: 1.8 },
      alpha: { start: 0.7, end: 0 },
      emitting: false,
    }).setDepth(44);
    this.notes = this.add.particles(0, 0, this.tex('d-note', D.note), {
      speedY: { min: -70, max: -40 },
      speedX: { min: -30, max: 30 },
      lifespan: 1600,
      scale: { start: K * 1.1, end: K * 0.6 },
      alpha: { start: 1, end: 0 },
      rotate: { min: -20, max: 20 },
      emitting: false,
    }).setDepth(46);
    this.tex('d-cookie-glow', () => B.softGlow(40, '#ffd27a'));
    this.tex('d-orbglow', () => B.softGlow(60, '#ffb35a'));
  }

  // --- Le dragon -----------------------------------------------------------------------------------------
  private buildDragon(): void {
    (['normal', 'gueule', 'content', 'beurk', 'aie'] as D.DragonFace[]).forEach((f) => this.tex(`d-head-${f}`, () => D.dragonHead(f)));
    (['corps', 'or', 'ventre'] as const).forEach((k) => this.tex(`d-seg-${k}`, () => D.segment(k)));
    this.tex('d-leg', D.leg);
    this.tex('d-lamp', () => D.lantern(false));
    this.tex('d-lamp-gold', () => D.lantern(true));
    this.tailImg = this.add.image(0, 0, this.tex('d-tail', D.tail)).setOrigin(0.92, 0.5).setScale(K * SEG_SCALE).setDepth(30);
    for (let i = 0; i < 3; i++) this.base.push(this.makePiece('corps', i));
    this.headImg = this.add.image(0, 0, 'd-head-normal').setOrigin(D.HEAD_ORIGIN.x, D.HEAD_ORIGIN.y).setScale(K * HEAD_SCALE).setDepth(40);
    this.whiskers = this.add.graphics().setDepth(39.95);
    this.headImg.setInteractive({ useHandCursor: true });
    this.headImg.on('pointerdown', () => {
      this.sfx.unlock();
      this.setFace('content', 900);
      this.hearts.explode(4, this.head.x, this.head.y - 30);
      this.sfx.yum();
    });
    if (!this.reducedMotion) {
      this.trail = this.add.particles(0, 0, this.tex('d-trail', () => B.sparkle('#ffd27a')), {
        lifespan: 700,
        speed: { min: 5, max: 30 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.9, end: 0 },
        frequency: 40,
        emitting: false,
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(29);
    }
    this.resetDragon(640, 400);
  }

  private makePiece(kind: Piece['kind'], slot: number, value?: number): Piece {
    const seg = this.add.image(0, 0, `d-seg-${kind}`).setScale(K * SEG_SCALE).setDepth(31);
    const p: Piece = { kind, seg, slot };
    if (kind === 'ventre' && value !== undefined) {
      p.lamp = this.add.image(0, 0, 'd-lamp').setScale(K * 0.6).setDepth(31.5);
      p.label = this.add.text(0, 0, String(value), { ...style(24, B.C.ink, 800), stroke: '#fff2c8', strokeThickness: 5 }).setOrigin(0.5).setDepth(31.6);
    }
    return p;
  }

  private destroyPiece(p: Piece): void {
    p.seg.destroy();
    p.lamp?.destroy();
    p.label?.destroy();
    p.leg?.destroy();
  }

  private get pieces(): Piece[] {
    return [...this.belly, ...this.celebrating, ...this.golds, ...this.base];
  }

  private resetDragon(x: number, y: number): void {
    this.head = { x, y, a: 0 };
    this.path = [];
    for (let i = 40; i >= 1; i--) this.path.push({ x: x - i * 12, y });
    for (const p of [...this.belly, ...this.celebrating, ...this.golds]) this.destroyPiece(p);
    this.belly = [];
    this.celebrating = [];
    this.golds = [];
    this.base.forEach((p, i) => (p.slot = i));
    this.refreshLegs();
  }

  /** Une petite patte tous les trois segments (hors ventre). */
  private refreshLegs(): void {
    const body = [...this.golds, ...this.base];
    body.forEach((p, i) => {
      const want = i % 3 === 1;
      if (want && !p.leg) p.leg = this.add.image(0, 0, 'd-leg').setOrigin(0.15, 0.1).setScale(K * SEG_SCALE).setDepth(30.5);
      if (!want && p.leg) {
        p.leg.destroy();
        p.leg = undefined;
      }
    });
  }

  /** Point du chemin parcouru, à la distance `d` derrière la tête. */
  private pathPoint(d: number): { x: number; y: number; a: number } {
    let remaining = d;
    let prev = { x: this.head.x, y: this.head.y };
    for (let i = this.path.length - 1; i >= 0; i--) {
      const p = this.path[i];
      const seg = Math.hypot(prev.x - p.x, prev.y - p.y);
      if (seg > 0 && seg >= remaining) {
        const t = remaining / seg;
        return { x: prev.x + (p.x - prev.x) * t, y: prev.y + (p.y - prev.y) * t, a: Math.atan2(prev.y - p.y, prev.x - p.x) };
      }
      remaining -= seg;
      prev = p;
    }
    return { x: prev.x - Math.cos(this.head.a) * remaining, y: prev.y - Math.sin(this.head.a) * remaining, a: this.head.a };
  }

  /** Position monde d'un point de la tête (coordonnées en pixels de texture, origine au cou). */
  private headPoint(lx: number, ly: number): { x: number; y: number } {
    const s = HEAD_SCALE;
    const flip = Math.cos(this.head.a) < 0 ? -1 : 1;
    const dx = (lx - D.HEAD_ORIGIN.x * D.HEAD_W) * s;
    const dy = (ly - D.HEAD_ORIGIN.y * D.HEAD_H) * s * flip;
    const c = Math.cos(this.head.a);
    const sn = Math.sin(this.head.a);
    return { x: this.head.x + dx * c - dy * sn, y: this.head.y + dx * sn + dy * c };
  }

  private mouth(): { x: number; y: number } {
    return this.headPoint(112, 72);
  }

  private setFace(face: D.DragonFace, ms: number): void {
    this.faceOverride = { face, until: this.time.now + ms };
  }

  private moveDragon(time: number, dt: number): void {
    if (this.diving) {
      this.trackPath();
      return;
    }
    const playing = this.isPlaying();
    let desired = this.head.a;
    let hasDesire = false;
    if (playing) {
      const k = this.cursors;
      const kx = (k.right?.isDown || k.d?.isDown ? 1 : 0) - (k.left?.isDown || k.a?.isDown ? 1 : 0);
      const ky = (k.down?.isDown || k.s?.isDown ? 1 : 0) - (k.up?.isDown || k.w?.isDown ? 1 : 0);
      if (kx || ky) {
        desired = Math.atan2(ky, kx);
        hasDesire = true;
        this.steer = null;
      } else if (this.steer && Math.hypot(this.steer.x - this.head.x, this.steer.y - this.head.y) > 26) {
        desired = Math.atan2(this.steer.y - this.head.y, this.steer.x - this.head.x);
        hasDesire = true;
      }
    } else if (!this.ending || this.session?.phase === 'won') {
      // Pendant les menus, le dragon se promène tout seul.
      if (time > this.wander.next || Math.hypot(this.wander.x - this.head.x, this.wander.y - this.head.y) < 60) {
        this.wander = { x: Phaser.Math.Between(160, W - 160), y: Phaser.Math.Between(200, 560), next: time + 4000 };
      }
      desired = Math.atan2(this.wander.y - this.head.y, this.wander.x - this.head.x);
      hasDesire = true;
    }
    // Murs souples : près d'un bord, le dragon fait demi-tour en douceur.
    const m = 60;
    const out = this.head.x < BOUNDS.x0 + m || this.head.x > BOUNDS.x1 - m || this.head.y < BOUNDS.y0 + m || this.head.y > BOUNDS.y1 - m;
    if (out) {
      const toCenter = Math.atan2(380 - this.head.y, 640 - this.head.x);
      const heading = { x: Math.cos(this.head.a), y: Math.sin(this.head.a) };
      const goingOut = (this.head.x < BOUNDS.x0 + m && heading.x < 0) || (this.head.x > BOUNDS.x1 - m && heading.x > 0) || (this.head.y < BOUNDS.y0 + m && heading.y < 0) || (this.head.y > BOUNDS.y1 - m && heading.y > 0);
      if (goingOut && (!hasDesire || Math.abs(wrapAngle(desired - toCenter)) > Math.PI / 2)) desired = toCenter;
    }
    const diff = wrapAngle(desired - this.head.a);
    const hurtSlow = time < this.invulnerableUntil ? 0.75 : 1;
    const turn = TURN * (this.fever ? 1.15 : 1);
    this.head.a = wrapAngle(this.head.a + Phaser.Math.Clamp(diff, -turn * dt, turn * dt));
    const modeSpeed = this.session ? DRAGON_MODES[this.session.mode].speed : 0.8;
    const v = SPEED * modeSpeed * (this.fever ? 1.1 : 1) * hurtSlow * (playing ? 1 : 0.75);
    this.head.x = Phaser.Math.Clamp(this.head.x + Math.cos(this.head.a) * v * dt, BOUNDS.x0, BOUNDS.x1);
    this.head.y = Phaser.Math.Clamp(this.head.y + Math.sin(this.head.a) * v * dt, BOUNDS.y0, BOUNDS.y1);
    this.trackPath();
  }

  /** Mémorise le chemin de la tête (le corps le suit) et oublie le trop vieux. */
  private trackPath(): void {
    const last = this.path[this.path.length - 1];
    if (!last || Math.hypot(last.x - this.head.x, last.y - this.head.y) >= 4) this.path.push({ x: this.head.x, y: this.head.y });
    const need = (this.pieces.length + 4) * SPACING + 200;
    let len = 0;
    for (let i = this.path.length - 1; i > 0; i--) {
      len += Math.hypot(this.path[i].x - this.path[i - 1].x, this.path[i].y - this.path[i - 1].y);
      if (len > need) {
        this.path.splice(0, i - 1);
        break;
      }
    }
  }

  private placeDragon(time: number, dt: number): void {
    const flipHead = Math.cos(this.head.a) < 0;
    this.headImg.setPosition(this.head.x, this.head.y).setRotation(this.head.a).setFlipY(flipHead);
    // Visage : forcé, gueule ouverte près d'une lanterne, ou normal.
    let face: D.DragonFace = 'normal';
    if (this.faceOverride && time < this.faceOverride.until) face = this.faceOverride.face;
    else if (time < this.breathingUntil) face = 'gueule';
    else if (this.isPlaying() && this.lanternAhead()) face = 'gueule';
    this.headImg.setTexture(`d-head-${face}`);
    let blink = time < this.invulnerableUntil ? (Math.floor(time / 90) % 2 ? 0.35 : 1) : 1;
    this.headImg.setAlpha(blink);
    if (this.sunk) {
      this.headImg.setPosition(this.head.x, SEA_Y + 4 + Math.sin(time / 400) * 4).setRotation(-0.35 + Math.sin(time / 600) * 0.08).setFlipY(false).setDepth(8.7);
      blink = 0;
    }

    const pieces = this.pieces;
    const ease = Math.min(1, dt * 7);
    let lastPoint = { x: this.head.x, y: this.head.y, a: this.head.a };
    pieces.forEach((p, i) => {
      p.slot += (i - p.slot) * ease;
      const d = 30 + p.slot * SPACING;
      const pt = this.pathPoint(d);
      const wave = this.reducedMotion ? 0 : Math.sin(time / 210 - p.slot * 0.75) * 4.5;
      const x = pt.x - Math.sin(pt.a) * wave;
      const y = pt.y + Math.cos(pt.a) * wave;
      const flip = Math.cos(pt.a) < 0;
      p.seg.setPosition(x, y).setRotation(pt.a).setFlipY(flip).setDepth(39 - i * 0.02).setAlpha(blink);
      if (p.lamp && p.label) {
        const glow = 1 + Math.sin(time / 180 + i) * 0.04;
        p.lamp.setPosition(x, y + 2).setScale(K * 0.6 * glow).setDepth(39.5 - i * 0.002).setAlpha(blink);
        p.label.setPosition(x, y + 5).setDepth(39.501 - i * 0.002).setAlpha(blink);
      }
      if (p.leg) {
        const side = flip ? -1 : 1;
        const lx = x - Math.sin(pt.a) * 14 * side;
        const ly = y + Math.cos(pt.a) * 14 * side;
        const kick = this.reducedMotion ? 0 : Math.sin(time / 120 + i) * 0.35;
        p.leg.setPosition(lx, ly).setRotation(pt.a + kick * side).setFlipY(flip).setDepth(38.9 - i * 0.02).setAlpha(blink);
      }
      lastPoint = { x, y, a: pt.a };
    });
    const tp = this.pathPoint(30 + (pieces.length - 0.2) * SPACING);
    const swish = this.reducedMotion ? 0 : Math.sin(time / 260) * 0.25;
    this.tailImg.setPosition(tp.x, tp.y).setRotation(tp.a + swish).setFlipY(Math.cos(tp.a) < 0).setAlpha(blink);
    void lastPoint;
    if (this.trail) {
      this.trail.setPosition(tp.x, tp.y);
      if (this.fever && !this.trail.emitting) this.trail.start();
      if (!this.fever && this.trail.emitting) this.trail.stop();
    }
    this.drawWhiskers(time);
  }

  /** Moustaches dorées qui ondulent derrière la tête. */
  private drawWhiskers(time: number): void {
    const g = this.whiskers;
    g.clear();
    if (this.sunk) return;
    const base = this.headPoint(122, 62);
    const back = { x: -Math.cos(this.head.a), y: -Math.sin(this.head.a) };
    const flip = Math.cos(this.head.a) < 0 ? -1 : 1;
    const perp = { x: back.y * flip, y: -back.x * flip };
    const fwd = { x: -back.x, y: -back.y };
    // Deux moustaches qui pendent sous le museau et flottent vers l'arrière.
    for (const [len, ph] of [[1, 0], [0.7, 1.7]] as const) {
      const w1 = Math.sin(time / 170 + ph) * 8;
      const w2 = Math.sin(time / 140 + ph + 1) * 14;
      const p0 = new Phaser.Math.Vector2(base.x, base.y);
      const p1 = new Phaser.Math.Vector2(base.x + fwd.x * 12 + perp.x * 22, base.y + fwd.y * 12 + perp.y * 22);
      const p2 = new Phaser.Math.Vector2(base.x + back.x * 40 * len + perp.x * (38 + w1) * len, base.y + back.y * 40 * len + perp.y * (38 + w1) * len);
      const p3 = new Phaser.Math.Vector2(base.x + back.x * 92 * len + perp.x * (26 + w2) * len, base.y + back.y * 92 * len + perp.y * (26 + w2) * len);
      const curve = new Phaser.Curves.CubicBezier(p0, p1, p2, p3);
      g.lineStyle(5, 0x1d1a2b, this.headImg.alpha);
      curve.draw(g, 20);
      g.lineStyle(2.5, this.fever ? 0xfff0b0 : 0xffc94a, this.headImg.alpha);
      curve.draw(g, 20);
    }
  }

  private lanternAhead(): boolean {
    const m = this.mouth();
    for (const v of this.orbViews.values()) {
      if (v.dying) continue;
      const dx = v.orb.x - m.x;
      const dy = v.orb.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d < 120 && Math.abs(wrapAngle(Math.atan2(dy, dx) - this.head.a)) < 0.9) return true;
    }
    return false;
  }

  // --- Lanternes ------------------------------------------------------------------------------------------
  private addOrbView(orb: Orb, delay = 0): void {
    const c = this.add.container(orb.x, orb.y).setDepth(20);
    const glow = this.add.image(0, 4, 'd-orbglow').setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    const lamp = this.add.image(0, 0, 'd-lamp').setScale(K * 0.86);
    const label = this.add.text(0, 6, String(orb.value), { ...style(30, B.C.ink, 800), stroke: '#fff2c8', strokeThickness: 5 }).setOrigin(0.5);
    c.add([glow, lamp, label]);
    const v: OrbView = { orb, c, glow, phase: Math.random() * Math.PI * 2, dying: false };
    this.orbViews.set(orb.id, v);
    c.setScale(0);
    this.tweens.add({ targets: c, scale: 1, duration: 420, delay, ease: 'Back.easeOut' });
    if (delay < 50) this.sparks.explode(this.reducedMotion ? 2 : 6, orb.x, orb.y);
    else this.time.delayedCall(delay, () => this.sparks.explode(this.reducedMotion ? 2 : 6, orb.x, orb.y));
  }

  private removeOrbView(id: number, how: 'pop' | 'eaten'): void {
    const v = this.orbViews.get(id);
    if (!v) return;
    this.orbViews.delete(id);
    v.dying = true;
    if (how === 'eaten') {
      const m = this.mouth();
      this.tweens.add({ targets: v.c, x: m.x, y: m.y, scale: 0.2, duration: 120, ease: 'Cubic.easeIn', onComplete: () => v.c.destroy() });
    } else {
      this.smokePuffs.explode(4, v.c.x, v.c.y);
      this.tweens.add({ targets: v.c, scale: 0, alpha: 0, duration: 260, ease: 'Back.easeIn', onComplete: () => v.c.destroy() });
    }
  }

  private applyMoves(r: { added: Orb[]; removed: number[] }, delay = 0): void {
    for (const id of r.removed) this.removeOrbView(id, 'pop');
    r.added.forEach((o, i) => this.addOrbView(o, delay + i * 90));
  }

  private animateOrbs(time: number): void {
    for (const v of this.orbViews.values()) {
      if (v.dying) continue;
      const bob = this.reducedMotion ? 0 : Math.sin(time / 600 + v.phase) * 6;
      v.c.y = v.orb.y + bob;
      v.c.x = v.orb.x;
      if (!this.reducedMotion) v.c.rotation = Math.sin(time / 900 + v.phase) * 0.06;
      v.glow.setAlpha(0.28 + Math.sin(time / 300 + v.phase) * 0.08);
    }
  }

  // --- Manger ---------------------------------------------------------------------------------------------
  private checkEat(): void {
    const m = this.mouth();
    for (const v of this.orbViews.values()) {
      if (v.dying) continue;
      if (Math.hypot(v.orb.x - m.x, v.orb.y - m.y) < EAT_RADIUS) {
        this.eat(v.orb.id);
        return;
      }
    }
  }

  private eat(id: number): void {
    const s = this.session;
    if (!s || s.phase !== 'play' || this.ending) return;
    const r = s.eat(id, { x: this.head.x, y: this.head.y });
    if (r.kind === 'ignored') return;
    this.sfx.unlock();
    this.sfx.chomp();
    this.removeOrbView(id, 'eaten');
    if (!this.reducedMotion) this.tweens.add({ targets: this.headImg, scale: { from: K * HEAD_SCALE * 1.18, to: K * HEAD_SCALE }, duration: 220, ease: 'Back.easeOut' });
    const value = r.orb.value;
    // Toujours : la lanterne rejoint le ventre.
    const piece = this.makePiece('ventre', -1, value);
    this.belly.unshift(piece);
    this.sfx.gulp(this.belly.length - 1);
    if (!this.reducedMotion) this.tweens.add({ targets: piece.seg, scale: { from: K * SEG_SCALE * 1.5, to: K * SEG_SCALE }, duration: 300, ease: 'Back.easeOut' });

    if (r.kind === 'progress') {
      this.applyMoves(r, 250);
      return;
    }
    if (r.kind === 'overshoot') {
      this.applyMoves(r, 900);
      this.overshoot();
      this.refreshScore();
      return;
    }
    this.complete(r);
  }

  /** Objectif atteint : le ventre s'illumine, le dragon crache du feu, une écaille d'or apparaît. */
  private complete(r: Extract<EatResult, { kind: 'complete' }>): void {
    const s = this.session!;
    const big = r.perfect;
    const lit = [...this.belly].reverse();
    // Ces lanternes quittent le ventre tout de suite : la suivante compte pour le prochain objectif.
    this.celebrating = [...this.belly, ...this.celebrating];
    this.belly = [];
    lit.forEach((p, i) => {
      this.time.delayedCall(80 + i * 110, () => {
        p.lamp?.setTexture('d-lamp-gold');
        if (!this.reducedMotion && p.lamp) this.tweens.add({ targets: p.lamp, scale: { from: K * 1, to: K * 0.6 }, duration: 260, ease: 'Back.easeOut' });
        this.sparks.explode(4, p.seg.x, p.seg.y);
      });
    });
    const t0 = 120 + lit.length * 110;
    this.time.delayedCall(t0, () => {
      this.sfx.yum();
      this.stamp(big ? 'PARFAIT !' : 'Miam !', big ? '#ff8fb1' : B.C.saffron);
      this.floatText(this.head.x, this.head.y - 70, `+${r.points}`, B.C.cream, 30);
      this.breathe(big);
      // Le ventre se transforme en écaille d'or.
      const at = lit[lit.length - 1]?.seg ?? this.headImg;
      const slot = lit[lit.length - 1]?.slot ?? 0;
      for (const p of lit) {
        this.scales.explode(this.reducedMotion ? 2 : 5, p.seg.x, p.seg.y);
        this.destroyPiece(p);
      }
      this.celebrating = this.celebrating.filter((p) => !lit.includes(p));
      const gold = this.makePiece('or', slot);
      this.golds.unshift(gold);
      this.refreshLegs();
      this.flashAt(at.x, at.y, '#fff0b0');
      if (!this.reducedMotion) this.tweens.add({ targets: gold.seg, scale: { from: K * SEG_SCALE * 2, to: K * SEG_SCALE }, duration: 420, ease: 'Back.easeOut' });
      if (big) {
        this.moonMood('clin', 1600);
        for (let i = 0; i < (this.reducedMotion ? 1 : 3); i++) {
          this.time.delayedCall(i * 260, () => this.fx.burst(Phaser.Math.Between(200, W - 200), Phaser.Math.Between(170, 330), [['#ff4d6d', '#ff8fb1', '#ffffff'], ['#ffc94a', '#ffffff'], ['#5fd3bc', '#ff8fb1']][i % 3]));
          this.sfx.firework(i * 0.26);
        }
      }
      this.refreshScore();
      this.applyMoves(r, 200);
      if (r.won) {
        this.time.delayedCall(900, () => this.celebrate());
        return;
      }
      this.time.delayedCall(700, () => {
        if (r.next) this.showGoal(r.next, true);
        if (r.stageUp) this.enterStage(s.stage);
        this.refreshStage();
      });
    });
  }

  /** Trop mangé : hoquet, les lanternes du ventre s'envolent. */
  private overshoot(): void {
    this.setFace('beurk', 1600);
    this.sfx.sadTrombone();
    for (let i = 0; i < 3; i++) {
      this.sfx.hiccup(0.25 + i * 0.4);
      this.time.delayedCall(250 + i * 400, () => {
        this.hiccupBubble();
        if (!this.reducedMotion) this.tweens.add({ targets: this.headImg, scale: { from: K * HEAD_SCALE * 1.15, to: K * HEAD_SCALE }, duration: 200 });
      });
    }
    this.stamp('Hic ! Trop mangé…', '#c7e58a');
    this.spitBelly();
  }

  private hiccupBubble(): void {
    const b = this.add.text(this.head.x + Phaser.Math.Between(-10, 30), this.head.y - 50, 'hic !', { ...style(22, '#e8ffd0', 800, 4) }).setOrigin(0.5).setDepth(55);
    this.tweens.add({ targets: b, y: b.y - 60, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => b.destroy() });
  }

  /** Les lanternes du ventre sont recrachées et s'éloignent en tournoyant. */
  private spitBelly(): void {
    for (const p of this.belly) {
      const lamp = this.add.image(p.seg.x, p.seg.y, 'd-lamp').setScale(K * 0.6).setDepth(47);
      const label = this.add.text(p.seg.x, p.seg.y + 5, p.label?.text ?? '', { ...style(24, B.C.ink, 800), stroke: '#fff2c8', strokeThickness: 5 }).setOrigin(0.5).setDepth(47.1);
      const ang = Math.random() * Math.PI * 2;
      const dist = 140 + Math.random() * 120;
      this.tweens.add({
        targets: [lamp, label],
        x: `+=${Math.cos(ang) * dist}`,
        y: `+=${Math.sin(ang) * dist - 60}`,
        angle: Phaser.Math.Between(-200, 200),
        alpha: 0,
        duration: 1000,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          lamp.destroy();
          label.destroy();
        },
      });
      this.smokePuffs.explode(2, p.seg.x, p.seg.y);
      this.destroyPiece(p);
    }
    this.belly = [];
  }

  /** Souffle de feu dans la direction de la tête ; brûle les chauves-souris. */
  private breathe(big: boolean): void {
    const dur = big ? 1100 : 700;
    this.breathingUntil = this.time.now + dur;
    this.sfx.fireBreath(big);
    this.fire.start();
    this.fireSmoke.start();
    if (!this.reducedMotion) this.cameras.main.shake(big ? 380 : 220, big ? 0.006 : 0.003);
    this.time.delayedCall(dur, () => {
      this.fire.stop();
      this.fireSmoke.stop();
    });
    // Les chauves-souris : brûlées dans le cône (toutes sur un coup parfait), les autres fuient.
    const m = this.mouth();
    for (const b of this.bats) {
      if (b.state === 'brulee') continue;
      const dx = b.x - m.x;
      const dy = b.y - m.y;
      const inCone = Math.hypot(dx, dy) < 380 && Math.abs(wrapAngle(Math.atan2(dy, dx) - this.head.a)) < 0.6;
      if (big || inCone || Math.hypot(dx, dy) < 150) this.time.delayedCall(Math.hypot(dx, dy) * 0.9, () => this.burnBat(b));
      else {
        b.scaredUntil = this.time.now + 1800;
        b.img.setTexture('d-bat-peur-0');
      }
    }
    if (big) {
      // Couronne de feu autour du dragon.
      const ring = this.add.circle(this.head.x, this.head.y, 30).setStrokeStyle(10, 0xffb347, 0.9).setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ring, scale: 14, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    }
  }

  private aimFire(): void {
    const m = this.mouth();
    const deg = Phaser.Math.RadToDeg(this.head.a);
    this.fire.setPosition(m.x, m.y);
    this.fire.setEmitterAngle({ min: deg - 13, max: deg + 13 });
    this.fireSmoke.setPosition(m.x, m.y);
    this.fireSmoke.setEmitterAngle({ min: deg - 20, max: deg + 20 });
  }

  // --- Coups durs -------------------------------------------------------------------------------------------
  private hurt(cause: 'chauve-souris' | 'eclair'): void {
    const s = this.session;
    if (!s || s.phase !== 'play' || this.time.now < this.invulnerableUntil || this.ending) return;
    const r = s.hurt({ x: this.head.x, y: this.head.y });
    this.invulnerableUntil = this.time.now + 2000;
    this.setFace('aie', 1400);
    this.sfx.impact(true);
    this.sfx.heartLost();
    this.stamp(cause === 'eclair' ? 'Zap ! Aïe !' : 'Aïe !', B.C.coralLight);
    this.dizzy();
    if (!this.reducedMotion) this.cameras.main.shake(300, 0.008);
    this.setFever(false);
    this.afterSetback(r);
  }

  private afterSetback(r: Setback): void {
    this.spitBelly();
    this.applyMoves(r, 300);
    if (r.next) this.time.delayedCall(500, () => this.showGoal(r.next!, true));
    this.refreshHearts(r.heartLost);
    this.refreshScore();
    if (r.lost) this.time.delayedCall(700, () => this.defeat());
  }

  /** Étoiles qui tournent autour de la tête étourdie. */
  private dizzy(): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < 3; i++) {
      const st = this.add.image(this.head.x, this.head.y, 'd-spark').setScale(K * 0.9).setDepth(55).setTint(0xffe27a);
      const p = { t: i / 3 };
      this.tweens.add({
        targets: p,
        t: p.t + 2,
        duration: 1400,
        onUpdate: () => st.setPosition(this.head.x + Math.cos(p.t * Math.PI * 2) * 40, this.head.y - 40 + Math.sin(p.t * Math.PI * 2) * 12),
        onComplete: () => st.destroy(),
      });
    }
  }

  // --- Chauves-souris ---------------------------------------------------------------------------------------
  private spawnBat(): void {
    const left = Math.random() < 0.5;
    const y = Phaser.Math.Between(190, 540);
    const img = this.add.image(left ? -60 : W + 60, y, 'd-bat-mechante-0').setScale(K * 0.85).setDepth(28);
    this.bats.push({ img, x: img.x, y, vx: 0, vy: 0, born: this.time.now, state: 'chasse', scaredUntil: 0, phase: Math.random() * 6 });
    this.sfx.batScreech();
  }

  private updateBats(time: number, dt: number): void {
    const s = this.session;
    const plan = s ? s.plan : DRAGON_STAGES[0];
    if (s && this.isPlaying() && plan.bats > 0 && this.bats.filter((b) => b.state !== 'brulee').length < plan.bats && time > this.nextBatAt) {
      this.spawnBat();
      this.nextBatAt = time + Phaser.Math.Between(3500, 6000);
    }
    const modeSpeed = s ? DRAGON_MODES[s.mode].speed : 1;
    for (const b of [...this.bats]) {
      if (b.state === 'brulee') continue;
      const frame = Math.floor(time / 150 + b.phase) % 2;
      const scared = time < b.scaredUntil;
      b.img.setTexture(`d-bat-${scared ? 'peur' : 'mechante'}-${frame}`);
      let tx = this.head.x;
      let ty = this.head.y;
      if (b.state === 'fuite' || scared) {
        tx = b.x + (b.x - this.head.x);
        ty = b.y + (b.y - this.head.y) - 80;
      }
      const ang = Math.atan2(ty - b.y, tx - b.x);
      const sp = (b.state === 'fuite' ? 220 : (scared ? 160 : (s?.stage ?? 0) >= 2 ? 92 : 78)) * modeSpeed;
      b.vx += (Math.cos(ang) * sp - b.vx) * Math.min(1, dt * 1.6);
      b.vy += (Math.sin(ang) * sp - b.vy) * Math.min(1, dt * 1.6);
      b.x += b.vx * dt;
      b.y += b.vy * dt + Math.sin(time / 260 + b.phase) * 0.8;
      b.img.setPosition(b.x, b.y).setFlipX(b.vx < 0);
      if (b.state === 'chasse' && time - b.born > 15000) b.state = 'fuite';
      if (b.x < -150 || b.x > W + 150 || b.y < -150 || b.y > H + 150) {
        b.img.destroy();
        this.bats = this.bats.filter((x) => x !== b);
        continue;
      }
      if (b.state === 'chasse' && !scared && this.isPlaying() && Math.hypot(b.x - this.head.x, b.y - this.head.y) < 44) {
        if (time >= this.invulnerableUntil) {
          this.hurt('chauve-souris');
          this.say(b.x, b.y - 50, 'Hi hi hi !', 900);
          this.sfx.laugh();
        }
        b.state = 'fuite';
      }
    }
  }

  private burnBat(b: Bat): void {
    if (b.state === 'brulee' || !b.img.active) return;
    b.state = 'brulee';
    b.img.setTexture('d-bat-brulee-1');
    this.sfx.batPoof();
    this.smokePuffs.explode(this.reducedMotion ? 2 : 6, b.x, b.y);
    this.embersAt(b.x, b.y);
    this.session?.bonus(50, 'bat');
    this.floatText(b.x, b.y - 40, '+50', B.C.saffron, 24);
    this.say(b.x, b.y - 60, 'Couic !', 700);
    this.refreshScore();
    // Toute gentille désormais, elle tombe en tournoyant jusqu'à la mer.
    this.tweens.add({
      targets: b.img,
      y: SEA_Y + 20,
      x: b.x + Phaser.Math.Between(-60, 60),
      angle: 540,
      scale: K * 0.6,
      duration: 1300,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.ripple(b.img.x);
        b.img.destroy();
        this.bats = this.bats.filter((x) => x !== b);
      },
    });
  }

  private embersAt(x: number, y: number): void {
    this.sparks.explode(this.reducedMotion ? 3 : 10, x, y);
  }

  private ripple(x: number): void {
    const r = this.add.ellipse(x, SEA_Y + 14, 20, 6).setStrokeStyle(2, 0xffe0c0, 0.8).setDepth(8.5);
    this.tweens.add({ targets: r, scaleX: 4, scaleY: 3, alpha: 0, duration: 900, onComplete: () => r.destroy() });
  }

  // --- Orage ------------------------------------------------------------------------------------------------
  private startStorm(): void {
    if (this.storms.length) return;
    this.tex('d-storm-0', () => D.stormCloud(false));
    this.tex('d-storm-1', () => D.stormCloud(true));
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? 300 : 900;
      const img = this.add.image(x, -80, 'd-storm-0').setScale(K * 1.05).setDepth(12);
      const column = this.add.rectangle(x, 150, 90, 520, 0xfff3a0, 0).setOrigin(0.5, 0).setDepth(11.5).setBlendMode(Phaser.BlendModes.ADD);
      const st: Storm = { img, x, y: 150, vx: (i ? -1 : 1) * Phaser.Math.Between(35, 55), nextStrike: this.time.now + 3500 + i * 2600, charging: false, column };
      this.tweens.add({ targets: img, y: st.y, duration: 1200, ease: 'Back.easeOut' });
      this.storms.push(st);
    }
    if (!this.reducedMotion) {
      this.rain = this.add.particles(0, 0, this.tex('d-rain', D.raindrop), {
        x: { min: 0, max: W + 200 },
        y: -30,
        speedY: { min: 620, max: 820 },
        speedX: { min: -180, max: -140 },
        lifespan: 1200,
        frequency: 18,
        alpha: { start: 0.7, end: 0.2 },
        rotate: 12,
      }).setDepth(50);
    }
  }

  private stopStorm(): void {
    for (const st of this.storms) {
      this.tweens.add({ targets: st.img, y: -120, alpha: 0, duration: 900, onComplete: () => st.img.destroy() });
      st.column.destroy();
    }
    this.storms = [];
    this.rain?.stop();
    const r = this.rain;
    this.rain = null;
    if (r) this.time.delayedCall(1500, () => r.destroy());
  }

  private updateStorms(time: number, dt: number): void {
    for (const st of this.storms) {
      if (!st.charging) {
        st.x += st.vx * dt;
        if (st.x < 160 || st.x > W - 160) st.vx *= -1;
        st.img.x = st.x;
        st.column.x = st.x;
      }
      st.img.y = st.y + Math.sin(time / 700 + st.x) * 3;
      if (!this.isPlaying()) continue;
      if (!st.charging && time > st.nextStrike) {
        st.charging = true;
        st.img.setTexture('d-storm-1');
        this.sfx.rumble();
        this.tweens.add({ targets: st.column, fillAlpha: { from: 0, to: 0.16 }, duration: 160, yoyo: true, repeat: 3 });
        if (!this.reducedMotion) this.tweens.add({ targets: st.img, x: st.x + 4, duration: 50, yoyo: true, repeat: 12 });
        this.time.delayedCall(1300, () => this.strike(st));
      }
    }
    void dt;
  }

  private strike(st: Storm): void {
    if (!st.img.active) return;
    st.charging = false;
    st.img.setTexture('d-storm-0');
    st.nextStrike = this.time.now + Phaser.Math.Between(5200, 8200) * (this.session?.mode === 'tranquille' ? 1.4 : 1);
    st.column.setFillStyle(0xfff3a0, 0);
    const bolt = this.add.image(st.x, st.y + 30, this.tex(`d-bolt-${Phaser.Math.Between(1, 3)}`, () => D.bolt(SEA_Y - 170, Phaser.Math.Between(1, 99)))).setOrigin(0.5, 0).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: bolt, alpha: 0, duration: 380, delay: 120, onComplete: () => bolt.destroy() });
    this.flash.setFillStyle(0xfff8e0, this.reducedMotion ? 0.12 : 0.35);
    this.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 380 });
    this.sfx.thunder();
    this.ripple(st.x);
    if (!this.reducedMotion) this.cameras.main.shake(200, 0.004);
    if (Math.abs(this.head.x - st.x) < 48 && this.head.y > st.y) this.hurt('eclair');
    // Les lanternes ont peur : elles tremblent un instant.
    for (const v of this.orbViews.values()) if (Math.abs(v.orb.x - st.x) < 120 && !this.reducedMotion) this.tweens.add({ targets: v.c, angle: { from: -10, to: 10 }, duration: 60, yoyo: true, repeat: 3 });
  }

  // --- Habitants -------------------------------------------------------------------------------------------
  private startAmbientLife(): void {
    (['mechante', 'peur'] as const).forEach((st) => [0, 1].forEach((f) => this.tex(`d-bat-${st}-${f}`, () => D.bat(f as 0 | 1, st))));
    this.tex('d-bat-brulee-1', () => D.bat(1, 'brulee'));
    // Lucioles près des îles ; en mode « en feu », elles suivent le dragon.
    const ff = this.tex('d-firefly', () => B.softGlow(14, '#fff27a'));
    for (let i = 0; i < 16; i++) {
      const hx = Phaser.Math.Between(40, W - 40);
      const hy = Phaser.Math.Between(520, 630);
      const img = this.add.image(hx, hy, ff).setDepth(9.8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.fireflies.push({ img, hx, hy, x: hx, y: hy, seed: Math.random() * 100 });
    }
    // Étoiles filantes, poissons volants, Zzz de la lune.
    if (!this.reducedMotion) {
      this.time.addEvent({ delay: 5200, loop: true, callback: () => this.shootingStar() });
      this.time.addEvent({ delay: 9000, loop: true, callback: () => this.jumpFish() });
      this.time.addEvent({ delay: 3000, loop: true, callback: () => this.moonSnore() });
    }
    this.nextBalloonAt = this.time.now + 9000;
  }

  private animateFireflies(time: number, dt: number): void {
    const night = (this.session?.stage ?? 0) >= 1 || this.ending;
    this.fireflies.forEach((f, i) => {
      let tx = f.hx + Math.sin(time / 1300 + f.seed) * 40;
      let ty = f.hy + Math.cos(time / 1100 + f.seed) * 20;
      if (this.fever && this.isPlaying()) {
        const pt = this.pathPoint(30 + (i % Math.max(1, this.pieces.length)) * SPACING);
        tx = pt.x + Math.sin(time / 200 + f.seed) * 30;
        ty = pt.y + Math.cos(time / 230 + f.seed) * 30;
      }
      const k = Math.min(1, dt * (this.fever ? 3 : 0.8));
      f.x += (tx - f.x) * k;
      f.y += (ty - f.y) * k;
      const blink = 0.5 + Math.sin(time / 260 + f.seed * 3) * 0.5;
      f.img.setPosition(f.x, f.y).setAlpha((night || this.fever ? 0.9 : 0.25) * blink).setDepth(this.fever ? 41 : 9.8);
    });
  }

  private shootingStar(): void {
    if (this.paused) return;
    const x = Phaser.Math.Between(100, W - 300);
    const y = Phaser.Math.Between(110, 260);
    const s = this.add.image(x, y, this.tex('s-streak', Sp.streak)).setOrigin(1, 0.5).setDepth(2.2).setAngle(160).setScale(0.6).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: s, x: x - 320, y: y + 120, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Sine.easeIn', onComplete: () => s.destroy() });
  }

  private jumpFish(): void {
    if (this.paused) return;
    const x = Phaser.Math.Between(260, W - 260);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const fish = this.add.image(x, SEA_Y + 20, this.tex('w-fish', Wd.flyingFish)).setScale(K * 0.8).setDepth(8.6).setFlipX(dir < 0);
    const p = { t: 0 };
    this.tweens.add({
      targets: p,
      t: 1,
      duration: 1100,
      onUpdate: () => {
        fish.setPosition(x + dir * p.t * 140, SEA_Y + 20 - Math.sin(p.t * Math.PI) * 90).setAngle(dir * (-50 + p.t * 100));
      },
      onComplete: () => {
        this.ripple(fish.x);
        fish.destroy();
      },
    });
    this.ripple(x);
  }

  private moonSnore(): void {
    if (this.paused || this.time.now < this.moonFaceUntil) return;
    const z = this.add.text(1100, 190, 'z', style(18 + Math.floor(Math.random() * 8), '#fff2c8', 800, 3)).setDepth(2.7);
    this.tweens.add({ targets: z, x: 1150, y: 120, alpha: 0, duration: 2200, ease: 'Sine.easeOut', onComplete: () => z.destroy() });
  }

  private moonMood(face: 'clin' | 'rougit', ms: number): void {
    this.moonFace.setTexture(`d-moonface-${face}`);
    this.moonFaceUntil = this.time.now + ms;
    this.time.delayedCall(ms, () => {
      if (this.time.now >= this.moonFaceUntil - 5) this.moonFace.setTexture('d-moonface-dort');
    });
  }

  private spawnCake(): void {
    if (this.cake) return;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = Phaser.Math.Between(220, 520);
    const img = this.add.image(dir > 0 ? -40 : W + 40, y, this.tex('d-cake', D.mooncake)).setScale(K * 0.95).setDepth(25);
    const glow = this.add.image(img.x, y, 'd-cookie-glow').setDepth(24.9).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    img.setData('glow', glow);
    this.cake = { img, t0: this.time.now, dir, y };
  }

  private updateCake(time: number): void {
    if (!this.cake) {
      if (this.isPlaying() && time > this.nextCakeAt) {
        if (this.nextCakeAt > 0) this.spawnCake();
        this.nextCakeAt = time + Phaser.Math.Between(22000, 32000);
      }
      return;
    }
    const c = this.cake;
    const t = (time - c.t0) / 1000;
    const x = c.dir > 0 ? -40 + t * 85 : W + 40 - t * 85;
    const y = c.y + Math.sin(t * 1.6) * 40;
    c.img.setPosition(x, y).setAngle(Math.sin(t * 2) * 12);
    (c.img.getData('glow') as Phaser.GameObjects.Image).setPosition(x, y);
    const m = this.mouth();
    if (this.isPlaying() && Math.hypot(m.x - x, m.y - y) < 50) {
      this.session?.bonus(150, 'cake');
      this.sfx.coin();
      this.sfx.yum();
      this.setFace('content', 1400);
      this.hearts.explode(this.reducedMotion ? 3 : 10, x, y);
      this.floatText(x, y - 40, 'Gâteau de lune ! +150', B.C.saffron, 26);
      this.refreshScore();
      this.removeCake();
      return;
    }
    if (x < -80 || x > W + 80) this.removeCake();
  }

  private removeCake(): void {
    if (!this.cake) return;
    (this.cake.img.getData('glow') as Phaser.GameObjects.Image).destroy();
    this.cake.img.destroy();
    this.cake = null;
  }

  /** L'escargot traverse le ciel en montgolfière ; on peut lui faire coucou. */
  private spawnBalloon(): void {
    if (this.balloon) return;
    const c = this.add.container(-80, Phaser.Math.Between(250, 380)).setDepth(5);
    c.add(this.add.image(0, 0, this.tex('d-balloon', D.balloon)).setScale(K * 0.8));
    c.add(this.add.image(2, 42, this.tex('w-snail-0', () => Wd.snail(0))).setScale(K * 0.42));
    c.setSize(90, 130).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.sfx.unlock();
      this.sfx.pop();
      this.say(c.x, c.y - 80, ['Coucou dragon !', 'Bon appétit !', 'Quelle vue !'][Phaser.Math.Between(0, 2)], 1300);
      this.hearts.explode(4, c.x, c.y - 40);
    });
    this.balloon = c;
    this.tweens.add({ targets: c, x: W + 100, duration: 42000, ease: 'Linear', onComplete: () => {
      c.destroy();
      this.balloon = null;
      this.nextBalloonAt = this.time.now + Phaser.Math.Between(25000, 40000);
    } });
    if (!this.reducedMotion) this.tweens.add({ targets: c, y: c.y - 30, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // --- Interface -------------------------------------------------------------------------------------------
  private buildHud(): void {
    this.scoreText = this.add.text(28, 18, 'Score 0', style(30, B.C.cream, 800, 6)).setDepth(60);
    this.comboText = this.add.text(28, 58, '', style(22, B.C.saffron, 800, 5)).setDepth(60);
    // Bandeau de l'objectif.
    this.goalBox = this.add.container(W / 2, 60).setDepth(60);
    this.goalBox.add(this.add.image(0, 0, this.tex('d-scroll', () => D.scroll(360, 84))).setScale(K));
    const badge = this.add.circle(-128, 0, 26, 0xe2423a).setStrokeStyle(4, 0x1d1a2b);
    this.goalOp = this.add.text(-128, -2, '+', style(36, B.C.cream, 800, 4)).setOrigin(0.5);
    this.goalLabel = this.add.text(18, -22, '', style(17, '#6a4a3a', 800)).setOrigin(0.5);
    this.goalNumber = this.add.text(18, 10, '', { ...style(44, DR_INK, 800), stroke: '#fbefd2', strokeThickness: 2 }).setOrigin(0.5);
    this.goalBox.add([badge, this.goalOp, this.goalLabel, this.goalNumber]);
    this.goalBox.setVisible(false);
    // Mèche de la faim (Défi).
    this.fuse = this.add.graphics().setDepth(60);
    this.fuseSpark = this.add.image(0, 0, 'd-spark').setScale(K * 0.9).setDepth(61).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    // Colonne de droite : ciel, progression, cœurs.
    this.stageText = this.add.text(1110, 16, '', style(22, B.C.cream, 800, 5)).setOrigin(0.5, 0).setDepth(60);
    this.tex('d-dot-0', () => dot(false));
    this.tex('d-dot-1', () => dot(true));
    this.tex('w-heart-1', () => Wd.heart(true));
    this.tex('w-heart-0', () => Wd.heart(false));
    this.soundText = this.add.text(W - 150, H - 14, '', style(16, B.C.cream, 700, 4)).setOrigin(1, 1).setDepth(60).setInteractive({ useHandCursor: true });
    this.soundText.on('pointerdown', () => this.toggleSound());
    this.setMuted(this.sfx.muted);
    const pb = this.add.container(W - 34, 38).setDepth(60);
    pb.add(this.add.circle(0, 0, 22, 0x1b1840, 0.9).setStrokeStyle(3, 0x1d1a2b));
    pb.add(this.add.text(0, -1, 'II', style(20, B.C.cream, 800)).setOrigin(0.5));
    pb.setSize(48, 48).setInteractive({ useHandCursor: true });
    pb.on('pointerdown', () => this.pause());
  }

  private showGoal(g: Goal, animate: boolean): void {
    this.goalBox.setVisible(true);
    const apply = () => {
      this.goalOp.setText(g.op === '+' ? '+' : '×');
      this.goalLabel.setText(g.op === '+' ? 'Additionne pour faire' : 'Multiplie pour faire');
      this.goalNumber.setText(String(g.target));
      (this.goalBox.list[1] as Phaser.GameObjects.Arc).setFillStyle(g.op === '+' ? 0xe2423a : 0x1f6f72);
    };
    if (!animate || this.reducedMotion) {
      apply();
      return;
    }
    this.tweens.add({
      targets: this.goalBox,
      scaleY: 0,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => {
        apply();
        this.sfx.chime();
        this.tweens.add({ targets: this.goalBox, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
      },
    });
  }

  private refreshStage(): void {
    const s = this.session;
    for (const d of this.stageDots) d.destroy();
    this.stageDots = [];
    if (!s) {
      this.stageText.setText('');
      return;
    }
    const st = Math.min(s.stage, DRAGON_STAGES.length - 1);
    this.stageText.setText(`Ciel ${st + 1}/3 · ${STAGE_NAMES[st]}`);
    const n = DRAGON_STAGES[st].goals;
    const done = s.stage > st ? n : s.goalsInStage;
    for (let i = 0; i < n; i++) {
      this.stageDots.push(this.add.image(1110 + (i - (n - 1) / 2) * 24, 58, `d-dot-${i < done ? 1 : 0}`).setScale(K).setDepth(60));
    }
  }

  private refreshHearts(lostOne = false): void {
    for (const h of this.heartIcons) h.destroy();
    this.heartIcons = [];
    const s = this.session;
    const max = s ? DRAGON_MODES[s.mode].hearts : null;
    if (!s || max === null || s.hearts === null) return;
    for (let i = 0; i < max; i++) {
      const img = this.add.image(1110 + (i - (max - 1) / 2) * 40, 92, `w-heart-${i < s.hearts ? 1 : 0}`).setScale(K * 0.8).setDepth(60);
      this.heartIcons.push(img);
      if (lostOne && i === s.hearts && !this.reducedMotion) this.tweens.add({ targets: img, scale: { from: K * 1.6, to: K * 0.8 }, angle: { from: -30, to: 0 }, duration: 400, ease: 'Back.easeOut' });
    }
  }

  private drawFuse(): void {
    const s = this.session;
    this.fuse.clear();
    if (!s || s.mode !== 'defi' || !this.isPlaying()) {
      this.fuseSpark.setVisible(false);
      return;
    }
    const w = 300;
    const x0 = W / 2 - w / 2;
    const y = 112;
    const k = Phaser.Math.Clamp(s.hunger / s.cfg.hunger, 0, 1);
    this.fuse.fillStyle(0x1d1a2b, 0.85);
    this.fuse.fillRoundedRect(x0 - 4, y - 6, w + 8, 12, 6);
    const col = k > 0.5 ? 0x7fb069 : k > 0.25 ? 0xffc94a : 0xf0745e;
    this.fuse.fillStyle(col, 1);
    this.fuse.fillRoundedRect(x0, y - 3, Math.max(4, w * k), 6, 3);
    this.fuseSpark.setVisible(true).setPosition(x0 + w * k, y).setAngle(this.time.now / 3);
  }

  private refreshScore(): void {
    const s = this.session;
    if (!s) return;
    this.scoreTween?.stop();
    const from = { v: this.scoreShown };
    this.scoreTween = this.tweens.add({ targets: from, v: s.score, duration: 450, ease: 'Cubic.easeOut', onUpdate: () => {
      this.scoreShown = Math.round(from.v);
      this.scoreText.setText(`Score ${this.scoreShown}`);
    } });
    const hot = s.combo >= FEVER_COMBO;
    this.comboText.setText(s.combo > 1 ? (hot ? `Dragon doré ! Série ×${s.combo}` : `Série ×${s.combo}`) : '').setColor(hot ? '#ffd27a' : B.C.saffron);
    if (hot && !this.fever) this.setFever(true);
    if (!hot && this.fever) this.setFever(false);
  }

  /** Mode « dragon doré » : traînée scintillante, lucioles autour du corps, musique plus vive. */
  private setFever(on: boolean): void {
    if (this.fever === on) return;
    this.fever = on;
    if (on) {
      this.sfx.feverOn();
      this.banner('Dragon doré !', '#ffd27a', 1100);
      this.setMusic(Math.max(1, this.musicLevel));
      this.headImg.setTint(0xffe9a8);
    } else {
      this.headImg.clearTint();
      if (this.isPlaying()) {
        this.sfx.feverOff();
        this.setMusic((this.session?.stage ?? 0) >= 2 ? 2 : 0);
      }
    }
  }

  private toggleSound(): void {
    this.sfx.unlock();
    this.setMuted(this.sfx.toggle());
  }

  private setMuted(m: boolean): void {
    this.soundText.setText(m ? 'Son : coupé (M)' : 'Son : activé (M)');
  }

  private setMusic(level: number | null): void {
    if (level === null) {
      this.sfx.music(false);
      return;
    }
    this.musicLevel = level;
    this.sfx.music(true, level, 'dragon');
  }

  private stamp(text: string, color: string): void {
    // Un seul tampon à la fois : le nouveau remplace l'ancien.
    if (this.stampText?.active) this.stampText.destroy();
    const t = this.add.text(this.head.x, this.head.y - 110, text, style(text.length > 10 ? 34 : 46, color, 800, 7)).setOrigin(0.5).setDepth(56);
    t.x = Phaser.Math.Clamp(t.x, 180, W - 180);
    t.y = Phaser.Math.Clamp(t.y, 170, H - 120);
    this.stampText = t;
    if (this.reducedMotion) {
      this.time.delayedCall(900, () => t.destroy());
      return;
    }
    this.tweens.add({ targets: t, scale: { from: 2.2, to: 1 }, angle: { from: -12, to: -4 }, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 40, delay: 800, duration: 400, onComplete: () => t.destroy() });
  }

  private floatText(x: number, y: number, text: string, color: string, size = 30): void {
    const t = this.add.text(Phaser.Math.Clamp(x, 120, W - 120), Math.max(150, y), text, style(size, color, 800, 5)).setOrigin(0.5).setDepth(55);
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private banner(text: string, color: string, hold = 1400): void {
    const t = this.add.text(W / 2, H / 2 - 30, text, style(text.length > 30 ? 30 : 40, color, 800, 7)).setOrigin(0.5).setDepth(57).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, scale: { from: 0.6, to: 1 }, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: hold, duration: 400, onComplete: () => t.destroy() });
  }

  private say(x: number, y: number, text: string, ms: number): void {
    const t = this.add.text(Phaser.Math.Clamp(x, 90, W - 90), Phaser.Math.Clamp(y, 140, H - 60), text, { ...style(18, B.C.ink, 800), backgroundColor: '#f6ecd8', padding: { x: 10, y: 5 } }).setOrigin(0.5).setDepth(56);
    if (!this.reducedMotion) this.tweens.add({ targets: t, scale: { from: 0.4, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 250, onComplete: () => t.destroy() });
  }

  private flashAt(x: number, y: number, color: string): void {
    const f = this.add.image(x, y, this.tex(`d-flash-${color}`, () => B.softGlow(60, color))).setDepth(45).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5);
    this.tweens.add({ targets: f, scale: 2.4, alpha: 0, duration: 450, ease: 'Cubic.easeOut', onComplete: () => f.destroy() });
  }

  // --- Ciels ------------------------------------------------------------------------------------------------
  private enterStage(stage: number): void {
    if (stage === this.shownStage || stage >= DRAGON_STAGES.length) return;
    this.shownStage = stage;
    this.sfx.fanfare();
    this.banner(STAGE_BANNERS[stage], stage === 2 ? '#c9c2ff' : B.C.saffron, 1900);
    if (stage >= 1) {
      this.tweens.add({ targets: this.dusk, alpha: stage === 1 ? 0.35 : 0.12, duration: 2500 });
      this.tweens.add({ targets: this.veil, fillAlpha: stage === 1 ? 0.22 : 0.4, duration: 2500 });
      this.nextBatAt = this.time.now + 2200;
    }
    if (stage === 2) {
      this.startStorm();
      this.setMusic(2);
    }
  }

  private resetSky(): void {
    this.tweens.killTweensOf([this.dusk, this.veil, this.auroraImg]);
    this.dusk.setAlpha(1);
    this.veil.setFillStyle(0x0a0820, 0);
    this.auroraImg.setAlpha(0);
    this.shownStage = 0;
    this.stopStorm();
  }

  // --- Entrées ----------------------------------------------------------------------------------------------
  private bindInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.addKeys('up,down,left,right,w,a,s,d') as Record<string, Phaser.Input.Keyboard.Key>;
      kb.on('keydown', (e: KeyboardEvent) => {
        if (e.key === 'm' || e.key === 'M') this.toggleSound();
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          if (this.paused) this.resume();
          else this.pause();
          return;
        }
        if (this.overlay && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          this.keyboardUsed = true;
          this.overlayFocus = (this.overlayFocus + 1) % Math.max(1, this.overlayButtons.length);
          this.refreshOverlayFocus();
        }
        if (this.overlay && (e.key === 'Enter' || e.key === ' ')) {
          this.sfx.unlock();
          this.overlayButtons[this.overlayFocus]?.run();
        }
      });
    }
    // Souris : le dragon suit le pointeur ; tactile : il suit le doigt.
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isPlaying()) return;
      if (p.wasTouch && !p.isDown) return;
      this.steer = { x: p.x, y: p.y };
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.sfx.unlock();
      if (this.isPlaying()) this.steer = { x: p.x, y: p.y };
    });
  }

  private isPlaying(): boolean {
    return !!this.session && this.session.phase === 'play' && !this.overlay && !this.ending && !this.paused;
  }

  update(time: number, delta: number): void {
    if (this.paused) return;
    const dt = Math.min(0.05, delta / 1000) * this.speedBoost;
    this.moveDragon(time, dt);
    this.placeDragon(time, dt);
    this.animateOrbs(time);
    this.animateFireflies(time, dt);
    if (time < this.breathingUntil) this.aimFire();
    this.updateBats(time, dt);
    this.updateStorms(time, dt);
    this.updateCake(time);
    if (!this.balloon && time > this.nextBalloonAt && !this.reducedMotion) this.spawnBalloon();
    this.drawFuse();
    const s = this.session;
    if (!s || !this.isPlaying()) return;
    this.checkEat();
    for (const ev of s.update(dt)) {
      if (ev.type === 'hungry') {
        this.setFace('aie', 1200);
        this.sfx.heartLost();
        this.stamp('Trop tard !', B.C.coralLight);
        this.setFever(false);
        this.afterSetback(ev.setback);
      }
    }
  }

  // --- Pause et fin -----------------------------------------------------------------------------------------
  private pause(): void {
    if (this.paused || this.overlay || this.ending || !this.session) return;
    this.paused = true;
    this.tweens.pauseAll();
    this.time.paused = true;
    this.sfx.music(false);
    this.fire.pause();
    const c = this.openOverlay(300);
    c.add(this.add.text(W / 2, H / 2 - 80, 'Pause', style(52, B.C.saffron, 800, 7)).setOrigin(0.5));
    c.add(this.add.text(W / 2, H / 2 - 22, 'Le dragon fait une petite sieste…', style(20, '#e8dcff', 600)).setOrigin(0.5));
    this.addOverlayButton(W / 2 - 130, H / 2 + 60, 'Accueil', false, () => {
      window.location.href = '../index.html';
    });
    this.addOverlayButton(W / 2 + 130, H / 2 + 60, 'Reprendre', true, () => this.resume());
    this.overlayFocus = 1;
    this.refreshOverlayFocus();
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.overlay?.destroy(true);
    this.overlay = null;
    this.overlayButtons = [];
    this.tweens.resumeAll();
    this.time.paused = false;
    this.fire.resume();
    this.setMusic(this.musicLevel);
  }

  private celebrate(): void {
    this.ending = true;
    this.setMusic(null);
    this.setFever(false);
    this.comboText.setText('');
    this.goalBox.setVisible(false);
    this.refreshStage();
    this.stageText.setText('Victoire !');
    this.stopStorm();
    for (const b of [...this.bats]) this.burnBat(b);
    this.sfx.victoryJingle();
    this.banner('Le dragon est repu !', B.C.saffron, 3600);
    // L'aube et l'aurore boréale.
    this.tweens.add({ targets: this.veil, fillAlpha: 0, duration: 2000 });
    this.tweens.add({ targets: this.dusk, alpha: 1, duration: 2500 });
    this.tweens.add({ targets: this.auroraImg, alpha: 0.85, duration: 2500 });
    this.moonMood('rougit', 6000);
    this.wreck.push(...this.fx.confetti(W, 3500));
    const bursts = this.reducedMotion ? 2 : 9;
    for (let i = 0; i < bursts; i++) {
      this.time.delayedCall(250 + i * 360, () => this.fx.burst(Phaser.Math.Between(120, W - 120), Phaser.Math.Between(150, 360), [['#ff4d6d', '#ffc94a'], ['#5fd3bc', '#ffffff'], ['#b79ad8', '#ff8fb1']][i % 3].concat('#ffffff')));
      this.sfx.firework(0.25 + i * 0.36);
    }
    // Les écailles d'or brillent en vague, le dragon chante.
    this.golds.forEach((p, i) => this.time.delayedCall(300 + i * 90, () => {
      this.sparks.explode(3, p.seg.x, p.seg.y);
      if (!this.reducedMotion) this.tweens.add({ targets: p.seg, scale: { from: K * SEG_SCALE * 1.4, to: K * SEG_SCALE }, duration: 300 });
    }));
    this.setFace('content', 5000);
    if (!this.reducedMotion) {
      this.time.addEvent({ delay: 280, repeat: 12, callback: () => this.notes.explode(1, this.head.x, this.head.y - 40) });
      this.breathe(true);
    }
    if (!this.balloon) this.spawnBalloon();
    this.time.delayedCall(5000, () => this.showEnd(true));
  }

  private defeat(): void {
    this.ending = true;
    this.setMusic(null);
    this.setFever(false);
    this.comboText.setText('');
    this.goalBox.setVisible(false);
    this.sfx.defeat();
    this.setFace('aie', 6000);
    this.banner('Le dragon tombe à l’eau…', B.C.coralLight, 2200);
    // Il pique vers la mer : plouf.
    this.diving = true;
    const target = { x: this.head.x + 60, y: SEA_Y + 30 };
    const p = { t: 0 };
    const from = { ...this.head };
    this.tweens.add({
      targets: p,
      t: 1,
      duration: 1400,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        this.head.x = from.x + (target.x - from.x) * p.t;
        this.head.y = from.y + (target.y - from.y) * p.t;
        this.head.a = Math.atan2(target.y - from.y, target.x - from.x);
      },
      onComplete: () => {
        this.sunk = true;
        this.sfx.splash();
        for (let i = 0; i < 3; i++) this.time.delayedCall(i * 160, () => this.ripple(target.x + (i - 1) * 30));
        this.smokePuffs.explode(6, target.x, SEA_Y);
      },
    });
    // Les chauves-souris dansent en ricanant.
    for (let i = 0; i < 3; i++) {
      const b = this.add.image(380 + i * 260, 260, 'd-bat-mechante-0').setScale(K * 0.9).setDepth(28).setAlpha(0);
      this.wreck.push(b);
      this.tweens.add({ targets: b, alpha: 1, delay: 1500 + i * 150, duration: 300 });
      if (!this.reducedMotion) this.tweens.add({ targets: b, y: 230, angle: { from: -15, to: 15 }, duration: 320, yoyo: true, repeat: 10, delay: 1600 + i * 100 });
    }
    this.time.delayedCall(1800, () => this.sfx.laugh());
    this.time.delayedCall(2100, () => this.sfx.danceTune());
    this.time.delayedCall(5200, () => this.showEnd(false));
  }

  private records(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(RECORD_KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  private makeButton(x: number, y: number, label: string, primary: boolean, run: () => void, width = 220): Phaser.GameObjects.Container {
    const key = this.tex(`b-btn-${primary ? 1 : 0}-${width}`, () => B.button(width, 54, primary));
    const c = this.add.container(x, y).setDepth(101);
    c.add(this.add.image(0, 3, key).setScale(K));
    c.add(this.add.text(0, -1, label, style(24, primary ? B.C.ink : B.C.cream, 800)).setOrigin(0.5));
    c.setSize(width + 4, 60).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.sfx.unlock();
      run();
    });
    return c;
  }

  private openOverlay(h: number, veil = 0.55): Phaser.GameObjects.Container {
    this.overlay?.destroy(true);
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x0b0a24, veil).setInteractive());
    const panel = this.add.image(W / 2, H / 2, this.tex(`d-dialog-${h}`, () => {
      const [cv, ctx] = B.makeCanvas(712, h + 20);
      B.paint(ctx, () => B.roundRectPath(ctx, 6, 14, 700, h, 30), B.C.ink, { ink: '' });
      B.paint(ctx, () => B.roundRectPath(ctx, 6, 6, 700, h, 30), '#1b1840', { line: 5 });
      ctx.strokeStyle = 'rgba(255, 201, 74, 0.4)';
      ctx.lineWidth = 2;
      B.roundRectPath(ctx, 18, 18, 676, h - 24, 22);
      ctx.stroke();
      return cv;
    })).setScale(K);
    c.add(panel);
    this.overlay = c;
    this.overlayButtons = [];
    this.overlayFocus = 0;
    return c;
  }

  private addOverlayButton(x: number, y: number, label: string, primary: boolean, run: () => void): void {
    const b = this.makeButton(x, y, label, primary, run);
    this.overlay?.add(b);
    this.overlayButtons.push({ c: b, run });
    this.refreshOverlayFocus();
  }

  private refreshOverlayFocus(): void {
    this.overlayButtons.forEach((b, i) => b.c.setScale(this.keyboardUsed && i === this.overlayFocus ? 1.08 : 1));
  }

  private showIntro(): void {
    const c = this.openOverlay(520);
    const top = H / 2 - 260;
    c.add(this.add.text(W / 2, top + 58, 'Le Dragon gourmand', style(48, B.C.saffron, 800, 7)).setOrigin(0.5));
    c.add(this.add.text(W / 2, top + 140, [
      'Guide le dragon (souris, doigt ou flèches) et avale des lanternes.',
      'Ensemble, elles doivent faire exactement le nombre demandé : gare au hoquet !',
    ].join('\n'), { ...style(19, B.C.cream, 600), align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    // Exemple illustré : 9 et 8 donnent 17.
    const ex = this.add.container(W / 2 - 170, top + 230);
    const lampAt = (x: number, n: number) => {
      ex.add(this.add.image(x, 0, 'd-lamp').setScale(K * 0.7));
      ex.add(this.add.text(x, 5, String(n), { ...style(26, B.C.ink, 800), stroke: '#fff2c8', strokeThickness: 4 }).setOrigin(0.5));
    };
    lampAt(0, 9);
    ex.add(this.add.text(48, 0, '+', style(30, B.C.cream, 800)).setOrigin(0.5));
    lampAt(96, 8);
    ex.add(this.add.text(160, 0, '=', style(30, B.C.cream, 800)).setOrigin(0.5));
    ex.add(this.add.text(214, 0, '17', style(40, B.C.saffron, 800, 5)).setOrigin(0.5));
    ex.add(this.add.image(310, 4, 'd-head-content').setScale(K * 0.62));
    c.add(ex);
    const mul = this.tier.id === 'stratege' || this.tier.id === 'maitre';
    c.add(this.add.text(W / 2, top + 304, mul ? 'Certains nombres se font en multipliant (×) · Niveau ' + this.tier.label : `Niveau ${this.tier.label} (${this.tier.public}) · moins de lanternes = coup parfait`, style(16, '#c9bfff', 700)).setOrigin(0.5));
    this.addOverlayButton(W / 2 - 140, top + 380, 'Tranquille', false, () => this.startGame('tranquille'));
    this.addOverlayButton(W / 2 + 140, top + 380, 'Défi', true, () => this.startGame('defi'));
    c.add(this.add.text(W / 2 - 140, top + 432, 'pas de chrono,\nrien à perdre', { ...style(15, '#c9bfff', 600), align: 'center' }).setOrigin(0.5, 0));
    c.add(this.add.text(W / 2 + 140, top + 432, 'chrono de faim\net 3 cœurs', { ...style(15, '#c9bfff', 600), align: 'center' }).setOrigin(0.5, 0));
  }

  /** Étoiles : 1 pour la victoire, 1 pour 85 % sans hoquet, 1 pour un sans-faute sans être touché. */
  private starsFor(won: boolean): number {
    const s = this.session;
    if (!s || !won) return 0;
    let n = 1;
    if (s.accuracy() >= 0.85) n++;
    if (s.accuracy() >= 0.95 && s.stats.hurts + s.stats.hungers === 0) n++;
    return n;
  }

  private showEnd(won: boolean): void {
    const s = this.session;
    if (!s) return;
    const key = `${this.tier.id}-${s.mode}`;
    const rec = this.records();
    const best = rec[key] ?? 0;
    const isRecord = s.score > best;
    if (isRecord) {
      rec[key] = s.score;
      try {
        localStorage.setItem(RECORD_KEY, JSON.stringify(rec));
      } catch {
        /* stockage indisponible */
      }
    }
    const c = this.openOverlay(560, won ? 0.55 : 0.35);
    const top = H / 2 - 280;
    c.add(this.add.text(W / 2, top + 54, won ? 'Le dragon est repu !' : 'Plouf ! Le dragon a besoin de repos…', style(won ? 44 : 34, won ? B.C.saffron : B.C.coralLight, 800, 7)).setOrigin(0.5));
    const stars = this.starsFor(won);
    this.tex('s-star-1', () => Sp.scoreStar(true));
    this.tex('s-star-0', () => Sp.scoreStar(false));
    for (let i = 0; i < 3; i++) {
      const size = K * (i === 1 ? 1.15 : 1);
      const st = this.add.image(W / 2 + (i - 1) * 84, top + 124 - (i === 1 ? 10 : 0), 's-star-0').setScale(size);
      c.add(st);
      if (i < stars) {
        this.time.delayedCall(350 + i * 380, () => {
          st.setTexture('s-star-1');
          this.sfx.star(i);
          if (!this.reducedMotion) {
            this.tweens.add({ targets: st, scale: { from: size * 2.2, to: size }, angle: { from: -40, to: 0 }, duration: 320, ease: 'Back.easeOut' });
            this.sparks.explode(10, st.x, st.y);
          }
        });
      }
    }
    c.add(this.add.text(W / 2, top + 186, `Score ${s.score}`, style(32, B.C.cream, 800, 5)).setOrigin(0.5));
    c.add(this.add.text(W / 2, top + 222, isRecord ? 'Nouveau record !' : `Record : ${best}`, style(18, isRecord ? B.C.saffron : '#c9bfff', 800)).setOrigin(0.5));
    const lines: Array<[string, string]> = [
      ['Objectifs réussis', `${s.stats.goals} / ${s.totalGoals}`],
      ['Coups parfaits (le moins de lanternes)', `${s.stats.perfect}`],
      ['Sans hoquet', `${Math.round(s.accuracy() * 100)} %`],
      ['Meilleure série', `${s.stats.bestCombo}`],
      ['Chauves-souris roussies', `${s.stats.batsBurned}`],
    ];
    lines.forEach(([label, value], i) => {
      const y = top + 266 + i * 34;
      c.add(this.add.text(W / 2 - 250, y, label, style(20, '#e8dcff', 600)).setOrigin(0, 0.5));
      c.add(this.add.text(W / 2 + 250, y, value, style(22, B.C.cream, 800)).setOrigin(1, 0.5));
    });
    const status = this.add.text(W / 2, top + 440, 'Enregistrement…', style(16, '#c9bfff', 700)).setOrigin(0.5);
    c.add(status);
    void reportResult({
      jeu: 'dragon',
      niveau: this.tier.id,
      mode: s.mode,
      score: s.score,
      gagne: won,
      etoiles: stars,
      duree: (Date.now() - this.startedAt) / 1000,
      precision: s.accuracy(),
      ops: s.stats.byOp,
      details: { objectifs: s.stats.goals, parfaits: s.stats.perfect, hoquets: s.stats.overshoots, serie: s.stats.bestCombo, chauvesSouris: s.stats.batsBurned },
    }).then((o) => status.active && status.setText(outcomeText(o)));
    this.addOverlayButton(W / 2 - 130, top + 482, 'Accueil', false, () => {
      window.location.href = '../index.html';
    });
    this.addOverlayButton(W / 2 + 130, top + 482, 'Rejouer', true, () => this.showIntro());
    this.overlayFocus = 1;
    this.refreshOverlayFocus();
  }

  private startGame(mode: Mode): void {
    this.overlay?.destroy(true);
    this.overlay = null;
    this.overlayButtons = [];
    this.paused = false;
    this.time.paused = false;
    this.tweens.resumeAll();
    for (const o of this.wreck) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.wreck = [];
    for (const id of [...this.orbViews.keys()]) {
      const v = this.orbViews.get(id)!;
      v.c.destroy();
      this.orbViews.delete(id);
    }
    for (const b of this.bats) b.img.destroy();
    this.bats = [];
    this.removeCake();
    this.resetSky();
    this.fire.stop();
    this.fireSmoke.stop();
    this.breathingUntil = 0;
    this.faceOverride = null;
    this.invulnerableUntil = 0;
    this.fever = false;
    this.headImg.clearTint();
    this.ending = false;
    this.diving = false;
    this.sunk = false;
    this.headImg.setDepth(40);
    this.steer = null;
    this.seed = (this.seed * 7919 + 13) % 1e9;
    this.resetDragon(240, 400);
    this.session = new DragonSession(this.tier.id, this.seed, mode, { x: 240, y: 400 });
    this.startedAt = Date.now();
    this.session.orbs.forEach((o, i) => this.addOrbView(o, 150 + i * 70));
    this.scoreShown = 0;
    this.nextCakeAt = this.time.now + 15000;
    this.showGoal(this.session.goal, false);
    this.refreshStage();
    this.refreshHearts();
    this.refreshScore();
    this.setMusic(0);
    this.banner(STAGE_BANNERS[0], B.C.saffron, 1300);
  }
}

const DR_INK = '#3a1a1a';

/** Petit point de progression (lanterne éteinte ou allumée). */
function dot(on: boolean): HTMLCanvasElement {
  const [c, ctx] = B.makeCanvas(22, 22);
  B.paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(11, 11, 8, 0, Math.PI * 2);
  }, on ? '#ffc94a' : '#2a2556', { line: 3 });
  return c;
}
