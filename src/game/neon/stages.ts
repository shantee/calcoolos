/** Le voyage : de la forêt jusqu'à la mégapole, puis ses zones de couleur. */
export type StageId = "forest" | "fields" | "village" | "town" | "city" | "mega";
export interface Stage {
  id: StageId;
  name: string;
  emoji: string;
  /** Distance (m) à laquelle l'étape commence. */
  from: number;
  /** Hauteur des obstacles centraux (toits) de l'étape. */
  roof: number;
  sky: string;
  fog: string;
  fogDensity: number;
  ground: string;
  light: string;
  lightIntensity: number;
  /** 0 = plein jour, 1 = nuit néon. */
  night: number;
}
export const STAGES: Stage[] = [
  { id: "forest", name: "La forêt", emoji: "🌲", from: 0, roof: 24, sky: "#8fc8ff", fog: "#bfe3ff", fogDensity: 0.0013, ground: "#2f6b2a", light: "#fff4dd", lightIntensity: 1.15, night: 0 },
  { id: "fields", name: "Les pâturages", emoji: "🐄", from: 1200, roof: 22, sky: "#ffd59a", fog: "#ffe2b8", fogDensity: 0.0012, ground: "#6fae45", light: "#ffe7b8", lightIntensity: 1.1, night: 0 },
  { id: "village", name: "Le village", emoji: "🏡", from: 2600, roof: 30, sky: "#ff9f7a", fog: "#f7b09a", fogDensity: 0.0014, ground: "#5d9a3c", light: "#ffc9a0", lightIntensity: 1, night: 0.15 },
  { id: "town", name: "La petite ville", emoji: "⚽", from: 4400, roof: 36, sky: "#6a4a9a", fog: "#8a6aa8", fogDensity: 0.0016, ground: "#4f5d50", light: "#c9b6ff", lightIntensity: 0.95, night: 0.45 },
  { id: "city", name: "La grande ville", emoji: "🏙️", from: 6600, roof: 44, sky: "#0b0f2e", fog: "#1f2a5c", fogDensity: 0.0019, ground: "#0b1328", light: "#859bff", lightIntensity: 0.9, night: 0.85 },
  { id: "mega", name: "La mégapole", emoji: "🌃", from: 9400, roof: 52, sky: "#05061a", fog: "#17213d", fogDensity: 0.0019, ground: "#070f22", light: "#859bff", lightIntensity: 0.9, night: 1 },
];
export interface Zone {
  id: "ocean" | "jardin" | "dragon" | "soleil" | "arcade" | "kawaii";
  name: string;
  emoji: string;
  /** Teinte dominante (0–360) des néons et des fenêtres. */
  hue: number;
  fog: string;
  sky: string;
}
/** Zones de la mégapole, qui se succèdent en boucle. */
export const ZONES: Zone[] = [
  { id: "ocean", name: "Zone bleue · Océan", emoji: "🪼", hue: 200, fog: "#0f2f5c", sky: "#020a1f" },
  { id: "jardin", name: "Zone verte · Jardins", emoji: "🌿", hue: 130, fog: "#0f3a2a", sky: "#02140c" },
  { id: "dragon", name: "Zone rouge · Dragon", emoji: "🐉", hue: 355, fog: "#4a0f1c", sky: "#1a0208" },
  { id: "soleil", name: "Zone orange · Soleil", emoji: "☀️", hue: 30, fog: "#4a2a0f", sky: "#1a0c02" },
  { id: "arcade", name: "Zone violette · Arcade", emoji: "👾", hue: 275, fog: "#2b1350", sky: "#0d0420" },
  { id: "kawaii", name: "Zone rose · Kawaii", emoji: "🐱", hue: 320, fog: "#4a0f3a", sky: "#1a0212" },
];
export const ZONE_LENGTH = 2200;
export interface Place {
  stage: Stage;
  index: number;
  zone?: Zone;
  /** Numéro de zone depuis l'entrée dans la mégapole. */
  zoneIndex: number;
  /** Clé unique de l'endroit (change à chaque nouvelle étape ou zone). */
  key: string;
}
export function placeAt(distance: number): Place {
  let index = 0;
  for (let i = 0; i < STAGES.length; i++) if (distance >= STAGES[i].from) index = i;
  const stage = STAGES[index];
  if (stage.id !== "mega") return { stage, index, zoneIndex: -1, key: stage.id };
  const zoneIndex = Math.floor((distance - stage.from) / ZONE_LENGTH);
  return { stage, index, zone: ZONES[zoneIndex % ZONES.length], zoneIndex, key: "mega" + zoneIndex };
}
/** Altitude sous laquelle on prévient le pilote (toits de l'étape actuelle et de la suivante). */
export function dangerAltitude(distance: number) {
  return Math.max(placeAt(distance).stage.roof, placeAt(distance + 400).stage.roof) + 16;
}
