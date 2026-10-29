export class Synth {
  ctx?: AudioContext;
  master?: GainNode;
  engine?: OscillatorNode;
  thrust?: GainNode;
  enabled = true;
  beat = 0;
  step = 0;
  async unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.17;
      this.master.connect(this.ctx.destination);
      this.engine = this.ctx.createOscillator();
      this.engine.type = "sawtooth";
      this.engine.frequency.value = 43;
      const filter = this.ctx.createBiquadFilter();
      filter.frequency.value = 130;
      this.thrust = this.ctx.createGain();
      this.thrust.gain.value = 0.08;
      this.engine.connect(filter).connect(this.thrust).connect(this.master);
      this.engine.start();
    }
    await this.ctx.resume();
    this.set(this.enabled);
  }
  set(on: boolean) {
    this.enabled = on;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(
        on ? 0.17 : 0,
        this.ctx.currentTime,
        0.05,
      );
  }
  tone(f: number, d = 0.2, type: OscillatorType = "sine", delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + d + 0.02);
  }
  /** Arpège qui monte d'un demi-ton à chaque réussite enchaînée. */
  good(combo = 1, flash = false) {
    const up = 2 ** (Math.min(combo - 1, 14) / 12);
    [440, 554, 659, ...(combo >= 3 ? [880] : [])].forEach((f, i) =>
      this.tone(f * up, 0.25, "triangle", i * 0.06),
    );
    if (flash)
      [1760, 2217, 2637].forEach((f, i) => this.tone(f, 0.12, "sine", 0.18 + i * 0.04));
  }
  fever() {
    [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) =>
      this.tone(f, 0.22, i % 2 ? "square" : "triangle", i * 0.08),
    );
  }
  bad() {
    this.tone(130, 0.3, "sawtooth");
    this.tone(98, 0.4, "triangle", 0.12);
  }
  crash() {
    [55, 73, 110, 147].forEach((f, i) => this.tone(f, 1, "sawtooth", i * 0.05));
  }
  update(dt: number, flying: boolean, boost: boolean, danger: boolean) {
    if (this.thrust && this.ctx)
      this.thrust.gain.setTargetAtTime(
        flying ? (boost ? 0.15 : 0.06) : 0,
        this.ctx.currentTime,
        0.2,
      );
    this.beat += dt;
    const period = boost ? 0.21 : 0.42;
    if (this.beat > period && flying) {
      this.beat = 0;
      this.step = (this.step + 1) % 8;
      const step = this.step;
      const note = [110, 165, 220, 165, 130.81, 196, 261.63, 196][step];
      this.tone(boost ? note * 2 : note, 0.19, "triangle");
      if (boost && step % 2 === 0) this.tone(note * 4, 0.08, "square");
      if (danger && step % 2 === 0) this.tone(740, 0.1);
    }
  }
}
