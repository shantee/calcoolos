/** Arsenal unique et livraisons magiques, indépendants de Phaser. */
import { createRng, type Rng } from '../../core/rng';
import { WAVES, type Mode } from '../../core/waves';

export type SpellId = 0 | 1 | 2;
export const SPELL_NAMES = ['Coup de froid', 'Météorite', 'Indice lumineux'] as const;
export const MAX_CHARGES = 2;
export const RECHARGE_HITS = [8, 6, 4] as const;
export const PASSES_PER_GAME = 2;
export const FREEZE_MS = 8000;

export interface Flight {
  cargo: SpellId;
  vehicle: 'soucoupe' | 'dirigeable';
  durationMs: number;
  state: 'flying' | 'caught' | 'escaped';
}

export class MagicPowers {
  readonly charges = [1, 1, 1];
  readonly progress = [0, 0, 0];
  readonly plan: number[];
  flight: Flight | null = null;
  launched = 0;
  caught = 0;
  private rng: Rng;

  constructor(readonly mode: Mode, seed: number) {
    this.rng = createRng(seed ^ 0x5eed);
    const start = (w: number) => WAVES.slice(0, w).reduce((n, wave) => n + wave.length, 0);
    this.plan = [this.rng.int(start(1), start(2) - 1), this.rng.int(start(2), start(WAVES.length) - 1)];
  }

  private get missing(): SpellId[] {
    return ([0, 1, 2] as SpellId[]).filter(i => this.charges[i] < MAX_CHARGES);
  }

  /** Une bonne réponse recharge progressivement ; aucune réserve cachée à plein. */
  recordHit(): void {
    for (const i of [0, 1, 2] as SpellId[]) {
      if (this.charges[i] >= MAX_CHARGES) { this.progress[i] = 0; continue; }
      if (++this.progress[i] >= RECHARGE_HITS[i]) {
        this.charges[i]++;
        this.progress[i] = 0;
      }
    }
  }

  use(i: SpellId): boolean {
    if (this.charges[i] <= 0) return false;
    this.charges[i]--;
    return true;
  }

  due(enemyIndex: number): boolean {
    return !this.flight && this.missing.length > 0 && this.launched < PASSES_PER_GAME && enemyIndex >= this.plan[this.launched];
  }

  delayAfterEnemy(): number { return this.rng.int(1500, 4000); }

  launch(force = false): Flight | null {
    if (this.flight || !this.missing.length || (!force && this.launched >= PASSES_PER_GAME)) return null;
    const cargo = this.rng.pick(this.missing);
    this.flight = { cargo, vehicle: this.launched % 2 ? 'dirigeable' : 'soucoupe',
      durationMs: this.mode === 'tranquille' ? 12000 : 10000, state: 'flying' };
    this.launched++;
    return this.flight;
  }

  /** Repli sur un autre sort si la réserve du chargement s'est remplie pendant le vol. */
  collect(): SpellId | null {
    const f = this.flight;
    if (!f || f.state !== 'flying') return null;
    f.state = 'caught';
    const i = this.charges[f.cargo] < MAX_CHARGES ? f.cargo : this.missing[0];
    if (i === undefined) return null;
    this.charges[i]++;
    if (this.charges[i] === MAX_CHARGES) this.progress[i] = 0;
    this.caught++;
    return i;
  }

  expire(): void { if (this.flight?.state === 'flying') this.flight.state = 'escaped'; }
  endFlight(): void { this.flight = null; }
}
