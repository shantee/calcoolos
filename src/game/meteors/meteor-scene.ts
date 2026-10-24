/**
 * « Pluie de météores » — jeu d'arcade spatial.
 *
 * Des météores rouges et des robots tombent vers la station en portant un calcul.
 * On tape le résultat (pavé à l'écran ou clavier) : le vaisseau vise et tire.
 * Toute la logique est dans session.ts ; ici on ne fait que montrer et animer.
 */
import Phaser from 'phaser';
import * as B from '../../art/variant-b';
import * as Sp from '../../art/space';
import { Sfx } from '../sfx';
import { Fireworks } from '../fx';
import { MeteorSession, METEOR_MODES, type Meteor, type MeteorEvent } from './session';
import { TIERS, type Tier, type TierId } from '../../core/difficulty';
import type { Mode } from '../../core/waves';

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

function style(size: number, color: string, weight = 700, stroke = 0): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: B.FONT, fontSize: `${size}px`, fontStyle: String(weight), color, stroke: B.C.ink, strokeThickness: stroke, resolution: 2 };
}

interface MeteorView {
  m: Meteor;
  obj: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  plate: Phaser.GameObjects.Image;
  trail: Phaser.GameObjects.Particles.ParticleEmitter | null;
  counter: Phaser.GameObjects.Text | null;
}

const RECORD_KEY = 'calcoolos.meteores.records';

export class MeteorScene extends Phaser.Scene {
  private tier!: Tier;
  private seed = 1;
  private session: MeteorSession | null = null;
  private sfx = new Sfx();
  private reducedMotion = false;
  private speedBoost = 1;
  private views = new Map<number, MeteorView>();
  private fx!: Fireworks;
  private ship!: Phaser.GameObjects.Container;
  private flame!: Phaser.GameObjects.Image;
  private stationImg!: Phaser.GameObjects.Image;
  private dome!: Phaser.GameObjects.Ellipse;
  private stars: Phaser.GameObjects.TileSprite[] = [];
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fire!: Phaser.GameObjects.Particles.ParticleEmitter;
  private shards: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private soundText!: Phaser.GameObjects.Text;
  private readout!: Phaser.GameObjects.Text;
  private shieldIcons: Phaser.GameObjects.Image[] = [];
  private keys: Phaser.GameObjects.Container[] = [];
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayButtons: Array<{ c: Phaser.GameObjects.Container; run: () => void }> = [];
  private overlayFocus = 0;
  private keyboardUsed = false;
  private wreck: Phaser.GameObjects.GameObject[] = [];
  private loops: Phaser.Time.TimerEvent[] = [];
  private ending = false;

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
    this.buildHud();
    this.buildKeypad();
    this.bindKeys();
    this.input.on('pointerdown', () => this.sfx.unlock());
    this.showIntro();

