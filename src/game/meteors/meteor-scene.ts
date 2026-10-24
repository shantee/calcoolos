/**
 * « Pluie de météores » — jeu d'arcade spatial.
 *
 * Des météores rouges et des robots tombent vers la station en portant un calcul.
 * On tape le résultat (pavé à l'écran ou clavier) : le vaisseau vise et tire.
 * Toute la logique est dans session.ts ; ici on montre, on anime et on fait vivre
 * le décor (baleine cosmique, chat astronaute, robots de la station, canard perdu).
 */
import Phaser from 'phaser';
import * as B from '../../art/variant-b';
import * as Sp from '../../art/space';
import * as Wd from '../../art/world-b';
import { Sfx } from '../sfx';
import { Fireworks } from '../fx';
import { MeteorSession, METEOR_MODES, type Meteor, type MeteorEvent } from './session';
import { TIERS, type Tier, type TierId } from '../../core/difficulty';
import type { Mode } from '../../core/waves';
import { reportResult, outcomeText } from '../../platform/results';

export const W = 1280;
export const H = 720;
const K = 1 / B.RES;

const F = {
  left: 20,
  right: 950,
  top: -70,
  stationY: 598,
  shipY: 548,
  panelX: 972,
  panelY: 118,
  panelW: 288,
  panelH: 586,
};
const CX = (F.left + F.right) / 2;
/** À partir de quelle série le vaisseau passe « en feu ». */
const FEVER_COMBO = 8;

function style(size: number, color: string, weight = 700, stroke = 0): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: B.FONT, fontSize: `${size}px`, fontStyle: String(weight), color, stroke: B.C.ink, strokeThickness: stroke, resolution: 2 };
}

interface MeteorView {
  m: Meteor;
  obj: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  plate: Phaser.GameObjects.Image;
  reticle: Phaser.GameObjects.Image;
  alarm: Phaser.GameObjects.Text;
  trails: Phaser.GameObjects.Particles.ParticleEmitter[];
  counter: Phaser.GameObjects.Text | null;
  locked: boolean;
  danger: boolean;
  frame: 0 | 1;
  wobble: number;
}

type PilotFace = Sp.PilotFace;

const RECORD_KEY = 'calcoolos.meteores.records';
const TAUNTS = ['Bip boup !', 'Trop lent !', 'Même pas peur !', 'Bzzzt !', 'Hi hi hi !'];
const SCARED = ['Oh non !', 'Au secours !', 'Pas moi !', 'Glups…'];

export class MeteorScene extends Phaser.Scene {
  private tier!: Tier;
  private seed = 1;
  private session: MeteorSession | null = null;
  private sfx = new Sfx();
  private reducedMotion = false;
  private speedBoost = 1;
  private views = new Map<number, MeteorView>();
  private scheduled = new Set<number>();
  private fx!: Fireworks;

  // Décor vivant
  private stars: Phaser.GameObjects.TileSprite[] = [];
  private nebulas: Phaser.GameObjects.Image[] = [];
  private vignette!: Phaser.GameObjects.Image;
  private stationImg!: Phaser.GameObjects.Image;
  private dome!: Phaser.GameObjects.Ellipse;
  private cracks!: Phaser.GameObjects.Graphics;
  private bots: Phaser.GameObjects.Image[] = [];
  private cat!: Phaser.GameObjects.Image;
  private tether!: Phaser.GameObjects.Graphics;
  private catSpin = false;
  private whale: Phaser.GameObjects.Image | null = null;
  private duck: Phaser.GameObjects.Image | null = null;

  // Vaisseau
  private ship!: Phaser.GameObjects.Container;
  private hull!: Phaser.GameObjects.Image;
  private pilot!: Phaser.GameObjects.Image;
  private flame!: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private pilotOverride: { face: PilotFace; until: number } | null = null;
  private fever = false;

  // Particules
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers!: Phaser.GameObjects.Particles.ParticleEmitter;
  private shards: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private parts: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  // Interface
  private scoreText!: Phaser.GameObjects.Text;
  private scoreShown = 0;
  private scoreTween: Phaser.Tweens.Tween | null = null;
  private comboText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private soundText!: Phaser.GameObjects.Text;
  private readout!: Phaser.GameObjects.Text;
  private shieldIcons: Phaser.GameObjects.Image[] = [];
  private keys = new Map<string, Phaser.GameObjects.Container>();
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayButtons: Array<{ c: Phaser.GameObjects.Container; run: () => void }> = [];
  private overlayFocus = 0;
  private keyboardUsed = false;
  private paused = false;
  private wreck: Phaser.GameObjects.GameObject[] = [];
  private ending = false;
  private musicLevel = 0;
  private startedAt = 0;

  constructor() {
    super('pluie-de-meteores');
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
    this.fx = new Fireworks(this, 71, this.reducedMotion);

    this.buildWorld();
    this.buildStation();
    this.buildShip();
    this.buildParticles();
    this.buildHud();
    this.buildKeypad();
    this.bindKeys();
    this.startAmbientLife();
    this.input.on('pointerdown', () => this.sfx.unlock());
    this.showIntro();

    (window as unknown as { __meteores: unknown }).__meteores = {
      session: () => this.session,
      start: (mode: Mode) => this.startGame(mode),
      type: (s: string) => [...s].forEach((d) => this.onDigit(d)),
      overlay: () => this.overlay !== null,
      ending: () => this.ending,
      pause: () => this.pause(),
      resume: () => this.resume(),
      spawnDuck: () => this.spawnDuck(),
      spawnWhale: () => this.spawnWhale(false),
    };
  }

