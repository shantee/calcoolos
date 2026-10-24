/**
 * Variante B — « Gouache nocturne » : 2D illustrée dessinée par code (Canvas 2D).
 * Formes légèrement irrégulières, contour encré, ombre en aplat, grain de papier.
 * Les sprites sont dessinés à résolution ×2 puis affichés à 0,5 pour rester nets.
 */
import { createRng, type Rng } from '../core/rng';

export const RES = 2;
export const FONT = '"Bricolage Grotesque Variable", "Bricolage Grotesque", system-ui, sans-serif';

export const C = {
  ink: '#1d1a2b',
  inkSoft: '#2d2944',
  cream: '#f6ecd8',
  creamShade: '#e2cfae',
  tan: '#c49a6c',
  saffron: '#ffc94a',
  saffronShade: '#e89a2c',
  coral: '#f0745e',
  coralShade: '#c24d4a',
  coralLight: '#ffb08f',
  moss: '#7fb069',
  mossShade: '#4b7f4f',
  teal: '#5fd3bc',
  tealDeep: '#1f6f72',
  night: '#10253a',
  sky1: '#0e2236',
  sky2: '#1d4a5b',
  sky3: '#3d7b7a',
  sky4: '#f0b27f',
  far1: '#2b5d6b',
  far2: '#3e7a80',
  plum: '#6a4a7a',
  wood: '#8a5a3c',
  woodLight: '#b67c4f',
  woodDark: '#5e3a2a',
};

export function makeCanvas(w: number, h: number, res = RES): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * res);
  c.height = Math.ceil(h * res);
  const ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

/** Contour d'une forme « organique » : ellipse dont le rayon ondule légèrement. */
export function blobPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, rng: Rng, wobble = 0.05, points = 14): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const k = 1 + (rng.next() - 0.5) * 2 * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  smoothClosed(ctx, pts);
}

/** Chemin fermé lissé passant par les milieux des segments. */
export function smoothClosed(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>): void {
  const n = pts.length;
  const mid = (i: number): [number, number] => {
    const a = pts[i % n];
    const b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  ctx.beginPath();
  const m0 = mid(0);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n];
    const m = mid(i);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Peint une forme : aplat, ombre portée intérieure (décalée vers le bas-droite),
 * reflet, puis contour encré.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  path: () => void,
  fill: string,
  opts: { shade?: string; light?: string; ink?: string; line?: number; shadeOffset?: [number, number] } = {},
): void {
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  if (opts.shade) {
    // Ombre en aplat : on peint l'ombre dans la forme, puis l'aplat d'origine
    // dans la forme décalée vers la lumière ; il reste un croissant d'ombre.
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = opts.shade;
    ctx.fillRect(-2000, -2000, 4000, 4000);
    const [dx, dy] = opts.shadeOffset ?? [-6, -7];
    ctx.translate(dx, dy);
    path();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }
  if (opts.light) {
    ctx.save();
    path();
    ctx.clip();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = opts.light;
    ctx.lineWidth = 5;
    ctx.translate(3, 3);
    path();
    ctx.stroke();
    ctx.restore();
  }
  if (opts.ink !== '') {
    path();
    ctx.strokeStyle = opts.ink ?? C.ink;
    ctx.lineWidth = opts.line ?? 4;
    ctx.stroke();
  }
}

// --- Cubes ------------------------------------------------------------------------
export const TILE = 84;