    (window as unknown as { __meteores: unknown }).__meteores = {
      session: () => this.session,
      start: (mode: Mode) => this.startGame(mode),
      type: (s: string) => [...s].forEach((d) => this.onDigit(d)),
      overlay: () => this.overlay !== null,
      ending: () => this.ending,
    };
  }

  // --- Décor ---------------------------------------------------------------------------------
  private buildWorld(): void {
    this.add.image(0, 0, this.tex('s-bg', () => Sp.spaceBackground(W, H))).setOrigin(0);
    // Trois couches d'étoiles en parallaxe : on file à travers l'espace.
    [
      { n: 60, size: 1, seed: 1, alpha: 0.6 },
      { n: 30, size: 2, seed: 2, alpha: 0.8 },
      { n: 12, size: 3, seed: 3, alpha: 0.9 },
    ].forEach((l, i) => {
      const t = this.add.tileSprite(0, 0, W, H - 90, this.tex(`s-stars-${i}`, () => Sp.starLayer(512, 512, l.n, l.size, l.seed))).setOrigin(0).setAlpha(l.alpha);
      this.stars.push(t);
    });
    this.stationImg = this.add.image((F.left + F.right) / 2, F.stationY + 96, this.tex('s-station', Sp.station)).setOrigin(0.5, 1).setScale(K).setDepth(5);
    // Bouclier de la station.
    this.dome = this.add.ellipse((F.left + F.right) / 2, F.stationY + 60, 860, 150).setStrokeStyle(4, 0x5fd3bc, 0.5).setFillStyle(0x5fd3bc, 0.06).setDepth(4);
    if (!this.reducedMotion) this.tweens.add({ targets: this.dome, alpha: 0.6, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Vaisseau.
    this.tex('s-flame-0', () => Sp.thruster(0));
    this.tex('s-flame-1', () => Sp.thruster(1));
    this.flame = this.add.image(0, 50, 's-flame-0').setOrigin(0.5, 0).setScale(K);
    const hull = this.add.image(0, 0, this.tex('s-ship', Sp.ship)).setScale(K);
    this.ship = this.add.container((F.left + F.right) / 2, F.shipY, [this.flame, hull]).setDepth(20);
    let f = 0;
    this.time.addEvent({ delay: 90, loop: true, callback: () => {
      f = 1 - f;
      this.flame.setTexture(`s-flame-${f}`);
    } });
    if (!this.reducedMotion) this.tweens.add({ targets: hull, y: -5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Particules partagées.
    this.sparks = this.add.particles(0, 0, this.tex('b-spark-0', () => B.sparkle('#fff6dc')), {
      speed: { min: 120, max: 420 },
      angle: { min: 0, max: 360 },
      rotate: { min: 0, max: 360 },
      lifespan: { min: 300, max: 700 },
      scale: { start: 0.8, end: 0 },
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(50);
    this.fire = this.add.particles(0, 0, this.tex('s-fire', () => B.softGlow(30, '#ff8a3d')), {
      speed: { min: 30, max: 160 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 300, max: 650 },
      scale: { start: 1.2, end: 2.6 },
      alpha: { start: 0.9, end: 0 },
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
  }

  update(_time: number, delta: number): void {
    const dt = (delta / 1000) * this.speedBoost;
    if (!this.reducedMotion) this.stars.forEach((t, i) => (t.tilePositionY -= (delta / 1000) * (20 + i * 35)));
    const s = this.session;
    if (!s || this.overlay || this.ending) return;
    for (const ev of s.update(dt)) this.onEvent(ev);
    for (const v of [...this.views.values()]) {
      // Filet de sécurité : un météore mort ne reste jamais affiché.
      if (!v.m.alive && !this.scheduled.has(v.m.id)) this.explode(v.m, false);
      else this.placeView(v);
    }
  }

  private fieldX(x: number): number {
    return F.left + 50 + x * (F.right - F.left - 100);
  }

  private fieldY(p: number): number {
    return F.top + p * (F.stationY - F.top);
  }

  private placeView(v: MeteorView): void {
    const { m } = v;
    v.obj.setPosition(this.fieldX(m.x), m.kind === 'boss' ? 130 + m.p * (F.stationY - 260) : this.fieldY(m.p));
    if (m.kind === 'rocher' || m.kind === 'dore') v.body.rotation += 0.01;
  }

  // --- Interface ------------------------------------------------------------------------------
  private buildHud(): void {
    this.scoreText = this.add.text(30, 20, 'Score 0', style(30, B.C.cream, 800, 6)).setDepth(60);
    this.comboText = this.add.text(30, 60, '', style(22, B.C.saffron, 800, 5)).setDepth(60);
    // Colonne de droite : vague et boucliers ; le terrain reste dégagé pour les météores.
    this.waveText = this.add.text(F.panelX + F.panelW / 2, 22, '', style(24, B.C.cream, 800, 5)).setOrigin(0.5, 0).setDepth(60);
    this.soundText = this.add.text(F.panelX + F.panelW / 2, F.panelY + F.panelH - 26, '', style(16, B.C.cream, 700, 4)).setOrigin(0.5).setDepth(60).setInteractive({ useHandCursor: true });
    this.soundText.on('pointerdown', () => {
      this.sfx.unlock();
      this.setMuted(this.sfx.toggle());
    });
    this.setMuted(this.sfx.muted);
    this.tex('s-shield-1', () => Sp.shieldIcon(true));
    this.tex('s-shield-0', () => Sp.shieldIcon(false));
  }

  private setMuted(m: boolean): void {
    this.soundText.setText(m ? 'Son : coupé (M)' : 'Son : activé (M)');
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

  private refreshScore(): void {
    const s = this.session;
    if (!s) return;
    this.scoreText.setText(`Score ${s.score}`);
    this.comboText.setText(s.combo > 1 ? `Combo ×${s.combo}` : '');
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
        this.tweens.add({ targets: c, scale: 0.92, duration: 60, yoyo: true });
        if (label === '⌫') this.onBackspace();
        else this.onDigit(label);
      });
      this.keys.push(c);
    });
    this.add.text(F.panelX + F.panelW / 2, F.panelY + F.panelH - 58, 'ou tape au clavier', style(14, '#9fc9c2', 600)).setOrigin(0.5).setDepth(31);
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
      if (e.key === 'm' || e.key === 'M') {
        this.sfx.unlock();
        this.setMuted(this.sfx.toggle());
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

  // --- Saisie et tir --------------------------------------------------------------------------
  private onDigit(d: string): void {
    const s = this.session;
    if (!s || this.overlay || this.ending) return;
    this.sfx.unlock();
    this.sfx.key(Number(d));
    const r = s.input(d);
    if (r.kind === 'pending') {
      this.refreshReadout();
      return;
    }
    if (r.kind === 'error') {
      this.sfx.buzz();
      this.readout.setText(`= ${r.typed}`).setColor(B.C.coralLight);
      if (!this.reducedMotion) this.tweens.add({ targets: this.readout, x: { from: this.readout.x - 8, to: this.readout.x }, duration: 360, ease: 'Elastic.easeOut' });
      this.time.delayedCall(380, () => this.refreshReadout());
      this.refreshScore();
      return;
    }
    this.refreshReadout();
    this.refreshScore();
    this.fireAt(r.meteor, r.points, r.destroyed, r.bossDone);
  }

  private onBackspace(): void {
    this.session?.backspace();
    this.refreshReadout();
  }

  /**
   * Le vaisseau tire au laser et le(s) météore(s) explose(nt) tout de suite.
   * Le déplacement du vaisseau vers la cible est purement décoratif : un nouveau
   * tir ne doit jamais annuler l'explosion du précédent.
   */
  private fireAt(target: Meteor, points: number, destroyed: Meteor[], bossDone: boolean): void {
    const v = this.views.get(target.id);
    if (!v) return;
    const tx = v.obj.x;
    const ty = v.obj.y;
    this.tweens.killTweensOf(this.ship);
    this.ship.setY(F.shipY);
    this.tweens.add({ targets: this.ship, x: Phaser.Math.Clamp(tx, F.left + 60, F.right - 60), duration: 140, ease: 'Quad.easeOut' });
    this.sfx.laser();
    const g = this.add.graphics().setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
    const sx = this.ship.x;
    const sy = this.ship.y - 34;
    g.lineStyle(14, 0x5fd3bc, 0.5).lineBetween(sx, sy, tx, ty);
    g.lineStyle(5, 0xffffff, 1).lineBetween(sx, sy, tx, ty);
    this.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
    this.sparks.explode(this.reducedMotion ? 2 : 6, sx, sy);
    this.floatText(tx, ty - 60, `+${points}`, B.C.saffron);
    if (target.kind === 'boss' && !bossDone) {
      this.bossHit(v);
      return;
    }
    if (target.kind === 'dore') this.shockwave(tx, ty);
    destroyed.forEach((m, i) => {
      if (target.kind === 'dore' && i > 0) {
        // Explosions en chaîne : on réserve le météore pour que le filet de sécurité ne le prenne pas.
        this.scheduled.add(m.id);
        this.time.delayedCall(i * 90, () => {
          this.scheduled.delete(m.id);
          this.explode(m, false);
        });
      } else this.explode(m, m.kind === 'boss');
    });
    if (bossDone) this.time.delayedCall(600, () => this.celebrate());
  }

  /** Météores détruits dont l'explosion est programmée (onde de choc en chaîne). */
  private scheduled = new Set<number>();

  private explode(m: Meteor, big: boolean): void {
    const v = this.views.get(m.id);
    if (!v) return;
    this.views.delete(m.id);
    const x = v.obj.x;
    const y = v.obj.y;
    this.sfx.boom(big);
    const n = this.reducedMotion ? 3 : big ? 30 : 12;
    this.shards.forEach((e) => e.explode(n, x, y));
    this.fire.explode(this.reducedMotion ? 3 : big ? 30 : 10, x, y);
    this.sparks.explode(this.reducedMotion ? 3 : big ? 30 : 12, x, y);
    const ring = this.add.circle(x, y, 18).setStrokeStyle(6, m.kind === 'robot' ? 0xff4d6d : 0xffc94a).setDepth(47);
    this.tweens.add({ targets: ring, scale: big ? 10 : 4, alpha: 0, duration: big ? 700 : 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    if (!this.reducedMotion) this.cameras.main.shake(big ? 500 : 110, big ? 0.012 : 0.004);
    v.trail?.stop();
    const trail = v.trail;
    this.time.delayedCall(700, () => trail?.destroy());
    v.obj.destroy();
    if (big && !this.reducedMotion) {
      for (let i = 0; i < 6; i++) this.time.delayedCall(i * 160, () => this.fx.burst(x + Phaser.Math.Between(-150, 150), y + Phaser.Math.Between(-60, 60), ['#ff4d6d', '#ffc94a', '#ffffff']));
    }
  }

  private bossHit(v: MeteorView): void {
    this.sfx.boom(false);
    this.fire.explode(this.reducedMotion ? 4 : 16, v.obj.x + Phaser.Math.Between(-80, 80), v.obj.y + Phaser.Math.Between(-30, 40));
    this.shards.forEach((e) => e.explode(this.reducedMotion ? 2 : 8, v.obj.x, v.obj.y + 40));
    v.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(80, () => v.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
    if (!this.reducedMotion) this.cameras.main.shake(160, 0.006);
    v.label.setText(v.m.expr.text);
    this.resizePlate(v);
    v.counter?.setText(`${v.m.queue.length + 1} restants`);
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

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, style(30, color, 800, 6)).setOrigin(0.5).setDepth(72);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, delay: 300, duration: 700, onComplete: () => t.destroy() });
  }

  private banner(text: string, color: string, hold = 1100): void {
    const t = this.add.text((F.left + F.right) / 2, 230, text, style(52, color, 800, 9)).setOrigin(0.5).setDepth(76);
    if (this.reducedMotion) {
      this.time.delayedCall(1200, () => t.destroy());
      return;
    }
    t.setScale(2.4).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: 200, delay: hold, duration: 400, onComplete: () => t.destroy() });
  }

  // --- Événements de la partie ---------------------------------------------------------------------
  private onEvent(ev: MeteorEvent): void {
    switch (ev.type) {
      case 'wave': {
        const s = this.session!;
        const boss = ev.wave >= s.waveCount - 1;
        this.waveText.setText(boss ? 'Boss !' : `Vague ${ev.wave + 1} / ${s.waveCount}`);
        this.sfx.fanfare();
        if (!boss) this.banner(`Vague ${ev.wave + 1}`, B.C.cream);
        break;
      }
      case 'spawn':
        this.makeView(ev.meteor);
        if (ev.meteor.kind === 'robot') this.sfx.robotBeep();
        if (ev.meteor.kind === 'dore') this.sfx.chime();
        break;
      case 'boss':
        this.sfx.alarm();
        this.banner('ALERTE : Robot-Mère !', '#ff4d6d');
        this.makeView(ev.meteor);
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

  private makeView(m: Meteor): void {
    const obj = this.add.container(this.fieldX(m.x), this.fieldY(0)).setDepth(m.kind === 'boss' ? 12 : 15);
    let body: Phaser.GameObjects.Image;
    let trail: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    let counter: Phaser.GameObjects.Text | null = null;
    let plateY = 70;
    if (m.kind === 'boss') {
      this.tex('s-boss-0', () => Sp.mothership(0));
      this.tex('s-boss-1', () => Sp.mothership(1));
      body = this.add.image(0, 0, 's-boss-0').setScale(K * 1.1);
      plateY = 140;
      const loop = this.time.addEvent({ delay: 300, loop: true, callback: () => body.active && body.setTexture(body.texture.key === 's-boss-0' ? 's-boss-1' : 's-boss-0') });
      this.loops.push(loop);
      counter = this.add.text(0, plateY + 40, `${m.queue.length + 1} restants`, style(18, B.C.coralLight, 800, 4)).setOrigin(0.5);
    } else if (m.kind === 'robot') {
      this.tex('s-robot-0', () => Sp.robot(0));
      this.tex('s-robot-1', () => Sp.robot(1));
      body = this.add.image(0, 0, 's-robot-0').setScale(K);
      const loop = this.time.addEvent({ delay: 260, loop: true, callback: () => body.active && body.setTexture(body.texture.key === 's-robot-0' ? 's-robot-1' : 's-robot-0') });
      this.loops.push(loop);
      plateY = 52;
    } else {
      const gold = m.kind === 'dore';
      const key = this.tex(gold ? 's-gold' : `s-rock-${m.id % 4}`, () => Sp.meteor((m.id % 4) + 1, gold));
      body = this.add.image(0, 0, key).setScale(K * (gold ? 1.1 : 1));
      plateY = 62;
      if (!this.reducedMotion) {
        trail = this.add.particles(0, 0, this.tex(gold ? 's-trail-gold' : 's-trail', () => B.softGlow(22, gold ? '#ffd34a' : '#ff8a3d')), {
          follow: obj,
          followOffset: { x: 0, y: -30 },
          speedY: { min: -120, max: -60 },
          speedX: { min: -20, max: 20 },
          lifespan: 420,
          scale: { start: 1.3, end: 0 },
          alpha: { start: 0.7, end: 0 },
          frequency: 30,
          blendMode: Phaser.BlendModes.ADD,
        }).setDepth(14);
      }
    }
    const label = this.add.text(0, plateY, m.expr.text, style(m.kind === 'boss' ? 38 : 30, B.C.cream, 800)).setOrigin(0.5);
    const plate = this.add.image(0, plateY + 2, this.tex('s-plate-120', () => Sp.plate(120))).setScale(K);
    obj.add([body, plate, label]);
    if (counter) obj.add(counter);
    const v: MeteorView = { m, obj, body, label, plate, trail, counter };
    this.resizePlate(v);
    this.views.set(m.id, v);
    this.placeView(v);
    if (!this.reducedMotion) {
      obj.setScale(0.3);
      this.tweens.add({ targets: obj, scale: 1, duration: 320, ease: 'Back.easeOut' });
    }
  }

  private resizePlate(v: MeteorView): void {
    const w = Math.max(100, Math.ceil((v.label.width + 36) / 20) * 20);
    v.plate.setTexture(this.tex(`s-plate-${w}`, () => Sp.plate(w)));
  }

  private onImpact(m: Meteor, shieldLost: boolean): void {
    const v = this.views.get(m.id);
    const x = v?.obj.x ?? (F.left + F.right) / 2;
    if (m.kind !== 'boss' && v) {
      this.views.delete(m.id);
      v.trail?.stop();
      const trail = v.trail;
      this.time.delayedCall(600, () => trail?.destroy());
      v.obj.destroy();
    }
    this.sfx.boom(false);
    this.fire.explode(this.reducedMotion ? 3 : 14, x, F.stationY);
    this.shards.forEach((e) => e.explode(this.reducedMotion ? 2 : 6, x, F.stationY));
    this.dome.setStrokeStyle(6, shieldLost ? 0xff4d6d : 0x5fd3bc, 1).setFillStyle(shieldLost ? 0xff4d6d : 0x5fd3bc, 0.25);
    this.time.delayedCall(260, () => this.dome.setStrokeStyle(4, 0x5fd3bc, 0.5).setFillStyle(0x5fd3bc, 0.06));
    if (!this.reducedMotion) this.cameras.main.shake(220, 0.008);
    this.refreshScore();
    if (shieldLost) {
      this.sfx.heartLost();
      this.refreshShields();
      this.floatText(x, F.stationY - 40, 'Bouclier touché !', B.C.coralLight);
    } else {
      this.floatText(x, F.stationY - 40, 'Bloqué !', B.C.teal);
    }
  }

  // --- Fin de partie ----------------------------------------------------------------------------------
  private celebrate(): void {
    this.ending = true;
    this.waveText.setText('Victoire !');
    this.sfx.victoryJingle();
    this.banner('Station sauvée !', B.C.saffron, 3800);
    this.wreck.push(...this.fx.confetti(F.right, 3500));
    const bursts = this.reducedMotion ? 2 : 10;
    for (let i = 0; i < bursts; i++) {
      this.time.delayedCall(200 + i * 340, () => this.fx.burst(Phaser.Math.Between(80, F.right - 80), Phaser.Math.Between(80, 360), [['#ff4d6d', '#ffc94a'], ['#5fd3bc', '#ffffff'], ['#b79ad8', '#ff8fb1']][i % 3].concat('#ffffff')));
      this.sfx.firework(0.2 + i * 0.34);
    }
    // Le vaisseau fait une boucle de joie.
    if (!this.reducedMotion) {
      const cx = (F.left + F.right) / 2;
      const p = { t: 0 };
      this.tweens.add({
        targets: p,
        t: 1,
        duration: 2400,
        delay: 300,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          const a = p.t * Math.PI * 2;
          this.ship.setPosition(cx + Math.sin(a) * 200, F.shipY - 160 + Math.cos(a) * 160).setAngle(-p.t * 360);
        },
        onComplete: () => this.ship.setAngle(0).setPosition(cx, F.shipY),
      });
    }
    this.time.delayedCall(4600, () => this.showEnd(true));
  }

  private defeat(): void {
    this.ending = true;
    this.waveText.setText('Défaite…');
    this.sfx.collapse();
    // La station explose.
    const sx = this.stationImg.x;
    const sy = this.stationImg.y - 50;
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 160, () => {
        const x = sx + Phaser.Math.Between(-120, 120);
        this.fire.explode(this.reducedMotion ? 3 : 20, x, sy + Phaser.Math.Between(-20, 30));
        this.shards.forEach((e) => e.explode(this.reducedMotion ? 2 : 10, x, sy));
      });
    }
    if (!this.reducedMotion) this.cameras.main.shake(900, 0.012);
    this.tweens.add({ targets: [this.stationImg, this.dome], alpha: 0, delay: 700, duration: 500 });
    this.tweens.add({ targets: this.ship, y: H + 200, angle: 200, delay: 300, duration: 1400, ease: 'Quad.easeIn' });
    // Les ennemis restants s'en vont ; une bande de robots et de météores vient danser.
    for (const v of this.views.values()) {
      v.trail?.destroy();
      v.obj.destroy();
    }
    this.views.clear();
    this.time.delayedCall(900, () => {
      this.sfx.danceTune();
      this.sfx.laugh(0.4);
      this.sfx.laugh(1.8);
      const dancers = ['robot', 'rocher', 'robot', 'rocher', 'robot'];
      dancers.forEach((kind, i) => {
        const key = kind === 'robot' ? this.tex('s-robot-0', () => Sp.robot(0)) : this.tex(`s-rock-${i % 4}`, () => Sp.meteor((i % 4) + 1));
        const x = 140 + i * 170;
        const d = this.add.image(x, -80, key).setScale(K).setDepth(25);
        this.wreck.push(d);
        this.tweens.add({ targets: d, y: 470, delay: i * 90, duration: 600, ease: 'Bounce.easeOut', onComplete: () => {
          if (this.reducedMotion) return;
          this.tweens.add({ targets: d, y: 430, duration: 260 + i * 15, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
          this.tweens.add({ targets: d, angle: { from: -14, to: 14 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } });
      });
      const t = this.add.text((F.left + F.right) / 2, 300, 'Ha ha ha !', style(46, '#ff4d6d', 800, 8)).setOrigin(0.5).setDepth(26).setScale(0);
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
    const panel = this.add.image(W / 2, H / 2, this.tex(`w-dialog-${h}`, () => {
      const [cv, ctx] = B.makeCanvas(712, h + 20);
      B.paint(ctx, () => B.roundRectPath(ctx, 6, 14, 700, h, 30), B.C.ink, { ink: '' });
      B.paint(ctx, () => B.roundRectPath(ctx, 6, 6, 700, h, 30), '#141842', { line: 5 });
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
    const c = this.openOverlay(470);
    const top = H / 2 - 235;
    c.add(this.add.text(W / 2, top + 60, 'Pluie de météores', style(48, B.C.saffron, 800, 7)).setOrigin(0.5));
    c.add(this.add.text(W / 2, top + 150, [
      'Météores et robots foncent sur la station, chacun porte un calcul.',
      'Tape le résultat : ton vaisseau tire aussitôt !',
      'Le météore doré fait tout exploser.',
    ].join('\n'), { ...style(20, B.C.cream, 600), align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    c.add(this.add.text(W / 2, top + 236, `Niveau ${this.tier.label} · ${this.tier.public}`, style(18, '#9fc9c2', 700)).setOrigin(0.5));
    this.addOverlayButton(W / 2 - 140, top + 316, 'Tranquille', false, () => this.startGame('tranquille'));
    this.addOverlayButton(W / 2 + 140, top + 316, 'Défi', true, () => this.startGame('defi'));
    c.add(this.add.text(W / 2 - 140, top + 370, 'chute lente,\nle bouclier tient bon', { ...style(15, '#9fc9c2', 600), align: 'center' }).setOrigin(0.5, 0));
    c.add(this.add.text(W / 2 + 140, top + 370, 'plus rapide,\n3 boucliers à protéger', { ...style(15, '#9fc9c2', 600), align: 'center' }).setOrigin(0.5, 0));
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
    const c = this.openOverlay(480, won ? 0.6 : 0.35);
    const top = H / 2 - 240;
    c.add(this.add.text(W / 2, top + 58, won ? 'Station sauvée !' : 'La station est tombée…', style(44, won ? B.C.saffron : B.C.coralLight, 800, 7)).setOrigin(0.5));
    c.add(this.add.text(W / 2, top + 114, `Score ${s.score}`, style(34, B.C.cream, 800, 5)).setOrigin(0.5));
    c.add(this.add.text(W / 2, top + 152, isRecord ? 'Nouveau record !' : `Record : ${best}`, style(18, isRecord ? B.C.saffron : '#9fc9c2', 800)).setOrigin(0.5));
    const lines: Array<[string, string]> = [
      ['Tirs réussis', `${s.stats.hits}`],
      ['Calculs justes', `${Math.round(s.accuracy() * 100)} %`],
      ['Meilleur combo', `${s.stats.bestCombo}`],
      ['Météores qui ont touché la station', `${s.stats.impacts}`],
    ];
    lines.forEach(([label, value], i) => {
      const y = top + 206 + i * 36;
      c.add(this.add.text(W / 2 - 230, y, label, style(20, '#cfe8e4', 600)).setOrigin(0, 0.5));
      c.add(this.add.text(W / 2 + 230, y, value, style(22, B.C.cream, 800)).setOrigin(1, 0.5));
    });
    this.addOverlayButton(W / 2 - 130, top + 400, 'Accueil', false, () => {
      window.location.href = '../index.html';
    });
    this.addOverlayButton(W / 2 + 130, top + 400, 'Rejouer', true, () => this.showIntro());
  }

  private startGame(mode: Mode): void {
    this.overlay?.destroy(true);
    this.overlay = null;
    this.overlayButtons = [];
    for (const l of this.loops) l.remove();
    this.loops = [];
    for (const o of this.wreck) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.wreck = [];
    for (const v of this.views.values()) {
      v.trail?.destroy();
      v.obj.destroy();
    }
    this.views.clear();
    this.tweens.killTweensOf(this.ship);
    this.ship.setPosition((F.left + F.right) / 2, F.shipY).setAngle(0);
    this.stationImg.setAlpha(1);
    this.dome.setAlpha(1);
    this.ending = false;
    this.seed = (this.seed * 7919 + 13) % 1e9;
    this.session = new MeteorSession(this.tier.id, this.seed, mode);
    this.refreshShields();
    this.refreshScore();
    this.refreshReadout();
  }
}
