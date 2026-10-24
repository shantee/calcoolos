/**
 * Variante A — « Crépuscule d'archipel » en pixel art.
 * Tous les sprites sont générés ici par PixelForge (aucune image externe).
 * Résolution native 427 × 240, affichée à l'échelle ×3.
 */
import { PixelCanvas, drawNumber, numberWidth, DIGIT_H, type Ramp } from './pixelforge';
import { createRng } from '../core/rng';

export const SCALE = 3;
export const NATIVE_W = 427;
export const NATIVE_H = 240;

export const INK = '#1a1430';
export const CREAM = '#fff4dc';

export const PAL = {
  stone: ['#2a2440', '#3d3559', '#554c78', '#7a6f9e', '#a99fc8', '#d4ccec'] as Ramp,
  moss: ['#1f3a33', '#2e5a45', '#4a8255', '#7fb069', '#c4e08a'] as Ramp,
  coral: ['#3e1a33', '#6e2a45', '#a8434f', '#e0705e', '#ffab84', '#ffe0c0'] as Ramp,
  amber: ['#5a2e1f', '#9a5426', '#d98e32', '#f6c25b', '#ffe9a8', '#fffbe8'] as Ramp,
  teal: ['#123040', '#1d5560', '#2e8a85', '#4fc2a8', '#9ff0d0', '#e8fff4'] as Ramp,
  wood: ['#2e1a22', '#4f2c2c', '#7a4634', '#a8673f', '#d39a5c'] as Ramp,
  soil: ['#1c1426', '#2b1d33', '#3e2a40', '#5a3b4c', '#7a5260'] as Ramp,
  sky: ['#141029', '#1e1838', '#2c2350', '#463468', '#6b4a80', '#9a5c86', '#c87383', '#ec9a7f', '#f8c68e'] as Ramp,
  far: ['#3a2c5c', '#4a3a6e', '#5e4a82', '#77609a'] as Ramp,
};

/** Couleurs d'interface (format Phaser 0xRRGGBB et CSS). */
export const UI = {
  ink: 0x1a1430,
  cream: '#fff4dc',
  amber: '#f6c25b',
  teal: '#9ff0d0',
  coral: '#ffab84',
  muted: '#a99fc8',
};

// --- Cubes ------------------------------------------------------------------
export const CUBE_W = 28;
export const CUBE_H = 32;

/** Cube de pierre (normal) ou chargé de magie (sélectionné). */
export function cube(selected: boolean): PixelCanvas {
  const pc = new PixelCanvas(CUBE_W, CUBE_H);
  const top: Ramp = selected ? PAL.teal : PAL.stone;
  const size = 27;
  const inside = (x: number, y: number) => {
    // Coins coupés d'un pixel.
    const cx = x === 0 || x === size - 1;
    const cy = y === 0 || y === size - 1;
    return !(cx && cy);
  };
  // Face avant (épaisseur), plus sombre.
  pc.shadeFn(0, 4, size - 1, size + 3, selected ? PAL.teal : PAL.stone, (x, y) => (inside(x, Math.min(y, size - 1)) ? 0.12 + (x / size) * 0.08 : null), { dither: 0.4 });
  // Face supérieure : biseau clair en haut à gauche, sombre en bas à droite.
  pc.shadeFn(0, 0, size - 1, size - 1, top, (x, y) => {
    if (!inside(x, y)) return null;
    const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
    if (edge === 0) return x + y < size ? 0.95 : 0.3;
    if (edge === 1) return x + y < size ? 0.8 : 0.42;
    // Léger dégradé diagonal au centre.
    return 0.62 - ((x + y) / (2 * size)) * 0.18;
  }, { dither: 0.6 });
  // Petits rivets décoratifs dans les coins.
  const rivet = selected ? PAL.teal[5] : PAL.amber[3];
  for (const [x, y] of [[3, 3], [size - 4, 3], [3, size - 4], [size - 4, size - 4]]) {
    pc.set(x, y, rivet);
    pc.set(x + 1, y + 1, top[1]);
  }
  pc.outline(INK);
  return pc;
}

/** Nombre affiché sur un cube (calque séparé pour changer la valeur sans redessiner le cube). */
export function cubeNumber(n: number): PixelCanvas {
  const w = numberWidth(n) + 4;
  const pc = new PixelCanvas(w, DIGIT_H + 5);
  drawNumber(pc, n, w / 2, (DIGIT_H + 3) / 2 + 1, CREAM, INK, PAL.stone[0]);
  return pc;
}

