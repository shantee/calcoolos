/**
 * Variante B — 2D illustrée. Sprites dessinés par src/art/variant-b.ts à
 * résolution ×2, affichés à 0,5. Mouvements souples (rebonds, élasticité),
 * lumières douces additives.
 */
import Phaser from 'phaser';
import * as B from '../../art/variant-b';
import { SiegeSceneBase, LAYOUT, W, H, type CubeView, type EnemyView, type Hud } from './base-scene';

const K = 1 / B.RES;

function style(size: number, color: string, weight = 700, stroke = 0): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: B.FONT,
    fontSize: `${size}px`,
    fontStyle: String(weight),
    color,
    stroke: B.C.ink,
    strokeThickness: stroke,
    resolution: 2,
  };
}

export class SceneB extends SiegeSceneBase {
  private lanternGlow!: Phaser.GameObjects.Image;
  private towerImg!: Phaser.GameObjects.Image;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('siege-b');
  }

  private tex(key: string, make: () => HTMLCanvasElement): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, make());
    return key;
  }

  // --- Décor -----------------------------------------------------------------------
  protected buildWorld(): void {
    this.add.image(0, 0, this.tex('b-bg', B.background)).setOrigin(0);

    // Nuages qui dérivent.
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

    // Établi des cubes.
    this.add.image(LAYOUT.gridX - 20, 126, this.tex('b-workshop', B.workshop)).setOrigin(0).setScale(K).setDepth(5);

    // Phare et halo.
    this.towerImg = this.add.image(LAYOUT.towerX, LAYOUT.groundY + 26, this.tex('b-tower', B.tower)).setOrigin(0.5, 1).setScale(K).setDepth(4);
    const glowKey = this.tex('b-glow', () => B.softGlow(128, '#5fd3bc'));
    this.lanternGlow = this.add.image(LAYOUT.towerX, LAYOUT.groundY + 26 - B.TOWER_H + 76, glowKey).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setDepth(4);
    if (!this.reducedMotion) this.tweens.add({ targets: this.lanternGlow, alpha: 0.8, scale: 1.1, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Étincelles et lucioles.
    const sparkKeys = [
      this.tex('b-spark-0', () => B.sparkle('#fff6dc')),
      this.tex('b-spark-1', () => B.sparkle(B.C.saffron)),
      this.tex('b-spark-2', () => B.sparkle(B.C.teal)),
    ];
    if (!this.reducedMotion) {
      this.add.particles(0, 0, sparkKeys[2], {
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
    this.sparks = this.add.particles(0, 0, sparkKeys[0], {
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

    // Grain de papier sur toute la scène.
    this.add.image(0, 0, this.tex('b-grain', () => B.grain(W, H))).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(0.12).setDepth(90);
  }

  // --- Cubes -------------------------------------------------------------------------
  protected makeCube(_i: number, value: number, x: number, y: number): CubeView {
    this.tex('b-tile', () => B.tile('normal'));
    this.tex('b-tile-sel', () => B.tile('selected'));
    this.tex('b-tile-spent', () => B.tile('spent'));
    this.tex('b-focus', B.focusRing);
    const c = this.add.container(x, y).setDepth(20);
    // Le canevas de tuile inclut une marge de 6 px et l'épaisseur (10 px) en bas.
    const base = this.add.image(0, 5, 'b-tile').setScale(K);
    const num = this.add.text(0, -2, String(value), style(46, B.C.ink, 800)).setOrigin(0.5);
    const focus = this.add.image(0, 5, 'b-focus').setScale(K).setVisible(false);
    c.add([base, num, focus]);
    return {
      obj: c,
      setValue: (v, appear) => {
        num.setText(String(v)).setVisible(true);
        base.setTexture('b-tile');
        if (appear) {
          c.setScale(0.3).setAlpha(0);
          this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 380, ease: 'Back.easeOut' });
          if (!this.reducedMotion) this.sparks.explode(4, x, y);
        }
      },
      setSelected: (s) => {
        base.setTexture(s ? 'b-tile-sel' : 'b-tile');
        this.tweens.killTweensOf(c);
        c.setScale(1).setAngle(0);
        this.tweens.add({ targets: c, y: y - (s ? 8 : 0), duration: 220, ease: 'Back.easeOut' });
        if (!this.reducedMotion) {
          this.tweens.add({ targets: c, scaleX: { from: 1.12, to: 1 }, scaleY: { from: 0.86, to: 1 }, duration: 320, ease: 'Elastic.easeOut', easeParams: [1, 0.5] });
          if (s) this.tweens.add({ targets: c, angle: { from: -3, to: 0 }, duration: 300, ease: 'Sine.easeOut' });
        }
      },
      setFocus: (f) => focus.setVisible(f),
      shake: () => {
        if (this.reducedMotion) {
          this.tweens.add({ targets: c, alpha: 0.5, duration: 140, yoyo: true });
          return;
        }
        this.tweens.add({ targets: c, x: { from: x - 7, to: x }, duration: 420, ease: 'Elastic.easeOut', easeParams: [2, 0.25] });
      },
    };
  }

  // --- Ennemi --------------------------------------------------------------------------
  protected makeEnemy(x: number, y: number): EnemyView {
    this.tex('b-enemy-0', () => B.enemy(0));
    this.tex('b-enemy-1', () => B.enemy(1));
    this.tex('b-shadow', () => B.shadow(110, 18));
    const c = this.add.container(x, y + 22).setDepth(10);
    const shadow = this.add.image(0, 0, 'b-shadow').setScale(K);
    const body = this.add.image(0, 2, 'b-enemy-0').setOrigin(0.5, 1).setScale(K);
    const signKey = (n: number) => this.tex(`b-sign-${n}`, () => B.sign(n));
    const signY = -B.ENEMY_H + 14;
    const sign = this.add.image(0, signY, signKey(0)).setOrigin(0.5, 1).setScale(K);
    const barW = 96;
    const barY = signY - 76;
    const barBg = this.add.rectangle(0, barY, barW + 6, 12, 0x1d1a2b).setOrigin(0.5);
    const bar = this.add.rectangle(-barW / 2, barY, barW, 6, 0xf0745e).setOrigin(0, 0.5);
    c.add([shadow, body, sign, barBg, bar]);

    let walking = true;
    let frame = 0;
    let acc = 0;
    const squash = (sx: number, sy: number, d = 120) => {
      this.tweens.add({ targets: body, scaleX: K * sx, scaleY: K * sy, duration: d, yoyo: true, ease: 'Sine.easeOut' });
    };
    const flash = () => {
      body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(70, () => body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
    };
    return {
      obj: c,
      setTarget: (n, animate) => {
        if (!animate || this.reducedMotion) {
          sign.setTexture(signKey(n));
          return;
        }
        this.tweens.add({ targets: sign, scaleY: 0, duration: 120, ease: 'Sine.easeIn', onComplete: () => {
          sign.setTexture(signKey(n));
          this.tweens.add({ targets: sign, scaleY: K, duration: 380, ease: 'Back.easeOut' });
        } });
      },
      setHp: (frac) => {
        this.tweens.add({ targets: bar, width: Math.max(0, barW * frac), duration: 380, ease: 'Cubic.easeOut' });
      },
      walk: (time, delta) => {
        if (!walking) return;
        acc += delta;
        if (acc > 260) {
          acc = 0;
          frame = 1 - frame;
          body.setTexture(`b-enemy-${frame}`);
          if (!this.reducedMotion) this.dust.explode(1, c.x + 20, c.y - 4);
        }
        if (!this.reducedMotion) {
          // Dandinement : léger balancement du corps et de la pancarte.
          const t = time / 260;
          body.angle = Math.sin(t * Math.PI) * 3;
          sign.angle = Math.sin(t * Math.PI + 0.6) * 4;
          sign.y = signY - Math.abs(Math.sin(t * Math.PI)) * 4;
        }
      },
      hit: (perfect) => {
        flash();
        if (this.reducedMotion) return;
        this.tweens.add({ targets: c, x: c.x + (perfect ? 44 : 24), duration: 220, ease: 'Cubic.easeOut' });
        squash(1.22, 0.8);
        this.tweens.add({ targets: sign, angle: { from: perfect ? -24 : -12, to: 0 }, duration: 700, ease: 'Elastic.easeOut' });
      },
      die: (done) => {
        walking = false;
        flash();
        this.sparks.explode(this.reducedMotion ? 6 : 36, c.x, c.y - 70);
        this.dust.explode(this.reducedMotion ? 2 : 10, c.x, c.y - 10);
        this.tweens.add({ targets: sign, y: signY - 200, x: 60, angle: 260, alpha: 0, duration: 900, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: [bar, barBg], alpha: 0, duration: 150 });
        // L'ennemi s'aplatit, rebondit puis s'éclipse en tournoyant.
        this.tweens.add({ targets: body, scaleY: K * 0.4, scaleX: K * 1.4, duration: 160, ease: 'Quad.easeOut', yoyo: true });
        this.tweens.add({ targets: body, y: -60, angle: 540, scale: 0, alpha: 0, delay: 320, duration: 600, ease: 'Back.easeIn' });
        this.tweens.add({ targets: shadow, alpha: 0, delay: 320, duration: 500, onComplete: () => done() });
      },
      bump: () => {
        flash();
        squash(0.85, 1.15, 160);
      },
      impactPoint: () => new Phaser.Math.Vector2(c.x - 4, c.y - 70),
    };
  }

  // --- Interface -----------------------------------------------------------------------
  protected makeHud(): Hud {
    const score = this.add.text(36, 22, 'Score 0', style(30, B.C.cream, 800, 6)).setDepth(60);
    const combo = this.add.text(36, 62, '', style(20, B.C.saffron, 700, 5)).setDepth(60);
    this.add.text(W / 2, 24, 'Prototype B · 2D illustrée', style(18, '#cfe8e4', 600, 4)).setOrigin(0.5, 0).setDepth(60);
    const sound = this.add.text(W - 30, 24, '', style(20, B.C.cream, 700, 5)).setOrigin(1, 0).setDepth(60).setInteractive({ useHandCursor: true });
    sound.on('pointerdown', () => this.toggleSound());

    const panelX = LAYOUT.gridX + 229;
    this.add.text(LAYOUT.gridX + 18, LAYOUT.sumY - 36, 'CIBLE', style(15, '#9fc9c2', 700)).setDepth(60);
    const target = this.add.text(LAYOUT.gridX + 6, LAYOUT.sumY + 8, '', style(56, B.C.saffron, 800, 7)).setOrigin(0, 0.5).setDepth(60);
    const equation = this.add.text(panelX, LAYOUT.sumY - 4, '', style(30, B.C.cream, 800, 5)).setOrigin(0.5).setDepth(60);
    const hint = this.add.text(panelX, LAYOUT.sumY + 22, '', style(16, '#9fc9c2', 600)).setOrigin(0.5, 0).setDepth(60);

    const toastBg = this.add.graphics().setDepth(69);
    const toast = this.add.text(880, 250, '', style(28, B.C.cream, 800, 0)).setOrigin(0.5).setDepth(70).setAlpha(0);

    return {
      setEquation: (values, sum, t) => {
        target.setText(String(t));
        if (values.length === 0) {
          equation.setText('Choisis des cubes').setColor('#cfe8e4');
          hint.setText('clic, toucher ou flèches + espace');
          return;
        }
        equation.setText(values.length === 1 ? `${sum}` : `${values.join(' + ')} = ${sum}`);
        if (sum === t) {
          equation.setColor(B.C.teal);
          hint.setText('Prêt ! Lance avec Entrée');
        } else if (sum < t) {
          equation.setColor(B.C.cream);
          hint.setText(`encore ${t - sum}`);
        } else {
          equation.setColor(B.C.coralLight);
          hint.setText(`${sum - t} de trop`);
        }
      },
      setScore: (s, k) => {
        score.setText(`Score ${s}`);
        combo.setText(k > 1 ? `Série parfaite ×${k}` : '');
      },
      toast: (msg, kind) => {
        toast.setText(msg).setColor(kind === 'perfect' ? B.C.ink : B.C.cream);
        const w = toast.width + 44;
        toastBg.clear();
        toastBg.fillStyle(kind === 'perfect' ? 0xffc94a : kind === 'good' ? 0x1f6f72 : 0x1d1a2b, kind === 'soft' ? 0.85 : 1);
        toastBg.fillRoundedRect(880 - w / 2, 250 - 26, w, 52, 26);
        toastBg.lineStyle(4, 0x1d1a2b, 1);
        toastBg.strokeRoundedRect(880 - w / 2, 250 - 26, w, 52, 26);
        this.tweens.killTweensOf([toast, toastBg]);
        toast.setAlpha(1).setScale(0.6);
        toastBg.setAlpha(1);
        this.tweens.add({ targets: toast, scale: 1, duration: 320, ease: 'Back.easeOut' });
        this.tweens.add({ targets: [toast, toastBg], alpha: 0, delay: 1700, duration: 400 });
      },
      setMuted: (m) => sound.setText(m ? 'Son : coupé (M)' : 'Son : activé (M)'),
      floatDamage: (x, y, dmg, perfect) => {
        const t = this.add.text(x, y, `−${dmg}`, style(perfect ? 44 : 32, perfect ? B.C.saffron : B.C.cream, 800, 7)).setOrigin(0.5).setDepth(70).setScale(0.4);
        this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({ targets: t, y: y - 80, duration: 1000, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: t, alpha: 0, delay: 700, duration: 300, onComplete: () => t.destroy() });
      },
    };
  }

  protected makeButton(x: number, y: number, label: string, primary: boolean, onClick: () => void): Phaser.GameObjects.Container {
    const key = this.tex(`b-btn-${primary ? 1 : 0}`, () => B.button(172, 54, primary));
    const c = this.add.container(x, y).setDepth(60);
    const bg = this.add.image(0, 3, key).setScale(K);
    const t = this.add.text(0, -1, label, style(24, primary ? B.C.ink : B.C.cream, 800)).setOrigin(0.5);
    c.add([bg, t]);
    c.setSize(176, 60).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.tweens.add({ targets: c, scale: 0.94, duration: 70, yoyo: true, ease: 'Sine.easeOut' });
      onClick();
    });
    return c;
  }

  // --- Effets ---------------------------------------------------------------------------
  protected fireVolley(used: number[], target: number, perfect: boolean, to: Phaser.Math.Vector2, onImpact: () => void): void {
    const fuse = new Phaser.Math.Vector2(LAYOUT.towerX - 20, 250);
    const glowKey = this.tex('b-glow-small', () => B.softGlow(40, '#5fd3bc'));
    let arrived = 0;
    used.forEach((i, k) => {
      const view = this.cubeViews[i];
      (view.obj.list[1] as Phaser.GameObjects.Text).setVisible(false);
      (view.obj.list[0] as Phaser.GameObjects.Image).setTexture('b-tile-spent');
      // Chaque chiffre s'envole en courbe vers le point de fusion.
      const n = this.add.text(view.obj.x, view.obj.y, String(this.shownValues[i]), style(46, B.C.ink, 800)).setOrigin(0.5).setDepth(40);
      const g = this.add.image(view.obj.x, view.obj.y, glowKey).setBlendMode(Phaser.BlendModes.ADD).setDepth(39);
      const start = new Phaser.Math.Vector2(view.obj.x, view.obj.y);
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
      this.sparks.explode(this.reducedMotion ? 3 : 12, fuse.x, fuse.y);
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
            // Étirement dans le sens du vol, sans rotation : le nombre reste lisible.
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

  protected impactFx(at: Phaser.Math.Vector2, perfect: boolean): void {
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

  protected towerHitFx(): void {
    this.towerImg.setTint(0xffb08f);
    this.time.delayedCall(140, () => this.towerImg.clearTint());
    this.tweens.add({ targets: this.towerImg, angle: { from: -2, to: 0 }, duration: 500, ease: 'Elastic.easeOut' });
    this.tweens.add({ targets: this.lanternGlow, alpha: 0.1, duration: 90, yoyo: true, repeat: 2 });
  }
}
