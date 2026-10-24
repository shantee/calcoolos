/**
 * Base commune des scènes « Cubes de siège ».
 * Elle gère les règles, les entrées (souris, tactile, clavier) et l'enchaînement
 * des actions ; chaque variante graphique fournit ses propres visuels et effets.
 */
import Phaser from 'phaser';
import { SiegeRound } from './round';
import { Sfx } from '../sfx';
import { TIERS, type TierId } from '../../core/difficulty';
import type { HitResult } from '../../core/scoring';

export const W = 1280;
export const H = 720;

/** Mise en page commune (coordonnées logiques 1280 × 720). */
export const LAYOUT = {
  gridX: 48,
  gridY: 236,
  pitchX: 94,
  pitchY: 98,
  cube: 84,
  sumY: 184,
  buttonsY: 672,
  towerX: 520,
  groundY: 566,
  lanternY: 342,
  enemyStartX: 1380,
  enemyEnterX: 1130,
  enemyStopX: 640,
};

export interface CubeView {
  readonly obj: Phaser.GameObjects.Container;
  setValue(v: number, appear: boolean): void;
  setSelected(selected: boolean): void;
  setFocus(focused: boolean): void;
  shake(): void;
}

export interface EnemyView {
  readonly obj: Phaser.GameObjects.Container;
  setTarget(n: number, animate: boolean): void;
  setHp(frac: number): void;
  /** Appelé à chaque image pendant la marche. */
  walk(time: number, delta: number): void;
  hit(perfect: boolean, from: Phaser.Math.Vector2): void;
  die(done: () => void): void;
  bump(): void;
  /** Point d'impact (centre du corps). */
  impactPoint(): Phaser.Math.Vector2;
}

export interface Hud {
  setEquation(values: number[], sum: number, target: number): void;
  setScore(score: number, combo: number): void;
  toast(text: string, kind: 'good' | 'perfect' | 'soft'): void;
  setMuted(muted: boolean): void;
  floatDamage(x: number, y: number, damage: number, perfect: boolean): void;
}

export abstract class SiegeSceneBase extends Phaser.Scene {
  protected round!: SiegeRound;
  protected sfx = new Sfx();
  protected reducedMotion = false;
  protected cubeViews: CubeView[] = [];
  /** Valeurs actuellement affichées sur les cubes. */
  protected shownValues: number[] = [];
  protected enemy!: EnemyView;
  protected hud!: Hud;
  protected focus = 0;
  protected busy = false;
  protected enemyHp = 0;
  protected enemyMaxHp = 200;
  protected enemyWalking = false;
  protected enemySpeed = 22;

  // --- À fournir par chaque variante -------------------------------------
  protected abstract buildWorld(): void;
  protected abstract makeCube(index: number, value: number, x: number, y: number): CubeView;
  protected abstract makeEnemy(x: number, y: number): EnemyView;
  protected abstract makeHud(): Hud;
  protected abstract makeButton(x: number, y: number, label: string, primary: boolean, onClick: () => void): Phaser.GameObjects.Container;
  /** Les cubes utilisés se rassemblent, fusionnent et partent vers l'ennemi. */
  protected abstract fireVolley(used: number[], target: number, perfect: boolean, to: Phaser.Math.Vector2, onImpact: () => void): void;
  protected abstract impactFx(at: Phaser.Math.Vector2, perfect: boolean): void;
  protected abstract towerHitFx(): void;

  create(): void {
    const params = new URLSearchParams(window.location.search);
    const seed = Number(params.get('graine')) || Math.floor(Math.random() * 1e9);
    const tierId = (params.get('niveau') as TierId) || 'explorateur';
    const tier = TIERS[tierId] ?? TIERS.explorateur;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || params.has('calme');
    this.round = new SiegeRound(tier, seed, false);

    this.buildWorld();
    this.hud = this.makeHud();
    this.hud.setMuted(this.sfx.muted);
    this.buildGrid();
    this.makeButton(LAYOUT.gridX + 88, LAYOUT.buttonsY, 'Effacer', false, () => this.clearSelection());
    this.makeButton(LAYOUT.gridX + 278, LAYOUT.buttonsY, 'Lancer !', true, () => this.validate());
    this.spawnEnemy();
    this.refreshEquation();
    this.hud.setScore(0, 0);
    this.bindKeys();
    this.input.on('pointerdown', () => this.sfx.unlock());

    // Accès pour les tests et les captures automatisées.
    (window as unknown as { __siege: unknown }).__siege = {
      round: this.round,
      select: (i: number) => this.onCube(i),
      solve: () => this.round.puzzle.solution.forEach((i) => this.onCube(i)),
      validate: () => this.validate(),
      busy: () => this.busy,
    };
  }