/** Cadre de mise au point clavier (pointillés ambrés). */
export function focusFrame(): PixelCanvas {
  const w = CUBE_W + 4;
  const h = CUBE_H + 4;
  const pc = new PixelCanvas(w, h);
  for (let x = 0; x < w; x++) {
    if ((x >> 1) % 2 === 0) {
      pc.set(x, 0, PAL.amber[4]);
      pc.set(x, h - 1, PAL.amber[4]);
    }
  }
  for (let y = 0; y < h; y++) {
    if ((y >> 1) % 2 === 0) {
      pc.set(0, y, PAL.amber[4]);
      pc.set(w - 1, y, PAL.amber[4]);
    }
  }
  return pc;
}

// --- Ennemi : le « Mordillon à pancarte » ------------------------------------
export const ENEMY_W = 42;
export const ENEMY_H = 46;

export function enemy(frame: 0 | 1, palette: 'coral' | 'teal' = 'coral'): PixelCanvas {
  const body = palette === 'coral' ? PAL.coral : PAL.teal;
  const pc = new PixelCanvas(ENEMY_W, ENEMY_H);
  const cx = 21;
  // Jambes trapues (alternées selon l'image).
  const legY = 38;
  const lift = frame === 0 ? [0, 2] : [2, 0];
  for (const [k, lx] of [[0, 13], [1, 25]] as const) {
    const dy = lift[k];
    pc.rect(lx, legY - dy, 4, 6, body, 0.35, 0.15, { dither: 0 });
    pc.fill(lx - 1, legY + 5 - dy, 6, 2, body[1]);
  }
  // Bras levés qui tiennent la pancarte.
  for (const [x0, x1] of [[9, 8], [33, 34]]) {
    pc.line(x0, 26, x1, 1, body[2]);
    pc.line(x0 + 1, 26, x1 + 1, 1, body[3]);
  }
  // Corps.
  pc.ellipse(cx, 28, 14, 12, body, { ambient: 0.2 });
  // Ventre plus clair.
  pc.ellipse(cx + 1, 32, 8, 5, body, { bias: 0.25, ambient: 0.3, dither: 0.5 });
  // Toison de mousse sur le dessus, avec mèches pendantes.
  pc.shadeFn(cx - 13, 14, cx + 13, 22, PAL.moss, (x, y) => {
    const dx = (x + 0.5 - cx) / 13;
    const dy = (y + 0.5 - 19) / 5;
    if (dx * dx + dy * dy > 1) return null;
    return 0.75 - (y - 14) * 0.08;
  });
  for (const x of [cx - 9, cx - 4, cx + 3, cx + 8]) {
    const len = 2 + ((x * 7) % 3);
    for (let j = 0; j < len; j++) pc.set(x, 22 + j, PAL.moss[1 + (j === 0 ? 1 : 0)]);
  }
  // Petites cornes.
  pc.pattern(cx - 9, 11, ['#.', '##', '.#'], { '#': PAL.amber[4] });
  pc.pattern(cx + 8, 11, ['.#', '##', '#.'], { '#': PAL.amber[4] });
  // Grand œil unique.
  pc.ellipse(cx + 2, 26, 5, 5, ['#c9c0d8', '#f0eaf8', '#ffffff'], { ambient: 0.4, dither: 0 });
  pc.fill(cx + 2, 25, 2, 3, INK);
  pc.set(cx + 2, 25, '#ffffff');
  // Sourcil en coin : l'air faussement menaçant.
  pc.line(cx - 3, 20, cx + 5, 21, INK);
  // Bouche de travers avec une dent.
  pc.line(cx - 3, 34, cx + 4, 33, INK);
  pc.set(cx + 1, 34, CREAM);
  pc.outline(INK);
  return pc;
}