export function tile(state: 'normal' | 'selected' | 'spent'): HTMLCanvasElement {
  const pad = 6;
  const [c, ctx] = makeCanvas(TILE + pad * 2, TILE + pad * 2 + 10);
  const top = state === 'selected' ? C.saffron : C.cream;
  const side = state === 'selected' ? C.saffronShade : C.tan;
  ctx.globalAlpha = state === 'spent' ? 0.35 : 1;
  // Épaisseur du bloc.
  paint(ctx, () => roundRectPath(ctx, pad, pad + 9, TILE, TILE, 16), side, { line: 4 });
  // Face supérieure.
  paint(ctx, () => roundRectPath(ctx, pad, pad, TILE, TILE, 16), top, {
    shade: state === 'selected' ? '#f2b03a' : C.creamShade,
    shadeOffset: [-5, -6],
    light: '#ffffff',
    line: 4,
  });
  // Petit ornement : trois points gravés.
  ctx.fillStyle = state === 'selected' ? C.saffronShade : C.creamShade;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(pad + TILE - 16 - i * 7, pad + TILE - 11, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export function focusRing(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(TILE + 20, TILE + 30);
  ctx.setLineDash([10, 7]);
  ctx.strokeStyle = C.saffron;
  ctx.lineWidth = 4;
  roundRectPath(ctx, 3, 3, TILE + 14, TILE + 24, 20);
  ctx.stroke();
  return c;
}

// --- Ennemi -----------------------------------------------------------------------
export const ENEMY_W = 150;
export const ENEMY_H = 160;

/** Le « Mordillon à pancarte », version illustrée. Pieds au bas du canevas. */
export function enemy(frame: 0 | 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(ENEMY_W, ENEMY_H);
  const rng = createRng(31);
  const cx = 75;
  const cy = 100;
  // Jambes.
  const legs = frame === 0 ? [0, -7] : [-7, 0];
  [[52, legs[0]], [90, legs[1]]].forEach(([x, dy]) => {
    paint(ctx, () => {
      roundRectPath(ctx, x, 128 + dy, 16, 26, 7);
    }, C.coralShade, { line: 4 });
    paint(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(x + 8, 154 + dy, 13, 5, 0, 0, Math.PI * 2);
    }, C.coralShade, { line: 4 });
  });
  // Bras tendus vers la pancarte.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 11;
  [[34, 98, 30, 6], [116, 98, 122, 6]].forEach(([x0, y0, x1, y1]) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + (x0 < cx ? -12 : 12), (y0 + y1) / 2, x1, y1);
    ctx.stroke();
  });
  ctx.strokeStyle = C.coral;
  ctx.lineWidth = 5;
  [[34, 98, 30, 6], [116, 98, 122, 6]].forEach(([x0, y0, x1, y1]) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + (x0 < cx ? -12 : 12), (y0 + y1) / 2, x1, y1);
    ctx.stroke();
  });
  // Corps.
  const body = () => blobPath(ctx, cx, cy, 50, 42, createRng(7), 0.04, 16);
  paint(ctx, body, C.coral, { shade: C.coralShade, shadeOffset: [-9, -9], light: C.coralLight, line: 5 });
  // Ventre.
  ctx.save();
  body();
  ctx.clip();
  ctx.fillStyle = C.coralLight;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy + 22, 28, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Toison de mousse avec mèches.
  const moss = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 46, cy - 14);
    ctx.bezierCurveTo(cx - 40, cy - 50, cx + 40, cy - 54, cx + 47, cy - 16);
    // Mèches pendantes irrégulières.
    const tips = 7;
    for (let i = 0; i <= tips; i++) {
      const x = cx + 47 - (i / tips) * 93;
      const y = cy - 16 + (i % 2 === 0 ? 2 : 14 + rng.int(0, 6));
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  paint(ctx, moss, C.moss, { shade: C.mossShade, shadeOffset: [-4, -6], line: 4 });
  // Cornes.
  [[-30, -1], [30, 1]].forEach(([dx, dir]) => {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(cx + dx - 7, cy - 44);
      ctx.quadraticCurveTo(cx + dx + dir * 4, cy - 70, cx + dx + dir * 14, cy - 64);
      ctx.quadraticCurveTo(cx + dx + dir * 4, cy - 56, cx + dx + 7, cy - 42);
      ctx.closePath();
    }, C.cream, { shade: C.creamShade, line: 4 });
  });
  // Grand œil, qui regarde vers le phare (à gauche).
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(cx - 2, cy - 2, 20, 21, 0, 0, Math.PI * 2);
  }, '#ffffff', { shade: '#dcd6ea', shadeOffset: [-4, -5], line: 4 });
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.ellipse(cx - 9, cy, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  // Sourcil têtu.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy - 28);
  ctx.quadraticCurveTo(cx - 2, cy - 22, cx + 18, cy - 30);
  ctx.stroke();
  // Bouche de travers avec une dent.
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy + 28);
  ctx.quadraticCurveTo(cx, cy + 34, cx + 16, cy + 25);
  ctx.stroke();
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy + 31);
    ctx.lineTo(cx + 6, cy + 30);
    ctx.lineTo(cx + 3, cy + 38);
    ctx.closePath();
  }, '#ffffff', { line: 2.5 });
  return c;
}