  update(time: number, delta: number): void {
    if (!this.enemy) return;
    if (this.enemyWalking) {
      const o = this.enemy.obj;
      o.x -= (this.enemySpeed * delta) / 1000;
      if (o.x <= LAYOUT.enemyStopX) {
        o.x = LAYOUT.enemyStopX;
        this.onEnemyReachesTower();
      }
    }
    this.enemy.walk(time, delta);
  }

  // --- Grille ---------------------------------------------------------------
  protected gridPos(index: number): { x: number; y: number } {
    const { cols, rows } = this.round.tier;
    const col = index % cols;
    const row = Math.floor(index / cols);
    // Grille centrée dans la zone 4×4 quel que soit le palier.
    const offX = ((4 - cols) * LAYOUT.pitchX) / 2;
    const offY = ((4 - rows) * LAYOUT.pitchY) / 2;
    return {
      x: LAYOUT.gridX + offX + col * LAYOUT.pitchX + LAYOUT.cube / 2,
      y: LAYOUT.gridY + offY + row * LAYOUT.pitchY + LAYOUT.cube / 2,
    };
  }

  private buildGrid(): void {
    this.round.cubes.forEach((v, i) => {
      const { x, y } = this.gridPos(i);
      const view = this.makeCube(i, v, x, y);
      view.obj.setSize(LAYOUT.cube, LAYOUT.cube);
      view.obj.setInteractive({ useHandCursor: true });
      view.obj.on('pointerdown', () => {
        this.focus = i;
        this.onCube(i);
      });
      this.cubeViews.push(view);
      this.shownValues.push(v);
    });
  }

  protected onCube(i: number): void {
    if (this.busy) return;
    this.sfx.unlock();
    const selected = this.round.toggle(i);
    this.cubeViews[i].setSelected(selected);
    if (selected) this.sfx.select(this.round.selected.length - 1);
    else this.sfx.deselect();
    this.refreshFocus();
    this.refreshEquation();
  }

  private clearSelection(): void {
    if (this.busy || this.round.selected.length === 0) return;
    for (const i of this.round.selected) this.cubeViews[i].setSelected(false);
    this.round.clear();
    this.sfx.clear();
    this.refreshEquation();
  }

  protected refreshEquation(): void {
    const values = this.round.selected.map((i) => this.round.cubes[i]);
    this.hud.setEquation(values, this.round.sum, this.round.target);
  }

  private refreshFocus(): void {
    this.cubeViews.forEach((c, i) => c.setFocus(this.keyboardUsed && i === this.focus));
  }