/** Pancarte de bois portée par l'ennemi, avec le nombre cible. */
export function sign(n: number): PixelCanvas {
  const w = Math.max(30, numberWidth(n) + 12);
  const h = 17;
  const pc = new PixelCanvas(w + 2, h + 2);
  pc.shadeFn(1, 1, w, h, PAL.wood, (x, y) => {
    const plank = y < 9 ? 0 : 1;
    const grain = ((x * 13 + plank * 7) % 11 === 0 ? -0.15 : 0) + (y === 1 || y === 9 ? 0.25 : 0);
    return 0.62 + grain - (y - 1) * 0.015;
  }, { dither: 0.5 });
  pc.fill(1, 9, w, 1, PAL.wood[1]);
  for (const x of [3, w - 2]) {
    pc.set(x, 3, PAL.stone[4]);
    pc.set(x, 13, PAL.stone[4]);
  }
  drawNumber(pc, n, (w + 2) / 2, h / 2 + 1, CREAM, INK);
  pc.outline(INK);
  return pc;
}

// --- Phare à défendre ------------------------------------------------------------
export function tower(): PixelCanvas {
  const W = 44;
  const Hh = 96;
  const pc = new PixelCanvas(W, Hh);
  const cx = 22;
  // Corps cylindrique en pierre, éclairé par la gauche.
  const cyl = (x: number, half: number) => {
    const u = (x + 0.5 - cx) / half;
    if (Math.abs(u) > 1) return null;
    return 0.25 + 0.6 * Math.max(0, Math.cos((u + 0.35) * 1.3));
  };
  pc.shadeFn(cx - 13, 40, cx + 13, 88, PAL.stone, (x, y) => {
    const half = 10 + ((y - 40) / 48) * 3;
    const v = cyl(x, half);
    if (v === null) return null;
    // Joints de pierre.
    const row = Math.floor((y - 40) / 6);
    const joint = (y - 40) % 6 === 0 || (x + row * 3) % 9 === 0;
    return joint ? v - 0.22 : v;
  });
  // Socle.
  pc.rect(cx - 16, 86, 32, 8, PAL.stone, 0.55, 0.2);
  // Fenêtres éclairées.
  for (const y of [52, 68]) {
    pc.fill(cx - 2, y, 4, 6, PAL.amber[3]);
    pc.fill(cx - 2, y, 4, 2, PAL.amber[4]);
  }
  // Porte.
  pc.fill(cx - 4, 77, 8, 9, PAL.wood[1]);
  pc.fill(cx - 3, 78, 6, 8, PAL.wood[2]);
  pc.set(cx + 1, 82, PAL.amber[4]);
  // Galerie.
  pc.rect(cx - 15, 36, 30, 4, PAL.wood, 0.75, 0.4);
  for (let x = cx - 14; x <= cx + 14; x += 4) pc.fill(x, 32, 1, 4, PAL.wood[2]);
  pc.fill(cx - 15, 31, 30, 1, PAL.wood[3]);
  // Lanterne de verre magique.
  pc.shadeFn(cx - 8, 18, cx + 8, 31, PAL.teal, (x, y) => {
    const u = Math.abs(x + 0.5 - cx) / 8;
    if (u > 1) return null;
    const bar = (x - (cx - 8)) % 5 === 0;
    return bar ? 0.15 : 0.95 - u * 0.4 - (y - 18) * 0.01;
  }, { dither: 0.5 });
  // Toit pointu et girouette.
  pc.shadeFn(cx - 11, 4, cx + 11, 18, PAL.coral, (x, y) => {
    const half = ((y - 4) / 14) * 11;
    const u = (x + 0.5 - cx) / Math.max(1, half);
    if (Math.abs(u) > 1) return null;
    return 0.3 + 0.55 * Math.max(0, 1 - Math.abs(u + 0.4));
  });
  pc.line(cx, 0, cx, 4, PAL.stone[1]);
  pc.pattern(cx + 1, 0, ['###', '##.'], { '#': PAL.amber[3] });
  pc.outline(INK);
  return pc;
}

/** Halo de la lanterne (pixels tramés, à afficher en mode additif). */
export function glow(r: number, ramp: Ramp): PixelCanvas {
  const pc = new PixelCanvas(r * 2, r * 2);
  pc.shadeFn(0, 0, r * 2 - 1, r * 2 - 1, ramp, (x, y) => {
    const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
    if (d > 1) return null;
    const v = (1 - d) ** 1.6;
    return v < 0.08 ? null : v;
  }, { dither: 1 });
  return pc;
}

/** Orbe-rune formé par la fusion des cubes, portant le nombre. */
export function rune(n: number): PixelCanvas {
  const w = Math.max(24, numberWidth(n) + 10);
  const pc = new PixelCanvas(w, 24);
  pc.ellipse(w / 2, 12, w / 2 - 1, 11, PAL.teal, { ambient: 0.45 });
  drawNumber(pc, n, w / 2, 12, CREAM, INK);
  pc.outline(INK);
  return pc;
}

