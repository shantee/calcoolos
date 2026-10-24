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

  private noise(dur: number, opts: { gain?: number; filter?: number; delay?: number; q?: number; type?: BiquadFilterType } = {}): void {
    if (!this.ctx || !this.master || this._muted) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
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

  /** Grognement d'un monstre qui arrive. */
  growl(): void {
    this.tone(120, 0.45, { wave: 'sawtooth', gain: 0.07, slideTo: 70 });
    this.tone(126, 0.45, { wave: 'sawtooth', gain: 0.05, slideTo: 74 });
    this.noise(0.4, { gain: 0.12, filter: 300, type: 'lowpass' });
  }

  /** « Aïe ! » du monstre touché : petit couinement rétro. */
  ouch(): void {
    this.tone(880, 0.12, { wave: 'square', gain: 0.06, slideTo: 300 });
    this.tone(660, 0.1, { wave: 'square', gain: 0.05, slideTo: 220, delay: 0.1 });
  }

  /** Pièce rétro (bonus d'un monstre vaincu). */
  coin(): void {
    this.tone(988, 0.08, { wave: 'square', gain: 0.07 });
    this.tone(1319, 0.3, { wave: 'square', gain: 0.07, delay: 0.08 });
  }

  /** Clochette de la lune. */
  chime(): void {
    [1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.4, { wave: 'sine', gain: 0.07, delay: i * 0.07 }));
  }

  /** « Bloup » du poisson volant. */
  bloop(): void {
    this.tone(300, 0.12, { wave: 'sine', gain: 0.12, slideTo: 900 });
  }

  /** Cascade de pierres. */
  stones(): void {
    for (let i = 0; i < 6; i++) this.noise(0.07, { gain: 0.25, filter: 1800 + i * 300, q: 2, delay: 0.05 + i * 0.09 + Math.random() * 0.04 });
  }

  /** Cœur perdu. */
  heartLost(): void {
    [523, 392, 262].forEach((f, i) => this.tone(f, 0.18, { wave: 'square', gain: 0.06, delay: i * 0.11 }));
  }

  /** Effondrement du phare : grondement, fracas, chute de pierres. */
  collapse(): void {
    this.noise(2.2, { gain: 0.5, filter: 160, type: 'lowpass' });
    this.tone(70, 1.6, { wave: 'sine', gain: 0.5, slideTo: 30 });
    this.noise(0.6, { gain: 0.6, filter: 700, q: 0.4, delay: 0.7 });
    this.tone(55, 0.8, { wave: 'sine', gain: 0.6, slideTo: 25, delay: 0.7 });
    this.stones();
    for (let i = 0; i < 5; i++) this.noise(0.08, { gain: 0.3, filter: 2500, q: 2, delay: 1 + i * 0.13 });
  }

  /** Ricanement « hé hé hé » des monstres. */
  laugh(delay = 0): void {
    [620, 540, 620, 540, 700].forEach((f, i) => this.tone(f, 0.09, { wave: 'square', gain: 0.05, slideTo: f * 0.85, delay: delay + i * 0.12 }));
  }

  /** Petite ritournelle de danse des monstres (rétro). */
  danceTune(): void {
    const notes = [262, 330, 392, 330, 294, 349, 440, 349, 262, 330, 392, 523, 392, 330, 262, 196];
    notes.forEach((f, i) => {
      this.tone(f, 0.14, { wave: 'square', gain: 0.045, delay: i * 0.18 });
      if (i % 2 === 0) this.tone(f / 2, 0.12, { wave: 'triangle', gain: 0.08, delay: i * 0.18 });
    });
  }

  /** Fusée de feu d'artifice : sifflement, détonation, crépitement. */
  firework(delay = 0): void {
    this.tone(900, 0.25, { wave: 'sine', gain: 0.05, slideTo: 2200, delay });
    this.noise(0.3, { gain: 0.45, filter: 900, q: 0.5, delay: delay + 0.22 });
    this.tone(160, 0.25, { wave: 'sine', gain: 0.25, slideTo: 60, delay: delay + 0.22 });
    for (let i = 0; i < 7; i++) this.noise(0.03, { gain: 0.18, filter: 4000 + i * 400, q: 3, delay: delay + 0.45 + i * 0.06 + Math.random() * 0.05 });
  }

  /**
   * Fanfare de victoire, composée pour le jeu (mélodie originale) :
   * montée joyeuse, thème en deux phrases, trille et accord final.
   */
  victoryJingle(): void {
    const q = 0.16;
    const melody: Array<[number, number]> = [
      [392, 1], [523, 1], [659, 1], [784, 2], [659, 1], [784, 3],
      [698, 1], [880, 1], [1047, 2], [880, 1], [1047, 3],
      [988, 1], [1047, 1], [988, 1], [1047, 1], [1175, 2], [1319, 6],
    ];
    let t = 0;
    for (const [f, d] of melody) {
      this.tone(f, q * d * 0.95, { wave: 'square', gain: 0.06, delay: t });
      this.tone(f / 2, q * d * 0.9, { wave: 'triangle', gain: 0.1, delay: t });
      t += q * d;
    }
    // Accord final tenu.
    [523, 659, 784, 1047].forEach((f) => this.tone(f, 1.2, { wave: 'triangle', gain: 0.07, delay: t - q * 6 }));
    // Petites percussions.
    for (let b = 0; b < Math.floor(t / (q * 2)); b++) this.noise(0.05, { gain: 0.12, filter: 5000, q: 1, delay: b * q * 2 });
  }

  /** Tir laser rétro. */
  laser(): void {
    this.tone(1400, 0.16, { wave: 'square', gain: 0.06, slideTo: 300 });
    this.tone(2100, 0.1, { wave: 'sawtooth', gain: 0.03, slideTo: 600 });
  }

  /** Explosion (plus grosse si `big`). */
  boom(big = false): void {
    this.noise(big ? 0.9 : 0.45, { gain: big ? 0.7 : 0.5, filter: big ? 300 : 600, type: 'lowpass' });
    this.tone(big ? 90 : 140, big ? 0.7 : 0.35, { wave: 'sine', gain: 0.4, slideTo: 35 });
  }

  /** Bip d'une touche du pavé (hauteur selon le chiffre). */
  key(d: number): void {
    this.tone(500 + d * 45, 0.06, { wave: 'square', gain: 0.04 });
  }

  /** Erreur de saisie : bourdonnement bref. */
  buzz(): void {
    this.tone(150, 0.22, { wave: 'sawtooth', gain: 0.08 });
    this.tone(142, 0.22, { wave: 'sawtooth', gain: 0.06 });
  }

  /** Alarme du boss. */
  alarm(): void {
    for (let i = 0; i < 3; i++) {
      this.tone(660, 0.22, { wave: 'square', gain: 0.06, slideTo: 440, delay: i * 0.45 });
      this.tone(440, 0.2, { wave: 'square', gain: 0.05, slideTo: 660, delay: i * 0.45 + 0.22 });
    }
  }

  /** Onde de choc du météore doré. */
  shockwave(): void {
    this.tone(200, 0.9, { wave: 'sine', gain: 0.3, slideTo: 1600 });
    this.noise(1, { gain: 0.5, filter: 1200, q: 0.3 });
    this.chime();
  }

  /** Bip-boup d'un robot ennemi qui arrive. */
  robotBeep(): void {
    this.tone(880, 0.08, { wave: 'square', gain: 0.04 });
    this.tone(660, 0.08, { wave: 'square', gain: 0.04, delay: 0.1 });
    this.tone(990, 0.1, { wave: 'square', gain: 0.04, delay: 0.2 });
  }

  bump(): void {
    this.tone(90, 0.3, { wave: 'sawtooth', gain: 0.12, slideTo: 60 });
  }
}