  // --- Décor ----------------------------------------------------------------------------------
  private buildWorld(): void {
    this.add.image(0, 0, this.tex('s-bg', () => Sp.spaceBackground(W, H))).setOrigin(0);
    // Nébuleuses qui respirent lentement.
    [
      { x: 240, y: 200, col: '#ff5fa2', r: 300 },
      { x: 720, y: 160, col: '#3fd6c4', r: 340 },
    ].forEach((n, i) => {
      const img = this.add.image(n.x, n.y, this.tex(`s-neb-${i}`, () => B.softGlow(n.r, n.col))).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
      this.nebulas.push(img);
      if (!this.reducedMotion) this.tweens.add({ targets: img, alpha: 0.3, x: n.x + 40, scale: 1.12, duration: 9000 + i * 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    // Trois couches d'étoiles en parallaxe : on file à travers l'espace.
    [
      { n: 60, size: 1, seed: 1, alpha: 0.6 },
      { n: 30, size: 2, seed: 2, alpha: 0.8 },
      { n: 12, size: 3, seed: 3, alpha: 0.9 },
    ].forEach((l, i) => {
      this.stars.push(this.add.tileSprite(0, 0, W, H - 90, this.tex(`s-stars-${i}`, () => Sp.starLayer(512, 512, l.n, l.size, l.seed))).setOrigin(0).setAlpha(l.alpha));
    });
    this.vignette = this.add.image(0, 0, this.tex('s-vignette', () => Sp.vignette(W, H))).setOrigin(0).setDisplaySize(W, H).setDepth(28).setAlpha(0);
  }

  private buildStation(): void {
    this.stationImg = this.add.image(CX, F.stationY + 96, this.tex('s-station', Sp.station)).setOrigin(0.5, 1).setScale(K).setDepth(5);
    this.dome = this.add.ellipse(CX, F.stationY + 60, 860, 150).setStrokeStyle(4, 0x5fd3bc, 0.5).setFillStyle(0x5fd3bc, 0.06).setDepth(4);
    if (!this.reducedMotion) this.tweens.add({ targets: this.dome, alpha: 0.6, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.cracks = this.add.graphics().setDepth(4);

    // Deux petits robots d'entretien sur la plate-forme.
    this.tex('s-bot-0', () => Sp.tinyBot(false));
    this.tex('s-bot-1', () => Sp.tinyBot(true));
    [-118, 118].forEach((dx, i) => {
      const bot = this.add.image(CX + dx, F.stationY + 58, 's-bot-0').setOrigin(0.5, 1).setScale(K).setDepth(6).setFlipX(i === 1).setInteractive({ useHandCursor: true });
      bot.setData('home', CX + dx);
      bot.on('pointerdown', () => {
        this.sfx.unlock();
        this.sfx.robotBeep();
        this.botJump(bot, 2);
      });
      this.bots.push(bot);
    });

    // Le chat astronaute, attaché à l'antenne par un câble.
    this.tex('s-cat-0', () => Sp.cat(0));
    this.tex('s-cat-1', () => Sp.cat(1));
    this.tether = this.add.graphics().setDepth(5);
    this.cat = this.add.image(CX - 230, F.stationY - 90, 's-cat-0').setScale(K).setDepth(6).setInteractive({ useHandCursor: true });
    this.cat.on('pointerdown', () => {
      this.sfx.unlock();
      this.sfx.meow();
      this.spinCat();
      this.sparks.explode(8, this.cat.x, this.cat.y);
    });
    let f = 0;
    this.time.addEvent({ delay: 700, loop: true, callback: () => {
      f = 1 - f;
      this.cat.setTexture(`s-cat-${f}`);
    } });
  }

  private buildShip(): void {
    this.tex('s-flame-0', () => Sp.thruster(0));
    this.tex('s-flame-1', () => Sp.thruster(1));
    (['normal', 'content', 'inquiet', 'oups'] as PilotFace[]).forEach((f) => this.tex(`s-pilot-${f}`, () => Sp.pilot(f)));
    this.flame = this.add.image(0, 50, 's-flame-0').setOrigin(0.5, 0).setScale(K);
    this.hull = this.add.image(0, 0, this.tex('s-ship', Sp.ship)).setScale(K);
    this.pilot = this.add.image(0, -9, 's-pilot-normal').setScale(K);
    this.ship = this.add.container(CX, F.shipY, [this.flame, this.hull, this.pilot]).setDepth(20);
    this.ship.setSize(80, 120).setInteractive({ useHandCursor: true });
    this.ship.on('pointerdown', () => {
      this.sfx.unlock();
      this.sfx.robotBeep();
      this.setPilot('content', 900);
    });
    let f = 0;
    this.time.addEvent({ delay: 90, loop: true, callback: () => {
      f = 1 - f;
      this.flame.setTexture(`s-flame-${f}`);
    } });
    if (!this.reducedMotion) {
      this.tweens.add({ targets: [this.hull, this.pilot], y: '-=5', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      // Gaz du réacteur.
      this.add.particles(0, 0, this.tex('s-exhaust', () => B.softGlow(16, '#ff9a4d')), {
        follow: this.ship,
        followOffset: { x: 0, y: 66 },
        speedY: { min: 90, max: 170 },
        speedX: { min: -14, max: 14 },
        lifespan: 340,
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.8, end: 0 },
        frequency: 28,
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(19);
      // Aura d'étincelles du mode « en feu ».
      this.aura = this.add.particles(0, 0, this.tex('w-fw-#ffc94a', () => B.sparkle('#ffc94a')), {
        follow: this.ship,
        speedY: { min: -140, max: -60 },
        speedX: { min: -50, max: 50 },
        x: { min: -40, max: 40 },
        y: { min: -20, max: 50 },
        lifespan: 600,
        scale: { start: 0.6, end: 0 },
        frequency: 35,
        emitting: false,
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(21);
    }
  }

  private buildParticles(): void {
    this.sparks = this.add.particles(0, 0, this.tex('b-spark-0', () => B.sparkle('#fff6dc')), {
      speed: { min: 120, max: 420 },
      angle: { min: 0, max: 360 },
      rotate: { min: 0, max: 360 },
      lifespan: { min: 300, max: 700 },
      scale: { start: 0.8, end: 0 },
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(50);
    this.embers = this.add.particles(0, 0, this.tex('s-ember', () => B.softGlow(10, '#ffb347')), {
      speed: { min: 80, max: 340 },
      angle: { min: 0, max: 360 },
      gravityY: 260,
      lifespan: { min: 500, max: 1100 },
      scale: { start: 0.9, end: 0 },
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(49);
    for (let i = 0; i < 3; i++) {
      this.shards.push(this.add.particles(0, 0, this.tex(`s-shard-${i}`, () => Sp.shard(i + 1)), {
        speed: { min: 160, max: 420 },
        angle: { min: 0, max: 360 },
        rotate: { min: -360, max: 360 },
        gravityY: 500,
        lifespan: { min: 600, max: 1100 },
        scale: { start: K * 1.4, end: K * 0.6 },
        emitting: false,
      }).setDepth(48));
    }
    (['engrenage', 'ressort', 'boulon'] as const).forEach((kind) => {
      this.parts.push(this.add.particles(0, 0, this.tex(`s-part-${kind}`, () => Sp.part(kind)), {
        speed: { min: 180, max: 460 },
        angle: { min: 200, max: 340 },
        rotate: { min: -720, max: 720 },
        gravityY: 700,
        lifespan: 1300,
        scale: K * 1.2,
        emitting: false,
      }).setDepth(48));
    });
    this.tex('s-fireball', () => B.softGlow(60, '#ff8a3d'));
    this.tex('s-flash', () => B.softGlow(60, '#ffffff'));
    this.tex('s-smoke', () => B.softGlow(40, '#8a86a8'));
    this.tex('s-coin', Sp.coin);
  }

  update(time: number, delta: number): void {
    if (!this.reducedMotion && !this.paused) this.stars.forEach((t, i) => (t.tilePositionY -= (delta / 1000) * (this.fever ? 2 : 1) * (20 + i * 35)));
    this.animateCat(time);
    const s = this.session;
    if (!s || this.overlay || this.ending) return;
    const dt = (delta / 1000) * this.speedBoost;
    for (const ev of s.update(dt)) this.onEvent(ev);
    let maxP = 0;
    for (const v of [...this.views.values()]) {
      // Filet de sécurité : un météore mort ne reste jamais affiché.
      if (!v.m.alive && !this.scheduled.has(v.m.id)) {
        this.explode(v.m, false);
        continue;
      }
      this.placeView(v, time);
      this.updateLock(v, s.typed);
      this.updateDanger(v);
      if (v.m.kind !== 'boss') maxP = Math.max(maxP, v.m.p);
    }
    // Halo rouge quand un météore est tout près de la station.
    const target = maxP > 0.82 ? 0.25 + 0.2 * Math.sin(time / 120) : 0;
    this.vignette.setAlpha(this.reducedMotion ? Math.min(0.2, target) : target);
    this.refreshPilot(time, maxP);
  }

  private fieldX(x: number): number {
    return F.left + 50 + x * (F.right - F.left - 100);
  }

  private fieldY(p: number): number {
    return F.top + p * (F.stationY - F.top);
  }

  private placeView(v: MeteorView, time: number): void {
    const { m } = v;
    if (m.kind === 'boss') {
      v.obj.setPosition(this.fieldX(m.x) + (this.reducedMotion ? 0 : Math.sin(time / 900) * 60), 130 + m.p * (F.stationY - 260));
      return;
    }
    const wob = this.reducedMotion ? 0 : Math.sin(time / 400 + v.wobble) * 4;
    v.obj.setPosition(this.fieldX(m.x) + wob, this.fieldY(m.p));
    if (m.kind === 'rocher' || m.kind === 'dore') v.body.rotation = Math.sin(time / 700 + v.wobble) * 0.25;
    if (m.kind === 'robot') v.body.angle = Math.sin(time / 300 + v.wobble) * 6;
  }

  // --- Verrouillage et danger ----------------------------------------------------------------------
  private bodyKey(v: MeteorView, scared: boolean): string {
    const mood = scared ? 'peur' : 'colere';
    const { m } = v;
    if (m.kind === 'robot') return this.tex(`s-robot-${v.frame}-${mood}`, () => Sp.robot(v.frame, mood));
    if (m.kind === 'boss') return this.tex(`s-boss-${v.frame}-${mood}`, () => Sp.mothership(v.frame, mood));
    if (m.kind === 'dore') return this.tex('s-gold', () => Sp.meteor(5, true));
    const n = (m.id % 4) + 1;
    return this.tex(`s-rock-${n}-${mood}`, () => Sp.meteor(n, false, mood));
  }

  /** Quand la saisie commence comme la réponse d'un météore, le viseur le verrouille et il prend peur. */
  private updateLock(v: MeteorView, typed: string): void {
    const locked = typed !== '' && String(v.m.expr.answer).startsWith(typed);
    if (locked === v.locked) return;
    v.locked = locked;
    const bossScared = v.m.kind === 'boss' && v.m.queue.length <= 1;
    v.body.setTexture(this.bodyKey(v, locked || bossScared));
    v.reticle.setVisible(locked);
    if (!locked) return;
    this.sfx.key(9);
    if (!this.reducedMotion) {
      const size = K * (v.m.kind === 'boss' ? 2.3 : 1);
      v.reticle.setScale(size * 1.8).setAlpha(0);
      this.tweens.add({ targets: v.reticle, scale: size, alpha: 1, duration: 160, ease: 'Back.easeOut' });
    }
    if (v.m.kind === 'robot' && Math.random() < 0.4) this.say(v, Phaser.Utils.Array.GetRandom(SCARED));
  }

  private updateDanger(v: MeteorView): void {
    const danger = v.m.kind !== 'boss' && v.m.p > 0.78;
    if (danger === v.danger) return;
    v.danger = danger;
    v.alarm.setVisible(danger);
    v.plate.setTint(danger ? 0xff8a8a : 0xffffff);
    if (danger) {
      this.sfx.danger();
      if (!this.reducedMotion) this.tweens.add({ targets: v.alarm, scale: { from: 0.8, to: 1.25 }, duration: 260, yoyo: true, repeat: -1 });
    }
  }

  private setPilot(face: PilotFace, ms: number): void {
    this.pilotOverride = { face, until: this.time.now + ms };
  }

  private refreshPilot(time: number, maxP: number): void {
    let face: PilotFace = 'normal';
    if (this.pilotOverride && time < this.pilotOverride.until) face = this.pilotOverride.face;
    else if (maxP > 0.7) face = 'inquiet';
    else if (this.fever) face = 'content';
    const key = `s-pilot-${face}`;
    if (this.pilot.texture.key !== key) this.pilot.setTexture(key);
  }

  // --- Vie du décor ---------------------------------------------------------------------------------------
  private startAmbientLife(): void {
    if (this.reducedMotion) return;
    // Étoiles filantes.
    const streakKey = this.tex('s-streak', Sp.streak);
    const shoot = () => {
      const x = Phaser.Math.Between(-100, 600);
      const y = Phaser.Math.Between(-20, 200);
      const st = this.add.image(x, y, streakKey).setOrigin(1, 0.5).setAngle(22).setBlendMode(Phaser.BlendModes.ADD).setDepth(1).setScale(0.5, 1);
      this.tweens.add({ targets: st, x: x + 520, y: y + 210, scaleX: 1.2, alpha: { from: 1, to: 0 }, duration: 750, ease: 'Quad.easeIn', onComplete: () => st.destroy() });
      this.time.delayedCall(Phaser.Math.Between(3000, 7000), shoot);
    };
    this.time.delayedCall(2500, shoot);
  }

  private animateCat(time: number): void {
    if (!this.cat?.active) return;
    if (!this.catSpin && !this.reducedMotion && !this.ending) {
      this.cat.x = CX - 230 + Math.sin(time / 1700) * 18;
      this.cat.y = F.stationY - 90 + Math.sin(time / 1100) * 10;
      this.cat.angle = Math.sin(time / 1300) * 14;
    }
    // Câble souple entre l'antenne et le chat.
    this.tether.clear();
    if (this.cat.alpha < 0.9 || this.cat.x < CX - 400) return;
    const ax = CX;
    const ay = F.stationY - 10;
    this.tether.lineStyle(3, 0x1d1a2b, 0.9);
    new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(ax, ay),
      new Phaser.Math.Vector2((ax + this.cat.x) / 2, Math.max(ay, this.cat.y) + 40),
      new Phaser.Math.Vector2(this.cat.x + 10, this.cat.y + 18),
    ).draw(this.tether, 24);
  }

  private spinCat(): void {
    if (this.catSpin || this.reducedMotion) return;
    this.catSpin = true;
    this.tweens.add({ targets: this.cat, angle: '+=720', y: this.cat.y - 40, duration: 900, ease: 'Cubic.easeOut', onComplete: () => {
      this.catSpin = false;
    } });
  }

  private botJump(bot: Phaser.GameObjects.Image, times: number): void {
    if (this.reducedMotion || !bot.active) return;
    this.tweens.killTweensOf(bot);
    bot.setY(F.stationY + 58).setTexture('s-bot-1');
    this.tweens.add({ targets: bot, y: F.stationY + 30, duration: 160, yoyo: true, repeat: times - 1, ease: 'Quad.easeOut', onComplete: () => {
      if (bot.active) bot.setTexture('s-bot-0');
    } });
  }

  private spawnWhale(singing: boolean): void {
    if (this.whale || this.reducedMotion) return;
    this.tex('s-whale-0', () => Sp.whale(0));
    this.tex('s-whale-1', () => Sp.whale(1));
    const y = Phaser.Math.Between(200, 330);
    const w = this.add.image(-220, y, 's-whale-0').setScale(K).setDepth(1).setAlpha(0.9).setInteractive({ useHandCursor: true });
    this.whale = w;
    let f = 0;
    const tail = this.time.addEvent({ delay: 650, loop: true, callback: () => {
      f = 1 - f;
      if (w.active) w.setTexture(`s-whale-${f}`);
    } });
    const sing = () => {
      if (!w.active) return;
      this.sfx.whale();
      const notes = this.add.particles(0, 0, this.tex('w-fw-#b79ad8', () => B.sparkle('#b79ad8')), {
        follow: w,
        followOffset: { x: 70, y: -30 },
        speedY: { min: -90, max: -40 },
        speedX: { min: -30, max: 30 },
        lifespan: 1400,
        scale: { start: 0.7, end: 0 },
        quantity: 2,
        frequency: 80,
        duration: 1600,
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(2);
      this.time.delayedCall(3200, () => notes.destroy());
    };
    w.on('pointerdown', () => {
      this.sfx.unlock();
      sing();
    });
    if (singing) this.time.delayedCall(1500, sing);
    this.tweens.add({ targets: w, x: F.right + 240, duration: 30000, onUpdate: () => w.setY(y + Math.sin(w.x / 90) * 12), onComplete: () => {
      tail.remove();
      w.destroy();
      this.whale = null;
    } });
  }

  /** Un canard en plastique dérive dans l'espace : l'attraper rapporte un bonus. */
  private spawnDuck(): void {
    if (this.duck || this.ending || !this.session) return;
    const y = Phaser.Math.Between(150, 260);
    const d = this.add.image(F.right + 40, y, this.tex('s-duck', Sp.duck)).setScale(K).setDepth(16).setInteractive({ useHandCursor: true });
    this.duck = d;
    const drift = this.tweens.add({ targets: d, x: F.left - 60, angle: -360, duration: 16000, onComplete: () => {
      d.destroy();
      if (this.duck === d) this.duck = null;
    } });
    d.on('pointerdown', () => {
      if (!this.session || this.ending) return;
      this.sfx.unlock();
      this.sfx.quack();
      this.session.bonus(100);
      this.refreshScore();
      drift.stop();
      d.disableInteractive();
      this.floatText(d.x, d.y - 40, 'Canard de l’espace ! +100', '#ffd23f', 24);
      this.sparks.explode(12, d.x, d.y);
      this.tweens.add({ targets: d, y: -80, angle: d.angle + 720, scale: K * 0.4, duration: 900, ease: 'Back.easeIn', onComplete: () => {
        d.destroy();
        if (this.duck === d) this.duck = null;
      } });
    });
  }

  // --- Interface ----------------------------------------------------------------------------------
  private buildHud(): void {
    this.scoreText = this.add.text(30, 20, 'Score 0', style(30, B.C.cream, 800, 6)).setDepth(60);
    this.comboText = this.add.text(30, 60, '', style(22, B.C.saffron, 800, 5)).setDepth(60);
    // Colonne de droite : vague et boucliers ; le terrain reste dégagé pour les météores.
    this.waveText = this.add.text(F.panelX + F.panelW / 2, 22, '', style(24, B.C.cream, 800, 5)).setOrigin(0.5, 0).setDepth(60);
    this.soundText = this.add.text(F.panelX + F.panelW / 2, F.panelY + F.panelH - 26, '', style(16, B.C.cream, 700, 4)).setOrigin(0.5).setDepth(60).setInteractive({ useHandCursor: true });
    this.soundText.on('pointerdown', () => this.toggleSound());
    this.setMuted(this.sfx.muted);
    this.tex('s-shield-1', () => Sp.shieldIcon(true));
    this.tex('s-shield-0', () => Sp.shieldIcon(false));
    // Bouton pause.
    const pb = this.add.container(F.right - 30, 38).setDepth(60);
    pb.add(this.add.circle(0, 0, 22, 0x141842, 0.9).setStrokeStyle(3, 0x1d1a2b));
    pb.add(this.add.text(0, -1, 'II', style(20, B.C.cream, 800)).setOrigin(0.5));
    pb.setSize(48, 48).setInteractive({ useHandCursor: true });
    pb.on('pointerdown', () => this.pause());
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
    this.sfx.music(true, level);
  }

  private refreshShields(): void {
    for (const i of this.shieldIcons) i.destroy();
    this.shieldIcons = [];
    const s = this.session;
    const max = s ? METEOR_MODES[s.mode].shields : null;
    if (!s || max === null || s.shields === null) return;
    for (let i = 0; i < max; i++) {
      this.shieldIcons.push(this.add.image(F.panelX + F.panelW / 2 + (i - (max - 1) / 2) * 38, 80, `s-shield-${i < s.shields ? 1 : 0}`).setScale(K).setDepth(60));
    }
  }

  /** Le score défile jusqu'à sa nouvelle valeur ; la série s'affiche et peut passer « en feu ». */
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
    this.comboText.setText(s.combo > 1 ? (hot ? `EN FEU ! Combo ×${s.combo}` : `Combo ×${s.combo}`) : '').setColor(hot ? '#ff7a3d' : B.C.saffron);
    if (hot && !this.fever) this.setFever(true);
    if (!hot && this.fever) this.setFever(false);
  }

  private setFever(on: boolean): void {
    this.fever = on;
    if (on) {
      this.sfx.feverOn();
      this.banner('EN FEU !', '#ff7a3d');
      this.aura?.start();
      if (this.musicLevel < 2) this.setMusic(1);
      this.nebulas.forEach((n) => n.setTint(0xffb36b));
    } else {
      this.sfx.feverOff();
      this.aura?.stop();
      if (this.musicLevel < 2 && !this.ending) this.setMusic(0);
      this.nebulas.forEach((n) => n.clearTint());
    }
  }

  private refreshReadout(error = false): void {
    const t = this.session?.typed ?? '';
    this.readout.setText(t === '' ? '= ?' : `= ${t}`).setColor(error ? B.C.coralLight : t ? B.C.saffron : '#9fc9c2');
  }

  private buildKeypad(): void {
    this.add.image(F.panelX - 5, F.panelY - 5, this.tex('s-panel', () => Sp.keypadPanel(F.panelW, F.panelH))).setOrigin(0).setScale(K).setDepth(30);
    this.add.text(F.panelX + F.panelW / 2, F.panelY + 26, 'TA RÉPONSE', style(15, '#9fc9c2', 700)).setOrigin(0.5).setDepth(31);
    this.readout = this.add.text(F.panelX + F.panelW / 2, F.panelY + 76, '= ?', style(52, '#9fc9c2', 800, 6)).setOrigin(0.5).setDepth(31);
    const layout = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0'];
    const kw = 76;
    const kh = 66;
    const gap = 12;
    const x0 = F.panelX + (F.panelW - (3 * kw + 2 * gap)) / 2 + kw / 2;
    const y0 = F.panelY + 152;
    layout.forEach((label, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const wide = label === '0';
      const w = wide ? kw * 2 + gap : kw;
      const x = wide ? x0 + (kw + gap) * 1.5 : x0 + col * (kw + gap);
      const y = y0 + row * (kh + gap);
      const kind = label === '⌫' ? 'effacer' : 'chiffre';
      const key = this.tex(`s-key-${kind}-${w}`, () => Sp.key(w, kh, kind));
      const c = this.add.container(x, y).setDepth(32);
      c.add(this.add.image(0, 3, key).setScale(K));
      c.add(this.add.text(0, -2, label, style(34, kind === 'chiffre' ? B.C.ink : B.C.cream, 800)).setOrigin(0.5));
      c.setSize(w, kh + 6).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        this.sfx.unlock();
        if (label === '⌫') this.onBackspace();
        else this.onDigit(label);
      });
      this.keys.set(label, c);
    });
    this.add.text(F.panelX + F.panelW / 2, F.panelY + F.panelH - 58, 'ou tape au clavier', style(14, '#9fc9c2', 600)).setOrigin(0.5).setDepth(31);
  }

  /** La touche s'enfonce, qu'on la touche à l'écran ou au clavier. */
  private pressKey(label: string): void {
    const c = this.keys.get(label);
    if (!c) return;
    this.tweens.killTweensOf(c);
    c.setScale(1);
    this.tweens.add({ targets: c, scale: 0.9, duration: 55, yoyo: true });
  }

  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown', (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        this.onDigit(e.key);
        return;
      }
      if (e.key === 'Backspace') this.onBackspace();
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

  // --- Saisie et tir ------------------------------------------------------------------------------
  private onDigit(d: string): void {
    const s = this.session;
    if (!s || this.overlay || this.ending) return;
    this.sfx.unlock();
    this.sfx.key(Number(d));
    this.pressKey(d);
    const r = s.input(d);
    if (!this.reducedMotion) this.tweens.add({ targets: this.readout, scale: { from: 1.18, to: 1 }, duration: 140, ease: 'Back.easeOut' });
    if (r.kind === 'pending') {
      this.refreshReadout();
      return;
    }
    if (r.kind === 'error') {
      this.sfx.buzz();
      this.setPilot('oups', 900);
      this.readout.setText(`= ${r.typed}`).setColor(B.C.coralLight);
      if (!this.reducedMotion) {
        this.tweens.add({ targets: this.readout, x: { from: this.readout.x - 10, to: this.readout.x }, duration: 380, ease: 'Elastic.easeOut' });
        // Le moteur tousse : petit nuage de fumée.
        for (let i = 0; i < 3; i++) this.puff(this.ship.x + Phaser.Math.Between(-10, 10), this.ship.y + 60, 0.6);
      }
      this.time.delayedCall(380, () => this.refreshReadout());
      this.refreshScore();
      return;
    }
    this.refreshReadout();
    this.fireAt(r.meteor, r.points, r.destroyed, r.bossDone);
    this.refreshScore();
  }

  private onBackspace(): void {
    this.pressKey('⌫');
    this.session?.backspace();
    this.refreshReadout();
  }

  /**
   * Tir laser immédiat ; le déplacement du vaisseau est purement décoratif :
   * un nouveau tir ne doit jamais annuler l'explosion du précédent.
   */
  private fireAt(target: Meteor, points: number, destroyed: Meteor[], bossDone: boolean): void {
    const v = this.views.get(target.id);
    if (!v) return;
    const tx = v.obj.x;
    const ty = v.obj.y;
    const sx = this.ship.x;
    const sy = this.ship.y - 40;
    this.tweens.killTweensOf(this.ship);
    this.ship.setY(F.shipY);
    const dx = Phaser.Math.Clamp(tx, F.left + 60, F.right - 60) - this.ship.x;
    // Le vaisseau s'incline vers sa cible, recule au tir, puis se redresse.
    this.tweens.add({ targets: this.ship, x: this.ship.x + dx, angle: Phaser.Math.Clamp(dx * 0.05, -16, 16), duration: 140, ease: 'Quad.easeOut', onComplete: () => {
      this.tweens.add({ targets: this.ship, angle: 0, duration: 380, ease: 'Back.easeOut' });
    } });
    if (!this.reducedMotion) this.tweens.add({ targets: this.ship, y: F.shipY + 10, duration: 70, yoyo: true });
    this.sfx.laser();
    this.setPilot('content', 700);
    const g = this.add.graphics().setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
    const outer = this.fever ? 0xff7a3d : 0x5fd3bc;
    const mid = this.fever ? 0xffc94a : 0xa8f0e4;
    g.lineStyle(this.fever ? 22 : 16, outer, 0.45).lineBetween(sx, sy, tx, ty);
    g.lineStyle(this.fever ? 10 : 7, mid, 0.9).lineBetween(sx, sy, tx, ty);
    g.lineStyle(3, 0xffffff, 1).lineBetween(sx, sy, tx, ty);
    this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
    const muzzle = this.add.image(sx, sy, 's-flash').setBlendMode(Phaser.BlendModes.ADD).setScale(0.25).setDepth(46);
    this.tweens.add({ targets: muzzle, scale: 0.6, alpha: 0, duration: 140, onComplete: () => muzzle.destroy() });
    this.sparks.explode(this.reducedMotion ? 2 : 8, tx, ty);
    this.floatText(tx + 40, ty - 50, `+${points}`, this.fever ? '#ff9a4d' : B.C.saffron);
    if (target.kind === 'boss' && !bossDone) {
      this.bossHit(v);
      return;
    }
    if (target.kind === 'dore') {
      this.shockwave(tx, ty);
      this.coinShower(tx, ty);
    }
    destroyed.forEach((m, i) => {
      if (m.kind === 'boss') {
        this.bossDefeat(m);
        return;
      }
      if (target.kind === 'dore' && i > 0) {
        // Explosions en chaîne : on réserve le météore pour que le filet de sécurité ne le prenne pas.
        this.scheduled.add(m.id);
        this.time.delayedCall(i * 90, () => {
          this.scheduled.delete(m.id);
          this.explode(m, false);
        });
      } else this.explode(m, false);
    });
    // Les robots de la station applaudissent les belles séries.
    const combo = this.session?.combo ?? 0;
    if (combo > 0 && combo % 5 === 0) this.bots.forEach((b, i) => this.time.delayedCall(i * 80, () => this.botJump(b, 2)));
  }

  /** Bouffée de fumée grise qui monte et s'étale. */
  private puff(x: number, y: number, size = 1): void {
    const p = this.add.image(x, y, 's-smoke').setScale(0.5 * size).setAlpha(0.55).setDepth(44);
    this.tweens.add({ targets: p, y: y - Phaser.Math.Between(20, 60), x: x + Phaser.Math.Between(-30, 30), scale: 1.8 * size, alpha: 0, duration: Phaser.Math.Between(900, 1400), ease: 'Sine.easeOut', onComplete: () => p.destroy() });
  }

  private destroyView(v: MeteorView): void {
    this.views.delete(v.m.id);
    for (const t of v.trails) {
      t.stop();
      this.time.delayedCall(700, () => t.destroy());
    }
    this.tweens.killTweensOf([v.obj, v.alarm, v.reticle]);
    v.obj.destroy();
  }

  /** Explosion en plusieurs temps : éclair, boule de feu, fumée, éclats, braises, onde. */
  private explode(m: Meteor, big: boolean): void {
    const v = this.views.get(m.id);
    if (!v) return;
    const x = v.obj.x;
    const y = v.obj.y;
    this.destroyView(v);
    this.sfx.boom(big);
    const r = this.reducedMotion;
    const flash = this.add.image(x, y, 's-flash').setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setDepth(47);
    this.tweens.add({ targets: flash, scale: big ? 3 : 1.5, alpha: 0, duration: 170, onComplete: () => flash.destroy() });
    const fire = this.add.image(x, y, 's-fireball').setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setDepth(46);
    if (m.kind === 'robot') fire.setTint(0xff6b8a);
    if (m.kind === 'dore') fire.setTint(0xffe27a);
    this.tweens.add({ targets: fire, scale: big ? 5 : 2.4, alpha: 0, duration: 460, ease: 'Cubic.easeOut', onComplete: () => fire.destroy() });
    for (let i = 0; i < (r ? 1 : big ? 8 : 4); i++) this.time.delayedCall(60 + i * 40, () => this.puff(x + Phaser.Math.Between(-24, 24), y + Phaser.Math.Between(-20, 20), big ? 1.6 : 1));
    if (m.kind !== 'robot') this.shards.forEach((e) => e.explode(r ? 2 : big ? 24 : 9, x, y));
    this.embers.explode(r ? 3 : big ? 40 : 16, x, y);
    this.sparks.explode(r ? 3 : big ? 30 : 10, x, y);
    if (m.kind === 'robot') {
      // Les robots perdent leurs boulons, leurs ressorts et leurs engrenages.
      this.parts.forEach((e) => e.explode(r ? 1 : 3, x, y));
      this.time.delayedCall(120, () => this.sfx.boing());
    }
    const ring = this.add.circle(x, y, 18).setStrokeStyle(6, m.kind === 'robot' ? 0xff4d6d : 0xffc94a).setDepth(47);
    this.tweens.add({ targets: ring, scale: big ? 10 : 4, alpha: 0, duration: big ? 700 : 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    if (!r) {
      this.cameras.main.shake(big ? 500 : 110, big ? 0.012 : 0.004);
      // Petit coup de zoom pour donner du poids à l'impact.
      this.tweens.add({ targets: this.cameras.main, zoom: big ? 1.05 : 1.018, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
    }
  }

  /** Pluie de pièces du météore doré, qui volent jusqu'au score. */
  private coinShower(x: number, y: number): void {
    const n = this.reducedMotion ? 3 : 12;
    for (let i = 0; i < n; i++) {
      const c = this.add.image(x, y, 's-coin').setScale(K).setDepth(73);
      const mid = new Phaser.Math.Vector2(x + Phaser.Math.Between(-160, 160), y - Phaser.Math.Between(60, 200));
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x, y), mid, new Phaser.Math.Vector2(110, 40));
      const p = { t: 0 };
      this.tweens.add({
        targets: p,
        t: 1,
        delay: 150 + i * 60,
        duration: 700,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          const pt = curve.getPoint(p.t);
          // La pièce tourne sur elle-même en volant.
          c.setPosition(pt.x, pt.y).setScale(K * (1 + Math.sin(p.t * Math.PI) * 0.6) * Math.max(0.15, Math.abs(Math.cos(p.t * 12))), K * (1 + Math.sin(p.t * Math.PI) * 0.6));
        },
        onComplete: () => {
          c.destroy();
          this.sfx.coinTick(i);
          this.tweens.add({ targets: this.scoreText, scale: { from: 1.15, to: 1 }, duration: 120 });
        },
      });
    }
  }

  private bossHit(v: MeteorView): void {
    this.sfx.boom(false);
    const x = v.obj.x + Phaser.Math.Between(-90, 90);
    const y = v.obj.y + Phaser.Math.Between(-40, 30);
    const fire = this.add.image(x, y, 's-fireball').setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setDepth(46);
    this.tweens.add({ targets: fire, scale: 2.6, alpha: 0, duration: 420, onComplete: () => fire.destroy() });
    this.parts.forEach((e) => e.explode(this.reducedMotion ? 1 : 2, x, y));
    this.embers.explode(this.reducedMotion ? 4 : 18, x, y);
    for (let i = 0; i < 3; i++) this.puff(x, y, 1.3);
    v.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(80, () => v.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
    if (!this.reducedMotion) this.cameras.main.shake(180, 0.007);
    v.label.setText(v.m.expr.text);
    this.resizePlate(v);
    v.counter?.setText(v.m.queue.length === 0 ? 'Dernier calcul !' : `${v.m.queue.length + 1} restants`);
    v.locked = false;
    v.reticle.setVisible(false);
    v.body.setTexture(this.bodyKey(v, v.m.queue.length <= 1));
    if (v.m.queue.length <= 1) this.say(v, v.m.queue.length === 0 ? 'NOOOON !' : 'Grr… pas encore !');
  }

  /** Le Robot-Mère se disloque : chapelet d'explosions, puis il se brise en morceaux. */
  private bossDefeat(m: Meteor): void {
    const v = this.views.get(m.id);
    if (!v) return;
    // La logique constate la victoire tout de suite (plus aucun ennemi), puis le décor prend le relais.
    for (const ev of this.session?.update(0) ?? []) this.onEvent(ev);
    this.ending = true;
    this.setMusic(null);
    const cx = v.obj.x;
    const cy = v.obj.y;
    v.body.setTexture(this.bodyKey(v, true));
    this.tweens.add({ targets: v.obj, x: cx + 6, duration: 40, yoyo: true, repeat: 20 });
    for (let i = 0; i < (this.reducedMotion ? 2 : 9); i++) {
      this.time.delayedCall(i * 140, () => {
        const x = cx + Phaser.Math.Between(-150, 150);
        const y = cy + Phaser.Math.Between(-60, 60);
        this.sfx.boom(false);
        const f = this.add.image(x, y, 's-fireball').setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setDepth(46);
        this.tweens.add({ targets: f, scale: 2.4, alpha: 0, duration: 420, onComplete: () => f.destroy() });
        this.parts.forEach((e) => e.explode(2, x, y));
        this.embers.explode(14, x, y);
      });
    }
    this.time.delayedCall(this.reducedMotion ? 300 : 1300, () => {
      // Le crâne se fend en quatre morceaux qui s'envolent.
      const key = v.body.texture.key;
      const tex = this.textures.get(key);
      const src = tex.getSourceImage() as HTMLCanvasElement;
      const pw = Math.floor(src.width / 4);
      const sc = v.body.scaleX;
      for (let i = 0; i < 4; i++) {
        const name = `morceau-${i}`;
        if (!tex.has(name)) tex.add(name, 0, i * pw, 0, pw, src.height);
        const px = cx + (i - 1.5) * pw * sc;
        const piece = this.add.image(px, cy, key, name).setScale(sc).setDepth(13);
        this.wreck.push(piece);
        const vx = (i - 1.5) * Phaser.Math.Between(120, 220);
        const vy = -Phaser.Math.Between(200, 420);
        const spin = Phaser.Math.Between(-400, 400);
        const p = { t: 0 };
        this.tweens.add({ targets: p, t: 2.2, duration: 2200, onUpdate: () => {
          piece.setPosition(px + vx * p.t, cy + vy * p.t + 450 * p.t * p.t).setAngle(spin * p.t);
        }, onComplete: () => piece.destroy() });
      }
      this.destroyView(v);
      this.sfx.boom(true);
      this.sfx.collapse();
      if (!this.reducedMotion) {
        const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.55).setDepth(80).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
        this.cameras.main.shake(700, 0.016);
        this.embers.explode(60, cx, cy);
        for (let i = 0; i < 10; i++) this.puff(cx + Phaser.Math.Between(-140, 140), cy + Phaser.Math.Between(-50, 50), 2);
      }
      this.time.delayedCall(900, () => this.celebrate());
    });
  }

  private shockwave(x: number, y: number): void {
    this.sfx.shockwave();
    // Anneaux qui s'étendent sur le terrain, sous le pavé numérique (qui reste lisible).
    [0, 140, 280].forEach((delay, i) => {
      const ring = this.add.circle(x, y, 40).setStrokeStyle(8 - i * 2, i === 1 ? 0xffffff : 0xffc94a).setDepth(29).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ring, scale: 14, alpha: 0, delay, duration: 750, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    });
    if (!this.reducedMotion) {
      const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xfff2b8, 0.3).setDepth(80).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    }
    this.banner('ONDE DE CHOC !', '#ffc94a');
  }

  private floatText(x: number, y: number, text: string, color: string, size = 30): void {
    const t = this.add.text(x, y, text, style(size, color, 800, 6)).setOrigin(0.5).setDepth(72);
    if (!this.reducedMotion) {
      t.setScale(0.5);
      this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    }
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, delay: 350, duration: 750, onComplete: () => t.destroy() });
  }

  private banner(text: string, color: string, hold = 1100): void {
    const t = this.add.text(CX, 230, text, style(52, color, 800, 9)).setOrigin(0.5).setDepth(76);
    if (this.reducedMotion) {
      this.time.delayedCall(hold, () => t.destroy());
      return;
    }
    t.setScale(2.4).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: 200, delay: hold, duration: 400, onComplete: () => t.destroy() });
  }

  /** Bulle de dialogue au-dessus d'un ennemi. */
  private say(v: MeteorView, text: string): void {
    if (!v.obj.active) return;
    const by = v.m.kind === 'boss' ? -150 : -78;
    const bub = this.add.image(46, by, this.tex('s-bubble', () => Wd.bubble(170, 50))).setScale(K);
    const t = this.add.text(46, by - 6, text, style(18, B.C.ink, 800)).setOrigin(0.5);
    v.obj.add([bub, t]);
    if (!this.reducedMotion) {
      bub.setScale(0);
      t.setScale(0);
      this.tweens.add({ targets: bub, scale: K, duration: 220, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    }
    this.time.delayedCall(1500, () => {
      bub.destroy();
      t.destroy();
    });
  }

  // --- Événements de la partie --------------------------------------------------------------------
  private onEvent(ev: MeteorEvent): void {
    switch (ev.type) {
      case 'wave': {
        const s = this.session!;
        const boss = ev.wave >= s.waveCount - 1;
        this.waveText.setText(boss ? 'Boss !' : `Vague ${ev.wave + 1} / ${s.waveCount}`);
        this.sfx.fanfare();
        if (!boss) {
          this.banner(`Vague ${ev.wave + 1}`, B.C.cream);
          // Un canard perdu passera peut-être pendant la vague…
          this.time.delayedCall(Phaser.Math.Between(7000, 16000), () => this.spawnDuck());
          if (ev.wave === 0) this.time.delayedCall(4000, () => this.spawnWhale(false));
        }
        break;
      }
      case 'spawn':
        this.makeView(ev.meteor);
        if (ev.meteor.kind === 'robot') this.sfx.robotBeep();
        if (ev.meteor.kind === 'dore') this.sfx.chime();
        break;
      case 'boss':
        this.bossAlert(ev.meteor);
        break;
      case 'impact':
        this.onImpact(ev.meteor, ev.shieldLost);
        break;
      case 'lost':
        this.time.delayedCall(400, () => this.defeat());
        break;
      case 'won':
        break;
    }
  }

  /** Alerte rouge : sirène, halo rouge clignotant, le Robot-Mère descend en tremblant. */
  private bossAlert(m: Meteor): void {
    this.sfx.alarm();
    this.setMusic(2);
    this.banner('ALERTE : Robot-Mère !', '#ff4d6d', 1800);
    if (!this.reducedMotion) this.tweens.add({ targets: this.vignette, alpha: { from: 0, to: 0.6 }, duration: 300, yoyo: true, repeat: 2 });
    this.bots.forEach((b, i) => this.time.delayedCall(i * 120, () => this.botJump(b, 3)));
    const v = this.makeView(m);
    if (!this.reducedMotion) this.cameras.main.shake(400, 0.008);
    this.time.delayedCall(1400, () => this.say(v, 'Rendez-vous, humains !'));
  }

  private makeView(m: Meteor): MeteorView {
    const obj = this.add.container(this.fieldX(m.x), this.fieldY(0)).setDepth(m.kind === 'boss' ? 12 : 15);
    let plateY = 62;
    let scale = K;
    if (m.kind === 'boss') {
      plateY = 140;
      scale = K * 1.1;
    } else if (m.kind === 'robot') plateY = 52;
    else if (m.kind === 'dore') scale = K * 1.1;
    const label = this.add.text(0, plateY, m.expr.text, style(m.kind === 'boss' ? 38 : 30, B.C.cream, 800)).setOrigin(0.5);
    const v: MeteorView = {
      m,
      obj,
      body: this.add.image(0, 0, '__DEFAULT').setScale(scale),
      label,
      plate: this.add.image(0, plateY + 2, this.tex('s-plate-120', () => Sp.plate(120))).setScale(K),
      reticle: this.add.image(0, 0, this.tex('s-reticle', Sp.reticle)).setScale(K * (m.kind === 'boss' ? 2.3 : 1)).setVisible(false),
      alarm: this.add.text(-74, plateY - 2, '!', style(34, '#ff4d6d', 800, 6)).setOrigin(0.5).setVisible(false),
      trails: [],
      counter: m.kind === 'boss' ? this.add.text(0, plateY + 40, `${m.queue.length + 1} restants`, style(18, B.C.coralLight, 800, 4)).setOrigin(0.5) : null,
      locked: false,
      danger: false,
      frame: 0,
      wobble: Math.random() * 10,
    };
    v.body.setTexture(this.bodyKey(v, false));
    obj.add([v.reticle, v.body, v.plate, v.label, v.alarm]);
    if (v.counter) obj.add(v.counter);

    if ((m.kind === 'rocher' || m.kind === 'dore') && !this.reducedMotion) {
      const gold = m.kind === 'dore';
      // Traînée de feu, puis de fumée, derrière le météore.
      v.trails.push(this.add.particles(0, 0, this.tex(gold ? 's-trail-gold' : 's-trail', () => B.softGlow(22, gold ? '#ffd34a' : '#ff8a3d')), {
        follow: obj,
        followOffset: { x: 0, y: -30 },
        speedY: { min: -130, max: -60 },
        speedX: { min: -20, max: 20 },
        lifespan: 420,
        scale: { start: 1.3, end: 0 },
        alpha: { start: 0.7, end: 0 },
        frequency: 30,
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(14));
      v.trails.push(this.add.particles(0, 0, 's-smoke', {
        follow: obj,
        followOffset: { x: 0, y: -50 },
        speedY: { min: -60, max: -20 },
        speedX: { min: -16, max: 16 },
        lifespan: 900,
        scale: { start: 0.3, end: 0.9 },
        alpha: { start: 0.25, end: 0 },
        frequency: 90,
      }).setDepth(13));
      if (gold) {
        v.trails.push(this.add.particles(0, 0, this.tex('w-fw-#ffc94a', () => B.sparkle('#ffc94a')), {
          follow: obj,
          x: { min: -40, max: 40 },
          y: { min: -40, max: 40 },
          lifespan: 500,
          scale: { start: 0.5, end: 0 },
          frequency: 70,
          blendMode: Phaser.BlendModes.ADD,
        }).setDepth(16));
      }
    }
    if (m.kind === 'robot' || m.kind === 'boss') {
      const loop = this.time.addEvent({ delay: m.kind === 'boss' ? 300 : 260, loop: true, callback: () => {
        if (!v.body.active) {
          loop.remove();
          return;
        }
        v.frame = v.frame ? 0 : 1;
        v.body.setTexture(this.bodyKey(v, v.locked || (m.kind === 'boss' && m.queue.length <= 1)));
      } });
      if (m.kind === 'robot' && Math.random() < 0.45) this.time.delayedCall(Phaser.Math.Between(1200, 2600), () => this.say(v, Phaser.Utils.Array.GetRandom(TAUNTS)));
    }
    if (!this.reducedMotion) this.tweens.add({ targets: v.reticle, angle: 360, duration: 2400, repeat: -1 });
    this.resizePlate(v);
    this.views.set(m.id, v);
    this.placeView(v, this.time.now);
    if (!this.reducedMotion) {
      if (m.kind === 'boss') {
        // Le Robot-Mère descend du haut de l'écran.
        obj.setScale(0.6).setAlpha(0);
        this.tweens.add({ targets: obj, scale: 1, alpha: 1, duration: 900, ease: 'Back.easeOut' });
      } else {
        // Apparition : petit anneau de téléportation.
        obj.setScale(0.2);
        this.tweens.add({ targets: obj, scale: 1, duration: 320, ease: 'Back.easeOut' });
        const ring = this.add.circle(obj.x, Math.max(20, obj.y), 10).setStrokeStyle(4, m.kind === 'robot' ? 0xff4d6d : 0xffc94a).setDepth(14);
        this.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
      }
    }
    return v;
  }

  private resizePlate(v: MeteorView): void {
    const w = Math.max(100, Math.ceil((v.label.width + 36) / 20) * 20);
    v.plate.setTexture(this.tex(`s-plate-${w}`, () => Sp.plate(w)));
    v.alarm.setX(-w / 2 - 14);
  }

  private onImpact(m: Meteor, shieldLost: boolean): void {
    const v = this.views.get(m.id);
    const x = v?.obj.x ?? CX;
    if (m.kind !== 'boss' && v) this.destroyView(v);
    this.sfx.boom(false);
    const fire = this.add.image(x, F.stationY, 's-fireball').setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setDepth(46);
    this.tweens.add({ targets: fire, scale: 3, alpha: 0, duration: 450, onComplete: () => fire.destroy() });
    this.embers.explode(this.reducedMotion ? 3 : 20, x, F.stationY);
    this.shards.forEach((e) => e.explode(this.reducedMotion ? 2 : 6, x, F.stationY));
    for (let i = 0; i < 3; i++) this.puff(x + Phaser.Math.Between(-30, 30), F.stationY, 1.2);
    this.dome.setStrokeStyle(6, shieldLost ? 0xff4d6d : 0x5fd3bc, 1).setFillStyle(shieldLost ? 0xff4d6d : 0x5fd3bc, 0.25);
    this.time.delayedCall(260, () => this.dome.setStrokeStyle(4, 0x5fd3bc, 0.5).setFillStyle(0x5fd3bc, 0.06));
    if (!this.reducedMotion) this.cameras.main.shake(260, 0.01);
    this.setPilot('oups', 1100);
    this.spinCat();
    // Panique chez les petits robots.
    this.bots.forEach((b) => this.botJump(b, 3));
    this.refreshScore();
    if (shieldLost) {
      this.sfx.heartLost();
      this.refreshShields();
      this.drawCrack(x);
      this.floatText(x, F.stationY - 40, 'Bouclier touché !', B.C.coralLight);
    } else {
      this.floatText(x, F.stationY - 40, 'Bloqué !', B.C.teal);
    }
  }

  /** Fissure dessinée sur le bouclier à l'endroit de l'impact. */
  private drawCrack(x: number): void {
    this.cracks.lineStyle(3, 0xff8fb1, 0.8);
    let px = x;
    let py = F.stationY + 2;
    for (let i = 0; i < 5; i++) {
      const nx = px + Phaser.Math.Between(-18, 18);
      const ny = py + Phaser.Math.Between(6, 14);
      this.cracks.lineBetween(px, py, nx, ny);
      if (i === 2) this.cracks.lineBetween(nx, ny, nx + Phaser.Math.Between(14, 26), ny + 4);
      px = nx;
      py = ny;
    }
  }

  // --- Pause ---------------------------------------------------------------------------------------
  private pause(): void {
    if (this.paused || this.overlay || this.ending || !this.session) return;
    this.paused = true;
    this.tweens.pauseAll();
    this.time.paused = true;
    this.sfx.music(false);
    const c = this.openOverlay(300);
    c.add(this.add.text(W / 2, H / 2 - 80, 'Pause', style(52, B.C.saffron, 800, 7)).setOrigin(0.5));
    c.add(this.add.text(W / 2, H / 2 - 22, 'Les météores attendent sagement…', style(20, '#cfe8e4', 600)).setOrigin(0.5));
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
    this.setMusic(this.musicLevel);
  }

  // --- Fin de partie ------------------------------------------------------------------------------------
  private celebrate(): void {
    this.ending = true;
    this.setMusic(null);
    if (this.fever) this.setFever(false);
    this.comboText.setText('');
    this.vignette.setAlpha(0);
    this.waveText.setText('Victoire !');
    this.sfx.victoryJingle();
    this.banner('Station sauvée !', B.C.saffron, 3800);
    this.wreck.push(...this.fx.confetti(F.right, 3500));
    const bursts = this.reducedMotion ? 2 : 10;
    for (let i = 0; i < bursts; i++) {
      this.time.delayedCall(200 + i * 340, () => this.fx.burst(Phaser.Math.Between(80, F.right - 80), Phaser.Math.Between(80, 360), [['#ff4d6d', '#ffc94a'], ['#5fd3bc', '#ffffff'], ['#b79ad8', '#ff8fb1']][i % 3].concat('#ffffff')));
      this.sfx.firework(0.2 + i * 0.34);
    }
    this.pilotOverride = { face: 'content', until: this.time.now + 6000 };
    this.bots.forEach((b) => this.botJump(b, 8));
    this.spinCat();
    this.spawnWhale(true);
    // Le vaisseau fait une boucle de joie.
    if (!this.reducedMotion) {
      const p = { t: 0 };
      this.tweens.add({
        targets: p,
        t: 1,
        duration: 2400,
        delay: 300,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          const a = p.t * Math.PI * 2;
          this.ship.setPosition(CX + Math.sin(a) * 200, F.shipY - 160 + Math.cos(a) * 160).setAngle(-p.t * 360);
        },
        onComplete: () => this.ship.setAngle(0).setPosition(CX, F.shipY),
      });
    }
    this.time.delayedCall(4800, () => this.showEnd(true));
  }

  private defeat(): void {
    this.ending = true;
    this.setMusic(null);
    if (this.fever) this.setFever(false);
    this.comboText.setText('');
    this.vignette.setAlpha(0);
    this.waveText.setText('Défaite…');
    this.sfx.collapse();
    // La station explose.
    const sx = this.stationImg.x;
    const sy = this.stationImg.y - 50;
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 160, () => {
        const x = sx + Phaser.Math.Between(-120, 120);
        const f = this.add.image(x, sy, 's-fireball').setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setDepth(46);
        this.tweens.add({ targets: f, scale: 3.4, alpha: 0, duration: 500, onComplete: () => f.destroy() });
        this.embers.explode(this.reducedMotion ? 3 : 24, x, sy);
        this.shards.forEach((e) => e.explode(this.reducedMotion ? 2 : 10, x, sy));
        this.puff(x, sy, 1.8);
      });
    }
    if (!this.reducedMotion) this.cameras.main.shake(900, 0.012);
    this.tweens.add({ targets: [this.stationImg, this.dome, this.cracks], alpha: 0, delay: 700, duration: 500 });
    this.tweens.add({ targets: this.ship, y: H + 200, angle: 200, delay: 300, duration: 1400, ease: 'Quad.easeIn' });
    // Les petits robots s'enfuient, le chat file au bout de son câble cassé.
    this.bots.forEach((b, i) => {
      this.tweens.killTweensOf(b);
      this.tweens.add({ targets: b, x: i === 0 ? -60 : F.right + 60, duration: 900, delay: 200 });
    });
    this.tweens.add({ targets: this.cat, x: -120, y: 80, angle: -540, alpha: 0, duration: 1600, delay: 300 });
    for (const v of [...this.views.values()]) this.destroyView(v);
    // Une bande de robots et de météores vient danser.
    this.time.delayedCall(900, () => {
      this.sfx.danceTune();
      this.sfx.laugh(0.4);
      this.sfx.laugh(1.8);
      const dancers = ['robot', 'rocher', 'robot', 'rocher', 'robot'];
      dancers.forEach((kind, i) => {
        const key = kind === 'robot' ? this.tex('s-robot-0-colere', () => Sp.robot(0)) : this.tex(`s-rock-${(i % 4) + 1}-colere`, () => Sp.meteor((i % 4) + 1));
        const x = 140 + i * 170;
        const d = this.add.image(x, -80, key).setScale(K).setDepth(25);
        this.wreck.push(d);
        this.tweens.add({ targets: d, y: 470, delay: i * 90, duration: 600, ease: 'Bounce.easeOut', onComplete: () => {
          if (this.reducedMotion) return;
          this.tweens.add({ targets: d, y: 430, duration: 260 + i * 15, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
          this.tweens.add({ targets: d, angle: { from: -14, to: 14 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } });
      });
      const t = this.add.text(CX, 300, 'Ha ha ha !', style(46, '#ff4d6d', 800, 8)).setOrigin(0.5).setDepth(26).setScale(0);
      this.wreck.push(t);
      this.tweens.add({ targets: t, scale: 1, delay: 700, duration: 300, ease: 'Back.easeOut' });
    });
    this.time.delayedCall(7000, () => this.showEnd(false));
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

  private openOverlay(h: number, veil = 0.6): Phaser.GameObjects.Container {
    this.overlay?.destroy(true);
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x0a0b24, veil).setInteractive());
    const panel = this.add.image(W / 2, H / 2, this.tex(`s-dialog-${h}`, () => {
      const [cv, ctx] = B.makeCanvas(712, h + 20);
      B.paint(ctx, () => B.roundRectPath(ctx, 6, 14, 700, h, 30), B.C.ink, { ink: '' });
      B.paint(ctx, () => B.roundRectPath(ctx, 6, 6, 700, h, 30), '#141842', { line: 5 });
      ctx.strokeStyle = 'rgba(95, 211, 188, 0.35)';
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
    const c = this.openOverlay(500);
    const top = H / 2 - 250;
    c.add(this.add.text(W / 2, top + 58, 'Pluie de météores', style(48, B.C.saffron, 800, 7)).setOrigin(0.5));
    c.add(this.add.text(W / 2, top + 140, [
      'Météores et robots foncent sur la station, chacun porte un calcul.',
      'Tape le résultat : ton vaisseau tire aussitôt !',
    ].join('\n'), { ...style(20, B.C.cream, 600), align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    // Petit exemple illustré : un météore, sa plaque, la réponse.
    const ex = this.add.container(W / 2 - 150, top + 222);
    ex.add(this.add.image(0, 0, this.tex('s-rock-1-colere', () => Sp.meteor(1))).setScale(K * 0.7));
    ex.add(this.add.image(96, 2, this.tex('s-plate-100', () => Sp.plate(100))).setScale(K));
    ex.add(this.add.text(96, 0, '7 × 8', style(26, B.C.cream, 800)).setOrigin(0.5));
    ex.add(this.add.text(170, 0, '→  tape', style(20, '#9fc9c2', 700)).setOrigin(0, 0.5));
    ex.add(this.add.text(254, 0, '56', style(36, B.C.saffron, 800, 5)).setOrigin(0, 0.5));
    c.add(ex);
    c.add(this.add.text(W / 2, top + 286, `Le météore doré fait tout exploser · Niveau ${this.tier.label} (${this.tier.public})`, style(16, '#9fc9c2', 700)).setOrigin(0.5));
    this.addOverlayButton(W / 2 - 140, top + 360, 'Tranquille', false, () => this.startGame('tranquille'));
    this.addOverlayButton(W / 2 + 140, top + 360, 'Défi', true, () => this.startGame('defi'));
    c.add(this.add.text(W / 2 - 140, top + 412, 'chute lente,\nle bouclier tient bon', { ...style(15, '#9fc9c2', 600), align: 'center' }).setOrigin(0.5, 0));
    c.add(this.add.text(W / 2 + 140, top + 412, 'plus rapide,\n3 boucliers à protéger', { ...style(15, '#9fc9c2', 600), align: 'center' }).setOrigin(0.5, 0));
  }

  /** Étoiles gagnées : 1 pour la victoire, 1 pour 85 % de calculs justes, 1 pour un sans-faute. */
  private starsFor(won: boolean): number {
    const s = this.session;
    if (!s || !won) return 0;
    let n = 1;
    if (s.accuracy() >= 0.85) n++;
    if (s.accuracy() >= 0.95 && s.stats.impacts === 0) n++;
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
    const c = this.openOverlay(540, won ? 0.6 : 0.35);
    const top = H / 2 - 270;
    c.add(this.add.text(W / 2, top + 54, won ? 'Station sauvée !' : 'La station est tombée…', style(44, won ? B.C.saffron : B.C.coralLight, 800, 7)).setOrigin(0.5));
    // Étoiles qui tombent une à une.
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
    c.add(this.add.text(W / 2, top + 222, isRecord ? 'Nouveau record !' : `Record : ${best}`, style(18, isRecord ? B.C.saffron : '#9fc9c2', 800)).setOrigin(0.5));
    const lines: Array<[string, string]> = [
      ['Tirs réussis', `${s.stats.hits}`],
      ['Calculs justes', `${Math.round(s.accuracy() * 100)} %`],
      ['Meilleur combo', `${s.stats.bestCombo}`],
      ['Météores qui ont touché la station', `${s.stats.impacts}`],
    ];
    lines.forEach(([label, value], i) => {
      const y = top + 270 + i * 34;
      c.add(this.add.text(W / 2 - 230, y, label, style(20, '#cfe8e4', 600)).setOrigin(0, 0.5));
      c.add(this.add.text(W / 2 + 230, y, value, style(22, B.C.cream, 800)).setOrigin(1, 0.5));
    });
    const status = this.add.text(W / 2, top + 418, 'Enregistrement…', style(16, '#9fc9c2', 700)).setOrigin(0.5);
    c.add(status);
    void reportResult({
      jeu: 'meteores',
      niveau: this.tier.id,
      mode: s.mode,
      score: s.score,
      gagne: won,
      etoiles: stars,
      duree: (Date.now() - this.startedAt) / 1000,
      precision: s.accuracy(),
      ops: s.stats.byOp,
      details: { tirs: s.stats.hits, erreurs: s.stats.errors, impacts: s.stats.impacts, serie: s.stats.bestCombo },
    }).then((o) => status.active && status.setText(outcomeText(o)));
    this.addOverlayButton(W / 2 - 130, top + 460, 'Accueil', false, () => {
      window.location.href = '../index.html';
    });
    this.addOverlayButton(W / 2 + 130, top + 460, 'Rejouer', true, () => this.showIntro());
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
    for (const v of [...this.views.values()]) this.destroyView(v);
    this.scheduled.clear();
    this.duck?.destroy();
    this.duck = null;
    this.tweens.killTweensOf(this.ship);
    this.ship.setPosition(CX, F.shipY).setAngle(0);
    this.tweens.killTweensOf([this.stationImg, this.cracks, this.cat, ...this.bots]);
    this.stationImg.setAlpha(1);
    this.dome.setAlpha(1);
    this.cracks.clear().setAlpha(1);
    this.cat.setAlpha(1).setAngle(0);
    this.catSpin = false;
    this.bots.forEach((b) => b.setX(b.getData('home') as number).setY(F.stationY + 58).setTexture('s-bot-0'));
    this.fever = false;
    this.aura?.stop();
    this.nebulas.forEach((n) => n.clearTint());
    this.pilotOverride = null;
    this.ending = false;
    this.seed = (this.seed * 7919 + 13) % 1e9;
    this.session = new MeteorSession(this.tier.id, this.seed, mode);
    this.startedAt = Date.now();
    this.scoreShown = 0;
    this.refreshShields();
    this.refreshScore();
    this.refreshReadout();
    this.setMusic(0);
  }
}