/** Projectile : losange lumineux. */
export function bolt(): PixelCanvas {
  const pc = new PixelCanvas(11, 11);
  pc.shadeFn(0, 0, 10, 10, PAL.teal, (x, y) => {
    const d = Math.abs(x - 5) + Math.abs(y - 5);
    if (d > 5) return null;
    return 1 - d / 6;
  }, { dither: 0.3 });
  return pc;
}

/** Particule carrée d'un pixel (agrandie à l'affichage). */
export function dot(color: string, size = 1): PixelCanvas {
  return new PixelCanvas(size, size).fill(0, 0, size, size, color);
}

/** Petit escargot habitant du décor. */
export function snail(frame: 0 | 1): PixelCanvas {
  const pc = new PixelCanvas(14, 10);
  pc.fill(1, 7, 11, 2, PAL.amber[2]);
  pc.fill(frame ? 11 : 10, 5, 2, 3, PAL.amber[2]);
  pc.set(frame ? 12 : 11, 3, PAL.amber[3]);
  pc.set(frame ? 12 : 11, 4, PAL.amber[2]);
  pc.ellipse(5, 5, 4, 4, PAL.coral, { ambient: 0.3 });
  pc.set(5, 5, PAL.coral[1]);
  pc.set(4, 4, PAL.coral[1]);
  pc.outline(INK);
  return pc;
}

/** Nuage effilé (calque qui dérive lentement). */
export function cloud(w: number, h: number, seed: number): PixelCanvas {
  const rng = createRng(seed);
  const pc = new PixelCanvas(w, h);
  const puffs = Array.from({ length: 6 }, () => ({ x: rng.int(6, w - 6), y: rng.int(h / 2, h - 4), r: rng.int(4, Math.max(5, h / 2)) }));
  pc.shadeFn(0, 0, w - 1, h - 1, ['#7a4f86', '#a8638a', '#d98b8a', '#f2b59a'], (x, y) => {
    let best = 0;
    for (const p of puffs) {
      const d = 1 - Math.hypot((x - p.x) / (p.r * 1.8), (y - p.y) / p.r);
      if (d > best) best = d;
    }
    if (best <= 0 || y > h - 3) return null;
    return 0.3 + best * 0.4 + (1 - y / h) * 0.3;
  }, { dither: 1 });
  return pc;
}