/** Pancarte avec le nombre cible. */
export function sign(n: number): HTMLCanvasElement {
  const w = n >= 10 ? 112 : 92;
  const h = 62;
  const [c, ctx] = makeCanvas(w + 10, h + 10);
  const plank = () => {
    ctx.beginPath();
    ctx.moveTo(6, 10);
    ctx.lineTo(w + 3, 6);
    ctx.lineTo(w + 5, h + 2);
    ctx.lineTo(4, h + 4);
    ctx.closePath();
  };
  paint(ctx, plank, C.woodLight, { shade: C.wood, shadeOffset: [-4, -5], line: 4 });
  // Veines du bois.
  ctx.strokeStyle = C.wood;
  ctx.lineWidth = 2;
  for (const y of [22, 44]) {
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.bezierCurveTo(30, y - 4, 60, y + 4, w - 6, y - 2);
    ctx.stroke();
  }
  ctx.fillStyle = C.ink;
  for (const [x, y] of [[13, 15], [w - 4, 12], [12, h - 4], [w - 3, h - 6]]) {
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `800 46px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = C.ink;
  ctx.strokeText(String(n), (w + 10) / 2, h / 2 + 7);
  ctx.fillStyle = C.cream;
  ctx.fillText(String(n), (w + 10) / 2, h / 2 + 7);
  return c;
}

// --- Phare ------------------------------------------------------------------------------
export const TOWER_W = 150;
export const TOWER_H = 300;

export function tower(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(TOWER_W, TOWER_H);
  const cx = 75;
  // Corps effilé, légèrement penché : un phare qui a du vécu.
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 44, 290);
    ctx.bezierCurveTo(cx - 40, 220, cx - 30, 160, cx - 26, 112);
    ctx.lineTo(cx + 30, 110);
    ctx.bezierCurveTo(cx + 34, 160, cx + 42, 220, cx + 46, 290);
    ctx.closePath();
  };
  paint(ctx, body, C.cream, { shade: C.creamShade, shadeOffset: [-12, 0], line: 5 });
  // Bandes corail.
  ctx.save();
  body();
  ctx.clip();
  for (const [y, hgt] of [[140, 30], [200, 30], [258, 32]]) {
    ctx.fillStyle = C.coral;
    ctx.beginPath();
    ctx.moveTo(0, y + 4);
    ctx.quadraticCurveTo(cx, y - 6, TOWER_W, y + 2);
    ctx.lineTo(TOWER_W, y + hgt + 2);
    ctx.quadraticCurveTo(cx, y + hgt - 6, 0, y + hgt + 4);
    ctx.fill();
    ctx.fillStyle = C.coralShade;
    ctx.fillRect(cx + 18, y - 10, 60, hgt + 16);
  }
  ctx.restore();
  body();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 5;
  ctx.stroke();
  // Fenêtre et porte.
  // Fenêtre en arc avec meneau (une forme ronde pleine se lirait comme un zéro).
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 9, 196);
    ctx.lineTo(cx - 9, 182);
    ctx.quadraticCurveTo(cx - 1, 168, cx + 7, 182);
    ctx.lineTo(cx + 7, 196);
    ctx.closePath();
  }, C.saffron, { line: 3.5 });
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 1, 176);
  ctx.lineTo(cx - 1, 196);
  ctx.moveTo(cx - 9, 186);
  ctx.lineTo(cx + 7, 186);
  ctx.stroke();
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 14, 292);
    ctx.lineTo(cx - 14, 262);
    ctx.quadraticCurveTo(cx, 248, cx + 14, 262);
    ctx.lineTo(cx + 14, 292);
    ctx.closePath();
  }, C.woodDark, { line: 4 });
  // Galerie.
  paint(ctx, () => roundRectPath(ctx, cx - 40, 100, 80, 14, 5), C.plum, { line: 4 });
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  for (let x = cx - 34; x <= cx + 34; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, 100);
    ctx.lineTo(x, 84);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 38, 84);
  ctx.lineTo(cx + 38, 84);
  ctx.stroke();
  // Lanterne.
  paint(ctx, () => roundRectPath(ctx, cx - 22, 52, 44, 50, 8), C.teal, { shade: '#3fae9a', shadeOffset: [-8, 0], line: 4.5 });
  ctx.fillStyle = '#e8fff4';
  ctx.beginPath();
  ctx.ellipse(cx - 2, 76, 9, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  for (const x of [cx - 8, cx + 8]) {
    ctx.beginPath();
    ctx.moveTo(x, 54);
    ctx.lineTo(x, 100);
    ctx.stroke();
  }
  // Toit en chapeau de sorcière un peu tordu.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 34, 56);
    ctx.quadraticCurveTo(cx - 6, 40, cx + 6, 6);
    ctx.quadraticCurveTo(cx + 12, 30, cx + 34, 54);
    ctx.quadraticCurveTo(cx, 62, cx - 34, 56);
    ctx.closePath();
  }, C.saffron, { shade: C.saffronShade, shadeOffset: [-10, 0], line: 5 });
  // Fanion.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + 6, 8);
  ctx.lineTo(cx + 6, -2);
  ctx.stroke();
  return c;
}

/** Halo doux (dégradé radial) pour les lumières et la magie. */
export function softGlow(r: number, color: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(r * 2, r * 2, 1);
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color + 'aa');
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, r * 2, r * 2);
  return c;
}

/** Étincelle à quatre branches. */
export function sparkle(color: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(24, 24);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.quadraticCurveTo(13.5, 10.5, 24, 12);
  ctx.quadraticCurveTo(13.5, 13.5, 12, 24);
  ctx.quadraticCurveTo(10.5, 13.5, 0, 12);
  ctx.quadraticCurveTo(10.5, 10.5, 12, 0);
  ctx.fill();
  return c;
}

/** Orbe-rune portant le nombre. */
export function rune(n: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(96, 96);
  paint(ctx, () => blobPath(ctx, 48, 48, 38, 38, createRng(n), 0.06, 10), C.teal, { shade: '#3fae9a', light: '#e8fff4', line: 5 });
  ctx.font = `800 40px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = C.ink;
  ctx.strokeText(String(n), 48, 52);
  ctx.fillStyle = C.cream;
  ctx.fillText(String(n), 48, 52);
  return c;
}

/** Nuage illustré. */
export function cloud(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h, 1);
  const rng = createRng(seed);
  const path = () => {
    const pts: Array<[number, number]> = [];
    const bumps = 7;
    for (let i = 0; i <= bumps; i++) {
      const x = 10 + (i / bumps) * (w - 20);
      pts.push([x, h * 0.45 - rng.int(0, Math.floor(h * 0.3))]);
    }
    pts.push([w - 6, h - 8], [6, h - 8]);
    smoothClosed(ctx, pts);
  };
  paint(ctx, path, '#f8d9c4', { ink: '', shade: '#e3aaa0', shadeOffset: [0, -10] });
  return c;
}

