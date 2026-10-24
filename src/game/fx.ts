/**
 * Effets partagés entre les jeux : feu d'artifice et confettis.
 */
import Phaser from 'phaser';
import * as B from '../art/variant-b';
import * as Wd from '../art/world-b';

export const FIREWORK_COLORS = ['#ff4d6d', '#ff8fb1', '#ffc94a', '#ffffff', '#5fd3bc', '#b79ad8'];

export class Fireworks {
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor(
    private scene: Phaser.Scene,
    private depth: number,
    private reduced: boolean,
  ) {}

  private tex(key: string, make: () => HTMLCanvasElement): string {
    if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, make());
    return key;
  }

  private ensure(): void {
    if (this.emitters.length) return;
    for (const col of FIREWORK_COLORS) {
      const em = this.scene.add.particles(0, 0, this.tex(`w-fw-${col}`, () => B.sparkle(col)), {
        speed: { min: 140, max: 360 },
        angle: { min: 0, max: 360 },
        rotate: { min: 0, max: 360 },
        gravityY: 240,
        lifespan: { min: 700, max: 1200 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0.2 },
        emitting: false,
        // Couleurs franches : seul le blanc est additif (éclat).
        blendMode: col === '#ffffff' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
      }).setDepth(this.depth);
      em.setData('color', col);
      this.emitters.push(em);
    }
  }

  /** Une gerbe : anneau, étincelles colorées puis crépitement blanc. */
  burst(x: number, y: number, palette = ['#ff4d6d', '#ff8fb1', '#ffc94a', '#ffffff']): void {
    this.ensure();
    const count = this.reduced ? 6 : 14;
    for (const em of this.emitters) if (palette.includes(em.getData('color') as string)) em.explode(count, x, y);
    const ring = this.scene.add.circle(x, y, 14).setStrokeStyle(5, Phaser.Display.Color.HexStringToColor(palette[0]).color).setDepth(this.depth - 1).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    if (this.reduced) return;
    const white = this.emitters.find((e) => e.getData('color') === '#ffffff');
    this.scene.time.delayedCall(450, () => {
      for (let k = 0; k < 6; k++) white?.explode(2, x + Phaser.Math.Between(-90, 90), y + Phaser.Math.Between(-60, 80));
    });
  }

  /** Pluie de confettis sur toute la largeur ; renvoie les émetteurs (à détruire au besoin). */
  confetti(width: number, durationMs: number): Phaser.GameObjects.Particles.ParticleEmitter[] {
    if (this.reduced) return [];
    return ['#ff4d6d', '#ffc94a', '#5fd3bc', '#b79ad8', '#f6ecd8'].map((col, i) =>
      this.scene.add.particles(0, 0, this.tex(`w-confetti-${i}`, () => Wd.confetti(col)), {
        x: { min: 0, max: width },
        y: -20,
        speedY: { min: 90, max: 200 },
        speedX: { min: -50, max: 50 },
        rotate: { start: 0, end: 720 },
        scaleX: { start: 0.6, end: 0.2, random: true },
        lifespan: 4500,
        frequency: 90,
        duration: durationMs,
      }).setDepth(this.depth + 3),
    );
  }
}
