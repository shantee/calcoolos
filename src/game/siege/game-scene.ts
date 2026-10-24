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
import { SiegeSession } from './session';
import { Sfx } from '../sfx';
import { TIERS, type Tier, type TierId } from '../../core/difficulty';
import { ARCHETYPES, MODES, WAVES, type EnemyKind, type Mode } from '../../core/waves';

export const W = 1280;
export const H = 720;
const K = 1 / B.RES;

const L = {
  gridX: 48,
  gridY: 236,
  pitchX: 94,
  pitchY: 98,
  cube: 84,
  sumY: 184,
  buttonsY: 672,
  towerX: 520,
  groundY: 566,
  enemyStartX: 1380,
  enemyEnterX: 1130,
  enemyStopX: 640,
  moonX: 1010,
  moonY: 150,
};

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
}

const RECORD_KEY = 'calcoolos.cubes.records';

export class CubesDeSiegeScene extends Phaser.Scene {
  private tier!: Tier;
  private seed = 1;
  private session: SiegeSession | null = null;
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

    this.buildWorld();
    this.buildCritters();
    this.buildHud();
    this.buildGrid();
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
    };
  }

  update(time: number, delta: number): void {
    const e = this.enemy;
    if (!e || !this.session) return;
    if (this.enemyWalking && e.walking) {
      e.obj.x -= (this.session.enemySpeed * delta) / 1000;
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
    if (!this.reducedMotion) this.tweens.add({ targets: this.lanternGlow, alpha: 0.8, scale: 1.1, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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

  /** Petits habitants : lune, chouette, escargot, poisson volant. Tous cliquables. */
  private buildCritters(): void {
    // La lune dort ; elle fait un clin d'œil aux coups parfaits et rougit si on la touche.
    ['dort', 'clin', 'rougit'].forEach((s) => this.tex(`w-moon-${s}`, () => Wd.moonFace(s as 'dort')));
    this.moonFace = this.add.image(L.moonX, L.moonY + 6, 'w-moon-dort').setScale(K).setDepth(2);
    const moonHit = this.add.zone(L.moonX, L.moonY, 150, 150).setInteractive({ useHandCursor: true }).setDepth(2);
    moonHit.on('pointerdown', () => this.moonReact('rougit', 1600));

    // La chouette du phare.
    ['ouvert', 'cligne', 'contente'].forEach((s) => this.tex(`w-owl-${s}`, () => Wd.owl(s as 'ouvert')));
    const owlY = L.groundY + 26 - B.TOWER_H + 102;
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
    this.makeButton(L.gridX + 278, L.buttonsY, 'Lancer !', true, () => this.validate());
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
  private openOverlay(h: number): Phaser.GameObjects.Container {
    this.closeOverlay();
    const c = this.add.container(0, 0).setDepth(100);
    const veil = this.add.rectangle(W / 2, H / 2, W, H, 0x0b1a2b, 0.62).setInteractive();
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
    const c = this.openOverlay(520);
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
    this.overlayButton(W / 2 - 130, top + 440, 'Accueil', false, () => {
      window.location.href = '../index.html';
    });
    this.overlayButton(W / 2 + 130, top + 440, 'Rejouer', true, () => this.showIntro());
    if (won) {
      this.sfx.victory();
      this.moonReact('clin', 4000);
      if (!this.reducedMotion) for (let i = 0; i < 4; i++) this.time.delayedCall(i * 250, () => this.sparks.explode(18, Phaser.Math.Between(300, 980), Phaser.Math.Between(120, 300)));
    }
  }

  // --- Partie ---------------------------------------------------------------------------------
  private startGame(mode: Mode): void {
    this.closeOverlay();
    this.enemy?.obj.destroy();
    for (const o of this.enemy?.extras ?? []) o.destroy();
    this.enemy = null;
    this.warnedArmor = false;
    this.seed = (this.seed * 7919 + 13) % 1e9;
    this.session = new SiegeSession(this.tier, this.seed, mode);
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
    if (!s || s.phase !== 'play') return;
    const a = s.nextEnemy(this.time.now);
    if (!a) {
      if (s.nextWave()) this.announceWave();
      else this.showEnd(true);
      return;
    }
    this.enemy = this.makeEnemy(a.kind);
    this.setEnemyTarget(this.enemy, s.round.target, false);
    this.enemyWalking = false;
    this.tweens.add({
      targets: this.enemy.obj,
      x: L.enemyEnterX,
      duration: 1300,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.enemyWalking = true;
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
    kb.on('keydown-BACKSPACE', () => this.clearSelection());
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
    const obj = this.add.container(L.enemyStartX, L.groundY + 22).setDepth(10);
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
    return { kind, obj, body, sign, bar, barBg, shadow, extras: [], scale, signY, frame: 0, acc: 0, walking: true };
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
    if (!e.walking) return;
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
    this.time.delayedCall(70, () => e.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
  }

  // --- Validation et tir --------------------------------------------------------------------------
  private validate(): void {
    const s = this.session;
    if (this.busy || !s || this.overlay || !this.enemy) return;
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
    const e = this.enemy;
    const perfect = out.result.perfect;
    const to = new Phaser.Math.Vector2(e.obj.x - 4, e.obj.y - 70 * e.scale);
    this.sfx.fuse();
    this.time.delayedCall(260, () => this.sfx.whoosh());
    this.fireVolley(out.used, out.target, perfect, to, () => {
      this.sfx.impact(perfect);
      const at = new Phaser.Math.Vector2(e.obj.x - 4, e.obj.y - 70 * e.scale);
      this.impactFx(at, perfect);
      this.flash(e);
      if (perfect) {
        this.sfx.perfect();
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
      this.floatDamage(to.x + 90, to.y - 10, res.damage, perfect);
      if (perfect) this.toast(s.round.combo > 1 ? `Parfait ! Série ×${s.round.combo}` : 'Parfait !', 'perfect');
      else if (res.armoredHalved) this.toast('La carapace a amorti le coup !', 'good');
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
          this.refreshEquation();
        });
      }
    });
  }

  private killEnemy(e: EnemyView, done: () => void): void {
    e.walking = false;
    this.flash(e);
    this.sparks.explode(this.reducedMotion ? 6 : 36, e.obj.x, e.obj.y - 70);
    this.dust.explode(this.reducedMotion ? 2 : 10, e.obj.x, e.obj.y - 10);
    const bounty = this.session?.enemy?.bounty;
    if (bounty) {
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
    this.sfx.bump();
    this.flash(e);
    this.towerImg.setTint(0xffb08f);
    this.time.delayedCall(140, () => this.towerImg.clearTint());
    this.tweens.add({ targets: this.towerImg, angle: { from: -2, to: 0 }, duration: 500, ease: 'Elastic.easeOut' });
    this.tweens.add({ targets: this.lanternGlow, alpha: 0.1, duration: 90, yoyo: true, repeat: 2 });
    if (!this.reducedMotion) this.cameras.main.shake(180, 0.004);
    const leaves = s.enemyReachedTower();
    if (!leaves) {
      // Mode Tranquille : le monstre est repoussé et revient.
      this.toast('Le phare le repousse !');
      this.tweens.add({ targets: e.obj, x: L.enemyStopX + 260, duration: 700, ease: 'Cubic.easeOut', onComplete: () => {
        this.enemyWalking = true;
      } });
      return;
    }
    // Mode Défi : un cœur perdu, le monstre s'enfuit en ricanant.
    this.refreshHearts();
    const lost = this.hearts[s.hearts ?? 0];
    if (lost && !this.reducedMotion) this.tweens.add({ targets: lost, scale: { from: K * 1.6, to: K }, duration: 400, ease: 'Back.easeOut' });
    this.toast(s.phase === 'lost' ? 'Plus de cœurs !' : 'Aïe, le phare perd un cœur');
    for (const i of s.round.selected) this.setCubeSelected(i, false);
    s.round.clear();
    this.refreshEquation();
    this.busy = true;
    e.walking = false;
    e.body.setFlipX(true);
    this.tweens.add({ targets: e.obj, x: W + 200, duration: 1200, ease: 'Quad.easeIn', onComplete: () => {
      e.obj.destroy();
      if (this.enemy === e) this.enemy = null;
      if (s.phase === 'lost') {
        this.showEnd(false);
        return;
      }
      this.busy = false;
      this.spawnNext();
    } });
  }

  private fireVolley(used: number[], target: number, perfect: boolean, to: Phaser.Math.Vector2, onImpact: () => void): void {
    const fuse = new Phaser.Math.Vector2(L.towerX - 20, 250);
    const glowKey = this.tex('b-glow-small', () => B.softGlow(40, '#5fd3bc'));
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
      const rune = this.add.image(fuse.x, fuse.y, this.tex(`b-rune-${target}`, () => B.rune(target))).setScale(0).setDepth(45);
      const halo = this.add.image(fuse.x, fuse.y, 'b-glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0).setDepth(44);
      this.sparks.explode(this.reducedMotion ? 2 : 5, fuse.x, fuse.y);
      this.tweens.add({ targets: rune, scale: K, duration: 220, ease: 'Back.easeOut' });
      this.tweens.add({ targets: halo, scale: perfect ? 0.9 : 0.6, duration: 220, ease: 'Sine.easeOut' });
      const trail = this.add.particles(0, 0, glowKey, {
        follow: rune,
        lifespan: 380,
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.8, end: 0 },
        frequency: 12,
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
            rune.setScale(K * (1 + p.t * 0.15), K * (1 - p.t * 0.1));
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
