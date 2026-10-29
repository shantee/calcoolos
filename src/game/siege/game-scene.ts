/**
 * « Cubes de siège » — le jeu complet (direction B, 2D illustrée).
 *
 * Écran d'accueil du jeu (règle en deux phrases, choix du mode), vagues de
 * monstres, cœurs du phare, écran de fin avec statistiques et record local.
 * La logique vit dans session.ts / round.ts ; cette scène ne fait que montrer.
 */
import Phaser from 'phaser';
import * as B from '../../art/variant-b';
import * as Wd from '../../art/world-b';
import * as Bn from '../../art/bonus-b';
import { SiegeSession } from './session';
import { POWERS, PowerUps, freezeMs, pushTarget, type Flight, type PowerKind } from './powerups';
import { Sfx } from '../sfx';
import { Fireworks } from '../fx';
import { TIERS, type Tier, type TierId } from '../../core/difficulty';
import { ARCHETYPES, MODES, WAVES, type EnemyKind, type Mode } from '../../core/waves';
import { reportResult, outcomeText } from '../../platform/results';
import { partieCommence } from '../../platform/suivi';
import { pleinEcranAuDemarrage } from '../plein-ecran';

export const W = 1280;
export const H = 720;
const K = 1 / B.RES;

const L = {
  gridX: 26,
  gridY: 236,
  pitchX: 94,
  pitchY: 98,
  cube: 84,
  sumY: 184,
  buttonsY: 672,
  towerX: 492,
  groundY: 566,
  enemyStartX: 1380,
  enemyEnterX: 1150,
  enemyStopX: 612,
  moonX: 1010,
  moonY: 150,
};

/** Bonus volants : trajet de l'engin, niches de rangement et pavé de réponse. */
const BONUS = {
  y: 96,
  enterX: 1000,
  leaveX: 532,
  slotX: [472, 552],
  slotY: 656,
  keyX0: 648,
  keyPitch: 72,
  keyRows: [634, 688],
};

/** Yeux des monstres (par rapport au centre de leur dessin, à l'échelle 1), pour les yeux exorbités. */
const EYES: Record<EnemyKind, Array<[number, number]>> = {
  mordillon: [[-18, 6], [16, 4]],
  trotteur: [[-12, 10], [14, 9]],
  carapacon: [[-18, 38], [16, 38]],
  roi: [[-18, 6], [16, 4]],
};

interface FlightView {
  box: Phaser.GameObjects.Container;
  craft: Phaser.GameObjects.Image;
  crate: Phaser.GameObjects.Image;
  link: Phaser.GameObjects.GameObject;
  tag: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  fuse: Phaser.GameObjects.Rectangle;
  trail: Phaser.GameObjects.Particles.ParticleEmitter;
  move: Phaser.Tweens.Tween | null;
  flight: Flight;
  done: boolean;
  /** Animations en boucle à arrêter quand l'engin disparaît. */
  loops: Phaser.Tweens.Tween[];
}

interface SlotView {
  box: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  pulse: Phaser.Tweens.Tween | null;
}

function style(size: number, color: string, weight = 700, stroke = 0): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: B.FONT, fontSize: `${size}px`, fontStyle: String(weight), color, stroke: B.C.ink, strokeThickness: stroke, resolution: 2 };
}

interface CubeView {
  obj: Phaser.GameObjects.Container;
  base: Phaser.GameObjects.Image;
  num: Phaser.GameObjects.Text;
  focus: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

interface EnemyView {
  kind: EnemyKind;
  obj: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  sign: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Rectangle;
  barBg: Phaser.GameObjects.Rectangle;
  shadow: Phaser.GameObjects.Image;
  extras: Phaser.GameObjects.GameObject[];
  scale: number;
  signY: number;
  frame: number;
  acc: number;
  walking: boolean;
  /** Vrai pendant l'entrée en scène. */
  entering: boolean;
}

const RECORD_KEY = 'calcoolos.cubes.records';

export class CubesDeSiegeScene extends Phaser.Scene {
  private tier!: Tier;
  private seed = 1;
  private session: SiegeSession | null = null;
  private startedAt = 0;
  private sfx = new Sfx();
  private reducedMotion = false;
  private cubes: CubeView[] = [];
  private shownValues: number[] = [];
  private enemy: EnemyView | null = null;
  private busy = true;
  private enemyWalking = false;
  private focus = 0;
  private keyboardUsed = false;
  private warnedArmor = false;

  // Décor et effets
  private towerImg!: Phaser.GameObjects.Image;
  private lanternGlow!: Phaser.GameObjects.Image;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private owlImg!: Phaser.GameObjects.Image;
  private moonFace!: Phaser.GameObjects.Image;
  private snailImg!: Phaser.GameObjects.Image;
  private snailHidden = false;
  private crackImg!: Phaser.GameObjects.Image;
  private owlHome = new Phaser.Math.Vector2();
  private lanternTween: Phaser.Tweens.Tween | null = null;
  /** Débris, gravats et danseurs à effacer quand on rejoue. */
  private wreck: Phaser.GameObjects.GameObject[] = [];
  private loops: Phaser.Time.TimerEvent[] = [];
  /** Accélération des monstres, pour les tests automatiques seulement (?accelere=4). */
  private speedBoost = 1;

  // Bonus volants
  private powers: PowerUps | null = null;
  /** Rang du monstre courant dans la partie (0 = premier). */
  private enemyIndex = -1;
  private enemyArrivedAt = 0;
  private passDelay = 0;
  private flightView: FlightView | null = null;
  private slots: SlotView[] = [];
  /** Niches dont le bonus est encore en train d'arriver. */
  private arriving = new Set<number>();
  private keypad!: Phaser.GameObjects.Container;
  private keypadShown = false;
  private frozenUntil = 0;
  private ice: { img: Phaser.GameObjects.Image; frost: Phaser.GameObjects.Particles.ParticleEmitter; timers: Phaser.Time.TimerEvent[] } | null = null;
  private pushing = false;
  private bonusExplained = false;
  private megaAura: Phaser.GameObjects.Image | null = null;
  private launchButton!: Phaser.GameObjects.Container;

  // Interface
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private soundText!: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Image[] = [];
  private targetText!: Phaser.GameObjects.Text;
  private equationText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private toastBg!: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayButtons: Array<{ c: Phaser.GameObjects.Container; run: () => void }> = [];
  private overlayFocus = 0;

  constructor() {
    super('cubes-de-siege');
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

    this.buildWorld();
    this.buildCritters();
    this.buildHud();
    this.buildGrid();
    this.buildBonusUi();
    this.bindKeys();
    this.input.on('pointerdown', () => this.sfx.unlock());
    this.showIntro();

    (window as unknown as { __siege: unknown }).__siege = {
      session: () => this.session,
      start: (mode: Mode) => this.startGame(mode),
      select: (i: number) => this.onCube(i),
      solve: () => this.session?.round.puzzle.solution.forEach((i) => this.onCube(i)),
      validate: () => this.validate(),
      busy: () => this.busy,
      overlay: () => this.overlay !== null,
      startButton: () => {
        const c = this.overlayButtons[0]?.c;
        if (!c) return null;
        const m = c.getWorldTransformMatrix();
        return { x: m.tx, y: m.ty };
      },
      monstres: () => this.children.list.filter((o) => o.name === 'monstre' && o.active).length,
      enemyX: () => this.enemy?.obj.x ?? null,
      // Bonus volants (tests automatiques).
      bonus: () => ({
        flight: this.powers?.flight ? { ...this.powers.flight, expr: { ...this.powers.flight.expr } } : null,
        slots: this.powers ? [...this.powers.slots] : [],
        launched: this.powers?.launched ?? 0,
        caught: this.powers?.caught ?? 0,
        plan: this.powers ? [...this.powers.plan] : [],
        enemyIndex: this.enemyIndex,
        frozen: this.isFrozen(),
        pushing: this.pushing,
        charged: this.session?.charged ?? false,
        keypad: this.keypadShown,
        arriving: [...this.arriving],
      }),
      forceBonus: (cargo?: PowerKind) => {
        const f = this.powers?.launch(true);
        if (f && cargo) f.cargo = cargo;
        if (f) this.launchFlight(f);
        return !!f;
      },
      answerBonus: () => String(this.powers?.flight?.expr.answer ?? '').split('').forEach((d) => this.bonusKey(d)),
      typeBonus: (d: string) => this.bonusKey(d),
      usePower: (i: number) => this.usePower(i),
      slotPos: (i: number) => ({ x: BONUS.slotX[i], y: BONUS.slotY }),
      keyPos: (d: string) => this.keyPos(d),
      enemyWalking: () => !!this.enemy && this.enemyWalking && this.enemy.walking && !this.isFrozen(),
    };
  }

  update(time: number, delta: number): void {
    const e = this.enemy;
    if (!e || !this.session) return;
    this.bonusTick(time);
    if (this.enemyWalking && e.walking && !this.isFrozen()) {
      e.obj.x -= (this.session.enemySpeed * this.speedBoost * delta) / 1000;
      if (e.obj.x <= L.enemyStopX) {
        e.obj.x = L.enemyStopX;
        this.onEnemyReachesTower();
      }
    }
    this.animateEnemy(e, time, delta);
    // L'escargot rentre dans sa coquille quand un monstre passe trop près.
    if (!this.snailHidden && Math.abs(e.obj.x - this.snailImg.x) < 90) this.hideSnail(1800);
    // La chouette regarde le monstre.
    this.owlImg.setFlipX(e.obj.x < this.owlImg.x);
  }