  private keyboardUsed = false;

  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    const { cols } = this.round.tier;
    const n = this.round.cubes.length;
    const move = (d: number) => {
      this.keyboardUsed = true;
      this.focus = (this.focus + d + n) % n;
      this.refreshFocus();
    };
    kb.on('keydown-LEFT', () => move(-1));
    kb.on('keydown-RIGHT', () => move(1));
    kb.on('keydown-UP', () => move(-cols));
    kb.on('keydown-DOWN', () => move(cols));
    kb.on('keydown-SPACE', () => {
      this.keyboardUsed = true;
      this.onCube(this.focus);
    });
    kb.on('keydown-ENTER', () => this.validate());
    kb.on('keydown-BACKSPACE', () => this.clearSelection());
    kb.on('keydown-ESC', () => this.clearSelection());
    kb.on('keydown-M', () => this.toggleSound());
  }

  protected toggleSound(): void {
    this.sfx.unlock();
    this.hud.setMuted(this.sfx.toggle());
  }

  // --- Validation -------------------------------------------------------------
  protected validate(): void {
    if (this.busy) return;
    this.sfx.unlock();
    const out = this.round.validate(this.time.now);
    if (out.kind === 'empty') {
      this.hud.toast('Choisis des cubes dont la somme fait ' + this.round.target, 'soft');
      return;
    }
    if (out.kind === 'miss') {
      this.sfx.miss();
      for (const i of this.round.selected) this.cubeViews[i].shake();
      const msg = out.diff > 0 ? `${out.sum} : il manque ${out.diff}` : `${out.sum} : ${-out.diff} de trop`;
      this.hud.toast(msg, 'soft');
      this.hud.setScore(this.round.score, this.round.combo);
      return;
    }
    this.busy = true;
    this.onHit(out.used, out.target, out.optimal, out.result);
  }

  private onHit(used: number[], target: number, optimal: number, result: HitResult): void {
    const to = this.enemy.impactPoint();
    this.sfx.fuse();
    this.time.delayedCall(260, () => this.sfx.whoosh());
    this.fireVolley(used, target, result.perfect, to, () => {
      this.sfx.impact(result.perfect);
      if (result.perfect) this.sfx.perfect();
      this.impactFx(this.enemy.impactPoint(), result.perfect);
      this.enemy.hit(result.perfect, new Phaser.Math.Vector2(LAYOUT.towerX, LAYOUT.lanternY));
      this.hud.floatDamage(to.x + 90, to.y - 10, result.damage, result.perfect);
      if (result.perfect) this.hud.toast(result.combo > 1 ? `Parfait ! Série ×${result.combo}` : 'Parfait !', 'perfect');
      else this.hud.toast(`Touché ! Possible en ${optimal} cubes au lieu de ${used.length}`, 'good');
      this.hud.setScore(this.round.score, this.round.combo);
      this.enemyHp = Math.max(0, this.enemyHp - result.damage);
      this.enemy.setHp(this.enemyHp / this.enemyMaxHp);
      // Les cubes utilisés sont remplacés par de nouveaux (et, cas rare, ceux que
      // le générateur a dû relancer pour garantir une solution).
      let k = 0;
      this.round.cubes.forEach((v, i) => {
        if (!used.includes(i) && this.shownValues[i] === v) return;
        this.cubeViews[i].setSelected(false);
        this.shownValues[i] = v;
        this.time.delayedCall(80 * k++, () => this.cubeViews[i].setValue(v, true));
      });
      if (this.enemyHp <= 0) {
        this.enemyWalking = false;
        this.time.delayedCall(250, () => {
          this.sfx.defeat();
          this.enemy.die(() => {
            this.spawnEnemy();
            this.busy = false;
            this.refreshEquation();
          });
        });
      } else {
        this.time.delayedCall(350, () => {
          this.enemy.setTarget(this.round.target, true);
          this.round.markTargetShown(this.time.now);
          this.busy = false;
          this.refreshEquation();
        });
      }
    });
  }

  private spawnEnemy(): void {
    this.enemy?.obj.destroy();
    this.enemyHp = this.enemyMaxHp;
    this.enemy = this.makeEnemy(LAYOUT.enemyStartX, LAYOUT.groundY);
    this.enemy.setTarget(this.round.target, false);
    this.enemy.setHp(1);
    this.round.markTargetShown(this.time.now);
    // Entrée en scène rapide, puis marche lente vers le phare.
    this.enemyWalking = false;
    this.tweens.add({
      targets: this.enemy.obj,
      x: LAYOUT.enemyEnterX,
      duration: 1300,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.enemyWalking = true;
      },
    });
  }

  private onEnemyReachesTower(): void {
    this.enemyWalking = false;
    this.sfx.bump();
    this.enemy.bump();
    this.towerHitFx();
    if (!this.reducedMotion) this.cameras.main.shake(180, 0.004);
    this.hud.toast('Le phare tient bon… mais attention !', 'soft');
    // Prototype : l'ennemi est repoussé et repart (pas de défaite en V0).
    this.tweens.add({
      targets: this.enemy.obj,
      x: LAYOUT.enemyStopX + 260,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.enemyWalking = true;
      },
    });
  }
}
