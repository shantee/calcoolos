/** Effets d'interface : textes flottants, smileys, flashs et confettis (DOM + CSS). */
import type { Flight } from "./model";
const WORDS = {
  flash: ["すごい！ SUGOI !", "完璧！ PARFAIT !", "⚡ ÉCLAIR ⚡", "神！ DIVIN !", "速い！ RAPIDE !"],
  great: ["いいね！ SUPER !", "やった！ YATTA !", "最高！ GÉNIAL !", "かっこいい！ STYLÉ !"],
  good: ["よし！ YOSHI !", "ナイス！ NICE !", "OK ！ BIEN !", "がんばれ！ CONTINUE !"],
  bad: ["あっ！ OUPS !", "ざんねん… DOMMAGE", "もう一回！ ENCORE !"],
};
const HAPPY = ["🤩", "😎", "🔥", "✨", "⭐", "🌈", "🚀", "💫", "🎉", "🦄", "💎", "👾", "🍭", "😺", "🍣", "🍜", "🎈", "🥳"];
const OOPS = ["😅", "🙈", "💦", "😵"];
const pick = <T>(l: T[]) => l[Math.floor(Math.random() * l.length)];
export class Fx {
  layer: HTMLDivElement;
  speedLines: HTMLDivElement;
  flashEl: HTMLDivElement;
  hue = 0;
  confettiTimer = 0;
  calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  constructor(parent: HTMLElement) {
    this.speedLines = el("div", "speedlines");
    this.flashEl = el("div", "screen-flash");
    this.layer = el("div", "fx-layer");
    parent.prepend(this.speedLines, this.flashEl, this.layer);
  }
  /** Élément éphémère retiré à la fin de son animation. */
  spawn(cls: string, text: string, style: Record<string, string>, life = 1600) {
    const e = el("span", cls);
    e.textContent = text;
    for (const [k, v] of Object.entries(style)) e.style.setProperty(k, v);
    this.layer.append(e);
    setTimeout(() => e.remove(), life);
    return e;
  }
  flash(hue: number, strength = 1) {
    if (this.calm) return;
    this.flashEl.style.setProperty("--h", String(hue));
    this.flashEl.style.setProperty("--s", String(strength));
    this.flashEl.classList.remove("on");
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add("on");
  }
  emojis(list: string[], n: number, spread = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        d = (160 + Math.random() * 260) * spread;
      this.spawn("emoji-pop", pick(list), {
        "--dx": `${Math.cos(a) * d}px`,
        "--dy": `${Math.sin(a) * d * 0.7 - 60}px`,
        "--r": `${(Math.random() - 0.5) * 720}deg`,
        "--d": `${Math.random() * 0.15}s`,
        "font-size": `${26 + Math.random() * 30}px`,
      });
    }
  }
  /** Un seul jugement et un seul gain à l'écran : les réponses rapides ne s'empilent pas. */
  clear() {
    this.layer.querySelectorAll(".judge, .mult-pop").forEach((e) => e.remove());
  }
  good(f: Flight) {
    this.clear();
    this.hue = (this.hue + 55) % 360;
    const word = pick(WORDS[f.rating === "" ? "good" : f.rating]);
    this.spawn("judge " + f.rating, word, { "--h": String(this.hue) }, 1400);
    this.spawn("gain", `+${f.gain.toLocaleString("fr-FR")}`, { "--h": String((this.hue + 120) % 360) }, 1300);
    if (f.multiplier > 1 || f.boost > 0)
      this.spawn("mult-pop", `COMBO ×${f.multiplier}${f.boost > 0 ? " · 🌈 ×2" : ""}`, { "--h": String((this.hue + 240) % 360) }, 1200);
    this.emojis(HAPPY, Math.min(12, 3 + f.combo + (f.rating === "flash" ? 3 : 0)));
    this.flash(this.hue, f.rating === "flash" ? 1 : 0.6);
  }
  bad() {
    this.clear();
    this.spawn("judge bad", pick(WORDS.bad), {}, 1400);
    this.emojis(OOPS, 3, 0.5);
    this.flash(350, 0.8);
  }
  /** Annonce d'une nouvelle étape du voyage. */
  stage(emoji: string, name: string) {
    this.layer.querySelectorAll(".stage-banner").forEach((e) => e.remove());
    this.spawn("stage-banner", `${emoji} ${name}`, {}, 3200);
  }
  fever() {
    this.spawn("fever-banner", "🌈 ARC-EN-CIEL · POINTS ×2 🌈", {}, 2600);
    this.emojis(HAPPY, 20, 1.6);
    this.flash(300, 1.2);
  }
  update(dt: number, f: Flight) {
    const playing = f.state === "playing";
    const rush = playing ? Math.min(1, Math.max(0, (f.speed - 60) / 65)) : 0;
    this.speedLines.style.opacity = String(f.boost > 0 && playing ? 0.9 : rush * 0.6);
    document.body.classList.toggle("fever", playing && f.boost > 0);
    if (playing && f.boost > 0 && !this.calm) {
      this.confettiTimer -= dt;
      if (this.confettiTimer <= 0) {
        this.confettiTimer = 0.14;
        this.spawn("confetti", pick(["▲", "●", "■", "★", "♥", "✦", ...HAPPY.slice(0, 6)]), {
          left: `${Math.random() * 100}%`,
          "--h": String(Math.floor(Math.random() * 360)),
          "--r": `${(Math.random() - 0.5) * 900}deg`,
          "--t": `${1.6 + Math.random() * 1.4}s`,
          "font-size": `${12 + Math.random() * 22}px`,
        }, 3100);
      }
    }
  }
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string) {
  const e = document.createElement(tag);
  e.className = cls;
  e.setAttribute("aria-hidden", "true");
  return e;
}