// --- Décor ------------------------------------------------------------------------------
export function background(): HTMLCanvasElement {
  const W = 1280;
  const Hh = 720;
  const [c, ctx] = makeCanvas(W, Hh, 1);
  const rng = createRng(796);

  // Ciel.
  const g = ctx.createLinearGradient(0, 0, 0, 560);
  g.addColorStop(0, C.sky1);
  g.addColorStop(0.45, C.sky2);
  g.addColorStop(0.78, C.sky3);
  g.addColorStop(1, C.sky4);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, Hh);

  // Étoiles et étincelles.
  for (let i = 0; i < 90; i++) {
    const x = rng.int(0, W);
    const y = rng.int(0, 300);
    ctx.fillStyle = rng.next() < 0.2 ? C.saffron : '#cfe8e4';
    ctx.globalAlpha = 0.4 + rng.next() * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, rng.next() < 0.1 ? 2.2 : 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Lune safran, gros et bienveillant.
  const halo = ctx.createRadialGradient(1010, 150, 40, 1010, 150, 220);
  halo.addColorStop(0, 'rgba(255, 201, 74, 0.35)');
  halo.addColorStop(1, 'rgba(255, 201, 74, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(760, 0, 500, 400);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(1010, 150, 74, 0, Math.PI * 2);
  }, '#ffd66b', { shade: '#f2b54a', shadeOffset: [-16, -10], line: 0, ink: '' });
  ctx.fillStyle = '#f2b54a';
  for (const [x, y, r] of [[985, 125, 12], [1040, 175, 9], [1020, 120, 5], [970, 180, 7]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Îles lointaines.
  const island = (cx: number, top: number, w: number, depth: number, col: string, trees: number, fall: boolean) => {
    const r = createRng(cx + top);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(cx - w, top);
      ctx.bezierCurveTo(cx - w * 0.6, top - 16, cx + w * 0.5, top - 18, cx + w, top);
      ctx.bezierCurveTo(cx + w * 0.6, top + depth * 0.5, cx + w * 0.2, top + depth, cx, top + depth * 1.15);
      ctx.bezierCurveTo(cx - w * 0.3, top + depth, cx - w * 0.7, top + depth * 0.4, cx - w, top);
      ctx.closePath();
    };
    paint(ctx, path, col, { ink: '', shade: C.far1, shadeOffset: [-w * 0.3, -6] });
    // Arbres-sucettes.
    for (let i = 0; i < trees; i++) {
      const x = cx - w * 0.6 + r.next() * w * 1.2;
      const hgt = 14 + r.int(0, 16);
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, top - 8);
      ctx.lineTo(x, top - 8 - hgt);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, top - 10 - hgt, 7 + r.int(0, 5), 0, Math.PI * 2);
      ctx.fill();
    }
    if (fall) {
      ctx.strokeStyle = 'rgba(232, 255, 244, 0.45)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx + w * 0.4, top + 6);
      ctx.bezierCurveTo(cx + w * 0.45, top + 60, cx + w * 0.42, top + 120, cx + w * 0.44, top + 190);
      ctx.stroke();
    }
  };
  island(640, 300, 110, 70, C.far2, 4, true);
  island(860, 250, 60, 40, C.far2, 2, false);
  island(1180, 330, 120, 60, C.far2, 5, true);
  // Petite maison avec une fenêtre allumée.
  ctx.fillStyle = C.far1;
  ctx.fillRect(850, 222, 18, 14);
  ctx.beginPath();
  ctx.moveTo(846, 223);
  ctx.lineTo(859, 210);
  ctx.lineTo(872, 223);
  ctx.fill();
  ctx.fillStyle = C.saffron;
  ctx.fillRect(856, 226, 5, 5);

  // Banc de nuages à l'horizon.
  ctx.fillStyle = '#f3c9b0';
  ctx.globalAlpha = 0.5;
  for (let x = 380; x < W + 60; x += 70) {
    ctx.beginPath();
    ctx.arc(x, 520 + Math.sin(x) * 8, 46 + (x % 3) * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Île principale.
  const ground = () => {
    ctx.beginPath();
    ctx.moveTo(-20, 572);
    for (let x = -20; x <= W + 20; x += 40) ctx.lineTo(x, 566 + Math.sin(x / 90) * 5 + Math.sin(x / 31) * 2);
    ctx.lineTo(W + 20, Hh + 20);
    ctx.lineTo(-20, Hh + 20);
    ctx.closePath();
  };
  paint(ctx, ground, '#3a3550', { line: 5, shade: '#2b2640', shadeOffset: [0, -40] });
  // Herbe.
  ctx.save();
  ground();
  ctx.clip();
  ctx.fillStyle = C.moss;
  ctx.fillRect(-20, 540, W + 40, 34);
  ctx.fillStyle = C.mossShade;
  for (let x = 0; x < W; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 590);
    ctx.quadraticCurveTo(x + 9, 600 + (x % 5) * 2, x + 18, 590);
    ctx.lineTo(x + 18, 560);
    ctx.lineTo(x, 560);
    ctx.fill();
  }
  ctx.fillStyle = C.moss;
  ctx.fillRect(-20, 540, W + 40, 34);
  // Sentier de pierres plates.
  for (let x = 610; x < W; x += 46 + rng.int(0, 10)) {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(x, 594 + rng.int(-2, 3), 18 + rng.int(0, 6), 6, 0, 0, Math.PI * 2);
    }, '#8f86a8', { line: 3, shade: '#6e6788', shadeOffset: [0, -3] });
  }
  // Racines et cailloux dans la terre.
  ctx.strokeStyle = '#4a4462';
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    const x = rng.int(0, W);
    ctx.beginPath();
    ctx.moveTo(x, 610);
    ctx.bezierCurveTo(x + 10, 640, x - 10, 660, x + rng.int(-20, 20), 700);
    ctx.stroke();
  }
  ctx.restore();
  ground();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 5;
  ctx.stroke();
  // Fleurs dans l'herbe.
  for (let i = 0; i < 26; i++) {
    const x = rng.int(560, W - 10);
    const y = 566 + Math.sin(x / 90) * 5 - 2;
    ctx.fillStyle = rng.next() < 0.5 ? C.coralLight : C.cream;
    ctx.beginPath();
    ctx.arc(x, y - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  return c;
}

/** Établi de l'atelier des cubes : panneau sombre à bord encré, ornements safran. */
export function workshop(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(420, 600);
  const path = () => roundRectPath(ctx, 6, 6, 408, 588, 26);
  paint(ctx, path, 'rgba(16, 37, 58, 0.9)', { line: 5 });
  ctx.strokeStyle = 'rgba(95, 211, 188, 0.35)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, 16, 16, 388, 568, 18);
  ctx.stroke();
  // Ornements de coin.
  for (const [x, y] of [[26, 26], [394, 26], [26, 574], [394, 574]]) paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
  }, C.saffron, { line: 3 });
  return c;
}

/** Grain de papier, superposé à faible opacité sur toute la scène. */
export function grain(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h, 1);
  const img = ctx.createImageData(w, h);
  const rng = createRng(12);
  for (let i = 0; i < w * h; i++) {
    const v = 128 + (rng.next() - 0.5) * 90;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Bouton illustré. */
export function button(w: number, h: number, primary: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w + 8, h + 14);
  paint(ctx, () => roundRectPath(ctx, 4, 10, w, h, 16), primary ? C.saffronShade : '#4a4462', { line: 4 });
  paint(ctx, () => roundRectPath(ctx, 4, 4, w, h, 16), primary ? C.saffron : '#6e6788', { line: 4, light: '#ffffff' });
  return c;
}

export function shadow(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  ctx.fillStyle = 'rgba(29, 26, 43, 0.45)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}
