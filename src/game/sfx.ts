/**
 * Sons synthétisés en direct (Web Audio) : aucun fichier audio, aucun droit à gérer.
 * Le son est coupable à tout moment ; le choix est mémorisé dans le navigateur.
 */
const STORAGE_KEY = 'calcoolos.son';

type Wave = OscillatorType;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted: boolean;

  constructor() {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* stockage indisponible : son actif par défaut */
    }
    this._muted = stored === 'off';
  }

  get muted(): boolean {
    return this._muted;
  }

  toggle(): boolean {
    this._muted = !this._muted;
    try {
      localStorage.setItem(STORAGE_KEY, this._muted ? 'off' : 'on');
    } catch {
      /* ignoré */
    }
    if (this.master) this.master.gain.value = this._muted ? 0 : 0.5;
    return this._muted;
  }

  /** À appeler sur un geste du joueur (les navigateurs bloquent l'audio avant). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
  }

  private tone(freq: number, dur: number, opts: { wave?: Wave; gain?: number; slideTo?: number; delay?: number; attack?: number } = {}): void {
    if (!this.ctx || !this.master || this._muted) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.wave ?? 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    const peak = opts.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, opts: { gain?: number; filter?: number; delay?: number; q?: number } = {}): void {
    if (!this.ctx || !this.master || this._muted) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = opts.filter ?? 1200;
    f.Q.value = opts.q ?? 0.8;
    const g = this.ctx.createGain();
    g.gain.value = opts.gain ?? 0.4;
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  /** Sélection d'un cube : la hauteur monte avec le nombre de cubes choisis. */
  select(step: number): void {
    const scale = [392, 440, 494, 587, 659, 784, 880];
    const f = scale[Math.min(step, scale.length - 1)];
    this.tone(f, 0.12, { wave: 'triangle', gain: 0.22 });
    this.tone(f * 2, 0.06, { wave: 'sine', gain: 0.06 });
  }

  deselect(): void {
    this.tone(330, 0.09, { wave: 'triangle', gain: 0.15, slideTo: 260 });
  }

  clear(): void {
    this.tone(300, 0.12, { wave: 'sine', gain: 0.12, slideTo: 200 });
  }

  /** Erreur douce, jamais agressive. */
  miss(): void {
    this.tone(220, 0.16, { wave: 'sine', gain: 0.18 });
    this.tone(196, 0.22, { wave: 'sine', gain: 0.16, delay: 0.12 });
  }

  fuse(): void {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, { wave: 'triangle', gain: 0.14, delay: i * 0.03 }));
  }

  whoosh(): void {
    this.noise(0.35, { gain: 0.35, filter: 900, q: 0.6 });
    this.tone(500, 0.3, { wave: 'sine', gain: 0.06, slideTo: 1400 });
  }

  impact(strong: boolean): void {
    this.noise(0.22, { gain: strong ? 0.7 : 0.45, filter: 500, q: 0.5 });
    this.tone(strong ? 120 : 150, 0.25, { wave: 'sine', gain: 0.5, slideTo: 45 });
  }

  perfect(): void {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, { wave: 'square', gain: 0.05, delay: 0.08 + i * 0.06 }));
  }

  defeat(): void {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.16, { wave: 'triangle', gain: 0.16, delay: i * 0.07 }));
    this.noise(0.5, { gain: 0.3, filter: 2400, delay: 0.1 });
  }

  /** Hou-hou de la chouette. */
  owl(): void {
    this.tone(520, 0.18, { wave: 'sine', gain: 0.16, slideTo: 440 });
    this.tone(500, 0.3, { wave: 'sine', gain: 0.16, slideTo: 400, delay: 0.24 });
  }

  /** Petit « plop » (escargot qui rentre dans sa coquille). */
  pop(): void {
    this.tone(700, 0.08, { wave: 'sine', gain: 0.2, slideTo: 260 });
  }

  /** Annonce d'une vague. */
  fanfare(): void {
    [392, 523, 659].forEach((f, i) => this.tone(f, 0.16, { wave: 'triangle', gain: 0.12, delay: i * 0.09 }));
  }

  victory(): void {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { wave: 'triangle', gain: 0.14, delay: i * 0.12 }));
  }

  bump(): void {
    this.tone(90, 0.3, { wave: 'sawtooth', gain: 0.12, slideTo: 60 });
  }
}
