/**
 * Variante A — pixel art. Tous les sprites viennent de src/art/variant-a.ts,
 * affichés à l'échelle ×3 sans lissage. Mouvements « par pas » pour rester
 * dans l'esprit pixel, effets additifs pour la magie.
 */
import Phaser from 'phaser';
import * as A from '../../art/variant-a';
import { PixelCanvas, drawNumber, numberWidth, DIGIT_H } from '../../art/pixelforge';
import { SiegeSceneBase, LAYOUT, W, type CubeView, type EnemyView, type Hud } from './base-scene';

const S = A.SCALE;
const FONT = '"Pixelify Sans", monospace';
const INK_CSS = A.INK;

function text(size: number, color: string, stroke = 6): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color, stroke: INK_CSS, strokeThickness: stroke };
}

export class SceneA extends SiegeSceneBase {
  private lanternGlow!: Phaser.GameObjects.Image;
  private towerImg!: Phaser.GameObjects.Image;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('siege-a');
  }

  /** Enregistre un PixelCanvas comme texture (une seule fois par clé). */
  private tex(key: string, make: () => PixelCanvas): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, make().toCanvas());
    return key;
  }

  private numTex(n: number): string {
    return this.tex(`a-num-${n}`, () => A.cubeNumber(n));
  }

  private bigNumTex(n: number, fill: string): string {
    return this.tex(`a-big-${n}-${fill}`, () => {
      const w = numberWidth(n) + 4;
      const pc = new PixelCanvas(w, DIGIT_H + 5);
      drawNumber(pc, n, w / 2, (DIGIT_H + 3) / 2 + 1, fill, A.INK, A.PAL.stone[0]);
      return pc;
    });
  }

  // --- Décor -----------------------------------------------------------------------
  protected buildWorld(): void {
    this.add.image(0, 0, this.tex('a-bg', A.background)).setOrigin(0).setScale(S);

    // Nuages qui dérivent lentement.
    [
      { y: 150, w: 70, h: 14, seed: 1, speed: 90000 },
      { y: 240, w: 54, h: 12, seed: 2, speed: 120000 },
      { y: 90, w: 40, h: 10, seed: 3, speed: 150000 },
    ].forEach((c, i) => {
      const img = this.add.image(-200 + i * 520, c.y, this.tex(`a-cloud-${c.seed}`, () => A.cloud(c.w, c.h, c.seed))).setScale(S).setAlpha(0.85);
      if (this.reducedMotion) return;
      this.tweens.add({ targets: img, x: W + 260, duration: c.speed * (1 - (img.x + 200) / (W + 460)), onComplete: () => {
        img.x = -260;
        this.tweens.add({ targets: img, x: W + 260, duration: c.speed, repeat: -1 });
      } });
    });

    this.add.image(0, 0, this.tex('a-frame', A.workshopFrame)).setOrigin(0).setScale(S).setDepth(5);

    // Étoiles qui scintillent.
    const star = this.tex('a-star', () => A.dot('#fff4dc'));
    for (let i = 0; i < 14; i++) {
      const s = this.add.image(Phaser.Math.Between(20, W - 20) - (Phaser.Math.Between(0, W) % S), Phaser.Math.Between(10, 230), star).setScale(S);
      if (!this.reducedMotion) this.tweens.add({ targets: s, alpha: 0.1, duration: Phaser.Math.Between(700, 1800), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000), ease: 'Stepped', easeParams: [3] });
    }

    // Phare et halo de la lanterne.
    const baseY = LAYOUT.groundY + 15;
    this.towerImg = this.add.image(LAYOUT.towerX, baseY, this.tex('a-tower', A.tower)).setOrigin(0.5, 1).setScale(S);
    const lanternY = baseY - (96 - 25) * S;
    this.lanternGlow = this.add.image(LAYOUT.towerX, lanternY, this.tex('a-glow', () => A.glow(26, A.PAL.teal))).setScale(S).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
    if (!this.reducedMotion) this.tweens.add({ targets: this.lanternGlow, alpha: 0.85, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Un escargot qui vit sa vie au pied du phare.
    this.tex('a-snail-0', () => A.snail(0));
    this.tex('a-snail-1', () => A.snail(1));
    const snail = this.add.image(LAYOUT.towerX + 72, LAYOUT.groundY + 3, 'a-snail-0').setOrigin(0.5, 1).setScale(S);
    let f = 0;
    this.time.addEvent({ delay: 600, loop: true, callback: () => {
      f = 1 - f;
      snail.setTexture(`a-snail-${f}`);
      if (!this.reducedMotion && f === 0) snail.x += snail.flipX ? -S : S;
      if (snail.x > LAYOUT.towerX + 150) snail.setFlipX(true);
      if (snail.x < LAYOUT.towerX + 60) snail.setFlipX(false);
    } });

    // Lucioles.
    if (!this.reducedMotion) {
      this.add.particles(0, 0, this.tex('a-firefly', () => A.dot(A.PAL.teal[4])), {
        x: { min: 470, max: W },
        y: { min: 380, max: 560 },
        lifespan: 4000,
        speedX: { min: -8, max: 8 },
        speedY: { min: -12, max: -2 },
        scale: S,
        alpha: { values: [0, 1, 0.2, 1, 0] },
        frequency: 450,
        blendMode: Phaser.BlendModes.ADD,
      });
    }

    // Émetteur réutilisé pour toutes les gerbes d'impact.
    // Une texture de 4 pixels, une image (frame) par couleur.
    const colors = ['#fff4dc', A.PAL.amber[3], A.PAL.coral[4], A.PAL.teal[4]];
    this.tex('a-sparks', () => {
      const pc = new PixelCanvas(colors.length, 1);
      colors.forEach((c, i) => pc.set(i, 0, c));
      return pc;
    });
    const sparkTex = this.textures.get('a-sparks');
    colors.forEach((_c, i) => {
      if (!sparkTex.has(String(i))) sparkTex.add(String(i), 0, i, 0, 1, 1);
    });
    this.sparks = this.add.particles(0, 0, 'a-sparks', {
      frame: ['0', '1', '2', '3'],
      speed: { min: 90, max: 330 },
      angle: { min: 0, max: 360 },
      gravityY: 520,
      lifespan: { min: 350, max: 750 },
      scale: { start: S * 1.4, end: S * 0.4 },
      emitting: false,
    }).setDepth(50);
  }

  // --- Cubes -------------------------------------------------------------------------
  protected makeCube(_i: number, value: number, x: number, y: number): CubeView {
    this.tex('a-cube', () => A.cube(false));
    this.tex('a-cube-sel', () => A.cube(true));
    this.tex('a-focus', A.focusFrame);
    const c = this.add.container(x, y).setDepth(20);
    // La face supérieure (27 px) est centrée ; l'épaisseur dépasse dessous.
    const base = this.add.image(0, (A.CUBE_H / 2 - 13.5) * S, 'a-cube').setScale(S);
    const num = this.add.image(0, 0, this.numTex(value)).setScale(S);
    const focus = this.add.image(0, (A.CUBE_H / 2 - 13.5) * S, 'a-focus').setScale(S).setVisible(false);
    c.add([base, num, focus]);
    const restY = y;
    return {
      obj: c,
      setValue: (v, appear) => {
        num.setTexture(this.numTex(v)).setVisible(true);
        base.setAlpha(1);
        if (appear) {
          c.setScale(0.2);
          this.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Back.easeOut' });
          this.sparks.explode(this.reducedMotion ? 2 : 6, x, y);
        }
      },
      setSelected: (s) => {
        base.setTexture(s ? 'a-cube-sel' : 'a-cube');
        this.tweens.killTweensOf(c);
        c.setScale(1);
        // Le cube se comprime puis se soulève de 2 pixels natifs.
        this.tweens.add({ targets: c, y: restY - (s ? 2 * S : 0), duration: 120, ease: 'Stepped', easeParams: [2] });
        if (!this.reducedMotion) this.tweens.add({ targets: c, scaleY: { from: 0.82, to: 1 }, scaleX: { from: 1.1, to: 1 }, duration: 160, ease: 'Back.easeOut' });
      },
      setFocus: (f) => focus.setVisible(f),
      shake: () => {
        if (this.reducedMotion) {
          this.tweens.add({ targets: c, alpha: 0.5, duration: 120, yoyo: true });
          return;
        }
        this.tweens.add({ targets: c, x: x + S * 2, duration: 50, yoyo: true, repeat: 3, ease: 'Stepped', onComplete: () => c.setX(x) });
      },
    };
  }

  // --- Ennemi --------------------------------------------------------------------------
  protected makeEnemy(x: number, y: number): EnemyView {
    this.tex('a-enemy-0', () => A.enemy(0));
    this.tex('a-enemy-1', () => A.enemy(1));
    this.tex('a-shadow', () => new PixelCanvas(30, 5).ellipse(15, 2.5, 15, 2.5, [A.INK], { dither: 0 }));
    const c = this.add.container(x, y).setDepth(10);
    const shadow = this.add.image(0, 4, 'a-shadow').setScale(S).setAlpha(0.45);
    const body = this.add.image(0, 0, 'a-enemy-0').setOrigin(0.5, 1).setScale(S);
    const signY = -(A.ENEMY_H - 2) * S;
    const signKey = (n: number) => this.tex(`a-sign-${n}`, () => A.sign(n));
    const sign = this.add.image(S, signY, signKey(0)).setOrigin(0.5, 1).setScale(S);
    const barW = 30 * S;
    const barY = signY - 19 * S - 3 * S;
    const barBg = this.add.rectangle(0, barY, barW + 2 * S, 4 * S, A.UI.ink);
    const bar = this.add.rectangle(-barW / 2, barY, barW, 2 * S, 0xe0705e).setOrigin(0, 0.5);
    c.add([shadow, body, sign, barBg, bar]);

    let frame = 0;
    let acc = 0;
    let walking = true;
    const flashWhite = () => {
      body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(80, () => body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
    };
    return {
      obj: c,
      setTarget: (n, animate) => {
        if (!animate || this.reducedMotion) {
          sign.setTexture(signKey(n));
          return;
        }
        // La pancarte se retourne pour révéler le nouveau nombre.
        this.tweens.add({ targets: sign, scaleX: 0, duration: 90, ease: 'Stepped', easeParams: [2], onComplete: () => {
          sign.setTexture(signKey(n));
          this.tweens.add({ targets: sign, scaleX: S, duration: 90, ease: 'Stepped', easeParams: [2] });
        } });
      },
      setHp: (frac) => {
        this.tweens.add({ targets: bar, width: Math.max(0, barW * frac), duration: 200, ease: 'Stepped', easeParams: [4] });
      },
      walk: (_t, delta) => {
        if (!walking) return;
        acc += delta;
        if (acc > 240) {
          acc = 0;
          frame = 1 - frame;
          body.setTexture(`a-enemy-${frame}`);
          if (!this.reducedMotion) {
            body.y = frame ? -S : 0;
            sign.y = signY + (frame ? -S : 0);
          }
        }
      },
      hit: (perfect) => {
        flashWhite();
        if (this.reducedMotion) return;
        this.tweens.add({ targets: c, x: c.x + (perfect ? 36 : 21), duration: 140, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: body, scaleX: S * 1.25, scaleY: S * 0.75, duration: 70, yoyo: true, ease: 'Stepped', easeParams: [2] });
        this.tweens.add({ targets: sign, angle: { from: perfect ? -14 : -8, to: 0 }, duration: 420, ease: 'Elastic.easeOut' });
      },
      die: (done) => {
        walking = false;
        flashWhite();
        this.sparks.explode(this.reducedMotion ? 8 : 40, c.x, c.y - 60);
        // La pancarte s'envole en tournoyant, le corps s'aplatit comiquement.
        this.tweens.add({ targets: sign, y: signY - 120, angle: 200, alpha: 0, duration: 700, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: [bar, barBg], alpha: 0, duration: 150 });
        this.tweens.add({ targets: body, scaleY: S * 0.25, scaleX: S * 1.5, duration: 260, delay: 120, ease: 'Stepped', easeParams: [3] });
        this.tweens.add({ targets: [body, shadow], alpha: 0, duration: 300, delay: 420, onComplete: () => done() });
      },
      bump: () => {
        flashWhite();
        this.tweens.add({ targets: body, angle: { from: -12, to: 0 }, duration: 500, ease: 'Elastic.easeOut' });
      },
      impactPoint: () => new Phaser.Math.Vector2(c.x, c.y - 28 * S),
    };
  }

  // --- Interface -----------------------------------------------------------------------
  protected makeHud(): Hud {

    // Bandeau supérieur.
    const score = this.add.text(36, 22, 'Score 0', text(30, A.UI.cream)).setDepth(60);
    const combo = this.add.text(36, 60, '', text(22, A.UI.amber, 5)).setDepth(60);
    this.add.text(W / 2, 22, 'Prototype A · pixel art', text(20, A.UI.muted, 4)).setOrigin(0.5, 0).setDepth(60);
    const sound = this.add.text(W - 30, 22, '', text(22, A.UI.cream, 5)).setOrigin(1, 0).setDepth(60).setInteractive({ useHandCursor: true });
    sound.on('pointerdown', () => this.toggleSound());

    // Bandeau « cible / somme » au-dessus de la grille.
    const panelX = LAYOUT.gridX + 183;
    this.add.text(LAYOUT.gridX + 6, LAYOUT.sumY - 34, 'CIBLE', text(16, A.UI.muted, 4)).setDepth(60);
    const targetImg = this.add.image(LAYOUT.gridX + 50, LAYOUT.sumY + 8, this.bigNumTex(0, A.PAL.amber[3])).setScale(S).setDepth(60);
    const equation = this.add.text(panelX + 46, LAYOUT.sumY - 4, '', text(30, A.UI.cream)).setOrigin(0.5).setDepth(60);
    const hint = this.add.text(panelX + 46, LAYOUT.sumY + 20, '', text(16, A.UI.muted, 4)).setOrigin(0.5, 0).setDepth(60);

    // Message central, sur un bandeau sombre pour rester lisible sur le ciel.
    const toastBg = this.add.rectangle(880, 250, 10, 48, A.UI.ink, 0.72).setDepth(69).setAlpha(0);
    const toast = this.add.text(880, 250, '', text(28, A.UI.cream)).setOrigin(0.5).setDepth(70).setAlpha(0);

    return {
      setEquation: (values, sum, target) => {
        targetImg.setTexture(this.bigNumTex(target, A.PAL.amber[3]));
        if (values.length === 0) {
          equation.setText('Choisis des cubes').setColor(A.UI.muted);
          hint.setText('clic, toucher ou flèches + espace');
          return;
        }
        equation.setText(values.length === 1 ? `${sum}` : `${values.join(' + ')} = ${sum}`);
        if (sum === target) {
          equation.setColor(A.UI.teal);
          hint.setText('Prêt ! Lance avec Entrée');
        } else if (sum < target) {
          equation.setColor(A.UI.cream);
          hint.setText(`encore ${target - sum}`);
        } else {
          equation.setColor(A.UI.coral);
          hint.setText(`${sum - target} de trop`);
        }
      },
      setScore: (s, k) => {
        score.setText(`Score ${s}`);
        combo.setText(k > 1 ? `Série parfaite ×${k}` : '');
      },
      toast: (msg, kind) => {
        toast.setText(msg).setColor(kind === 'perfect' ? A.UI.amber : kind === 'good' ? A.UI.teal : A.UI.cream);
        this.tweens.killTweensOf([toast, toastBg]);
        toast.setAlpha(1).setScale(kind === 'perfect' ? 1.25 : 1);
        toastBg.setAlpha(1).setSize(toast.width + 48, 48);
        toastBg.setOrigin(0.5);
        this.tweens.add({ targets: toast, scale: 1, duration: 220, ease: 'Back.easeOut' });
        this.tweens.add({ targets: [toast, toastBg], alpha: 0, delay: 1700, duration: 400 });
      },
      setMuted: (m) => sound.setText(m ? 'Son : coupé (M)' : 'Son : activé (M)'),
      floatDamage: (x, y, dmg, perfect) => {
        const t = this.add.text(x, y, `-${dmg}`, text(perfect ? 40 : 30, perfect ? A.UI.amber : A.UI.cream)).setOrigin(0.5).setDepth(70);
        this.tweens.add({ targets: t, y: y - 70, duration: 900, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: t, alpha: 0, delay: 600, duration: 300, onComplete: () => t.destroy() });
      },
    };
  }

  protected makeButton(x: number, y: number, label: string, primary: boolean, onClick: () => void): Phaser.GameObjects.Container {
    const key = this.tex(`a-btn-${primary ? 1 : 0}`, () => {
      const pc = new PixelCanvas(58, 18);
      pc.rect(0, 0, 58, 18, primary ? A.PAL.teal : A.PAL.stone, 0.7, 0.3, { dither: 0.6 });
      pc.fill(1, 1, 56, 1, (primary ? A.PAL.teal : A.PAL.stone)[4]);
      pc.outline(A.INK);
      return pc;
    });
    const c = this.add.container(x, y).setDepth(60);
    const bg = this.add.image(0, 0, key).setScale(S);
    const t = this.add.text(0, -2, label, text(26, A.UI.cream, 5)).setOrigin(0.5);
    c.add([bg, t]);
    c.setSize(60 * S, 20 * S).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.tweens.add({ targets: c, y: y + S, duration: 60, yoyo: true, ease: 'Stepped' });
      onClick();
    });
    return c;
  }

  // --- Effets ---------------------------------------------------------------------------
  protected fireVolley(used: number[], target: number, perfect: boolean, to: Phaser.Math.Vector2, onImpact: () => void): void {
    const fuse = new Phaser.Math.Vector2(LAYOUT.towerX - 30, 260);
    const boltKey = this.tex('a-bolt', A.bolt);
    let arrived = 0;
    used.forEach((i, k) => {
      const view = this.cubeViews[i];
      const from = new Phaser.Math.Vector2(view.obj.x, view.obj.y);
      // Le chiffre quitte le cube, qui reste vide jusqu'au remplacement.
      (view.obj.list[1] as Phaser.GameObjects.Image).setVisible(false);
      (view.obj.list[0] as Phaser.GameObjects.Image).setTexture('a-cube').setAlpha(0.35);
      const p = this.add.image(from.x, from.y, this.numTex(this.shownValues[i])).setScale(S).setDepth(40);
      this.tweens.add({
        targets: p,
        x: fuse.x,
        y: fuse.y,
        delay: k * 60,
        duration: 260,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          p.destroy();
          if (++arrived === used.length) launch();
        },
      });
    });

    const launch = () => {
      const rune = this.add.image(fuse.x, fuse.y, this.tex(`a-rune-${target}`, () => A.rune(target))).setScale(0).setDepth(45);
      const halo = this.add.image(fuse.x, fuse.y, 'a-glow').setScale(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
      this.tweens.add({ targets: rune, scale: S, duration: 160, ease: 'Back.easeOut' });
      this.tweens.add({ targets: halo, scale: S * (perfect ? 1.4 : 1), alpha: { from: 1, to: 0.6 }, duration: 160 });
      const trail = this.add.particles(0, 0, boltKey, {
        follow: rune,
        lifespan: 260,
        scale: { start: S, end: 0 },
        alpha: { start: 0.9, end: 0 },
        frequency: 16,
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(43);
      this.time.delayedCall(170, () => {
        const start = new Phaser.Math.Vector2(rune.x, rune.y);
        const ctrl = new Phaser.Math.Vector2((start.x + to.x) / 2, Math.min(start.y, to.y) - 160);
        const curve = new Phaser.Curves.QuadraticBezier(start, ctrl, to);
        const prog = { t: 0 };
        halo.destroy();
        this.tweens.add({
          targets: prog,
          t: 1,
          duration: 380,
          ease: 'Quad.easeIn',
          onUpdate: () => {
            const pt = curve.getPoint(prog.t);
            // Position arrondie à la grille native pour rester net.
            rune.setPosition(Math.round(pt.x / S) * S, Math.round(pt.y / S) * S);
            // Pas de rotation : le nombre doit rester lisible pendant le vol.
            rune.setScale(S * (1 + 0.12 * Math.sin(prog.t * Math.PI)));
          },
          onComplete: () => {
            rune.destroy();
            trail.stop();
            this.time.delayedCall(300, () => trail.destroy());
            onImpact();
          },
        });
      });
    };
  }

  protected impactFx(at: Phaser.Math.Vector2, perfect: boolean): void {
    this.sparks.explode(this.reducedMotion ? 6 : perfect ? 34 : 18, at.x, at.y);
    const ring = this.add.image(at.x, at.y, 'a-glow').setBlendMode(Phaser.BlendModes.ADD).setScale(S * 0.3).setDepth(48);
    this.tweens.add({ targets: ring, scale: S * (perfect ? 2.2 : 1.5), alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    if (!this.reducedMotion) {
      this.cameras.main.shake(perfect ? 140 : 90, perfect ? 0.006 : 0.003);
      if (perfect) {
        // Éclair discret (jamais plein écran opaque).
        const flash = this.add.rectangle(W / 2, 360, W, 720, 0xfff4dc, 0.16).setDepth(80).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: flash, alpha: 0, duration: 140, onComplete: () => flash.destroy() });
      }
    }
  }

  protected towerHitFx(): void {
    this.towerImg.setTint(0xffab84);
    this.time.delayedCall(120, () => this.towerImg.clearTint());
    this.tweens.add({ targets: this.lanternGlow, alpha: 0.1, duration: 80, yoyo: true, repeat: 2 });
  }
}
