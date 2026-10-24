/**
 * PixelForge : petit atelier de pixel art procédural, écrit pour le projet.
 *
 * On décrit des formes (ellipses, rectangles, fonctions libres) ; chaque pixel
 * reçoit une valeur de lumière, convertie en couleur d'une « rampe » de palette
 * avec un tramage ordonné (Bayer 4×4). Un contour automatique termine le sprite.
 * Le résultat est un <canvas> à 1 pixel par pixel, agrandi ensuite sans lissage.
 */

export type Ramp = readonly string[];

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function bayer(x: number, y: number): number {
  return (BAYER4[y & 3][x & 3] + 0.5) / 16;
}

export interface Light {
  x: number;
  y: number;
  z: number;
}

/** Lumière venant d'en haut à gauche, légèrement de face. */
export const DEFAULT_LIGHT: Light = normalize({ x: -0.55, y: -0.65, z: 0.55 });

function normalize(v: Light): Light {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export interface ShadeOptions {
  light?: Light;
  /** Lumière minimale (0-1). */
  ambient?: number;
  /** Décalage ajouté à la valeur finale. */
  bias?: number;
  /** Force du tramage (0 = aplats nets). */
  dither?: number;
  /** Limite le dessin à certains pixels. */
  clip?: (x: number, y: number) => boolean;
}

export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  private px: (string | null)[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): string | null {
    return this.inBounds(x, y) ? this.px[y * this.w + x] : null;
  }

  set(x: number, y: number, color: string | null): void {
    if (this.inBounds(x, y)) this.px[(y | 0) * this.w + (x | 0)] = color;
  }

  /** Couleur de la rampe pour une valeur 0-1, avec tramage. */
  rampColor(ramp: Ramp, v: number, x: number, y: number, dither = 0.85): string {
    const n = ramp.length;
    const f = Math.min(1, Math.max(0, v)) * (n - 1) + (bayer(x, y) - 0.5) * dither;
    const i = Math.min(n - 1, Math.max(0, Math.round(f)));
    return ramp[i];
  }

  /** Remplissage libre : `fn` renvoie une valeur de lumière ou null (pixel vide). */
  shadeFn(x0: number, y0: number, x1: number, y1: number, ramp: Ramp, fn: (x: number, y: number) => number | null, opts: ShadeOptions = {}): this {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        if (!this.inBounds(x, y) || (opts.clip && !opts.clip(x, y))) continue;
        const v = fn(x, y);
        if (v === null) continue;
        this.set(x, y, this.rampColor(ramp, v + (opts.bias ?? 0), x, y, opts.dither ?? 0.85));
      }
    }
    return this;
  }

  /** Ellipse éclairée comme une sphère aplatie. */
  ellipse(cx: number, cy: number, rx: number, ry: number, ramp: Ramp, opts: ShadeOptions = {}): this {
    const L = opts.light ?? DEFAULT_LIGHT;
    const amb = opts.ambient ?? 0.18;
    return this.shadeFn(cx - rx, cy - ry, cx + rx, cy + ry, ramp, (x, y) => {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) return null;
      const nz = Math.sqrt(1 - d);
      const lit = Math.max(0, dx * L.x + dy * L.y + nz * L.z);
      return amb + (1 - amb) * lit;
    }, opts);
  }

  /** Rectangle avec dégradé vertical simple (haut clair, bas sombre). */
  rect(x: number, y: number, w: number, h: number, ramp: Ramp, top = 0.8, bottom = 0.35, opts: ShadeOptions = {}): this {
    return this.shadeFn(x, y, x + w - 1, y + h - 1, ramp, (_px, py) => {
      const t = h <= 1 ? 0 : (py - y) / (h - 1);
      return top + (bottom - top) * t;
    }, opts);
  }

  /** Aplat d'une couleur. */
  fill(x: number, y: number, w: number, h: number, color: string): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, color);
    return this;
  }

  /** Ligne de Bresenham. */
  line(x0: number, y0: number, x1: number, y1: number, color: string): this {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  /** Motif ASCII : chaque caractère est cherché dans `palette` ('.' ou espace = vide). */
  pattern(x: number, y: number, rows: readonly string[], palette: Record<string, string>): this {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = palette[row[i]];
        if (c) this.set(x + i, y + j, c);
      }
    });
    return this;
  }

  /**
   * Contour extérieur : les pixels vides touchant un pixel plein (4-voisinage)
   * prennent la couleur `ink`.
   */
  outline(ink: string): this {
    const add: Array<[number, number]> = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.set(x, y, ink);
    return this;
  }

  /** Copie un autre PixelCanvas (pixels non vides seulement). */
  stamp(src: PixelCanvas, ox: number, oy: number): this {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c) this.set(ox + x, oy + y, c);
    }
    return this;
  }

  /** Remplace une couleur par une autre (échange de palette). */
  swap(map: Record<string, string>): PixelCanvas {
    const out = new PixelCanvas(this.w, this.h);
    for (let i = 0; i < this.px.length; i++) {
      const c = this.px[i];
      out.px[i] = c ? (map[c] ?? c) : null;
    }
    return out;
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.px.length; i++) {
      const col = this.px[i];
      if (!col) continue;
      const n = parseInt(col.slice(1), 16);
      img.data[i * 4] = (n >> 16) & 255;
      img.data[i * 4 + 1] = (n >> 8) & 255;
      img.data[i * 4 + 2] = n & 255;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

/** Chiffres pixel 7×10 dessinés pour la lisibilité (traits de 2 pixels). */
export const DIGITS: Record<string, readonly string[]> = {
  '0': ['..###..', '.##.##.', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '.##.##.', '..###..'],
  '1': ['...##..', '..###..', '.####..', '...##..', '...##..', '...##..', '...##..', '...##..', '...##..', '.######'],
  '2': ['.#####.', '##...##', '.....##', '....##.', '...##..', '..##...', '.##....', '##.....', '##.....', '#######'],
  '3': ['.#####.', '##...##', '.....##', '.....##', '..####.', '.....##', '.....##', '.....##', '##...##', '.#####.'],
  '4': ['....##.', '...###.', '..####.', '.##.##.', '##..##.', '##..##.', '#######', '....##.', '....##.', '....##.'],
  '5': ['#######', '##.....', '##.....', '######.', '.....##', '.....##', '.....##', '.....##', '##...##', '.#####.'],
  '6': ['..####.', '.##....', '##.....', '##.....', '######.', '##...##', '##...##', '##...##', '##...##', '.#####.'],
  '7': ['#######', '.....##', '.....##', '....##.', '....##.', '...##..', '...##..', '..##...', '..##...', '..##...'],
  '8': ['.#####.', '##...##', '##...##', '##...##', '.#####.', '##...##', '##...##', '##...##', '##...##', '.#####.'],
  '9': ['.#####.', '##...##', '##...##', '##...##', '##...##', '.######', '.....##', '.....##', '....##.', '.####..'],
};

export const DIGIT_W = 7;
export const DIGIT_H = 10;

/** Largeur en pixels d'un nombre écrit avec DIGITS (1 pixel entre chiffres). */
export function numberWidth(n: number): number {
  const s = String(n);
  return s.length * DIGIT_W + (s.length - 1);
}

/**
 * Écrit un nombre : remplissage `fill`, contour `ink` et ombre portée
 * d'un pixel vers le bas (`shadow`).
 */
export function drawNumber(pc: PixelCanvas, n: number, cx: number, cy: number, fill: string, ink: string, shadow?: string): void {
  const s = String(n);
  const w = numberWidth(n);
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(cy - DIGIT_H / 2);
  const glyph = new PixelCanvas(w + 2, DIGIT_H + 3);
  [...s].forEach((ch, k) => glyph.pattern(1 + k * (DIGIT_W + 1), 1, DIGITS[ch], { '#': fill }));
  glyph.outline(ink);
  if (shadow) {
    // L'ombre se place sous le contour, sans recouvrir le chiffre.
    for (let x = 0; x < glyph.w; x++) {
      for (let y = glyph.h - 1; y >= 1; y--) {
        if (!glyph.get(x, y) && glyph.get(x, y - 1) === ink) glyph.set(x, y, shadow);
      }
    }
  }
  pc.stamp(glyph, x0 - 1, y0 - 1);
}
