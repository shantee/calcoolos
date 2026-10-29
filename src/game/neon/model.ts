import type { TierId } from "../../core/difficulty";
import { Releve } from "../../platform/releve";
/** Arcade = mode Défi de Calcoolos (classé), Entraînement = mode Tranquille. */
export type Mode = "arcade" | "training";
export type Quality = "low" | "medium" | "high";
export interface Settings {
  tables: number[];
  /** Niveau Calcoolos : il fixe le temps par calcul. */
  difficulty: TierId;
  mode: Mode;
  quality: Quality;
  sound: boolean;
}
export const defaults: Settings = {
  tables: [2, 3, 4, 5],
  difficulty: "explorateur",
  mode: "arcade",
  quality: "high",
  sound: true,
};
/** Temps par calcul (s) selon le niveau, en Arcade ; il raccourcit un peu au fil des bonnes réponses. */
export const TIME_LIMIT: Record<TierId, number> = { eveil: 16, explorateur: 13, stratege: 10, maitre: 7 };
/**
 * Séries de tables qui ont un classement : on ne compare que des joueurs qui révisent les mêmes tables.
 * Toute autre sélection est « perso » : comptée dans les progrès, hors classement.
 */
export const SERIES = {
  petites: { name: "Tables 2 à 5", tables: [2, 3, 4, 5] },
  grandes: { name: "Tables 6 à 9", tables: [6, 7, 8, 9] },
  toutes: { name: "Tables 2 à 10", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
  expert: { name: "Tables 2 à 12", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
} as const;
export type SeriesId = keyof typeof SERIES;
export function seriesOf(tables: readonly number[]): SeriesId | "perso" {
  const key = [...new Set(tables)].sort((a, b) => a - b).join(",");
  for (const [id, s] of Object.entries(SERIES)) if (s.tables.join(",") === key) return id as SeriesId;
  return "perso";
}
/** Série proposée d'office selon le niveau (avant tout choix du joueur). */
export const TIER_SERIES: Record<TierId, SeriesId> = { eveil: "petites", explorateur: "petites", stratege: "toutes", maitre: "expert" };
/** Étoiles du voyage : le village (1), la grande ville (2), la mégapole (3). */
export const STAR_DISTANCES = [2600, 6600, 9400];
export const starsFor = (distance: number) => STAR_DISTANCES.filter((d) => distance >= d).length;
export interface RecordData {
  best: number;
  combo: number;
  tables: Record<string, { correct: number; total: number }>;
  /** Records Arcade par niveau et série (« explorateur/petites »). */
  bests?: Record<string, number>;
}
export const emptyRecord = (): RecordData => ({
  best: 0,
  combo: 0,
  tables: {},
  bests: {},
});
export type Rating = "flash" | "great" | "good" | "";
/** Hauteurs de vol : plafond, plancher arcade et plancher entraînement. */
export const CEILING = 155;
const FLOOR = { arcade: 12, training: 75 };
/** Mètres perdus pendant une question entière sans réponse (chute continue). */
const SINK_PER_QUESTION = 22;
const LIFT = 14;
const PENALTY = 15;
/** Une bonne réponse ne compte dans le combo que si elle arrive en moins de 3,5 s. */
export const COMBO_TIME = 3.5;
const FLASH_TIME = 2;
export class Flight {
  state: "title" | "playing" | "paused" | "crashing" | "results" = "title";
  altitude = 100;
  targetAltitude = 100;
  /** Vitesse verticale affichée (m/s), négative en descente. */
  vario = 0;
  sink = 0;
  score = 0;
  combo = 0;
  longest = 0;
  correct = 0;
  total = 0;
  elapsed = 0;
  distance = 0;
  speed = 55;
  remaining = 0;
  limit = 12;
  /** Mode arc-en-ciel : secondes restantes. */
  boost = 0;
  /** Jauge arc-en-ciel 0..1, remplie surtout par les réponses rapides. */
  heat = 0;
  cooldown = 0;
  a = 2;
  b = 3;
  feedback = "";
  /** Correction de la dernière erreur, affichée sous le nouveau calcul. */
  correction = "";
  correctionTime = 0;
  result: "good" | "bad" | "" = "";
  rating: Rating = "";
  gain = 0;
  flashes = 0;
  questions = 0;
  /** Altitude la plus haute de la partie, modes arc-en-ciel déclenchés. */
  maxAltitude = 100;
  fevers = 0;
  /** Relevé commun des réponses (temps, faits), envoyé avec le résultat. */
  releve = new Releve();
  private recent: string[] = [];
  private retry: { a: number; b: number; due: number }[] = [];
  stats: RecordData = emptyRecord();
  constructor(
    public settings: Settings,
    private random = Math.random,
  ) {}
  get multiplier() {
    return 1 + Math.min(5, Math.floor(this.combo / 3));
  }
  get floor() {
    return FLOOR[this.settings.mode];
  }
  start() {
    this.state = "playing";
    this.altitude = this.targetAltitude = 100;
    this.score =
      this.combo =
      this.longest =
      this.correct =
      this.total =
      this.elapsed =
      this.distance =
      this.boost =
      this.heat =
      this.cooldown =
      this.questions =
      this.vario =
      this.gain =
      this.flashes =
        0;
    this.speed = 55;
    this.maxAltitude = 100;
    this.fevers = 0;
    this.releve = new Releve();
    this.recent = [];
    this.retry = [];
    this.stats = emptyRecord();
    this.feedback = this.correction = "";
    this.correctionTime = 0;
    this.result = "";
    this.rating = "";
    this.next();
  }
  next() {
    this.questions++;
    const due = this.retry.findIndex((q) => q.due <= this.questions);
    if (due >= 0) {
      const q = this.retry.splice(due, 1)[0];
      this.a = q.a;
      this.b = q.b;
    } else {
      const pool = this.settings.tables
        .flatMap((a) => Array.from({ length: 9 }, (_, i) => ({ a, b: i + 2 })))
        .filter((q) => !this.recent.includes(`${q.a}:${q.b}`));
      const q = pool[Math.floor(this.random() * pool.length)] ?? { a: 2, b: 3 };
      this.a = q.a;
      this.b = q.b;
    }
    this.recent.push(`${this.a}:${this.b}`);
    if (this.recent.length > 5) this.recent.shift();
    const base = TIME_LIMIT[this.settings.difficulty] ?? TIME_LIMIT.explorateur;
    this.limit =
      this.settings.mode === "training"
        ? 30
        : Math.max(base * 0.65, base - this.correct * 0.07);
    this.sink = SINK_PER_QUESTION / this.limit;
    this.remaining = this.limit;
    this.cooldown = 0;
    this.result = "";
  }
  answer(value: number | null) {
    if (this.state !== "playing" || this.cooldown > 0) return false;
    const good = value === this.a * this.b && this.remaining > 0;
    const used = this.limit - this.remaining;
    this.total++;
    const st = (this.stats.tables[this.a] ??= { correct: 0, total: 0 });
    st.total++;
    // Temps de réponse seulement pour une réponse tapée (pas pour un temps écoulé).
    this.releve.reponse(good, value === null ? undefined : used * 1000, { op: "×", a: this.a, b: this.b });
    if (good) {
      this.correct++;
      st.correct++;
      const fast = used <= COMBO_TIME;
      this.combo = fast ? this.combo + 1 : 0;
      this.longest = Math.max(this.longest, this.combo);
      this.rating = used <= FLASH_TIME ? "flash" : fast ? "great" : "good";
      if (this.rating === "flash") this.flashes++;
      const wasFever = this.boost > 0;
      this.gain =
        Math.round(
          ((100 + (100 * this.remaining) / this.limit) *
            this.multiplier *
            (this.rating === "flash" ? 1.5 : 1) *
            (wasFever ? 2 : 1)) /
            10,
        ) * 10;
      this.score += this.gain;
      this.targetAltitude = Math.min(
        CEILING,
        this.targetAltitude + LIFT * (wasFever ? 1.4 : 1),
      );
      this.result = "good";
      this.heat += { flash: 0.38, great: 0.22, good: 0.04, "": 0 }[this.rating];
      if (!wasFever && this.heat >= 1) {
        this.boost = 6;
        this.heat = 0;
        this.fevers++;
        this.feedback = "MODE ARC-EN-CIEL !";
      } else
        this.feedback =
          !fast
            ? "Juste ! Plus vite pour le combo"
            : this.combo % 3 === 0 && this.combo <= 15
              ? `COMBO ×${this.multiplier} !`
              : this.rating === "flash"
                ? "ÉCLAIR !"
                : "Bien joué !";
    } else {
      this.combo = 0;
      this.heat = Math.max(0, this.heat - 0.5);
      this.gain = 0;
      this.rating = "";
      this.targetAltitude = Math.max(
        this.floor,
        this.targetAltitude - PENALTY,
      );
      this.feedback = this.correction = `${this.a} × ${this.b} = ${this.a * this.b}`;
      this.correctionTime = 2.5;
      this.retry.push({ a: this.a, b: this.b, due: this.questions + 3 });
      // Nouveau calcul immédiatement : on ne réessaie pas le même tout de suite.
      this.next();
      this.result = "bad";
      return false;
    }
    this.cooldown = 0.7;
    return good;
  }
  tick(dt: number) {
    if (this.state !== "playing") return;
    this.elapsed += dt;
    this.correctionTime = Math.max(0, this.correctionTime - dt);
    this.boost = Math.max(0, this.boost - dt);
    this.heat = Math.max(0, this.heat - dt * 0.01);
    const cruise = this.boost > 0 ? 125 : 55 + 5 * Math.min(this.combo, 12);
    this.speed += (cruise - this.speed) * (1 - Math.exp(-dt * 1.5));
    this.distance += dt * this.speed;
    // Tant que la question attend une réponse, l'appareil perd de l'altitude en continu.
    if (this.cooldown <= 0 && this.boost <= 0)
      this.targetAltitude = Math.max(
        this.floor,
        this.targetAltitude - this.sink * dt,
      );
    const before = this.altitude;
    const rate = this.targetAltitude > this.altitude ? 2.2 : 0.7;
    this.altitude +=
      (this.targetAltitude - this.altitude) * (1 - Math.exp(-dt * rate));
    this.maxAltitude = Math.max(this.maxAltitude, this.altitude);
    if (dt > 0) this.vario += ((this.altitude - before) / dt - this.vario) * 0.2;
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) this.next();
    } else {
      this.remaining = Math.max(0, this.remaining - dt);
      if (this.remaining === 0) this.answer(null);
    }
  }
  crash() {
    if (this.state === "playing" && this.settings.mode === "arcade")
      this.state = "crashing";
  }
  pause() {
    if (this.state === "playing") this.state = "paused";
    else if (this.state === "paused") this.state = "playing";
  }
}
export const SETTINGS_KEY = "calcoolos.neon.reglages";
export const RECORD_KEY = "calcoolos.neon.records";
/** Réglages retenus sur l'appareil ; le niveau, lui, vient de Calcoolos (et la série d'office du niveau). */
export function loadSettings(tier: TierId = defaults.difficulty): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      ...defaults,
      ...s,
      difficulty: tier,
      tables:
        Array.isArray(s.tables) &&
        s.tables.some(
          (n: unknown) =>
            Number.isInteger(n) && Number(n) >= 2 && Number(n) <= 12,
        )
          ? s.tables.filter(
              (n: number) => Number.isInteger(n) && n >= 2 && n <= 12,
            )
          : [...SERIES[TIER_SERIES[tier]].tables],
      quality: ["low", "medium", "high"].includes(s.quality)
        ? s.quality
        : defaults.quality,
      mode: s.mode === "training" ? "training" : "arcade",
      sound: s.sound !== false,
    };
  } catch {
    return { ...defaults };
  }
}
export function readRecord(): RecordData {
  try {
    const r = JSON.parse(localStorage.getItem(RECORD_KEY) || "null");
    if (
      r &&
      Number.isFinite(r.best) &&
      Number.isFinite(r.combo) &&
      r.tables &&
      typeof r.tables === "object"
    )
      return { ...r, bests: r.bests && typeof r.bests === "object" ? r.bests : {} };
  } catch {}
  return emptyRecord();
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing / full storage: play remains available. */
  }
}
