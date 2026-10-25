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

  private tone(freq: number, dur: number, opts: { wave?: Wave; gain?: number; slideTo?: number; delay?: number; attack?: number; at?: number; out?: AudioNode } = {}): void {
    if (!this.ctx || !this.master || this._muted) return;
    const t0 = opts.at ?? this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.wave ?? 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    const peak = opts.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(opts.out ?? this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, opts: { gain?: number; filter?: number; delay?: number; q?: number; type?: BiquadFilterType; at?: number; out?: AudioNode } = {}): void {
    if (!this.ctx || !this.master || this._muted) return;
    const t0 = opts.at ?? this.ctx.currentTime + (opts.delay ?? 0);
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
    src.connect(f).connect(g).connect(opts.out ?? this.master);
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

  // --- Petits sons de Pluie de météores -------------------------------------------------------

  /** Bip d'alerte : un météore approche dangereusement. */
  danger(): void {
    this.tone(1046, 0.07, { wave: 'square', gain: 0.04 });
    this.tone(1046, 0.07, { wave: 'square', gain: 0.04, delay: 0.12 });
  }

  /** « Boing » d'un ressort qui s'échappe. */
  boing(): void {
    this.tone(180, 0.35, { wave: 'triangle', gain: 0.12, slideTo: 620 });
    this.tone(620, 0.25, { wave: 'sine', gain: 0.06, slideTo: 260, delay: 0.18 });
  }

  /** Tintement d'une pièce qui rejoint le score (de plus en plus aigu). */
  coinTick(i: number): void {
    this.tone(1200 + i * 90, 0.08, { wave: 'square', gain: 0.035 });
  }

  /** Chant de la baleine cosmique. */
  whale(): void {
    this.tone(260, 1.2, { wave: 'sine', gain: 0.16, slideTo: 420, attack: 0.25 });
    this.tone(420, 1.4, { wave: 'sine', gain: 0.12, slideTo: 200, delay: 1, attack: 0.25 });
    this.tone(520, 0.9, { wave: 'triangle', gain: 0.05, slideTo: 640, delay: 0.4, attack: 0.2 });
  }

  /** Miaou du chat astronaute. */
  meow(): void {
    this.tone(700, 0.18, { wave: 'triangle', gain: 0.12, slideTo: 1100 });
    this.tone(1100, 0.3, { wave: 'triangle', gain: 0.1, slideTo: 600, delay: 0.16 });
  }

  /** Coin-coin du canard. */
  quack(): void {
    for (const d of [0, 0.2]) {
      this.tone(420, 0.12, { wave: 'sawtooth', gain: 0.08, slideTo: 300, delay: d });
      this.noise(0.1, { gain: 0.1, filter: 900, q: 4, delay: d });
    }
  }

  /** Passage en mode « en feu ». */
  feverOn(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.12, { wave: 'square', gain: 0.05, delay: i * 0.05 }));
    this.noise(0.5, { gain: 0.2, filter: 3000, q: 0.5, delay: 0.1 });
  }

  /** Fin du mode « en feu ». */
  feverOff(): void {
    this.tone(400, 0.3, { wave: 'triangle', gain: 0.08, slideTo: 150 });
  }

  /** Étoile de fin de partie (n = 0, 1, 2). */
  star(n: number): void {
    [784, 988, 1175].slice(0, n + 1).forEach((f, i) => this.tone(f * (1 + n * 0.12), 0.2, { wave: 'square', gain: 0.05, delay: i * 0.06 }));
    this.chime();
  }

  /** Apparition par téléportation. */
  warp(): void {
    this.tone(200, 0.25, { wave: 'sine', gain: 0.05, slideTo: 1200 });
  }

  // --- Musique rétro ------------------------------------------------------------------------------
  private musicTimer: number | null = null;
  private musicBus: GainNode | null = null;
  private musicStep = 0;
  private musicNext = 0;
  private musicTempo = 112;
  private musicIntensity = 0;
  private musicTrack: 'espace' | 'dragon' | 'fusee' = 'espace';

  /**
   * Petite boucle chiptune jouée en direct (basse, arpège, charleston), composée
   * pour le jeu. `intensity` : 0 calme, 1 mode « en feu », 2 boss.
   */
  music(on: boolean, intensity = 0, track: 'espace' | 'dragon' | 'fusee' = 'espace'): void {
    this.musicIntensity = intensity;
    this.musicTrack = track;
    this.musicTempo = (track === 'dragon' ? [100, 112, 118] : track === 'fusee' ? [128, 140, 104] : [112, 124, 136])[intensity] ?? 112;
    if (!on) {
      if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
      this.musicTimer = null;
      if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    if (!this.ctx || !this.master) return;
    if (!this.musicBus) {
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
    }
    this.musicBus.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.2);
    if (this.musicTimer !== null) return;
    this.musicNext = this.ctx.currentTime + 0.05;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 30);
  }

  private scheduleMusic(): void {
    if (!this.ctx || !this.musicBus) return;
    if (this.musicTrack === 'dragon') {
      this.scheduleDragon();
      return;
    }
    if (this.musicTrack === 'fusee') {
      this.scheduleRocket();
      return;
    }
    const sixteenth = 60 / this.musicTempo / 4;
    // La mineur, Fa, Do, Sol : une grille d'aventure spatiale.
    const chords = [
      [220, 262, 330],
      [175, 220, 262],
      [262, 330, 392],
      [196, 247, 294],
    ];
    while (this.musicNext < this.ctx.currentTime + 0.12) {
      const step = this.musicStep % 64;
      const chord = chords[Math.floor(step / 16)];
      const at = this.musicNext;
      const out = this.musicBus;
      if (step % 4 === 0) this.tone(chord[0] / 2, sixteenth * 3, { wave: 'triangle', gain: 0.16, at, out });
      if (step % 8 === 6) this.tone(chord[0] / 2, sixteenth, { wave: 'triangle', gain: 0.1, at, out });
      const arp = chord[[0, 1, 2, 1][step % 4]] * (this.musicIntensity > 0 && step % 8 >= 4 ? 4 : 2);
      this.tone(arp, sixteenth * 0.8, { wave: 'square', gain: 0.018, at, out });
      if (step % 2 === 1) this.noise(0.03, { gain: this.musicIntensity > 0 ? 0.07 : 0.04, filter: 7000, q: 1, at, out });
      if (step % 8 === 4 && this.musicIntensity >= 1) this.noise(0.08, { gain: 0.12, filter: 1500, q: 0.7, at, out });
      if (this.musicIntensity >= 2 && step % 16 === 0) this.tone(chord[2] * 2, sixteenth * 6, { wave: 'sawtooth', gain: 0.02, at, out });
      this.musicNext += sixteenth;
      this.musicStep++;
    }
  }

  /**
   * Musique du Dragon gourmand (composée pour le jeu) : gamme pentatonique,
   * cordes pincées, tambour grave et bloc de bois. En orage (intensité 2), la
   * gamme passe en mineur.
   */
  private scheduleDragon(): void {
    if (!this.ctx || !this.musicBus) return;
    const sixteenth = 60 / this.musicTempo / 4;
    const storm = this.musicIntensity >= 2;
    const scale = storm
      ? [293.66, 349.23, 392, 440, 523.25, 587.33, 698.46, 783.99, 880]
      : [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.26, 739.99, 880];
    const roots = storm ? [146.83, 116.54, 130.81, 110] : [146.83, 123.47, 98, 110];
    // Mélodie en croches (indices de la gamme, -1 = silence).
    const melody = [4, -1, 3, 2, 3, -1, 1, -1, 2, 3, 4, 6, 5, -1, 4, -1, 3, -1, 2, 1, 2, -1, 0, -1, 1, 2, 3, 1, 0, -1, -1, -1];
    const answer = [5, 6, 5, 4, 3, -1, 4, -1, 5, -1, 7, 6, 5, -1, -1, -1, 6, 5, 4, 3, 4, -1, 2, -1, 3, 4, 2, 1, 0, -1, -1, -1];
    while (this.musicNext < this.ctx.currentTime + 0.12) {
      const step = this.musicStep % 128;
      const bar = Math.floor((step % 64) / 16);
      const at = this.musicNext;
      const out = this.musicBus;
      const root = roots[bar];
      // Basse ronde.
      if (step % 8 === 0) this.tone(root, sixteenth * 5, { wave: 'sine', gain: 0.22, at, out });
      if (step % 8 === 6) this.tone(root * 1.5, sixteenth * 2, { wave: 'triangle', gain: 0.08, at, out });
      // Mélodie pincée, puis sa réponse une octave plus haut en fièvre.
      if (step % 2 === 0) {
        const phrase = step < 64 ? melody : answer;
        const deg = phrase[(step % 64) / 2];
        if (deg >= 0) {
          const f = scale[deg] * (this.musicIntensity === 1 && step >= 64 ? 2 : 1);
          this.tone(f, sixteenth * 3, { wave: 'triangle', gain: 0.07, at, out });
          this.tone(f * 2, sixteenth * 1.2, { wave: 'sine', gain: 0.02, at, out });
        }
      }
      // Tambour grave et bloc de bois.
      if (step % 16 === 0 || step % 16 === 10) this.tone(95, 0.22, { wave: 'sine', gain: 0.22, slideTo: 42, at, out });
      if (step % 8 === 4) this.noise(0.04, { gain: 0.1, filter: 2600, q: 9, at, out });
      if (this.musicIntensity >= 1 && step % 2 === 1) this.noise(0.025, { gain: 0.04, filter: 7000, q: 1, at, out });
      if (storm && step % 32 === 0) this.tone(root / 2, sixteenth * 30, { wave: 'sawtooth', gain: 0.018, at, out, attack: 0.4 });
      this.musicNext += sixteenth;
      this.musicStep++;
    }
  }

  // --- Petits sons du Dragon gourmand --------------------------------------------------------

  /** « Crounch » : le dragon croque une lanterne. */
  chomp(): void {
    this.noise(0.08, { gain: 0.3, filter: 1400, q: 1.2 });
    this.tone(320, 0.1, { wave: 'square', gain: 0.05, slideTo: 140 });
  }

  /** « Gloup » mélodieux : la hauteur monte avec le nombre de lanternes avalées. */
  gulp(i: number): void {
    const notes = [587, 659, 740, 880, 988, 1175, 1319];
    const f = notes[Math.min(i, notes.length - 1)];
    this.tone(f, 0.18, { wave: 'triangle', gain: 0.12, delay: 0.05 });
    this.tone(f / 2, 0.14, { wave: 'sine', gain: 0.1, slideTo: f, delay: 0.02 });
  }

  /** Souffle de feu (plus long et grave pour un coup parfait). */
  fireBreath(big: boolean): void {
    const d = big ? 1.5 : 0.9;
    this.noise(d, { gain: 0.5, filter: 700, type: 'lowpass' });
    this.noise(d * 0.8, { gain: 0.25, filter: 2200, q: 0.4, delay: 0.05 });
    this.tone(110, d, { wave: 'sawtooth', gain: 0.07, slideTo: 55 });
    this.tone(220, d * 0.6, { wave: 'square', gain: 0.03, slideTo: 90 });
  }

  /** « Miam ! » : petite montée joyeuse. */
  yum(): void {
    [587, 740, 880, 1175].forEach((f, i) => this.tone(f, 0.14, { wave: 'square', gain: 0.045, delay: i * 0.06 }));
  }

  /** Hoquet. */
  hiccup(delay = 0): void {
    this.tone(380, 0.09, { wave: 'sine', gain: 0.2, slideTo: 980, delay });
    this.noise(0.05, { gain: 0.12, filter: 1800, q: 3, delay });
  }

  /** Trombone triste (wah-wah-wah-waaah), en sourdine. */
  sadTrombone(): void {
    const notes: Array<[number, number, number]> = [[392, 370, 0], [370, 349, 0.3], [349, 330, 0.6], [330, 262, 0.9]];
    for (const [a, b, t] of notes) this.tone(a, t < 0.9 ? 0.28 : 0.8, { wave: 'sawtooth', gain: 0.05, slideTo: b, delay: t, attack: 0.04 });
  }

  /** Cri de chauve-souris. */
  batScreech(): void {
    this.tone(1800, 0.07, { wave: 'square', gain: 0.03, slideTo: 2600 });
    this.tone(2000, 0.07, { wave: 'square', gain: 0.03, slideTo: 2800, delay: 0.1 });
  }

  /** Chauve-souris roussie : « pouf » puis « couic ». */
  batPoof(): void {
    this.noise(0.25, { gain: 0.3, filter: 900, q: 0.6 });
    this.tone(900, 0.12, { wave: 'square', gain: 0.05, slideTo: 1500, delay: 0.18 });
  }

  /** Tonnerre (craquement puis grondement). */
  thunder(): void {
    this.noise(0.2, { gain: 0.5, filter: 3200, q: 0.5 });
    this.noise(2, { gain: 0.6, filter: 220, type: 'lowpass', delay: 0.05 });
    this.tone(60, 1.4, { wave: 'sine', gain: 0.3, slideTo: 30, delay: 0.05 });
  }

  /** Grondement sourd (un nuage se charge). */
  rumble(): void {
    this.noise(0.9, { gain: 0.25, filter: 180, type: 'lowpass' });
  }

  /** Plouf dans la mer. */
  splash(): void {
    this.noise(0.6, { gain: 0.45, filter: 1300, q: 0.5 });
    this.tone(500, 0.3, { wave: 'sine', gain: 0.12, slideTo: 150 });
    this.bloop();
  }

  /**
   * Musique de « Décollage ! » (composée pour le jeu) : chiptune joyeuse en do
   * majeur (do, sol, la mineur, fa). Intensité 0 : village et nuages ; 1 : haut
   * du ciel, plus de batterie ; 2 : espace, arpèges rêveurs et plus lents.
   */
  private scheduleRocket(): void {
    if (!this.ctx || !this.musicBus) return;
    const sixteenth = 60 / this.musicTempo / 4;
    const space = this.musicIntensity >= 2;
    const chords = [
      [262, 330, 392],
      [196, 247, 294],
      [220, 262, 330],
      [175, 220, 262],
    ];
    // Mélodie en doubles croches (demi-tons au-dessus du do 4, -1 = silence).
    const tune = [12, -1, 7, -1, 9, 7, 4, -1, 7, -1, 12, 14, 16, -1, 14, 12, 11, -1, 7, -1, 11, 12, 14, -1, 11, -1, 7, -1, 2, 4, 7, -1, 9, -1, 12, -1, 9, 7, 9, -1, 16, -1, 14, 12, 9, -1, 12, -1, 5, -1, 9, -1, 12, 9, 7, 5, 4, -1, 5, 7, 9, 11, 12, -1];
    while (this.musicNext < this.ctx.currentTime + 0.12) {
      const step = this.musicStep % 64;
      const chord = chords[Math.floor(step / 16)];
      const at = this.musicNext;
      const out = this.musicBus;
      if (space) {
        // Arpège rêveur, notes longues.
        const f = chord[[0, 1, 2, 1][step % 4]] * (step % 8 < 4 ? 2 : 4);
        this.tone(f, sixteenth * 3, { wave: 'triangle', gain: 0.05, at, out });
        if (step % 16 === 0) this.tone(chord[0] / 2, sixteenth * 15, { wave: 'sine', gain: 0.14, at, out, attack: 0.2 });
        if (step % 8 === 0 && tune[step] >= 0) this.tone(262 * 2 ** (tune[step] / 12), sixteenth * 6, { wave: 'sine', gain: 0.05, at, out, attack: 0.05 });
      } else {
        // Basse sautillante.
        if (step % 2 === 0) this.tone(chord[(step / 2) % 2 === 0 ? 0 : 2] / 2, sixteenth * 1.6, { wave: 'triangle', gain: 0.15, at, out });
        const n = tune[step];
        if (n >= 0) this.tone(262 * 2 ** (n / 12), sixteenth * 1.8, { wave: 'square', gain: 0.03, at, out });
        if (step % 4 === 0) this.tone(110, 0.09, { wave: 'sine', gain: 0.2, slideTo: 45, at, out });
        if (step % 8 === 4) this.noise(0.07, { gain: 0.1, filter: 1800, q: 0.8, at, out });
        if (this.musicIntensity >= 1 && step % 2 === 1) this.noise(0.025, { gain: 0.05, filter: 7500, q: 1, at, out });
        if (this.musicIntensity >= 1 && step % 4 === 2) this.tone(chord[1] * 2, sixteenth, { wave: 'square', gain: 0.015, at, out });
      }
      this.musicNext += sixteenth;
      this.musicStep++;
    }
  }

  // --- Petits sons de « Décollage ! » ---------------------------------------------------------

  /** Poussée du réacteur (plus grave et plus longue en turbo). */
  thrust(turbo = false): void {
    this.noise(turbo ? 0.7 : 0.45, { gain: 0.35, filter: turbo ? 600 : 900, q: 0.6 });
    this.tone(turbo ? 160 : 220, turbo ? 0.6 : 0.4, { wave: 'square', gain: 0.05, slideTo: turbo ? 900 : 700 });
  }

  /** Atterrissage : « pouf » doux, ou « bong » brutal. */
  land(hard: boolean): void {
    this.noise(hard ? 0.3 : 0.12, { gain: hard ? 0.5 : 0.25, filter: hard ? 400 : 700, type: 'lowpass' });
    this.tone(hard ? 90 : 180, hard ? 0.3 : 0.12, { wave: 'square', gain: hard ? 0.08 : 0.05, slideTo: hard ? 45 : 120 });
    if (!hard) this.tone(660, 0.08, { wave: 'square', gain: 0.025, delay: 0.05 });
  }

  /** Tic-tac quand le temps presse. */
  tick(high: boolean): void {
    this.tone(high ? 1320 : 990, 0.04, { wave: 'square', gain: 0.03 });
  }

  /** Temps écoulé : petit glissando qui descend. */
  timeout(): void {
    this.tone(520, 0.25, { wave: 'square', gain: 0.04, slideTo: 200 });
  }

  /** Bonus ramassé : arpège qui monte. */
  powerUp(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.1, { wave: 'square', gain: 0.045, delay: i * 0.05 }));
  }

  /** Sifflement de chute. */
  whistle(): void {
    this.tone(1400, 0.9, { wave: 'sine', gain: 0.06, slideTo: 300 });
  }

  /** Le petit drone de secours qui ramène la fusée (teuf-teuf). */
  rescue(): void {
    for (let i = 0; i < 6; i++) this.tone(140 + (i % 2) * 30, 0.06, { wave: 'square', gain: 0.05, delay: i * 0.09 });
    this.tone(880, 0.15, { wave: 'triangle', gain: 0.05, delay: 0.6 });
  }

  /** Une plateforme fragile s'effrite. */
  crumble(): void {
    for (let i = 0; i < 5; i++) this.noise(0.06, { gain: 0.2, filter: 1200 + i * 400, q: 2, delay: i * 0.07 });
  }

  /** Meuh ! */
  moo(): void {
    this.tone(150, 0.7, { wave: 'sawtooth', gain: 0.06, slideTo: 110, attack: 0.1 });
    this.tone(152, 0.7, { wave: 'sawtooth', gain: 0.04, slideTo: 112, attack: 0.1 });
  }

  /** Piou-piou d'oiseau. */
  chirp(): void {
    this.tone(2200, 0.06, { wave: 'sine', gain: 0.06, slideTo: 2800 });
    this.tone(2400, 0.06, { wave: 'sine', gain: 0.06, slideTo: 3000, delay: 0.1 });
  }

  /** « Youpi » aigu d'un habitant content. */
  yay(): void {
    this.tone(700, 0.08, { wave: 'square', gain: 0.03, slideTo: 1100 });
    this.tone(1100, 0.12, { wave: 'square', gain: 0.03, slideTo: 1500, delay: 0.09 });
  }

  bump(): void {
    this.tone(90, 0.3, { wave: 'sawtooth', gain: 0.12, slideTo: 60 });
  }
}
