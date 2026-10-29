/**
 * Déroulement d'une partie complète (vagues, monstres, cœurs du phare,
 * statistiques), sans aucun rendu. La scène Phaser s'appuie dessus.
 */
import { SiegeRound, type ValidateOutcome } from './round';
import { AdaptiveDifficulty, adjustConfig } from '../../core/adaptive';
import { ARCHETYPES, MODES, WAVES, damageTo, type Archetype, type EnemyKind, type Mode } from '../../core/waves';
import type { Tier } from '../../core/difficulty';
import { Releve } from '../../platform/releve';

export interface Stats {
  attempts: number;
  hits: number;
  perfects: number;
  misses: number;
  bestCombo: number;
  defeated: number;
  /** Temps (s) des réponses justes, pour la médiane. */
  times: number[];
}

export type Phase = 'play' | 'won' | 'lost';

export class SiegeSession {
  readonly round: SiegeRound;
  readonly mode: Mode;
  readonly adaptive = new AdaptiveDifficulty();
  readonly stats: Stats = { attempts: 0, hits: 0, perfects: 0, misses: 0, bestCombo: 0, defeated: 0, times: [] };
  /** Relevé commun (src/platform/releve.ts) : une validation = un calcul, temps depuis l'apparition de la cible. */
  readonly releve = new Releve();
  wave = 0;
  private queue: EnemyKind[] = [];
  enemy: Archetype | null = null;
  enemyHp = 0;
  hearts: number | null;
  phase: Phase = 'play';
  bonus = 0;
  /** Méga-tir prêt (bonus) : le prochain coup réussi frappe deux fois plus fort. */
  charged = false;
  private shownAt = 0;

  constructor(tier: Tier, seed: number, mode: Mode) {
    this.mode = mode;
    this.round = new SiegeRound(tier, seed, MODES[mode].timed);
    this.hearts = MODES[mode].hearts;
    this.queue = [...WAVES[0]];
  }

  get score(): number {
    return this.round.score + this.bonus;
  }

  get waveCount(): number {
    return WAVES.length;
  }

  /** Vitesse du monstre courant selon le mode. */
  get enemySpeed(): number {
    return this.enemy ? this.enemy.speed * MODES[this.mode].speedFactor : 0;
  }

  /** Fait entrer le monstre suivant. Renvoie null s'il faut changer de vague ou si c'est fini. */
  nextEnemy(nowMs: number): Archetype | null {
    if (this.phase !== 'play') return null;
    const kind = this.queue.shift();
    if (!kind) return null;
    this.enemy = ARCHETYPES[kind];
    this.enemyHp = this.enemy.hp;
    this.markShown(nowMs);
    return this.enemy;
  }

  /** Passe à la vague suivante ; false si toutes les vagues sont terminées (victoire). */
  nextWave(): boolean {
    if (this.wave + 1 >= WAVES.length) {
      this.phase = 'won';
      return false;
    }
    this.wave++;
    this.queue = [...WAVES[this.wave]];
    return true;
  }

  get waveCleared(): boolean {
    return this.queue.length === 0 && (this.enemy === null || this.enemyHp <= 0);
  }

  markShown(nowMs: number): void {
    this.shownAt = nowMs;
    this.round.markTargetShown(nowMs);
  }

  validate(nowMs: number): { outcome: ValidateOutcome; damage: number; killed: boolean; armoredHalved: boolean; mega: boolean } {
    const outcome = this.round.validate(nowMs);
    let damage = 0;
    let killed = false;
    let armoredHalved = false;
    let mega = false;
    if (outcome.kind === 'empty') return { outcome, damage, killed, armoredHalved, mega };
    this.stats.attempts++;
    if (outcome.kind === 'miss') {
      this.stats.misses++;
      this.releve.reponse(false);
      this.adaptive.record('miss');
      return { outcome, damage, killed, armoredHalved, mega };
    }
    const perfect = outcome.result.perfect;
    this.stats.hits++;
    if (perfect) this.stats.perfects++;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.round.combo);
    this.stats.times.push((nowMs - this.shownAt) / 1000);
    this.releve.reponse(true, nowMs - this.shownAt);
    this.adaptive.record(perfect ? 'perfect' : 'hit');
    // La difficulté ajustée s'applique aux cibles suivantes.
    this.round.puzzleConfig = adjustConfig(this.round.tier.puzzle, this.adaptive.offset);
    if (this.enemy) {
      damage = damageTo(this.enemy.kind, outcome.result.damage, perfect);
      armoredHalved = damage < outcome.result.damage;
      if (this.charged) {
        damage *= 2;
        mega = true;
        this.charged = false;
      }
      this.enemyHp = Math.max(0, this.enemyHp - damage);
      if (this.enemyHp === 0) {
        killed = true;
        this.stats.defeated++;
        this.bonus += this.enemy.bounty;
      }
    }
    this.shownAt = nowMs;
    return { outcome, damage, killed, armoredHalved, mega };
  }

  /**
   * Le monstre atteint le phare. En mode Défi, le phare perd un cœur et le
   * monstre s'en va ; en mode Tranquille, il est seulement repoussé.
   * Renvoie true si le monstre quitte la partie.
   */
  enemyReachedTower(): boolean {
    if (this.hearts === null) return false;
    this.hearts--;
    this.enemyHp = 0;
    if (this.hearts <= 0) this.phase = 'lost';
    return true;
  }

  /** Temps médian des bonnes réponses (s), ou null. */
  medianTime(): number | null {
    if (this.stats.times.length === 0) return null;
    const t = [...this.stats.times].sort((a, b) => a - b);
    const m = Math.floor(t.length / 2);
    return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
  }

  accuracy(): number {
    return this.stats.attempts === 0 ? 0 : this.stats.hits / this.stats.attempts;
  }
}