  // --- Décor ------------------------------------------------------------------------------
  private buildWorld(): void {
    this.add.image(0, 0, this.tex('b-bg', B.background)).setOrigin(0);
    [
      { y: 120, w: 220, h: 70, seed: 1, speed: 110000, alpha: 0.9 },
      { y: 230, w: 160, h: 54, seed: 2, speed: 140000, alpha: 0.8 },
      { y: 420, w: 260, h: 80, seed: 3, speed: 170000, alpha: 0.65 },
    ].forEach((c, i) => {
      const img = this.add.image(200 + i * 430, c.y, this.tex(`b-cloud-${c.seed}`, () => B.cloud(c.w, c.h, c.seed))).setAlpha(c.alpha);
      if (this.reducedMotion) return;
      this.tweens.add({ targets: img, x: W + c.w, duration: c.speed * (1 - img.x / (W + c.w)), onComplete: () => {
        img.x = -c.w;
        this.tweens.add({ targets: img, x: W + c.w, duration: c.speed, repeat: -1 });
      } });
    });
    this.add.image(L.gridX - 20, 126, this.tex('b-workshop', B.workshop)).setOrigin(0).setScale(K).setDepth(5);
    this.towerImg = this.add.image(L.towerX, L.groundY + 26, this.tex('b-tower', B.tower)).setOrigin(0.5, 1).setScale(K).setDepth(4);
    this.lanternGlow = this.add.image(L.towerX, L.groundY + 26 - B.TOWER_H + 76, this.tex('b-glow', () => B.softGlow(128, '#5fd3bc'))).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setDepth(4);
    this.pulseLantern();
    this.tex('w-cracks-1', () => Wd.cracks(1));
    this.tex('w-cracks-2', () => Wd.cracks(2));
    this.crackImg = this.add.image(L.towerX, L.groundY + 26, 'w-cracks-1').setOrigin(0.5, 1).setScale(K).setDepth(4).setVisible(false);

    const fire = this.tex('b-spark-2', () => B.sparkle(B.C.teal));
    if (!this.reducedMotion) {
      this.add.particles(0, 0, fire, {
        x: { min: 470, max: W },
        y: { min: 330, max: 560 },
        lifespan: 5000,
        speedX: { min: -10, max: 10 },
        speedY: { min: -14, max: -3 },
        scale: { start: 0.35, end: 0.1 },
        alpha: { values: [0, 0.9, 0.3, 0.9, 0] },
        frequency: 420,
        blendMode: Phaser.BlendModes.ADD,
      });
    }
    this.sparks = this.add.particles(0, 0, this.tex('b-spark-0', () => B.sparkle('#fff6dc')), {
      speed: { min: 120, max: 380 },
      angle: { min: 0, max: 360 },
      rotate: { min: 0, max: 360 },
      gravityY: 300,
      lifespan: { min: 400, max: 800 },
      scale: { start: 0.9, end: 0 },
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(50);
    this.dust = this.add.particles(0, 0, this.tex('b-puff', () => B.softGlow(24, '#f6ecd8')), {
      speed: { min: 40, max: 140 },
      angle: { min: 180, max: 360 },
      lifespan: 600,
      scale: { start: 0.9, end: 2 },
      alpha: { start: 0.6, end: 0 },
      emitting: false,
    }).setDepth(49);
    this.add.image(0, 0, this.tex('b-grain', () => B.grain(W, H))).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(0.12).setDepth(90);
  }

  private pulseLantern(): void {
    this.lanternTween?.stop();
    this.lanternGlow.setAlpha(0.5).setScale(1);
    this.lanternTween = this.reducedMotion
      ? null
      : this.tweens.add({ targets: this.lanternGlow, alpha: 0.8, scale: 1.1, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Petits habitants : lune, chouette, escargot, poisson volant. Tous cliquables. */
  private buildCritters(): void {
    // La lune dort ; elle fait un clin d'œil aux coups parfaits et rougit si on la touche.
    ['dort', 'clin', 'rougit'].forEach((s) => this.tex(`w-moon-${s}`, () => Wd.moonFace(s as 'dort')));
    this.moonFace = this.add.image(L.moonX, L.moonY + 6, 'w-moon-dort').setScale(K).setDepth(2);
    const moonHit = this.add.zone(L.moonX, L.moonY, 150, 150).setInteractive({ useHandCursor: true }).setDepth(2);
    moonHit.on('pointerdown', () => {
      this.sfx.unlock();
      this.sfx.chime();
      this.moonReact('rougit', 1600);
    });

    // La chouette du phare.
    ['ouvert', 'cligne', 'contente'].forEach((s) => this.tex(`w-owl-${s}`, () => Wd.owl(s as 'ouvert')));
    const owlY = L.groundY + 26 - B.TOWER_H + 102;
    this.owlHome.set(L.towerX + 44, owlY);
    this.owlImg = this.add.image(L.towerX + 44, owlY, 'w-owl-ouvert').setOrigin(0.5, 1).setScale(K).setDepth(6).setInteractive({ useHandCursor: true });
    this.owlImg.on('pointerdown', () => {
      this.sfx.unlock();
      this.sfx.owl();
      this.tweens.add({ targets: this.owlImg, angle: { from: 0, to: this.reducedMotion ? 0 : 360 }, duration: 600, ease: 'Back.easeInOut' });
    });
    const blink = () => {
      if (this.owlImg.texture.key === 'w-owl-ouvert') {
        this.owlImg.setTexture('w-owl-cligne');
        this.time.delayedCall(140, () => {
          if (this.owlImg.texture.key === 'w-owl-cligne') this.owlImg.setTexture('w-owl-ouvert');
        });
      }
      this.time.delayedCall(Phaser.Math.Between(2500, 5500), blink);
    };
    this.time.delayedCall(2000, blink);

    // L'escargot patrouille au pied du phare.
    this.tex('w-snail-0', () => Wd.snail(0));
    this.tex('w-snail-1', () => Wd.snail(1));
    this.tex('w-snail-cache', () => Wd.snail('cache'));
    this.snailImg = this.add.image(L.towerX + 120, L.groundY + 8, 'w-snail-0').setOrigin(0.5, 1).setScale(K).setDepth(9).setInteractive({ useHandCursor: true });
    this.snailImg.on('pointerdown', () => {
      this.sfx.unlock();
      this.sfx.pop();
      this.hideSnail(2600);
    });
    let f = 0;
    this.time.addEvent({ delay: 500, loop: true, callback: () => {
      if (this.snailHidden) return;
      f = 1 - f;
      this.snailImg.setTexture(`w-snail-${f}`);
      if (this.reducedMotion) return;
      if (f === 1) this.snailImg.x += this.snailImg.flipX ? -3 : 3;
      if (this.snailImg.x > L.towerX + 230) this.snailImg.setFlipX(true);
      if (this.snailImg.x < L.towerX + 90) this.snailImg.setFlipX(false);
    } });

    // Un poisson volant saute parfois hors de la mer de nuages.
    if (!this.reducedMotion) {
      const fish = this.add.image(0, 0, this.tex('w-fish', Wd.flyingFish)).setScale(K).setDepth(3).setVisible(false);
      const leap = () => {
        const x0 = Phaser.Math.Between(700, 1150);
        const dir = Math.random() < 0.5 ? -1 : 1;
        const p = { t: 0 };
        fish.setVisible(true).setFlipX(dir > 0);
        this.sfx.bloop();
        this.tweens.add({
          targets: p,
          t: 1,
          duration: 1400,
          ease: 'Linear',
          onUpdate: () => {
            const x = x0 + dir * 160 * p.t;
            const y = 540 - Math.sin(p.t * Math.PI) * 130;
            fish.setPosition(x, y).setAngle(dir * (p.t - 0.5) * 70);
          },
          onComplete: () => {
            fish.setVisible(false);
            this.time.delayedCall(Phaser.Math.Between(9000, 16000), leap);
          },
        });
      };
      this.time.delayedCall(5000, leap);
    }
  }

  private hideSnail(ms: number): void {
    if (this.snailHidden) return;
    this.snailHidden = true;
    this.snailImg.setTexture('w-snail-cache');
    if (!this.reducedMotion) this.tweens.add({ targets: this.snailImg, scaleY: { from: K * 0.8, to: K }, duration: 260, ease: 'Back.easeOut' });
    this.time.delayedCall(ms, () => {
      this.snailHidden = false;
      this.snailImg.setTexture('w-snail-0');
    });
  }

  private moonReact(state: 'clin' | 'rougit', ms: number): void {
    this.moonFace.setTexture(`w-moon-${state}`);
    this.time.delayedCall(ms, () => this.moonFace.setTexture('w-moon-dort'));
  }

  // --- Interface ----------------------------------------------------------------------------
  private buildHud(): void {
    this.scoreText = this.add.text(36, 22, 'Score 0', style(30, B.C.cream, 800, 6)).setDepth(60);
    this.comboText = this.add.text(36, 62, '', style(20, B.C.saffron, 700, 5)).setDepth(60);
    this.waveText = this.add.text(W / 2, 24, '', style(22, B.C.cream, 800, 5)).setOrigin(0.5, 0).setDepth(60);
    this.soundText = this.add.text(W - 30, 24, '', style(20, B.C.cream, 700, 5)).setOrigin(1, 0).setDepth(60).setInteractive({ useHandCursor: true });
    this.soundText.on('pointerdown', () => this.toggleSound());
    this.setMuted(this.sfx.muted);
    this.tex('w-heart-1', () => Wd.heart(true));
    this.tex('w-heart-0', () => Wd.heart(false));

    this.add.text(L.gridX + 18, L.sumY - 36, 'CIBLE', style(15, '#9fc9c2', 700)).setDepth(60);
    this.targetText = this.add.text(L.gridX + 6, L.sumY + 8, '', style(56, B.C.saffron, 800, 7)).setOrigin(0, 0.5).setDepth(60);
    this.equationText = this.add.text(L.gridX + 229, L.sumY + 4, '', style(30, B.C.cream, 800, 5)).setOrigin(0.5).setDepth(60);

    this.toastBg = this.add.graphics().setDepth(69);
    this.toastText = this.add.text(880, 250, '', style(26, B.C.cream, 800)).setOrigin(0.5).setDepth(70).setAlpha(0);

    this.makeButton(L.gridX + 88, L.buttonsY, 'Effacer', false, () => this.clearSelection());
    this.launchButton = this.makeButton(L.gridX + 278, L.buttonsY, 'Lancer !', true, () => this.validate());
  }

  private setMuted(m: boolean): void {
    this.soundText.setText(m ? 'Son : coupé (M)' : 'Son : activé (M)');
  }

  private refreshHearts(): void {
    for (const h of this.hearts) h.destroy();
    this.hearts = [];
    const n = this.session?.hearts;
    const max = this.session ? MODES[this.session.mode].hearts : null;
    if (n === null || n === undefined || max === null) return;
    for (let i = 0; i < max; i++) {
      this.hearts.push(this.add.image(W - 250 - i * 34, 38, `w-heart-${i < n ? 1 : 0}`).setScale(K).setDepth(60));
    }
  }

  private refreshScore(): void {
    if (!this.session) return;
    this.scoreText.setText(`Score ${this.session.score}`);
    const k = this.session.round.combo;
    this.comboText.setText(k > 1 ? `Série parfaite ×${k}` : '');
  }

  /** Le calcul en cours, sans le résultat : c'est au joueur de le faire de tête. */
  private refreshEquation(): void {
    if (!this.session) {
      this.targetText.setText('');
      this.equationText.setText('');
      return;
    }
    const r = this.session.round;
    this.targetText.setText(String(r.target));
    const values = r.selected.map((i) => r.cubes[i]);
    this.equationText.setText(values.length ? `${values.join(' + ')} = ?` : '').setColor(B.C.cream);
  }

  private toast(msg: string, kind: 'good' | 'perfect' | 'soft' = 'soft'): void {
    this.toastText.setText(msg).setColor(kind === 'perfect' ? B.C.ink : B.C.cream);
    const w = this.toastText.width + 44;
    this.toastBg.clear();
    this.toastBg.fillStyle(kind === 'perfect' ? 0xffc94a : kind === 'good' ? 0x1f6f72 : 0x1d1a2b, kind === 'soft' ? 0.85 : 1);
    this.toastBg.fillRoundedRect(880 - w / 2, 250 - 26, w, 52, 26);
    this.toastBg.lineStyle(4, 0x1d1a2b, 1);
    this.toastBg.strokeRoundedRect(880 - w / 2, 250 - 26, w, 52, 26);
    this.tweens.killTweensOf([this.toastText, this.toastBg]);
    this.toastText.setAlpha(1).setScale(0.6);
    this.toastBg.setAlpha(1);
    this.tweens.add({ targets: this.toastText, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [this.toastText, this.toastBg], alpha: 0, delay: 1900, duration: 400 });
  }

  private floatDamage(x: number, y: number, dmg: number, perfect: boolean): void {
    const t = this.add.text(x, y, `−${dmg}`, style(perfect ? 44 : 32, perfect ? B.C.saffron : B.C.cream, 800, 7)).setOrigin(0.5).setDepth(70).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 80, duration: 1000, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 700, duration: 300, onComplete: () => t.destroy() });
  }

  private makeButton(x: number, y: number, label: string, primary: boolean, onClick: () => void, depth = 60, width = 172): Phaser.GameObjects.Container {
    const key = this.tex(`b-btn-${primary ? 1 : 0}-${width}`, () => B.button(width, 54, primary));
    const c = this.add.container(x, y).setDepth(depth);
    const bg = this.add.image(0, 3, key).setScale(K);
    const t = this.add.text(0, -1, label, style(24, primary ? B.C.ink : B.C.cream, 800)).setOrigin(0.5);
    c.add([bg, t]);
    c.setSize(width + 4, 60).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.sfx.unlock();
      this.tweens.add({ targets: c, scale: 0.94, duration: 70, yoyo: true, ease: 'Sine.easeOut' });
      onClick();
    });
    return c;
  }

  // --- Écrans de début et de fin ---------------------------------------------------------------
  private openOverlay(h: number, veilAlpha = 0.62): Phaser.GameObjects.Container {
    this.closeOverlay();
    const c = this.add.container(0, 0).setDepth(100);
    const veil = this.add.rectangle(W / 2, H / 2, W, H, 0x0b1a2b, veilAlpha).setInteractive();
    const panel = this.add.image(W / 2, H / 2, this.tex(`w-dialog-${h}`, () => Wd.dialogPanel(700, h))).setScale(K);
    c.add([veil, panel]);
    this.overlay = c;
    this.overlayButtons = [];
    this.overlayFocus = 0;
    if (!this.reducedMotion) {
      panel.setScale(K * 0.9).setAlpha(0);
      this.tweens.add({ targets: panel, scale: K, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    }
    return c;
  }

  private overlayButton(x: number, y: number, label: string, primary: boolean, run: () => void, width = 220): void {
    const b = this.makeButton(x, y, label, primary, run, 101, width);
    this.overlay?.add(b);
    this.overlayButtons.push({ c: b, run });
    this.refreshOverlayFocus();
  }

  private refreshOverlayFocus(): void {
    this.overlayButtons.forEach((b, i) => b.c.setScale(this.keyboardUsed && i === this.overlayFocus ? 1.08 : 1));
  }

  private closeOverlay(): void {
    this.overlay?.destroy(true);
    this.overlay = null;
    this.overlayButtons = [];
  }

  private showIntro(): void {
    const c = this.openOverlay(470);
    const top = H / 2 - 235;
    c.add(this.add.text(W / 2, top + 60, 'Cubes de siège', style(48, B.C.saffron, 800, 7)).setOrigin(0.5));
    c.add(this.add.text(W / 2, top + 150, [
      'Un monstre approche du phare avec un nombre sur sa pancarte.',
      'Additionne des cubes pour obtenir exactement ce nombre :',
      'moins tu utilises de cubes, plus ton tir est fort !',
    ].join('\n'), { ...style(20, B.C.cream, 600), align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    c.add(this.add.text(W / 2, top + 236, `Niveau ${this.tier.label} · ${this.tier.public}`, style(18, '#9fc9c2', 700)).setOrigin(0.5));
    this.overlayButton(W / 2 - 140, top + 316, 'Tranquille', false, () => this.startGame('tranquille'));
    this.overlayButton(W / 2 + 140, top + 316, 'Défi', true, () => this.startGame('defi'));
    c.add(this.add.text(W / 2 - 140, top + 370, 'à ton rythme,\nle phare ne craint rien', { ...style(15, '#9fc9c2', 600), align: 'center' }).setOrigin(0.5, 0));
    c.add(this.add.text(W / 2 + 140, top + 370, 'monstres plus rapides,\n3 cœurs à protéger', { ...style(15, '#9fc9c2', 600), align: 'center' }).setOrigin(0.5, 0));
  }

  private records(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(RECORD_KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  private showEnd(won: boolean): void {
    const s = this.session;
    if (!s) return;
    this.busy = true;
    this.enemyWalking = false;
    this.abortFlight();
    const key = `${this.tier.id}-${s.mode}`;
    const rec = this.records();
    const best = rec[key] ?? 0;
    const isRecord = s.score > best;
    if (isRecord) {
      rec[key] = s.score;
      try {
        localStorage.setItem(RECORD_KEY, JSON.stringify(rec));
      } catch {
        /* stockage indisponible : record non conservé */
      }
    }
    const c = this.openOverlay(520, won ? 0.62 : 0.3);
    const top = H / 2 - 260;
    c.add(this.add.text(W / 2, top + 58, won ? 'Le phare est sauvé !' : 'Le phare s’est éteint…', style(44, won ? B.C.saffron : B.C.coralLight, 800, 7)).setOrigin(0.5));
    c.add(this.add.text(W / 2, top + 116, `Score ${s.score}`, style(34, B.C.cream, 800, 5)).setOrigin(0.5));
    c.add(this.add.text(W / 2, top + 156, isRecord ? 'Nouveau record !' : `Record : ${best}`, style(18, isRecord ? B.C.saffron : '#9fc9c2', 800)).setOrigin(0.5));
    const total = WAVES.flat().length;
    const med = s.medianTime();
    const lines: Array<[string, string]> = [
      ['Monstres vaincus', `${s.stats.defeated} / ${total}`],
      ['Coups parfaits', `${s.stats.perfects} sur ${s.stats.hits}`],
      ['Calculs justes', `${Math.round(s.accuracy() * 100)} %`],
      ['Meilleure série', `${s.stats.bestCombo}`],
      ['Temps habituel d’un calcul juste', med === null ? '—' : `${med.toFixed(1).replace('.', ',')} s`],
    ];
    lines.forEach(([label, value], i) => {
      const y = top + 210 + i * 36;
      c.add(this.add.text(W / 2 - 220, y, label, style(20, '#cfe8e4', 600)).setOrigin(0, 0.5));
      c.add(this.add.text(W / 2 + 220, y, value, style(22, B.C.cream, 800)).setOrigin(1, 0.5));
    });
    // Étoiles (comme les autres jeux) : victoire, 85 % de calculs justes, 70 % de coups parfaits.
    let stars = 0;
    if (won) {
      stars = 1;
      if (s.accuracy() >= 0.85) stars++;
      if (s.stats.hits > 0 && s.stats.perfects / s.stats.hits >= 0.7) stars++;
    }
    const status = this.add.text(W / 2, top + 396, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}   Enregistrement…`, style(17, '#9fc9c2', 700)).setOrigin(0.5);
    c.add(status);
    void reportResult({
      jeu: 'cubes',
      niveau: this.tier.id,
      mode: s.mode,
      score: s.score,
      gagne: won,
      etoiles: stars,
      duree: (Date.now() - this.startedAt) / 1000,
      precision: s.accuracy(),
      ops: { '+': [s.stats.hits, s.stats.misses] },
      details: { monstres: s.stats.defeated, parfaits: s.stats.perfects, serie: s.stats.bestCombo, bonus: this.powers?.caught ?? 0 },
    }).then((o) => status.active && status.setText(`${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}   ${outcomeText(o)}`));
    this.overlayButton(W / 2 - 130, top + 440, 'Accueil', false, () => {
      window.location.href = '../index.html';
    });
    this.overlayButton(W / 2 + 130, top + 440, 'Rejouer', true, () => this.showIntro());
    if (won) {
      this.moonReact('clin', 4000);
      if (!this.reducedMotion) for (let i = 0; i < 4; i++) this.time.delayedCall(i * 250, () => this.sparks.explode(18, Phaser.Math.Between(300, 980), Phaser.Math.Between(120, 300)));
    }
  }

  // --- Partie ---------------------------------------------------------------------------------
  private startGame(mode: Mode): void {
    pleinEcranAuDemarrage();
    this.closeOverlay();
    this.enemy?.obj.destroy();
    for (const o of this.enemy?.extras ?? []) o.destroy();
    this.enemy = null;
    this.warnedArmor = false;
    this.resetWorld();
    this.seed = (this.seed * 7919 + 13) % 1e9;
    this.session = new SiegeSession(this.tier, this.seed, mode);
    partieCommence('cubes', this.tier.id, mode);
    this.resetBonus(mode);
    this.startedAt = Date.now();
    this.session.round.cubes.forEach((v, i) => {
      this.cubes[i].base.setTexture('b-tile');
      this.cubes[i].obj.setY(this.cubes[i].y);
      this.shownValues[i] = v;
      this.setCubeValue(i, v, true, i * 30);
    });
    this.refreshHearts();
    this.refreshScore();
    this.refreshEquation();
    this.busy = false;
    this.announceWave();
  }

  private announceWave(): void {
    const s = this.session;
    if (!s) return;
    this.waveText.setText(`Vague ${s.wave + 1} / ${s.waveCount}`);
    const boss = WAVES[s.wave].includes('roi');
    const label = boss ? 'Dernière vague : le Roi Mordillon !' : `Vague ${s.wave + 1}`;
    const rib = this.add.image(880, 200, this.tex('w-ribbon', () => Wd.ribbon(420, 64))).setScale(K).setDepth(75);
    const t = this.add.text(880, 196, label, style(boss ? 24 : 30, B.C.ink, 800)).setOrigin(0.5).setDepth(76);
    const parts = [rib, t];
    if (this.reducedMotion) {
      this.time.delayedCall(1400, () => parts.forEach((p) => p.destroy()));
    } else {
      parts.forEach((p) => p.setScale(p === rib ? 0 : 0.2));
      this.tweens.add({ targets: rib, scale: K, duration: 380, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, scale: 1, duration: 380, ease: 'Back.easeOut' });
      this.tweens.add({ targets: parts, alpha: 0, delay: 1300, duration: 300, onComplete: () => parts.forEach((p) => p.destroy()) });
    }
    this.sfx.fanfare();
    this.time.delayedCall(1100, () => this.spawnNext());
  }

  private spawnNext(): void {
    const s = this.session;
    // Jamais deux monstres à la fois.
    if (!s || s.phase !== 'play' || this.enemy) return;
    const a = s.nextEnemy(this.time.now);
    if (!a) {
      if (s.nextWave()) this.announceWave();
      else this.celebrate(() => this.showEnd(true));
      return;
    }
    const e = this.makeEnemy(a.kind);
    this.enemy = e;
    this.enemyIndex++;
    this.setEnemyTarget(e, s.round.target, false);
    this.time.delayedCall(500, () => this.sfx.growl());
    this.enemyWalking = false;
    this.tweens.add({
      targets: e.obj,
      x: L.enemyEnterX,
      duration: 1300,
      ease: 'Sine.easeOut',
      onComplete: () => {
        e.entering = false;
        if (this.enemy !== e) return;
        this.enemyArrivedAt = this.time.now;
        this.passDelay = this.powers?.delayAfterEnemy() ?? 0;
        // Si un tir est en vol, la marche reprendra après l'impact.
        if (!this.busy) this.enemyWalking = true;
        s.markShown(this.time.now);
      },
    });
    if (a.armored && !this.warnedArmor) {
      this.warnedArmor = true;
      this.time.delayedCall(900, () => this.toast('Blindé : seuls les coups parfaits lui font vraiment mal'));
    }
  }

  // --- Grille ---------------------------------------------------------------------------------
  private gridPos(index: number): { x: number; y: number } {
    const { cols, rows } = this.tier;
    const offX = ((4 - cols) * L.pitchX) / 2;
    const offY = ((4 - rows) * L.pitchY) / 2;
    return {
      x: L.gridX + offX + (index % cols) * L.pitchX + L.cube / 2,
      y: L.gridY + offY + Math.floor(index / cols) * L.pitchY + L.cube / 2,
    };
  }

  private buildGrid(): void {
    this.tex('b-tile', () => B.tile('normal'));
    this.tex('b-tile-sel', () => B.tile('selected'));
    this.tex('b-tile-spent', () => B.tile('spent'));
    this.tex('b-focus', B.focusRing);
    const n = this.tier.cols * this.tier.rows;
    for (let i = 0; i < n; i++) {
      const { x, y } = this.gridPos(i);
      const obj = this.add.container(x, y).setDepth(20);
      const base = this.add.image(0, 5, 'b-tile').setScale(K);
      const num = this.add.text(0, -2, '', style(46, B.C.ink, 800)).setOrigin(0.5);
      const focus = this.add.image(0, 5, 'b-focus').setScale(K).setVisible(false);
      obj.add([base, num, focus]);
      obj.setSize(L.cube, L.cube).setInteractive({ useHandCursor: true });
      obj.on('pointerdown', () => {
        this.focus = i;
        this.onCube(i);
      });
      this.cubes.push({ obj, base, num, focus, x, y });
      this.shownValues.push(0);
    }
  }

  private setCubeValue(i: number, v: number, appear: boolean, delay = 0): void {
    const c = this.cubes[i];
    this.time.delayedCall(delay, () => {
      c.num.setText(String(v)).setVisible(true);
      c.base.setTexture('b-tile');
      if (!appear) return;
      c.obj.setScale(0.3).setAlpha(0);
      this.tweens.add({ targets: c.obj, scale: 1, alpha: 1, duration: 380, ease: 'Back.easeOut' });
      if (!this.reducedMotion) this.sparks.explode(4, c.x, c.y);
    });
  }

  private setCubeSelected(i: number, s: boolean): void {
    const c = this.cubes[i];
    c.base.setTexture(s ? 'b-tile-sel' : 'b-tile');
    this.tweens.killTweensOf(c.obj);
    c.obj.setScale(1).setAngle(0).setAlpha(1);
    this.tweens.add({ targets: c.obj, y: c.y - (s ? 8 : 0), duration: 220, ease: 'Back.easeOut' });
    if (!this.reducedMotion) {
      this.tweens.add({ targets: c.obj, scaleX: { from: 1.12, to: 1 }, scaleY: { from: 0.86, to: 1 }, duration: 320, ease: 'Elastic.easeOut', easeParams: [1, 0.5] });
      if (s) this.tweens.add({ targets: c.obj, angle: { from: -3, to: 0 }, duration: 300, ease: 'Sine.easeOut' });
    }
  }

  private shakeCube(i: number): void {
    const c = this.cubes[i];
    if (this.reducedMotion) {
      this.tweens.add({ targets: c.obj, alpha: 0.5, duration: 140, yoyo: true });
      return;
    }
    this.tweens.add({ targets: c.obj, x: { from: c.x - 7, to: c.x }, duration: 420, ease: 'Elastic.easeOut', easeParams: [2, 0.25] });
  }

  private onCube(i: number): void {
    const s = this.session;
    if (this.busy || !s || this.overlay) return;
    this.sfx.unlock();
    const selected = s.round.toggle(i);
    this.setCubeSelected(i, selected);
    if (selected) this.sfx.select(s.round.selected.length - 1);
    else this.sfx.deselect();
    this.refreshFocus();
    this.refreshEquation();
  }

  private clearSelection(): void {
    const s = this.session;
    if (this.busy || !s || s.round.selected.length === 0) return;
    for (const i of s.round.selected) this.setCubeSelected(i, false);
    s.round.clear();
    this.sfx.clear();
    this.refreshEquation();
  }

  private refreshFocus(): void {
    this.cubes.forEach((c, i) => c.focus.setVisible(this.keyboardUsed && i === this.focus));
  }

  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    const n = this.cubes.length;
    const cols = this.tier.cols;
    const move = (d: number, horizontal: boolean) => {
      this.keyboardUsed = true;
      if (this.overlay) {
        if (!horizontal || this.overlayButtons.length === 0) return;
        this.overlayFocus = (this.overlayFocus + (d > 0 ? 1 : -1) + this.overlayButtons.length) % this.overlayButtons.length;
        this.refreshOverlayFocus();
        return;
      }
      this.focus = (this.focus + d + n) % n;
      this.refreshFocus();
    };
    kb.on('keydown-LEFT', () => move(-1, true));
    kb.on('keydown-RIGHT', () => move(1, true));
    kb.on('keydown-UP', () => move(-cols, false));
    kb.on('keydown-DOWN', () => move(cols, false));
    kb.on('keydown-SPACE', () => {
      this.keyboardUsed = true;
      if (this.overlay) return this.overlayButtons[this.overlayFocus]?.run();
      this.onCube(this.focus);
    });
    kb.on('keydown-ENTER', () => {
      if (this.overlay) {
        this.sfx.unlock();
        return this.overlayButtons[this.overlayFocus]?.run();
      }
      this.validate();
    });
    kb.on('keydown-BACKSPACE', () => {
      if (!this.bonusErase()) this.clearSelection();
    });
    // Chiffres : réponse au calcul bonus (la grille ne s'en sert pas). B et N : utiliser un bonus.
    // Quand une image est lente, Phaser peut relire la même file d'événements : chaque touche
    // n'est comptée qu'une fois (sinon un chiffre tapé compterait double).
    const seen = new WeakSet<KeyboardEvent>();
    kb.on('keydown', (ev: KeyboardEvent) => {
      if (seen.has(ev)) return;
      seen.add(ev);
      const digit = /^(?:Digit|Numpad)([0-9])$/.exec(ev.code);
      if (digit) {
        this.sfx.unlock();
        this.bonusKey(digit[1]);
      } else if (ev.code === 'KeyB') this.usePower(0);
      else if (ev.code === 'KeyN') this.usePower(1);
    });
    kb.on('keydown-ESC', () => this.clearSelection());
    kb.on('keydown-M', () => this.toggleSound());
  }

  private toggleSound(): void {
    this.sfx.unlock();
    this.setMuted(this.sfx.toggle());
  }

  // --- Monstres ---------------------------------------------------------------------------------
  private makeEnemy(kind: EnemyKind): EnemyView {
    this.tex(`w-${kind}-0`, () => Wd.creature(kind, 0));
    this.tex(`w-${kind}-1`, () => Wd.creature(kind, 1));
    this.tex('b-shadow', () => B.shadow(110, 18));
    const scale = Wd.CREATURE_SCALE[kind];
    const obj = this.add.container(L.enemyStartX, L.groundY + 22).setDepth(10).setName('monstre');
    const shadow = this.add.image(0, 0, 'b-shadow').setScale(K * scale);
    const body = this.add.image(0, 2, `w-${kind}-0`).setOrigin(0.5, 1).setScale(K * scale);
    const signY = -(Wd.CREATURE_H - 14) * scale;
    const sign = this.add.image(0, signY, this.tex('b-sign-0', () => B.sign(0))).setOrigin(0.5, 1).setScale(K);
    const barW = 96;
    const barY = signY - 76;
    const barBg = this.add.rectangle(0, barY, barW + 6, 12, 0x1d1a2b);
    const bar = this.add.rectangle(-barW / 2, barY, barW, 6, 0xf0745e).setOrigin(0, 0.5);
    obj.add([shadow, body, sign, barBg, bar]);
    if (ARCHETYPES[kind].armored) obj.add(this.add.image(-barW / 2 - 18, barY, this.tex('w-shield', Wd.shield)).setScale(K));
    return { kind, obj, body, sign, bar, barBg, shadow, extras: [], scale, signY, frame: 0, acc: 0, walking: true, entering: true };
  }

  private setEnemyTarget(e: EnemyView, n: number, animate: boolean): void {
    const key = this.tex(`b-sign-${n}`, () => B.sign(n));
    if (!animate || this.reducedMotion) {
      e.sign.setTexture(key);
      return;
    }
    this.tweens.add({ targets: e.sign, scaleY: 0, duration: 120, ease: 'Sine.easeIn', onComplete: () => {
      e.sign.setTexture(key);
      this.tweens.add({ targets: e.sign, scaleY: K, duration: 380, ease: 'Back.easeOut' });
    } });
  }

  private animateEnemy(e: EnemyView, time: number, delta: number): void {
    if (!e.walking || this.isFrozen()) return;
    const fast = e.kind === 'trotteur';
    e.acc += delta;
    if (e.acc > (fast ? 150 : e.kind === 'carapacon' ? 380 : 260)) {
      e.acc = 0;
      e.frame = 1 - e.frame;
      e.body.setTexture(`w-${e.kind}-${e.frame}`);
      if (!this.reducedMotion && this.enemyWalking) this.dust.explode(1, e.obj.x + 20, e.obj.y - 4);
    }
    if (this.reducedMotion) return;
    const t = time / (fast ? 150 : 260);
    e.body.angle = Math.sin(t * Math.PI) * (fast ? 5 : 3);
    e.sign.angle = Math.sin(t * Math.PI + 0.6) * 4;
    e.sign.y = e.signY - Math.abs(Math.sin(t * Math.PI)) * 4;
  }

  private flash(e: EnemyView): void {
    e.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(70, () => {
      e.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.isFrozen() && this.enemy === e) e.body.setTint(0xa8e4ff);
    });
  }

  // --- Validation et tir --------------------------------------------------------------------------
  private validate(): void {
    const s = this.session;
    if (this.busy || !s || this.overlay || !this.enemy || this.pushing) return;
    this.sfx.unlock();
    const target = s.round.target;
    const before = s.round.selected.slice();
    const res = s.validate(this.time.now);
    const out = res.outcome;
    if (out.kind === 'empty') {
      this.toast('Choisis des cubes');
      return;
    }
    if (out.kind === 'miss') {
      // On ne donne pas l'écart : le joueur refait le calcul lui-même.
      this.sfx.miss();
      for (const i of before) this.shakeCube(i);
      this.toast(`Ce n’est pas ${target}, essaie encore`);
      this.refreshScore();
      return;
    }
    this.busy = true;
    // Le monstre s'arrête pendant le tir : il ne peut pas atteindre le phare entre-temps.
    this.enemyWalking = false;
    const e = this.enemy;
    const perfect = out.result.perfect;
    const to = new Phaser.Math.Vector2(e.obj.x - 4, e.obj.y - 70 * e.scale);
    this.sfx.fuse();
    this.time.delayedCall(260, () => this.sfx.whoosh());
    this.fireVolley(out.used, out.target, perfect, to, res.mega, () => {
      this.sfx.impact(perfect || res.mega);
      const at = new Phaser.Math.Vector2(e.obj.x - 4, e.obj.y - 70 * e.scale);
      this.impactFx(at, perfect || res.mega);
      if (res.mega) this.megaImpact(at);
      this.flash(e);
      if (perfect) {
        this.sfx.perfect();
        this.perfectFx(at, s.round.combo);
        this.moonReact('clin', 1200);
        this.owlImg.setTexture('w-owl-contente');
        if (!this.reducedMotion) this.tweens.add({ targets: this.owlImg, y: this.owlImg.y - 10, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
        this.time.delayedCall(1200, () => this.owlImg.setTexture('w-owl-ouvert'));
      }
      if (!this.reducedMotion) {
        this.tweens.add({ targets: e.obj, x: e.obj.x + (perfect ? 44 : 24), duration: 220, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: e.body, scaleX: K * e.scale * 1.22, scaleY: K * e.scale * 0.8, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: e.sign, angle: { from: perfect ? -24 : -12, to: 0 }, duration: 700, ease: 'Elastic.easeOut' });
      }
      // À gauche du monstre (côté phare) : la pancarte et son nombre restent visibles.
      this.floatDamage(to.x - 120, to.y + 10, res.damage, perfect || res.mega);
      if (!res.killed) this.time.delayedCall(120, () => this.sfx.ouch());
      if (res.mega) {
        this.toast(`Méga-tir : −${res.damage} !`, 'perfect');
      } else if (perfect) {
        if (s.round.combo > 1) this.toast(`Série parfaite ×${s.round.combo}`, 'perfect');
      } else if (res.armoredHalved) this.toast('La carapace a amorti le coup !', 'good');
      else this.toast('Touché ! Avec moins de cubes, ça frappe plus fort', 'good');
      this.refreshScore();
      const max = ARCHETYPES[e.kind].hp;
      this.tweens.add({ targets: e.bar, width: Math.max(0, 96 * (s.enemyHp / max)), duration: 380, ease: 'Cubic.easeOut' });
      let k = 0;
      s.round.cubes.forEach((v, i) => {
        if (!out.used.includes(i) && this.shownValues[i] === v) return;
        this.setCubeSelected(i, false);
        this.shownValues[i] = v;
        this.setCubeValue(i, v, true, 80 * k++);
      });
      if (res.killed) {
        this.enemyWalking = false;
        this.time.delayedCall(250, () => {
          this.sfx.defeat();
          this.killEnemy(e, () => {
            this.busy = false;
            this.refreshEquation();
            this.spawnNext();
          });
        });
      } else {
        this.time.delayedCall(350, () => {
          this.setEnemyTarget(e, s.round.target, true);
          s.markShown(this.time.now);
          this.busy = false;
          if (!e.entering) this.enemyWalking = true;
          this.refreshEquation();
        });
      }
    });
  }

  /** Coup parfait : tampon « PARFAIT ! » et feu d'artifice rouge, rose et or. */
  private perfectFx(at: Phaser.Math.Vector2, combo: number): void {
    // Au-dessus de la pancarte, sans sortir de l'écran ni cacher le nombre.
    const sx = Phaser.Math.Clamp(at.x - 40, 760, W - 200);
    const stamp = this.add.text(sx, at.y - 250, 'PARFAIT !', { ...style(64, B.C.saffron, 800, 9), stroke: '#c2365a' }).setOrigin(0.5).setDepth(72).setAngle(-8);
    if (this.reducedMotion) {
      this.time.delayedCall(900, () => stamp.destroy());
    } else {
      stamp.setScale(2.6).setAlpha(0);
      this.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
      this.tweens.add({ targets: stamp, y: stamp.y - 30, alpha: 0, delay: 750, duration: 350, onComplete: () => stamp.destroy() });
    }
    // Plus la série est longue, plus il y a de fusées.
    const n = this.reducedMotion ? 1 : Math.min(5, 2 + Math.floor(combo / 2));
    for (let i = 0; i < n; i++) {
      // Dans le ciel, au-dessus du monstre et de sa pancarte.
      const x = Phaser.Math.Clamp(at.x + Phaser.Math.Between(-260, 60), 700, W - 80);
      const y = at.y - Phaser.Math.Between(230, 340);
      this.time.delayedCall(120 + i * 170, () => this.fireworkBurst(x, y));
      this.sfx.firework(0.1 + i * 0.17);
    }
  }

  private fireworksFx: Fireworks | null = null;

  private fireworkBurst(x: number, y: number, palette?: string[]): void {
    this.fireworksFx ??= new Fireworks(this, 71, this.reducedMotion);
    this.fireworksFx.burst(x, y, palette);
  }

  /** Victoire : faisceau du phare, feu d'artifice, confettis, cubes et habitants qui dansent, fanfare. */
  private celebrate(done: () => void): void {
    this.busy = true;
    this.enemyWalking = false;
    this.abortFlight();
    this.clearMegaFx();
    this.waveText.setText('Victoire !');
    this.sfx.victoryJingle();
    // Bannière.
    const rib = this.add.image(880, 190, this.tex('w-ribbon-big', () => Wd.ribbon(520, 74))).setScale(0).setDepth(75);
    const t = this.add.text(880, 186, 'Le phare est sauvé !', style(36, B.C.ink, 800)).setOrigin(0.5).setScale(0).setDepth(76);
    this.wreck.push(rib, t);
    this.tweens.add({ targets: rib, scale: K, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, scale: 1, duration: 420, ease: 'Back.easeOut' });
    // Le phare balaie le ciel de son faisceau.
    const beam = this.add.image(L.towerX, this.lanternGlow.y, this.tex('w-beam', Wd.beam)).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(3).setAlpha(0);
    this.wreck.push(beam);
    this.tweens.add({ targets: beam, alpha: 0.9, duration: 300 });
    if (!this.reducedMotion) this.tweens.add({ targets: beam, angle: { from: -35, to: 10 }, duration: 1100, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.lanternGlow, alpha: 1, scale: 1.4, duration: 400, yoyo: true, repeat: 4 });
    // Feu d'artifice multicolore.
    const all = ['#ff4d6d', '#ff8fb1', '#ffc94a', '#ffffff', '#5fd3bc', '#b79ad8'];
    const bursts = this.reducedMotion ? 2 : 9;
    for (let i = 0; i < bursts; i++) {
      const x = Phaser.Math.Between(560, 1220);
      const y = Phaser.Math.Between(90, 330);
      const pal = [all[i % all.length], all[(i + 2) % all.length], '#ffffff'];
      this.time.delayedCall(250 + i * 380, () => this.fireworkBurst(x, y, pal));
      this.sfx.firework(0.25 + i * 0.38);
    }
    // Pluie de confettis.
    this.fireworksFx ??= new Fireworks(this, 71, this.reducedMotion);
    this.wreck.push(...this.fireworksFx.confetti(W, 3200));
    // Les cubes sautent en vague, la chouette et l'escargot dansent.
    if (!this.reducedMotion) {
      this.cubes.forEach((c, i) => {
        const col = i % this.tier.cols;
        const row = Math.floor(i / this.tier.cols);
        this.tweens.add({ targets: c.obj, y: c.y - 26, duration: 200, yoyo: true, repeat: 4, repeatDelay: 220, delay: (col + row) * 70, ease: 'Quad.easeOut' });
      });
      this.owlImg.setTexture('w-owl-contente');
      this.tweens.add({ targets: this.owlImg, y: this.owlHome.y - 22, duration: 220, yoyo: true, repeat: 7, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: this.owlImg, angle: 360, duration: 700, delay: 900 });
      this.snailHidden = false;
      this.snailImg.setTexture('w-snail-0');
      this.tweens.add({ targets: this.snailImg, y: this.snailImg.y - 24, duration: 260, yoyo: true, repeat: 5, ease: 'Quad.easeOut' });
    }
    this.moonReact('clin', 2000);
    this.time.delayedCall(2000, () => this.moonReact('rougit', 2000));
    this.time.delayedCall(4600, () => {
      this.owlImg.setTexture('w-owl-ouvert');
      done();
    });
  }

  private killEnemy(e: EnemyView, done: () => void): void {
    e.walking = false;
    if (this.ice) this.thaw(e, true);
    this.flash(e);
    this.sparks.explode(this.reducedMotion ? 6 : 36, e.obj.x, e.obj.y - 70);
    this.dust.explode(this.reducedMotion ? 2 : 10, e.obj.x, e.obj.y - 10);
    const bounty = this.session?.enemy?.bounty;
    if (bounty) {
      this.time.delayedCall(350, () => this.sfx.coin());
      const t = this.add.text(e.obj.x, e.obj.y - 200 * e.scale, `+${bounty}`, style(34, B.C.saffron, 800, 6)).setOrigin(0.5).setDepth(70);
      this.tweens.add({ targets: t, y: t.y - 60, alpha: 0, delay: 400, duration: 900, onComplete: () => t.destroy() });
    }
    this.tweens.add({ targets: e.sign, y: e.signY - 200, x: 60, angle: 260, alpha: 0, duration: 900, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: [e.bar, e.barBg], alpha: 0, duration: 150 });
    this.tweens.add({ targets: e.body, scaleY: K * e.scale * 0.4, scaleX: K * e.scale * 1.4, duration: 160, ease: 'Quad.easeOut', yoyo: true });
    this.tweens.add({ targets: e.body, y: -60, angle: 540, scale: 0, alpha: 0, delay: 320, duration: 600, ease: 'Back.easeIn' });
    this.tweens.add({ targets: e.shadow, alpha: 0, delay: 320, duration: 500, onComplete: () => {
      e.obj.destroy();
      if (this.enemy === e) this.enemy = null;
      done();
    } });
  }

  private onEnemyReachesTower(): void {
    const s = this.session;
    const e = this.enemy;
    if (!s || !e) return;
    this.enemyWalking = false;
    // Le monstre se jette sur le phare.
    if (!this.reducedMotion) this.tweens.add({ targets: e.obj, x: e.obj.x - 34, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
    this.time.delayedCall(120, () => this.towerDamage(s.hearts !== null));
    const leaves = s.enemyReachedTower();
    if (!leaves) {
      // Mode Tranquille : le monstre est repoussé et revient.
      this.toast('Le phare le repousse !');
      this.tweens.add({ targets: e.obj, x: L.enemyStopX + 260, delay: 200, duration: 700, ease: 'Cubic.easeOut', onComplete: () => {
        this.enemyWalking = true;
      } });
      return;
    }
    // Mode Défi : un cœur perdu.
    this.refreshHearts();
    this.sfx.heartLost();
    const lost = this.hearts[s.hearts ?? 0];
    if (lost && !this.reducedMotion) this.tweens.add({ targets: lost, scale: { from: K * 1.6, to: K }, duration: 400, ease: 'Back.easeOut' });
    for (const i of s.round.selected) this.setCubeSelected(i, false);
    s.round.clear();
    this.refreshEquation();
    this.busy = true;
    if (s.phase === 'lost') {
      this.toast('Plus de cœurs !');
      e.walking = false;
      this.time.delayedCall(500, () => this.collapseTower(() => this.showEnd(false)));
      return;
    }
    this.toast('Aïe, le phare perd un cœur');
    this.time.delayedCall(300, () => this.sfx.laugh());
    e.walking = false;
    e.body.setFlipX(true);
    this.tweens.add({ targets: e.obj, x: W + 200, delay: 300, duration: 1200, ease: 'Quad.easeIn', onComplete: () => {
      e.obj.destroy();
      if (this.enemy === e) this.enemy = null;
      this.busy = false;
      this.spawnNext();
    } });
  }

  /** Le phare encaisse : secousse, pierres qui tombent, poussière, fissures. */
  private towerDamage(lostHeart: boolean): void {
    this.sfx.bump();
    this.sfx.stones();
    this.towerImg.setTint(0xffb08f);
    this.time.delayedCall(140, () => this.towerImg.clearTint());
    this.tweens.add({ targets: [this.towerImg, this.crackImg], angle: { from: -3, to: 0 }, duration: 600, ease: 'Elastic.easeOut' });
    this.tweens.add({ targets: this.lanternGlow, alpha: 0.1, duration: 90, yoyo: true, repeat: 2 });
    if (!this.reducedMotion) this.cameras.main.shake(220, 0.006);
    this.dropStones(this.reducedMotion ? 2 : lostHeart ? 7 : 4, 50);
    this.dust.explode(this.reducedMotion ? 3 : 14, L.towerX, L.groundY + 10);
    const s = this.session;
    const max = s ? MODES[s.mode].hearts : null;
    if (s && max !== null && s.hearts !== null) {
      const level = Math.min(2, max - s.hearts);
      if (level > 0) this.crackImg.setTexture(`w-cracks-${level}`).setVisible(true);
    }
    // L'escargot et la chouette n'aiment pas ça.
    this.hideSnail(2500);
    this.tweens.add({ targets: this.owlImg, y: this.owlHome.y - 26, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Pierres qui se détachent du phare et rebondissent au sol. */
  private dropStones(n: number, spread: number): void {
    for (let i = 0; i < n; i++) {
      const key = this.tex(`w-rock-${i % 4}`, () => Wd.rock((i % 4) + 1));
      const x0 = L.towerX + Phaser.Math.Between(-32, 32);
      const y0 = Phaser.Math.Between(320, 520);
      const r = this.add.image(x0, y0, key).setScale(K * Phaser.Math.FloatBetween(0.8, 1.5)).setDepth(8);
      const ground = L.groundY + Phaser.Math.Between(0, 16);
      const dur = 450 + (ground - y0) * 1.4;
      this.tweens.add({ targets: r, x: x0 + Phaser.Math.Between(-spread, spread * 2), duration: dur });
      this.tweens.add({ targets: r, y: ground, angle: Phaser.Math.Between(-400, 400), duration: dur, ease: 'Quad.easeIn', onComplete: () => {
        this.dust.explode(2, r.x, ground);
        this.tweens.add({ targets: r, y: ground - 12, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: r, alpha: 0, delay: 1800, duration: 500, onComplete: () => r.destroy() });
      } });
    }
  }

  /** Défaite : le phare tremble, explose en morceaux, puis les monstres dansent. */
  private collapseTower(done: () => void): void {
    this.busy = true;
    this.enemyWalking = false;
    this.abortFlight();
    this.clearMegaFx();
    this.sfx.collapse();
    this.lanternTween?.stop();
    this.tweens.add({ targets: this.lanternGlow, alpha: 0, duration: 700 });
    // La chouette s'envole, l'escargot se cache.
    this.hideSnail(8000);
    this.tweens.add({ targets: this.owlImg, x: this.owlHome.x - 700, y: -120, angle: -25, duration: 1600, ease: 'Quad.easeIn' });
    if (!this.reducedMotion) this.cameras.main.shake(900, 0.01);
    this.tweens.add({ targets: [this.towerImg, this.crackImg], angle: { from: -3, to: 3 }, duration: 60, yoyo: true, repeat: 7 });
    this.crackImg.setTexture('w-cracks-2').setVisible(true);
    this.dropStones(this.reducedMotion ? 3 : 10, 90);
    this.time.delayedCall(800, () => this.explodeTower());
    this.time.delayedCall(1500, () => this.monstersDance());
    this.time.delayedCall(6200, done);
  }

  private explodeTower(): void {
    const tex = this.textures.get('b-tower');
    const src = tex.getSourceImage() as HTMLCanvasElement;
    const slices = 6;
    const sh = Math.floor(src.height / slices);
    const top = L.groundY + 26 - B.TOWER_H;
    const pieceH = B.TOWER_H / slices;
    this.towerImg.setVisible(false);
    this.crackImg.setVisible(false);
    const g = 1500;
    for (let i = 0; i < slices; i++) {
      const name = `piece-${i}`;
      if (!tex.has(name)) tex.add(name, 0, 0, i * sh, src.width, sh);
      const y0 = top + (i + 0.5) * pieceH;
      const piece = this.add.image(L.towerX, y0, 'b-tower', name).setScale(K).setDepth(8);
      this.wreck.push(piece);
      const height = 1 - i / slices;
      const vx = Phaser.Math.Between(-120, 320) * (0.4 + height);
      const vy = -Phaser.Math.Between(250, 560) * (0.3 + height);
      const spin = Phaser.Math.Between(-540, 540);
      const ground = L.groundY + 8 - Phaser.Math.Between(0, 10);
      const p = { t: 0 };
      this.tweens.add({
        targets: p,
        t: 1.8,
        duration: 1800,
        onUpdate: () => {
          const t = p.t;
          const y = y0 + vy * t + 0.5 * g * t * t;
          if (y >= ground && t > 0.1) {
            if (piece.getData('landed')) return;
            piece.setData('landed', true).setY(ground);
            this.dust.explode(this.reducedMotion ? 1 : 5, piece.x, ground);
            return;
          }
          piece.setPosition(L.towerX + vx * t, y).setAngle(spin * t);
        },
      });
    }
    if (!this.reducedMotion) {
      this.cameras.main.shake(500, 0.016);
      const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffd6a0, 0.35).setDepth(80).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
      for (let k = 0; k < 4; k++) this.dust.explode(18, L.towerX + Phaser.Math.Between(-40, 40), top + k * 70);
      this.sparks.explode(40, L.towerX, top + 60);
    }
    this.dropStones(this.reducedMotion ? 3 : 12, 160);
    const rub = this.add.image(L.towerX, L.groundY + 24, this.tex('w-rubble', Wd.rubble)).setOrigin(0.5, 1).setScale(0).setDepth(7);
    this.wreck.push(rub);
    this.tweens.add({ targets: rub, scale: K, delay: 500, duration: 500, ease: 'Back.easeOut' });
  }

  /** Les monstres arrivent en sautillant et dansent sur les ruines. */
  private monstersDance(): void {
    if (this.enemy) {
      this.enemy.obj.destroy();
      this.enemy = null;
    }
    this.sfx.danceTune();
    this.sfx.laugh(0.4);
    this.sfx.laugh(1.9);
    const kinds: EnemyKind[] = ['trotteur', 'mordillon', 'carapacon', 'mordillon', 'trotteur'];
    kinds.forEach((kind, i) => {
      this.tex(`w-${kind}-0`, () => Wd.creature(kind, 0));
      this.tex(`w-${kind}-1`, () => Wd.creature(kind, 1));
      const x = 690 + i * 115;
      const sc = K * Wd.CREATURE_SCALE[kind] * 0.85;
      const d = this.add.image(W + 60 + i * 40, L.groundY + 24, `w-${kind}-0`).setOrigin(0.5, 1).setScale(sc).setDepth(11);
      this.wreck.push(d);
      this.tweens.add({ targets: d, x, delay: i * 80, duration: 520, ease: 'Quad.easeOut', onComplete: () => {
        if (this.reducedMotion) return;
        this.tweens.add({ targets: d, y: L.groundY + 24 - Phaser.Math.Between(22, 40), duration: 240 + i * 20, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: d, angle: { from: -10, to: 10 }, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.loops.push(this.time.addEvent({ delay: 480, loop: true, callback: () => {
          if (!d.active) return;
          d.setFlipX(!d.flipX);
          d.setTexture(`w-${kind}-${d.flipX ? 1 : 0}`);
        } }));
      } });
      if (i === 1 || i === 3) {
        const bx = x;
        const by = L.groundY - 200;
        const bub = this.add.image(bx, by, this.tex('w-bubble', () => Wd.bubble(130, 54))).setScale(0).setDepth(12);
        const t = this.add.text(bx, by - 6, i === 1 ? 'Ha ha ha !' : 'Hé hé !', style(22, B.C.ink, 800)).setOrigin(0.5).setScale(0).setDepth(13);
        this.wreck.push(bub, t);
        this.tweens.add({ targets: bub, scale: K, delay: 600 + i * 200, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: t, scale: 1, delay: 600 + i * 200, duration: 300, ease: 'Back.easeOut' });
      }
    });
  }

  /** Remet le décor en état pour une nouvelle partie. */
  private resetWorld(): void {
    for (const l of this.loops) l.remove();
    this.loops = [];
    for (const o of this.wreck) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.wreck = [];
    this.towerImg.setVisible(true).setAngle(0);
    this.crackImg.setVisible(false).setAngle(0);
    this.pulseLantern();
    this.tweens.killTweensOf(this.owlImg);
    this.owlImg.setPosition(this.owlHome.x, this.owlHome.y).setAngle(0);
  }

  private fireVolley(used: number[], target: number, perfect: boolean, to: Phaser.Math.Vector2, mega: boolean, onImpact: () => void): void {
    const fuse = new Phaser.Math.Vector2(L.towerX - 20, 250);
    const glowKey = mega ? this.tex('b-glow-small-or', () => B.softGlow(40, '#ffc94a')) : this.tex('b-glow-small', () => B.softGlow(40, '#5fd3bc'));
    // Méga-tir : rune dorée, plus grosse.
    const m = mega ? 1.6 : 1;
    let arrived = 0;
    used.forEach((i, k) => {
      const c = this.cubes[i];
      c.num.setVisible(false);
      c.base.setTexture('b-tile-spent');
      const n = this.add.text(c.obj.x, c.obj.y, String(this.shownValues[i]), style(46, B.C.ink, 800)).setOrigin(0.5).setDepth(40);
      const g = this.add.image(c.obj.x, c.obj.y, glowKey).setBlendMode(Phaser.BlendModes.ADD).setDepth(39);
      const start = new Phaser.Math.Vector2(c.obj.x, c.obj.y);
      const curve = new Phaser.Curves.QuadraticBezier(start, new Phaser.Math.Vector2(start.x + 80, start.y - 140), fuse);
      const p = { t: 0 };
      this.tweens.add({
        targets: p,
        t: 1,
        delay: k * 70,
        duration: 340,
        ease: 'Sine.easeIn',
        onUpdate: () => {
          const pt = curve.getPoint(p.t);
          n.setPosition(pt.x, pt.y).setScale(1 - p.t * 0.5).setColor(p.t > 0.4 ? B.C.cream : B.C.ink);
          g.setPosition(pt.x, pt.y);
        },
        onComplete: () => {
          n.destroy();
          g.destroy();
          if (++arrived === used.length) launch();
        },
      });
    });
    const launch = () => {
      const runeKey = mega ? this.tex(`bonus-rune-${target}`, () => Bn.goldRune(target)) : this.tex(`b-rune-${target}`, () => B.rune(target));
      const rune = this.add.image(fuse.x, fuse.y, runeKey).setScale(0).setDepth(45);
      const halo = this.add.image(fuse.x, fuse.y, 'b-glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0).setDepth(44);
      // Anneau discret autour de la rune : rien ne doit masquer le nombre.
      const ring = this.add.circle(fuse.x, fuse.y, 30).setStrokeStyle(4, mega ? 0xffc94a : 0x5fd3bc).setDepth(44);
      this.tweens.add({ targets: ring, scale: 2.2 * m, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
      this.tweens.add({ targets: rune, scale: K * m, duration: 220, ease: 'Back.easeOut' });
      this.tweens.add({ targets: halo, scale: (perfect || mega ? 0.9 : 0.6) * m, duration: 220, ease: 'Sine.easeOut' });
      const trail = this.add.particles(0, 0, glowKey, {
        follow: rune,
        lifespan: 380,
        scale: { start: 0.8 * m, end: 0 },
        alpha: { start: 0.8, end: 0 },
        frequency: mega ? 6 : 12,
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(43);
      this.time.delayedCall(220, () => {
        const start = new Phaser.Math.Vector2(rune.x, rune.y);
        const curve = new Phaser.Curves.QuadraticBezier(start, new Phaser.Math.Vector2((start.x + to.x) / 2, Math.min(start.y, to.y) - 180), to);
        const p = { t: 0 };
        this.tweens.add({ targets: halo, alpha: 0, duration: 200, onComplete: () => halo.destroy() });
        this.tweens.add({
          targets: p,
          t: 1,
          duration: 420,
          ease: 'Quad.easeIn',
          onUpdate: () => {
            const pt = curve.getPoint(p.t);
            rune.setPosition(pt.x, pt.y);
            rune.setScale(K * m * (1 + p.t * 0.15), K * m * (1 - p.t * 0.1));
          },
          onComplete: () => {
            rune.destroy();
            trail.stop();
            this.time.delayedCall(400, () => trail.destroy());
            onImpact();
          },
        });
      });
    };
  }

  // --- Bonus volants -----------------------------------------------------------------------------
  // Deux fois par partie, un engin traverse le ciel avec un calcul : bonne réponse = un bonus
  // rangé dans une niche au pied du phare. Logique dans powerups.ts ; ici, seulement le spectacle.

  private isFrozen(): boolean {
    return this.time.now < this.frozenUntil;
  }

  private buildBonusUi(): void {
    this.tex('bonus-niche', Bn.niche);
    this.tex('bonus-halo', () => B.softGlow(64, '#ffc94a'));
    (['poussee', 'gel', 'supertir'] as PowerKind[]).forEach((k) => this.tex(`bonus-icon-${k}`, () => Bn.powerIcon(k)));
    BONUS.slotX.forEach((x, i) => {
      const box = this.add.container(x, BONUS.slotY).setDepth(61);
      const glow = this.add.image(0, 0, 'bonus-halo').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(1.3);
      const niche = this.add.image(0, 0, 'bonus-niche').setScale(K);
      const icon = this.add.image(0, -1, 'bonus-icon-poussee').setScale(K).setVisible(false);
      const badge = this.add.text(27, 27, i === 0 ? 'B' : 'N', style(14, B.C.cream, 800, 4)).setOrigin(0.5);
      box.add([glow, niche, icon, badge]);
      box.setSize(76, 76).setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        this.sfx.unlock();
        this.usePower(i);
      });
      this.slots.push({ box, icon, glow, pulse: null });
    });

    // Pavé du calcul bonus, sorti seulement pendant le passage d'un engin. Touches sombres et
    // dorées : impossible de les confondre avec les cubes crème de la grille.
    this.keypad = this.add.container(0, 0).setDepth(62).setVisible(false);
    const keyTex = this.tex('bonus-touche', () => Bn.bonusKey(64, 46));
    const eraseTex = this.tex('bonus-touche-efface', () => Bn.bonusKey(64, 100, true));
    this.keypad.add(this.add.text(BONUS.keyX0 + 2 * BONUS.keyPitch, BONUS.keyRows[0] - 40, 'Réponse du bonus', style(17, B.C.saffron, 800, 5)).setOrigin(0.5));
    for (const d of '1234567890') {
      const { x, y } = this.keyPos(d);
      const c = this.add.container(x, y);
      c.add([this.add.image(0, 2, keyTex).setScale(K), this.add.text(0, 0, d, style(28, B.C.saffron, 800)).setOrigin(0.5)]);
      c.setSize(68, 50).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        this.sfx.unlock();
        this.pressFx(c);
        this.bonusKey(d);
      });
      this.keypad.add(c);
    }
    const { x, y } = this.keyPos('efface');
    const er = this.add.container(x, y);
    er.add(this.add.image(0, 2, eraseTex).setScale(K));
    er.setSize(68, 104).setInteractive({ useHandCursor: true });
    er.on('pointerdown', () => {
      this.pressFx(er);
      this.bonusErase();
    });
    this.keypad.add(er);

    this.shards = this.add.particles(0, 0, this.tex('bonus-eclat', Bn.shard), {
      speed: { min: 160, max: 420 },
      angle: { min: 180, max: 360 },
      rotate: { min: 0, max: 360 },
      gravityY: 700,
      lifespan: { min: 600, max: 1000 },
      scale: { start: 0.7, end: 0.4 },
      emitting: false,
    }).setDepth(51);
  }

  private shards!: Phaser.GameObjects.Particles.ParticleEmitter;

  private keyPos(d: string): { x: number; y: number } {
    if (d === 'efface') return { x: BONUS.keyX0 + 5 * BONUS.keyPitch + 6, y: (BONUS.keyRows[0] + BONUS.keyRows[1]) / 2 };
    const k = d === '0' ? 9 : Number(d) - 1;
    return { x: BONUS.keyX0 + (k % 5) * BONUS.keyPitch, y: BONUS.keyRows[Math.floor(k / 5)] };
  }

  private pressFx(c: Phaser.GameObjects.Container): void {
    this.tweens.add({ targets: c, scale: 0.9, duration: 70, yoyo: true, ease: 'Sine.easeOut' });
  }

  private showKeypad(on: boolean): void {
    if (on === this.keypadShown) return;
    this.keypadShown = on;
    this.tweens.killTweensOf(this.keypad);
    if (on) {
      this.keypad.setVisible(true).setAlpha(1).setY(this.reducedMotion ? 0 : 150);
      if (!this.reducedMotion) this.tweens.add({ targets: this.keypad, y: 0, duration: 320, ease: 'Back.easeOut' });
    } else {
      this.tweens.add({ targets: this.keypad, y: 150, alpha: 0, duration: 220, ease: 'Sine.easeIn', onComplete: () => this.keypad.setVisible(false) });
    }
  }

  /** Nouvelle partie : niches vides, plus d'engin ni d'effet en cours. */
  private resetBonus(mode: Mode): void {
    if (this.flightView) this.destroyFlight(this.flightView);
    this.showKeypad(false);
    this.clearIce();
    this.pushing = false;
    this.clearMegaFx();
    this.powers = new PowerUps(this.tier.id, mode, this.seed);
    this.enemyIndex = -1;
    this.arriving.clear();
    this.refreshSlots();
  }

  /** Lance un engin si un passage est prévu et que le moment s'y prête. */
  private bonusTick(time: number): void {
    const p = this.powers;
    const s = this.session;
    const e = this.enemy;
    if (!p || !s || !e || s.phase !== 'play' || this.flightView || this.overlay || e.entering) return;
    if (this.busy || this.pushing || s.enemyHp <= 0 || !p.due(this.enemyIndex)) return;
    if (time - this.enemyArrivedAt < this.passDelay) return;
    // Pas quand le monstre est déjà près du phare : ce serait trop de choses à la fois.
    if (e.obj.x < L.enemyStopX + 260) return;
    const f = p.launch();
    if (f) this.launchFlight(f);
  }

  private launchFlight(f: Flight): void {
    const saucer = f.vehicle === 'soucoupe';
    const box = this.add.container(W + 160, BONUS.y).setDepth(30);
    const loops: Phaser.Tweens.Tween[] = [];
    const aura = this.add.image(0, 46, 'bonus-halo').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setScale(3.2);
    const craft = this.add.image(0, 0, this.tex(`bonus-${f.vehicle}-normal`, () => (saucer ? Bn.saucer('normal') : Bn.blimp('normal')))).setScale(K);
    const crateY = saucer ? 98 : 104;
    const crate = this.add.image(0, crateY, this.tex('bonus-paquet', Bn.crate)).setScale(K);
    let link: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    const parts: Phaser.GameObjects.GameObject[] = [aura];
    if (saucer) {
      link = this.add.image(0, 38, this.tex('bonus-rayon', Bn.tractorBeam)).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7).setScale(0.8, 0.5);
      if (!this.reducedMotion) loops.push(this.tweens.add({ targets: link, alpha: 0.35, duration: 260, yoyo: true, repeat: -1 }));
      parts.push(link, craft);
    } else {
      link = this.add.rectangle(0, 58, 3, 20, 0x1d1a2b).setOrigin(0.5, 0);
      const prop = this.add.image(92, -19, this.tex('bonus-helice', Bn.propeller)).setScale(K);
      if (!this.reducedMotion) loops.push(this.tweens.add({ targets: prop, scaleY: K * 0.2, duration: 60, yoyo: true, repeat: -1 }));
      parts.push(link, craft, prop);
    }

    // Étiquette dorée du calcul, accrochée au paquet.
    const label = this.add.text(0, 1, `${f.expr.text} = ${f.expr.answer}`, style(30, B.C.cream, 800, 6)).setOrigin(0.5);
    if (label.width > 180) label.setFontSize(26);
    const w = Math.ceil((label.width + 80) / 10) * 10;
    label.setText(`${f.expr.text} = ?`);
    const tag = this.add.container(36 + w / 2, crateY + 4);
    const string = this.add.rectangle(-w / 2 - 6, -2, 18, 3, 0x1d1a2b);
    const card = this.add.image(0, 3, this.tex(`bonus-etiquette-${w}`, () => Bn.cartouche(w, 58))).setScale(K);
    const fuse = this.add.rectangle(-(w - 64) / 2, 34, w - 64, 5, 0xffc94a).setOrigin(0, 0.5);
    const badge = this.add.text(-w / 2 + 14, -34, 'BONUS !', style(16, B.C.saffron, 800, 5)).setOrigin(0, 0.5);
    tag.add([string, card, label, fuse, badge]);
    box.add([...parts, crate, tag]);

    const trail = this.add.particles(0, 0, this.tex('b-spark-or', () => B.sparkle('#ffc94a')), {
      follow: box,
      followOffset: { x: 40, y: 40 },
      lifespan: 700,
      speedX: { min: 30, max: 90 },
      speedY: { min: -25, max: 25 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      frequency: this.reducedMotion ? 300 : 40,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(29);

    const fv: FlightView = { box, craft, crate, link, tag, label, fuse, trail, move: null, flight: f, done: false, loops };
    this.flightView = fv;
    const cruise = Math.max(1500, f.durationMs - 450);
    fv.move = this.tweens.add({ targets: box, x: BONUS.enterX, duration: 450, ease: 'Cubic.easeOut', onComplete: () => {
      if (fv.done) return;
      fv.move = this.tweens.add({ targets: box, x: BONUS.leaveX, duration: cruise, onComplete: () => {
        if (!fv.done) this.flightEscape(fv, 'temps');
      } });
    } });
    loops.push(this.tweens.add({ targets: fuse, width: 0, duration: f.durationMs }));
    if (!this.reducedMotion) {
      loops.push(this.tweens.add({ targets: box, y: BONUS.y + 8, duration: 640, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      loops.push(this.tweens.add({ targets: craft, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      loops.push(this.tweens.add({ targets: tag, angle: { from: -3, to: 3 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
    this.sfx.bonusAppear();
    if (saucer) this.sfx.ufo();
    else this.sfx.putt();
    this.showKeypad(true);
    if (!this.bonusExplained) {
      this.bonusExplained = true;
      this.time.delayedCall(500, () => this.toast('Un bonus ! Tape la réponse avant qu’il s’envole'));
    }
  }

  private refreshTag(fv: FlightView): void {
    const f = fv.flight;
    fv.label.setText(`${f.expr.text} = ${f.state === 'caught' ? f.expr.answer : f.typed || '?'}`);
  }

  /** Un chiffre pour le calcul bonus (clavier ou pavé). */
  private bonusKey(d: string): void {
    const p = this.powers;
    const fv = this.flightView;
    if (!p || !fv || fv.done || this.overlay) return;
    const r = p.type(d);
    if (r === 'ignored') return;
    this.sfx.key(Number(d));
    this.refreshTag(fv);
    if (r === 'caught') this.catchFlight(fv);
    else if (r === 'wrong') this.wrongAnswer(fv);
    else if (r === 'escaped') {
      this.wrongAnswer(fv);
      this.flightEscape(fv, 'erreurs');
    }
  }

  /** Efface un chiffre du calcul bonus ; false s'il n'y avait rien à effacer. */
  private bonusErase(): boolean {
    const fv = this.flightView;
    if (!this.powers || !fv || fv.done || !this.powers.erase()) return false;
    this.sfx.deselect();
    this.refreshTag(fv);
    return true;
  }

  private setCraft(fv: FlightView, mood: Bn.Mood): void {
    const v = fv.flight.vehicle;
    fv.craft.setTexture(this.tex(`bonus-${v}-${mood}`, () => (v === 'soucoupe' ? Bn.saucer(mood) : Bn.blimp(mood))));
  }

  private wrongAnswer(fv: FlightView): void {
    this.sfx.buzz();
    fv.label.setColor(B.C.coralLight);
    this.time.delayedCall(380, () => fv.label.active && fv.label.setColor(B.C.cream));
    const x = fv.tag.x;
    this.tweens.add({ targets: fv.tag, x: { from: x - 12, to: x }, duration: 420, ease: 'Elastic.easeOut', easeParams: [2, 0.25] });
    // Le pilote se moque un instant.
    this.setCraft(fv, 'moqueur');
    this.time.delayedCall(500, () => !fv.done && fv.craft.active && this.setCraft(fv, 'normal'));
  }

  /** Bonne réponse : le pilote sursaute, le paquet tombe, s'ouvre, et le bonus file dans sa niche. */
  private catchFlight(fv: FlightView): void {
    const p = this.powers!;
    fv.done = true;
    fv.move?.stop();
    const slot = p.collect();
    const kind = fv.flight.cargo;
    this.showKeypad(false);
    this.sfx.bonusCaught();
    fv.label.setColor('#a8f0b4');
    this.setCraft(fv, 'surpris');
    this.tweens.add({ targets: fv.tag, y: fv.tag.y + 70, angle: 28, alpha: 0, delay: 380, duration: 520, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: fv.link, alpha: 0, duration: 70, yoyo: true, repeat: 2, onComplete: () => fv.link.active && (fv.link as Phaser.GameObjects.Image).setVisible(false) });
    fv.crate.setVisible(false);
    const crate = this.add.image(fv.box.x + fv.crate.x, fv.box.y + fv.crate.y, 'bonus-paquet').setScale(K).setDepth(31);
    if (slot >= 0) {
      this.arriving.add(slot);
      this.dropCrate(crate, kind, slot);
    } else crate.destroy();
    p.endFlight();
    // L'engin, vexé, file sans demander son reste.
    const saucer = fv.flight.vehicle === 'soucoupe';
    if (!this.reducedMotion) this.tweens.add({ targets: fv.craft, angle: { from: -16, to: 16 }, duration: 70, yoyo: true, repeat: 4 });
    this.time.delayedCall(650, () => {
      if (!fv.box.active) return;
      for (const t of fv.loops) t.stop();
      if (saucer) {
        this.sfx.ufo();
        this.tweens.add({ targets: fv.craft, angle: 720, duration: 900, ease: 'Cubic.easeIn' });
        this.tweens.add({ targets: fv.box, x: -260, y: -170, scale: 0.6, duration: 900, ease: 'Cubic.easeIn', onComplete: () => this.destroyFlight(fv) });
      } else {
        // Le ballon se dégonfle et part en zigzag, comme un ballon de baudruche lâché.
        this.sfx.deflate();
        const x0 = fv.box.x;
        const y0 = fv.box.y;
        const q = { t: 0 };
        this.tweens.add({ targets: q, t: 1, duration: 1300, ease: 'Quad.easeIn', onUpdate: () => {
          if (!fv.box.active) return;
          const t = q.t;
          fv.box.setPosition(x0 - 1000 * t + Math.sin(t * 26) * 46, y0 - 300 * t + Math.cos(t * 19) * 34);
          fv.box.setAngle(Math.sin(t * 30) * 35).setScale(1 - 0.35 * t);
        }, onComplete: () => this.destroyFlight(fv) });
      }
    });
  }

  private dropCrate(crate: Phaser.GameObjects.Image, kind: PowerKind, slot: number): void {
    const ground = L.groundY - 6;
    const dur = 300 + (ground - crate.y) * 1.2;
    this.tweens.add({ targets: crate, angle: 360, duration: dur });
    this.tweens.add({ targets: crate, y: ground, duration: dur, ease: 'Quad.easeIn', onComplete: () => {
      this.sfx.crateLand();
      this.dust.explode(this.reducedMotion ? 2 : 8, crate.x, ground + 26);
      this.tweens.add({ targets: crate, y: ground - 46, duration: 210, yoyo: true, ease: 'Quad.easeOut', onComplete: () => {
        this.sfx.crateLand();
        this.dust.explode(this.reducedMotion ? 1 : 4, crate.x, ground + 26);
        this.tweens.add({ targets: crate, scaleX: K * 1.3, scaleY: K * 0.7, duration: 120, yoyo: true, onComplete: () => this.openCrate(crate, kind, slot) });
      } });
    } });
  }

  private openCrate(crate: Phaser.GameObjects.Image, kind: PowerKind, slot: number): void {
    const { x, y } = crate;
    this.sfx.crateOpen();
    this.sparks.explode(this.reducedMotion ? 6 : 22, x, y);
    const ring = this.add.circle(x, y, 24).setStrokeStyle(5, 0xffc94a).setDepth(48);
    this.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    this.tweens.add({ targets: crate, scale: 0, alpha: 0, duration: 200, onComplete: () => crate.destroy() });
    const icon = this.add.image(x, y, `bonus-icon-${kind}`).setScale(0).setDepth(73);
    const name = this.add.text(x, y - 92, `${POWERS[kind].name} !`, style(30, B.C.saffron, 800, 7)).setOrigin(0.5).setDepth(73).setScale(0);
    const hint = this.add.text(x, y - 60, POWERS[kind].hint, style(18, B.C.cream, 700, 5)).setOrigin(0.5).setDepth(73).setAlpha(0);
    this.tweens.add({ targets: icon, scale: K * 1.7, angle: 360, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: name, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: hint, alpha: 1, delay: 200, duration: 250 });
    this.tweens.add({ targets: [name, hint], alpha: 0, delay: 1700, duration: 300, onComplete: () => {
      name.destroy();
      hint.destroy();
    } });
    // Puis le bonus file dans sa niche.
    const to = new Phaser.Math.Vector2(BONUS.slotX[slot], BONUS.slotY);
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x, y), new Phaser.Math.Vector2((x + to.x) / 2, Math.min(y, to.y) - 180), to);
    const q = { t: 0 };
    this.tweens.add({ targets: q, t: 1, delay: 900, duration: 700, ease: 'Sine.easeInOut', onUpdate: () => {
      const pt = curve.getPoint(q.t);
      icon.setPosition(pt.x, pt.y).setScale(K * (1.7 - 0.7 * q.t));
    }, onComplete: () => {
      icon.destroy();
      this.arriving.delete(slot);
      this.refreshSlots(slot);
      this.sfx.slotIn();
      this.sparks.explode(this.reducedMotion ? 4 : 14, to.x, to.y);
      if (this.session?.phase === 'play') this.toast(`${POWERS[kind].name} : touche-la quand tu veux (${slot === 0 ? 'B' : 'N'})`, 'good');
    } });
  }

  /** Temps écoulé ou deux erreurs : l'engin se moque et repart avec son paquet. Aucune pénalité. */
  private flightEscape(fv: FlightView, why: 'temps' | 'erreurs'): void {
    fv.done = true;
    fv.move?.stop();
    this.powers?.expire();
    this.showKeypad(false);
    this.setCraft(fv, 'moqueur');
    this.sfx.taunt();
    const saucer = fv.flight.vehicle === 'soucoupe';
    const bx = Math.max(150, fv.box.x - 150);
    const by = fv.box.y - 20;
    const bub = this.add.image(bx, by, this.tex('w-bubble', () => Wd.bubble(130, 54))).setScale(0).setDepth(74);
    const t = this.add.text(bx, by - 6, saucer ? 'Nananère !' : 'Trop tard !', style(21, B.C.ink, 800)).setOrigin(0.5).setScale(0).setDepth(75);
    this.tweens.add({ targets: bub, scale: K, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, scale: 1, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [bub, t], alpha: 0, delay: 1000, duration: 250, onComplete: () => {
      bub.destroy();
      t.destroy();
    } });
    if (why === 'temps') this.toast('Le bonus s’est envolé… pas grave !');
    this.time.delayedCall(800, () => {
      if (!fv.box.active) return;
      for (const l of fv.loops) l.stop();
      this.tweens.add({ targets: fv.box, x: -320, y: -150, duration: 750, ease: 'Cubic.easeIn', onComplete: () => this.destroyFlight(fv) });
    });
  }

  /** Fin de partie pendant un passage : l'engin s'éclipse sans bruit. */
  private abortFlight(): void {
    this.showKeypad(false);
    const fv = this.flightView;
    if (!fv || fv.done) return;
    fv.done = true;
    fv.move?.stop();
    this.powers?.expire();
    this.tweens.add({ targets: fv.box, y: -220, alpha: 0, duration: 400, ease: 'Cubic.easeIn', onComplete: () => this.destroyFlight(fv) });
  }

  private destroyFlight(fv: FlightView): void {
    fv.done = true;
    for (const t of fv.loops) t.stop();
    fv.move?.stop();
    this.tweens.killTweensOf([fv.box, fv.craft, fv.tag, fv.link]);
    fv.trail.stop();
    this.time.delayedCall(800, () => fv.trail.destroy());
    fv.box.destroy(true);
    if (this.flightView === fv) {
      this.flightView = null;
      this.powers?.endFlight();
    }
  }

  private refreshSlots(pop = -1): void {
    const p = this.powers;
    this.slots.forEach((v, i) => {
      const kind = p && !this.arriving.has(i) ? p.slots[i] : null;
      v.pulse?.stop();
      v.pulse = null;
      this.tweens.killTweensOf([v.icon, v.glow]);
      if (!kind) {
        v.icon.setVisible(false);
        v.glow.setAlpha(0);
        return;
      }
      v.icon.setTexture(`bonus-icon-${kind}`).setVisible(true).setScale(K).setPosition(0, -1).setAngle(0);
      v.glow.setAlpha(0.6).setScale(1.3);
      if (!this.reducedMotion) {
        v.pulse = this.tweens.add({ targets: v.glow, alpha: 0.2, scale: 1.45, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: v.icon, y: -5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        if (i === pop) this.tweens.add({ targets: v.icon, scale: { from: K * 1.7, to: K }, duration: 380, ease: 'Back.easeOut' });
      }
    });
  }

  private slotShake(i: number): void {
    const b = this.slots[i].box;
    this.tweens.add({ targets: b, x: { from: BONUS.slotX[i] - 7, to: BONUS.slotX[i] }, duration: 400, ease: 'Elastic.easeOut', easeParams: [2, 0.3] });
  }

  /** Utilise le bonus d'une niche (clic, toucher, B ou N). Un bonus inutile maintenant est gardé. */
  private usePower(i: number, tries = 0): void {
    const p = this.powers;
    const s = this.session;
    if (!p || !s || s.phase !== 'play' || this.overlay || this.arriving.has(i)) return;
    if (!p.slots[i]) {
      if (tries === 0) this.slotShake(i);
      return;
    }
    const e = this.enemy && s.enemyHp > 0 ? this.enemy : null;
    const c = p.check(i, { enemyX: e ? e.obj.x : null, entering: e?.entering ?? false, frozen: this.isFrozen(), pushing: this.pushing, charged: s.charged });
    if (!c.ok) {
      if (tries === 0) {
        this.toast(c.reason);
        this.slotShake(i);
        this.sfx.miss();
      }
      return;
    }
    // Un tir est en vol : le bonus part juste après l'impact.
    if (this.busy && c.kind !== 'supertir') {
      if (tries < 30) this.time.delayedCall(80, () => this.usePower(i, tries + 1));
      return;
    }
    p.take(i);
    this.refreshSlots();
    const from = { x: BONUS.slotX[i], y: BONUS.slotY };
    if (c.kind === 'poussee') this.superPush(e!);
    else if (c.kind === 'gel') this.freezeEnemy(e!, from);
    else this.chargeMega(from);
  }

  // --- Super Poussée : un gant de boxe à ressort jaillit du phare ---------------------------------
  private superPush(e: EnemyView): void {
    this.pushing = true;
    if (this.ice) this.thaw(e, true);
    e.walking = false;
    const from = e.obj.x;
    const to = pushTarget(from, e.kind);
    const y = e.obj.y - 62 * e.scale;
    const baseX = L.towerX + 30;
    const hitX = from - 40 * e.scale;
    this.sfx.spring();
    this.tweens.add({ targets: this.lanternGlow, alpha: 1, scale: 1.5, duration: 120, yoyo: true });
    const spring = this.add.graphics().setDepth(12);
    const glove = this.add.image(baseX, y, this.tex('bonus-gant', Bn.glove)).setOrigin(1, 0.5).setScale(K * 0.3).setDepth(13);
    const draw = () => {
      spring.clear();
      const x0 = baseX;
      const x1 = glove.x - glove.displayWidth + 14;
      if (x1 <= x0 + 6) return;
      const n = 10;
      const pts: Array<[number, number]> = [];
      for (let k = 0; k <= n; k++) pts.push([x0 + ((x1 - x0) * k) / n, y + (k === 0 || k === n ? 0 : k % 2 ? -14 : 14)]);
      for (const [lw, col] of [[10, 0x1d1a2b], [4, 0xd9dbe6]]) {
        spring.lineStyle(lw, col, 1);
        spring.beginPath();
        spring.moveTo(pts[0][0], pts[0][1]);
        for (const [px, py] of pts) spring.lineTo(px, py);
        spring.strokePath();
      }
    };
    const q = { t: 0 };
    const place = () => {
      glove.x = baseX + (hitX - baseX) * q.t;
      glove.setScale(K * (0.3 + 0.7 * q.t));
      draw();
    };
    this.tweens.add({ targets: q, t: 1, duration: 240, ease: 'Cubic.easeIn', onUpdate: place, onComplete: () => {
      this.punchFx(hitX, y);
      if (this.enemy === e && e.obj.active) this.launchEnemy(e, to);
      else this.pushing = false;
      this.tweens.add({ targets: q, t: 0, delay: 180, duration: 420, ease: 'Sine.easeInOut', onUpdate: place, onComplete: () => {
        glove.destroy();
        spring.destroy();
      } });
    } });
  }

  private punchFx(x: number, y: number): void {
    this.sfx.punch();
    this.sparks.explode(this.reducedMotion ? 8 : 34, x, y);
    this.dust.explode(this.reducedMotion ? 3 : 12, x + 30, L.groundY + 14);
    const bang = this.add.image(x + 6, y - 12, this.tex('bonus-paf', Bn.bang)).setScale(0).setAngle(-12).setDepth(72);
    const word = this.add.text(x + 6, y - 14, 'PAF !', style(40, B.C.ink, 800)).setOrigin(0.5).setScale(0).setAngle(-12).setDepth(73);
    this.tweens.add({ targets: bang, scale: K * 1.1, duration: 150, ease: 'Back.easeOut' });
    this.tweens.add({ targets: word, scale: 1, duration: 150, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [bang, word], alpha: 0, scale: '*=1.2', delay: 520, duration: 260, onComplete: () => {
      bang.destroy();
      word.destroy();
    } });
    // Onde de choc au sol.
    const wave = this.add.ellipse(x + 20, L.groundY + 20, 70, 20).setStrokeStyle(5, 0xffc94a).setDepth(9);
    this.tweens.add({ targets: wave, scaleX: 8, scaleY: 3, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => wave.destroy() });
    if (!this.reducedMotion) {
      this.cameras.main.shake(260, 0.012);
      const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xfff6dc, 0.25).setDepth(80).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
    }
  }

  /** Le monstre s'envole vers le fond en tournoyant (le Roi glisse en freinant des talons). */
  private launchEnemy(e: EnemyView, to: number): void {
    const heavy = e.kind === 'roi';
    const roll = e.kind === 'carapacon';
    const from = e.obj.x;
    const h = heavy ? 0 : roll ? 34 : 150;
    const spin = heavy ? 0 : roll ? 1080 : 720;
    const dur = heavy ? 950 : 780;
    const bodyH = Wd.CREATURE_H * e.scale;
    const lifted = e.obj.list.filter((o) => o !== e.shadow) as unknown as Phaser.GameObjects.Image[];
    e.body.setOrigin(0.5, 0.5).setY(2 - bodyH / 2);
    e.sign.y = e.signY;
    const base = lifted.map((o) => o.y);
    const eyes = EYES[e.kind].map(() => this.add.image(0, 0, this.tex('bonus-oeil', Bn.bigEye)).setScale(K * e.scale * 1.15));
    e.obj.add(eyes);
    const placeEyes = () => {
      const a = Phaser.Math.DegToRad(e.body.angle);
      EYES[e.kind].forEach(([ex, ey], k) => {
        const dx = ex * e.scale;
        const dy = ey * e.scale;
        eyes[k].setPosition(e.body.x + dx * Math.cos(a) - dy * Math.sin(a), e.body.y + dx * Math.sin(a) + dy * Math.cos(a)).setAngle(e.body.angle);
      });
    };
    placeEyes();
    if (heavy) this.sfx.bump();
    else this.sfx.fly();
    const q = { t: 0 };
    this.tweens.add({ targets: q, t: 1, duration: dur, onUpdate: () => {
      if (!e.obj.active) return;
      const t = q.t;
      const ease = 1 - Math.pow(1 - t, 2.4);
      e.obj.x = from + (to - from) * ease;
      const lift = -Math.sin(Math.PI * t) * h;
      lifted.forEach((o, k) => (o.y = base[k] + lift));
      e.body.angle = heavy ? Math.sin(t * 30) * 7 : spin * ease;
      if (!this.reducedMotion) e.sign.angle = Phaser.Math.Between(-16, 16);
      e.shadow.setScale(K * e.scale * (1 - (h ? (0.5 * -lift) / h : 0)));
      placeEyes();
      if (heavy && Math.random() < 0.35) this.dust.explode(1, e.obj.x - 30, e.obj.y - 4);
    }, onComplete: () => this.landEnemy(e, eyes, lifted, base) });
  }

  private landEnemy(e: EnemyView, eyes: Phaser.GameObjects.Image[], lifted: Phaser.GameObjects.Image[], base: number[]): void {
    const cleanup = () => eyes.forEach((o) => o.destroy());
    if (!e.obj.active) {
      this.pushing = false;
      return;
    }
    lifted.forEach((o, k) => (o.y = base[k]));
    e.body.setOrigin(0.5, 1).setY(2).setAngle(0);
    e.sign.setAngle(0).setY(e.signY);
    e.shadow.setScale(K * e.scale);
    // Les yeux restent exorbités encore un moment.
    EYES[e.kind].forEach(([ex, ey], k) => eyes[k].setPosition(ex * e.scale, 2 - Wd.CREATURE_H * e.scale / 2 + ey * e.scale).setAngle(0));
    this.sfx.thud();
    this.dust.explode(this.reducedMotion ? 4 : 18, e.obj.x, L.groundY + 14);
    if (!this.reducedMotion) {
      this.cameras.main.shake(140, 0.005);
      this.tweens.add({ targets: e.body, scaleX: K * e.scale * 1.22, scaleY: K * e.scale * 0.74, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
    }
    // Étoiles qui tournent autour de la tête, et une petite réplique vexée.
    const stars = [0, 1, 2].map(() => this.add.image(0, 0, this.tex('b-spark-or', () => B.sparkle('#ffc94a'))).setScale(0.9));
    e.obj.add(stars);
    const headY = 2 - Wd.CREATURE_H * e.scale * 0.92;
    const q = { t: 0 };
    this.tweens.add({ targets: q, t: 1, duration: 1500, onUpdate: () => {
      stars.forEach((st, k) => {
        const a = q.t * Math.PI * 6 + (k * Math.PI * 2) / 3;
        st.setPosition(Math.cos(a) * 38 * e.scale, headY + Math.sin(a) * 10);
      });
    } });
    const line = { mordillon: 'Ouille !', trotteur: 'Hé ho !', carapacon: 'Ça tourne…', roi: 'Grrr !' }[e.kind];
    const bx = e.obj.x;
    const by = e.obj.y + e.signY - 124;
    const bub = this.add.image(bx, by, this.tex('w-bubble', () => Wd.bubble(130, 54))).setScale(0).setDepth(74);
    const t = this.add.text(bx, by - 6, line, style(21, B.C.ink, 800)).setOrigin(0.5).setScale(0).setDepth(75);
    this.tweens.add({ targets: [bub], scale: K, delay: 150, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [t], scale: 1, delay: 150, duration: 240, ease: 'Back.easeOut' });
    this.time.delayedCall(800, () => {
      if (e.kind === 'roi') this.sfx.growl();
      else this.sfx.ouch();
    });
    this.time.delayedCall(1550, () => {
      cleanup();
      stars.forEach((st) => st.destroy());
      bub.destroy();
      t.destroy();
      this.pushing = false;
      if (this.enemy === e && e.obj.active && (this.session?.enemyHp ?? 0) > 0) e.walking = true;
    });
  }

  // --- Gel : le monstre est pris dans un bloc de glace --------------------------------------------
  private freezeEnemy(e: EnemyView, from: { x: number; y: number }): void {
    const s = this.session!;
    this.sfx.freeze();
    const flake = this.add.image(from.x, from.y, 'bonus-icon-gel').setScale(K * 1.3).setDepth(73);
    const target = new Phaser.Math.Vector2(e.obj.x, e.obj.y - 70 * e.scale);
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(from.x, from.y), new Phaser.Math.Vector2((from.x + target.x) / 2, target.y - 240), target);
    const q = { t: 0 };
    this.tweens.add({ targets: q, t: 1, duration: 450, ease: 'Sine.easeIn', onUpdate: () => {
      const pt = curve.getPoint(q.t);
      flake.setPosition(pt.x, pt.y).setAngle(q.t * 540);
    }, onComplete: () => {
      flake.destroy();
      if (this.enemy !== e || !e.obj.active || (this.session?.enemyHp ?? 0) <= 0) return;
      this.encase(e, freezeMs(s.mode));
    } });
  }

  private encase(e: EnemyView, ms: number): void {
    this.clearIce();
    this.frozenUntil = this.time.now + ms;
    const cx = e.obj.x;
    const cy = e.obj.y - 70 * e.scale;
    this.shards.explode(this.reducedMotion ? 4 : 16, cx, cy);
    const ring = this.add.circle(cx, cy, 30).setStrokeStyle(6, 0xbfefff).setDepth(48);
    this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 500, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    e.body.setTint(0xa8e4ff);
    const w = Math.round(124 * e.scale);
    const h = Math.round(150 * e.scale);
    const img = this.add.image(0, 8, this.tex(`bonus-glace-${w}-${h}`, () => Bn.iceBlock(w, h, false))).setOrigin(0.5, 1).setScale(K, this.reducedMotion ? K : 0);
    e.obj.addAt(img, 2);
    if (!this.reducedMotion) this.tweens.add({ targets: img, scaleY: K, duration: 280, ease: 'Back.easeOut' });
    const frost = this.add.particles(0, 0, this.tex('b-spark-glace', () => B.sparkle('#e8fbff')), {
      x: { min: cx - 55 * e.scale, max: cx + 55 * e.scale },
      y: { min: e.obj.y - 150 * e.scale, max: e.obj.y - 10 },
      lifespan: 900,
      speedY: { min: -14, max: 4 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.9, end: 0 },
      frequency: this.reducedMotion ? 600 : 130,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(14);
    const timers = [
      this.time.delayedCall(Math.max(0, ms - 1300), () => {
        img.setTexture(this.tex(`bonus-glace-${w}-${h}-f`, () => Bn.iceBlock(w, h, true)));
        if (!this.reducedMotion) this.tweens.add({ targets: img, angle: { from: -2, to: 2 }, duration: 60, yoyo: true, repeat: 9 });
      }),
      this.time.delayedCall(ms, () => this.thaw(e, true)),
    ];
    this.ice = { img, frost, timers };
    this.toast(`Gelé pendant ${ms / 1000} secondes !`, 'good');
  }

  private clearIce(): void {
    const ice = this.ice;
    this.ice = null;
    this.frozenUntil = 0;
    if (!ice) return;
    for (const t of ice.timers) t.remove();
    ice.frost.stop();
    this.time.delayedCall(1000, () => ice.frost.destroy());
    this.tweens.killTweensOf(ice.img);
    ice.img.destroy();
  }

  /** Fin du gel (ou glace brisée par un coup) : éclats et retour des couleurs. */
  private thaw(e: EnemyView, broken: boolean): void {
    if (!this.ice) return;
    this.clearIce();
    if (e.body.active) e.body.clearTint();
    if (broken && e.obj.active) {
      this.sfx.shatter();
      this.shards.explode(this.reducedMotion ? 5 : 22, e.obj.x, e.obj.y - 70 * e.scale);
    }
  }

  // --- Méga-tir : la lanterne du phare se charge d'or ------------------------------------------------
  private chargeMega(from: { x: number; y: number }): void {
    const s = this.session!;
    s.charged = true;
    this.sfx.megaCharge();
    const icon = this.add.image(from.x, from.y, 'bonus-icon-supertir').setScale(K * 1.3).setDepth(73);
    const to = new Phaser.Math.Vector2(L.towerX, this.lanternGlow.y);
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(from.x, from.y), new Phaser.Math.Vector2(from.x + 160, (from.y + to.y) / 2), to);
    const q = { t: 0 };
    this.tweens.add({ targets: q, t: 1, duration: 550, ease: 'Sine.easeInOut', onUpdate: () => {
      const pt = curve.getPoint(q.t);
      icon.setPosition(pt.x, pt.y).setAngle(q.t * 360);
    }, onComplete: () => {
      icon.destroy();
      this.sparks.explode(this.reducedMotion ? 5 : 20, to.x, to.y);
      this.applyMegaFx();
      this.toast('Méga-tir prêt : ton prochain tir frappe ×2 !', 'good');
    } });
  }

  private applyMegaFx(): void {
    if (!this.session?.charged) return;
    this.lanternGlow.setTexture(this.tex('b-glow-or', () => B.softGlow(128, '#ffc94a')));
    this.megaAura?.destroy();
    this.megaAura = this.add.image(this.launchButton.x, this.launchButton.y + 3, this.tex('bonus-halo-bouton', () => B.softGlow(100, '#ffc94a'))).setBlendMode(Phaser.BlendModes.ADD).setDepth(59).setScale(1.7, 0.75).setAlpha(0.8);
    if (!this.reducedMotion) this.tweens.add({ targets: this.megaAura, alpha: 0.35, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private clearMegaFx(): void {
    this.lanternGlow?.setTexture('b-glow');
    if (this.megaAura) {
      this.tweens.killTweensOf(this.megaAura);
      this.megaAura.destroy();
      this.megaAura = null;
    }
  }

  /** Impact du Méga-tir : tampon doré et gerbe d'étincelles en plus. */
  private megaImpact(at: Phaser.Math.Vector2): void {
    this.clearMegaFx();
    const x = Phaser.Math.Clamp(at.x - 70, 700, W - 200);
    const stamp = this.add.text(x, at.y - 160, 'MÉGA !', { ...style(62, B.C.saffron, 800, 9), stroke: '#e8424f' }).setOrigin(0.5).setDepth(72).setAngle(6);
    if (this.reducedMotion) {
      this.time.delayedCall(900, () => stamp.destroy());
    } else {
      stamp.setScale(2.4).setAlpha(0);
      this.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
      this.tweens.add({ targets: stamp, y: stamp.y - 30, alpha: 0, delay: 800, duration: 350, onComplete: () => stamp.destroy() });
      this.fireworkBurst(at.x - 40, at.y - 230, ['#ffc94a', '#ffffff', '#ff8fb1']);
      this.sfx.firework(0.1);
    }
  }

  private impactFx(at: Phaser.Math.Vector2, perfect: boolean): void {
    this.sparks.explode(this.reducedMotion ? 6 : perfect ? 30 : 16, at.x, at.y);
    this.dust.explode(this.reducedMotion ? 2 : 8, at.x, at.y + 30);
    const ring = this.add.circle(at.x, at.y, 20).setStrokeStyle(6, perfect ? 0xffc94a : 0x5fd3bc).setDepth(48);
    this.tweens.add({ targets: ring, scale: perfect ? 4.5 : 3, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    if (!this.reducedMotion) {
      this.cameras.main.shake(perfect ? 150 : 90, perfect ? 0.005 : 0.0025);
      if (perfect) {
        const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xfff6dc, 0.14).setDepth(80).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: flash, alpha: 0, duration: 160, onComplete: () => flash.destroy() });
      }
    }
  }
}