// --- Décor complet -------------------------------------------------------------
/** Arrière-plan fixe : ciel, astre, îles lointaines, île principale, socle de l'atelier. */
export function background(): PixelCanvas {
  const W = NATIVE_W;
  const Hh = NATIVE_H;
  const pc = new PixelCanvas(W, Hh);
  const rng = createRng(796);
  const horizon = 168;

  // Ciel en bandes tramées.
  pc.shadeFn(0, 0, W - 1, Hh - 1, PAL.sky, (_x, y) => Math.min(1, (y / horizon) ** 1.35), { dither: 1 });

  // Étoiles.
  for (let i = 0; i < 70; i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, 80);
    pc.set(x, y, rng.next() < 0.2 ? PAL.amber[4] : '#cfc6f0');
  }

  // Astre annelé, pâle et étrange.
  const mx = 330;
  const my = 46;
  pc.ellipse(mx, my, 20, 20, ['#6b4a80', '#a07aa8', '#d8b8c8', '#f6e2d0', '#fff4e6'], { ambient: 0.25, light: { x: -0.7, y: -0.3, z: 0.65 } });
  for (let a = 0; a < 360; a += 0.5) {
    const t = (a * Math.PI) / 180;
    const x = Math.round(mx + Math.cos(t) * 34);
    const y = Math.round(my + Math.sin(t) * 7 - Math.cos(t) * 3);
    const behind = Math.sin(t) < 0 && Math.hypot(x - mx, y - my) < 20;
    if (!behind) pc.set(x, y, Math.sin(t) > 0 ? '#ffe9c8' : '#c99ab8');
  }

  // Îles flottantes lointaines (silhouettes atmosphériques).
  const island = (cx: number, top: number, w: number, depth: number, ramp: Ramp, waterfall: boolean) => {
    const seed = createRng(cx * 31 + top);
    const bumps = Array.from({ length: 5 }, () => seed.int(-2, 2));
    pc.shadeFn(cx - w, top - 6, cx + w, top + depth, ramp, (x, y) => {
      const u = (x - cx) / w;
      if (Math.abs(u) > 1) return null;
      const surface = top - Math.round(bumps[Math.floor((u + 1) * 2.49)] * 0.8) - (1 - u * u) * 3;
      const bottom = top + depth * (1 - u * u) ** 0.9 * (0.85 + 0.15 * Math.sin(x * 0.45) * Math.sin(x * 0.13));
      if (y < surface || y > bottom) return null;
      return y - surface < 2 ? 0.95 : 0.55 - ((y - top) / depth) * 0.45;
    }, { dither: 0.9 });
    if (waterfall) {
      const x = cx + Math.round(w * 0.35);
      for (let y = top + 2; y < Math.min(Hh, top + depth + 30); y++) {
        if (rng.next() < 0.85) pc.set(x, y, y % 3 ? '#b9a6e0' : '#e6dcff');
      }
    }
  };
  island(70, 104, 34, 26, PAL.far, true);
  island(205, 92, 22, 18, PAL.far, false);
  island(275, 120, 40, 22, PAL.far, true);
  island(400, 100, 26, 20, PAL.far, false);
  // Minuscule maison sur une île : un détail pour l'œil curieux.
  pc.fill(203, 86, 5, 4, '#2c2350');
  pc.set(205, 85, '#2c2350');
  pc.set(206, 87, PAL.amber[3]);

  // Île principale : sol, herbe, sentier.
  const ground = 189;
  pc.shadeFn(0, ground - 6, W - 1, Hh - 1, PAL.soil, (x, y) => {
    const surface = ground - Math.round(2 * Math.sin(x / 23) + Math.sin(x / 7));
    if (y < surface) return null;
    // Strates tramées vers le bas.
    return 0.75 - ((y - surface) / (Hh - surface)) * 0.6 + (Math.sin(x / 5 + y) > 0.95 ? 0.15 : 0);
  });
  // Bordure herbeuse.
  for (let x = 0; x < W; x++) {
    const surface = ground - Math.round(2 * Math.sin(x / 23) + Math.sin(x / 7));
    for (let j = 0; j < 4; j++) pc.set(x, surface + j, PAL.moss[j === 0 ? 4 : j === 1 ? 3 : 2]);
    if (rng.next() < 0.3) pc.set(x, surface - 1, PAL.moss[3]);
    if (rng.next() < 0.04) {
      pc.set(x, surface - 2, PAL.coral[4]);
      pc.set(x, surface - 1, PAL.moss[2]);
    }
  }
  // Sentier de terre battue que suit l'ennemi.
  for (let x = 150; x < W; x++) {
    for (let j = 5; j < 9; j++) if (rng.next() < 0.75) pc.set(x, ground + j, PAL.soil[3 + (j === 5 ? 1 : 0)]);
  }
  // Racines et cailloux.
  for (let i = 0; i < 26; i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(ground + 12, Hh - 3);
    pc.fill(x, y, 2, 1, PAL.stone[2]);
    pc.set(x, y + 1, PAL.soil[0]);
  }

  return pc;
}

/** Socle de l'atelier des cubes (cadre de pierre gravé), calque au-dessus des nuages. */
export function workshopFrame(): PixelCanvas {
  const pc = new PixelCanvas(NATIVE_W, NATIVE_H);
  const fx = 9;
  const fy = 46;
  const fw = 138;
  const fh = 190;
  pc.shadeFn(fx, fy, fx + fw - 1, fy + fh - 1, PAL.stone, (x, y) => {
    const edge = Math.min(x - fx, y - fy, fx + fw - 1 - x, fy + fh - 1 - y);
    if (edge < 0) return null;
    if (edge === 0) return 0.05;
    if (edge <= 2) return x - fx + (y - fy) < fw ? 0.7 : 0.35;
    return 0.06;
  }, { dither: 0.5 });
  // Rivets ambrés aux coins.
  for (const [x, y] of [[fx + 4, fy + 4], [fx + fw - 6, fy + 4], [fx + 4, fy + fh - 6], [fx + fw - 6, fy + fh - 6]]) {
    pc.fill(x, y, 2, 2, PAL.amber[3]);
    pc.set(x, y, PAL.amber[4]);
  }
  return pc;
}
