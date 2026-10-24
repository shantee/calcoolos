/**
 * Monde de « Cubes de siège » (direction B retenue le 24/10/2026) :
 * monstres supplémentaires, petits habitants du décor et icônes.
 * Même technique que variant-b.ts : dessin Canvas 2D à ×2, contour encré.
 */
import { C, FONT, RES, makeCanvas, paint, blobPath, roundRectPath } from './variant-b';
import { createRng } from '../core/rng';
import type { EnemyKind } from '../core/waves';

export { RES, FONT, C };

export const CREATURE_W = 150;
export const CREATURE_H = 160;

/** Bras levés qui tiennent la pancarte (communs à tous les monstres). */
function arms(ctx: CanvasRenderingContext2D, from: Array<[number, number]>, color: string): void {
  const tops: Array<[number, number]> = [[30, 6], [122, 6]];
  for (const pass of [{ w: 11, c: C.ink }, { w: 5, c: color }]) {
    ctx.strokeStyle = pass.c;
    ctx.lineWidth = pass.w;
    from.forEach(([x0, y0], i) => {
      const [x1, y1] = tops[i];
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + (i === 0 ? -12 : 12), (y0 + y1) / 2, x1, y1);
      ctx.stroke();
    });
  }
}

/** Œil de monstre : jaune, pupille fendue, sourcil froncé. */
function angryEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look = -0.35, browTilt = 1): void {
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.9, 0, 0, Math.PI * 2);
  }, '#ffd34a', { shade: '#e8a52c', shadeOffset: [-2, -3], line: 3.5 });
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.ellipse(x + look * r * 0.5, y + 1, r * 0.18, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + look * r * 0.5 + r * 0.3, y - r * 0.3, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  // Sourcil épais en V : l'air vraiment fâché.
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  const t = browTilt * r * 0.55;
  ctx.moveTo(x - r * 1.15, y - r * 0.95 - t);
  ctx.lineTo(x + r * 1.1, y - r * 0.55 + t * 0.6);
  ctx.lineTo(x + r * 1.05, y - r * 0.2 + t * 0.6);
  ctx.lineTo(x - r * 1.1, y - r * 0.6 - t);
  ctx.closePath();
  ctx.fill();
}

/** Grande gueule : intérieur sombre, rangées de crocs pointus. */
function fangs(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, topTeeth: number, bottomTeeth: number): void {
  const mouth = () => {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy - h * 0.15);
    ctx.quadraticCurveTo(cx, cy - h * 0.45, cx + w / 2, cy - h * 0.2);
    ctx.quadraticCurveTo(cx + w * 0.3, cy + h * 0.75, cx, cy + h * 0.7);
    ctx.quadraticCurveTo(cx - w * 0.35, cy + h * 0.7, cx - w / 2, cy - h * 0.15);
    ctx.closePath();
  };
  paint(ctx, mouth, '#3a0f1a', { line: 4 });
  ctx.save();
  mouth();
  ctx.clip();
  // Langue.
  ctx.fillStyle = '#c8405a';
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.08, cy + h * 0.55, w * 0.22, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  const tooth = (x: number, y: number, tw: number, th: number, down: boolean) => {
    ctx.beginPath();
    ctx.moveTo(x - tw / 2, y);
    ctx.lineTo(x + tw / 2, y);
    ctx.lineTo(x + tw * 0.1, y + (down ? th : -th));
    ctx.closePath();
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  for (let i = 0; i < topTeeth; i++) {
    const x = cx - w * 0.42 + ((i + 0.5) / topTeeth) * w * 0.84;
    const yTop = cy - h * 0.32 + Math.abs(x - cx) * 0.08;
    tooth(x, yTop - 2, (w / topTeeth) * 0.9, h * (i % 2 ? 0.38 : 0.5), true);
  }
  for (let i = 0; i < bottomTeeth; i++) {
    const x = cx - w * 0.3 + ((i + 0.5) / bottomTeeth) * w * 0.6;
    tooth(x, cy + h * 0.72, (w / bottomTeeth) * 0.55, h * 0.3, false);
  }
  ctx.restore();
}

/** Rangée de piquants sur le dos. */
function spikes(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, n: number, len: number, color: string): void {
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (1.12 + (i / (n - 1)) * 0.76);
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x - ny * 7, y + nx * 7);
      ctx.lineTo(x + nx * len, y + ny * len);
      ctx.lineTo(x + ny * 7, y - nx * 7);
      ctx.closePath();
    }, color, { line: 3.5 });
  }
}

const RED = { body: '#d8433b', shade: '#9e2a2f', light: '#ff8466', dark: '#5e1a22' };

/** Mordillon : boule rouge hérissée, gueule énorme. */
function mordillon(frame: 0 | 1, crown = false): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(CREATURE_W, CREATURE_H);
  const cx = 75;
  const cy = 100;
  const legs = frame === 0 ? [0, -7] : [-7, 0];
  [[50, legs[0]], [88, legs[1]]].forEach(([x, dy]) => {
    paint(ctx, () => roundRectPath(ctx, x, 126 + dy, 18, 26, 7), RED.shade, { line: 4 });
    // Griffes.
    for (let k = 0; k < 3; k++) {
      paint(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(x + 1 + k * 7, 150 + dy);
        ctx.lineTo(x + 4 + k * 7, 158 + dy);
        ctx.lineTo(x + 7 + k * 7, 150 + dy);
        ctx.closePath();
      }, '#fffaf0', { line: 2 });
    }
  });
  arms(ctx, [[32, 96], [118, 96]], RED.body);
  spikes(ctx, cx, cy - 2, 46, 40, 7, 18, RED.dark);
  const body = () => blobPath(ctx, cx, cy, 50, 42, createRng(7), 0.04, 16);
  paint(ctx, body, RED.body, { shade: RED.shade, shadeOffset: [-9, -9], light: RED.light, line: 5 });
  // Cornes noires recourbées.
  [[-28, -1], [28, 1]].forEach(([dx, dir]) => {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(cx + dx - 8, cy - 36);
      ctx.quadraticCurveTo(cx + dx + dir * 6, cy - 72, cx + dx + dir * 22, cy - 66);
      ctx.quadraticCurveTo(cx + dx + dir * 6, cy - 54, cx + dx + 8, cy - 34);
      ctx.closePath();
    }, '#3a3550', { shade: C.ink, shadeOffset: [-3, 0], line: 4 });
  });
  angryEye(ctx, cx - 18, cy - 14, 12, -0.5, 1);
  angryEye(ctx, cx + 16, cy - 16, 10, -0.5, -1);
  fangs(ctx, cx - 2, cy + 16, 64, 30, 7, 4);
  if (crown) {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(cx - 26, cy - 46);
      ctx.lineTo(cx - 30, cy - 76);
      ctx.lineTo(cx - 13, cy - 60);
      ctx.lineTo(cx, cy - 82);
      ctx.lineTo(cx + 13, cy - 60);
      ctx.lineTo(cx + 30, cy - 76);
      ctx.lineTo(cx + 26, cy - 46);
      ctx.closePath();
    }, C.saffron, { shade: C.saffronShade, shadeOffset: [-6, 0], line: 4 });
    ctx.fillStyle = '#5fd3bc';
    for (const x of [cx - 13, cx, cx + 13]) {
      ctx.beginPath();
      ctx.arc(x, cy - 52, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  return c;
}

/** Trotte-menu : petit diablotin cramoisi sur grandes pattes, sourire carnassier. */
function trotteur(frame: 0 | 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(CREATURE_W, CREATURE_H);
  const cx = 76;
  const cy = 98;
  const body = '#c2365a';
  const shade = '#87203f';
  const stride = frame === 0 ? [-14, 12] : [12, -14];
  [[62, stride[0]], [90, stride[1]]].forEach(([x, dx]) => {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(x, 118);
    ctx.lineTo(x + dx, 152);
    ctx.stroke();
    ctx.strokeStyle = shade;
    ctx.lineWidth = 4;
    ctx.stroke();
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x + dx - 14, 157);
      ctx.lineTo(x + dx + 6, 150);
      ctx.lineTo(x + dx + 8, 157);
      ctx.closePath();
    }, shade, { line: 3.5 });
  });
  arms(ctx, [[50, 92], [102, 92]], body);
  // Queue pointue.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx + 30, cy + 14);
  ctx.bezierCurveTo(cx + 60, cy + 20, cx + 50, cy - 20, cx + 66, cy - 26);
  ctx.stroke();
  ctx.strokeStyle = body;
  ctx.lineWidth = 3;
  ctx.stroke();
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx + 60, cy - 22);
    ctx.lineTo(cx + 74, cy - 34);
    ctx.lineTo(cx + 70, cy - 18);
    ctx.closePath();
  }, shade, { line: 3 });
  const shape = () => blobPath(ctx, cx, cy, 36, 31, createRng(3), 0.05, 14);
  paint(ctx, shape, body, { shade, shadeOffset: [-7, -7], light: '#f06d8c', line: 5 });
  // Petites cornes pointues.
  [[-16, -1], [16, 1]].forEach(([dx, dir]) => {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(cx + dx - 6, cy - 26);
      ctx.lineTo(cx + dx + dir * 6, cy - 50);
      ctx.lineTo(cx + dx + 6, cy - 26);
      ctx.closePath();
    }, '#3a3550', { line: 3.5 });
  });
  angryEye(ctx, cx - 13, cy - 8, 10, -0.6, 1);
  angryEye(ctx, cx + 13, cy - 9, 9, -0.6, -1);
  fangs(ctx, cx, cy + 14, 46, 20, 6, 0);
  return c;
}

/** Carapaçon : brute lourde à carapace cloutée, défenses qui dépassent. */
function carapacon(frame: 0 | 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(CREATURE_W, CREATURE_H);
  const cx = 75;
  const cy = 104;
  const body = '#b8463c';
  const shade = '#7e2a2a';
  const legs = frame === 0 ? [0, -5] : [-5, 0];
  [[46, legs[0]], [90, legs[1]]].forEach(([x, dy]) => {
    paint(ctx, () => roundRectPath(ctx, x, 130 + dy, 22, 22, 8), shade, { line: 4 });
  });
  arms(ctx, [[30, 104], [120, 104]], body);
  const shape = () => blobPath(ctx, cx, cy + 4, 54, 36, createRng(9), 0.03, 16);
  paint(ctx, shape, body, { shade, shadeOffset: [-8, -8], light: '#e07a62', line: 5 });
  // Carapace sombre hérissée de pointes.
  const shell = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 62, cy - 2);
    ctx.bezierCurveTo(cx - 58, cy - 68, cx + 58, cy - 68, cx + 62, cy - 2);
    ctx.quadraticCurveTo(cx, cy + 8, cx - 62, cy - 2);
    ctx.closePath();
  };
  spikes(ctx, cx, cy - 6, 52, 46, 6, 16, '#d9d2e6');
  paint(ctx, shell, '#3f3b56', { shade: '#2a2740', shadeOffset: [-10, -8], light: '#6c6890', line: 5 });
  ctx.fillStyle = '#d9d2e6';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  for (const [x, y] of [[cx - 42, cy - 14], [cx - 14, cy - 34], [cx + 14, cy - 34], [cx + 42, cy - 14], [cx, cy - 16]]) {
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  angryEye(ctx, cx - 18, cy + 14, 10, -0.5, 1.3);
  angryEye(ctx, cx + 16, cy + 14, 10, -0.5, -1.3);
  // Mâchoire inférieure prognathe avec deux défenses.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy + 30);
    ctx.quadraticCurveTo(cx, cy + 46, cx + 26, cy + 30);
    ctx.closePath();
  }, '#3a0f1a', { line: 3.5 });
  for (const dx of [-18, 18]) {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(cx + dx - 5, cy + 36);
      ctx.lineTo(cx + dx + (dx < 0 ? -3 : 3), cy + 20);
      ctx.lineTo(cx + dx + 5, cy + 36);
      ctx.closePath();
    }, '#fffaf0', { line: 2.5 });
  }
  return c;
}

export function creature(kind: EnemyKind, frame: 0 | 1): HTMLCanvasElement {
  switch (kind) {
    case 'trotteur':
      return trotteur(frame);
    case 'carapacon':
      return carapacon(frame);
    case 'roi':
      return mordillon(frame, true);
    default:
      return mordillon(frame);
  }
}

/** Échelle d'affichage de chaque monstre. */
export const CREATURE_SCALE: Record<EnemyKind, number> = { mordillon: 1, trotteur: 0.9, carapacon: 1.05, roi: 1.35 };

// --- Petits habitants ---------------------------------------------------------------

/** Escargot (marche) ou coquille seule (caché). */
export function snail(state: 0 | 1 | 'cache'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(80, 56);
  if (state !== 'cache') {
    const stretch = state === 0 ? 0 : 4;
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(10, 48);
      ctx.quadraticCurveTo(40, 40, 62 + stretch, 46);
      ctx.quadraticCurveTo(70 + stretch, 30, 64 + stretch, 22);
      ctx.quadraticCurveTo(54 + stretch, 22, 54, 38);
      ctx.lineTo(10, 52);
      ctx.closePath();
    }, '#cfe3a8', { shade: '#9fbf74', shadeOffset: [0, -4], line: 3.5 });
    // Cornes à yeux.
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    for (const [x, y] of [[62 + stretch, 6], [72 + stretch, 10]]) {
      ctx.beginPath();
      ctx.moveTo(64 + stretch, 24);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Coquille en spirale.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(30, 30, 20, 0, Math.PI * 2);
  }, C.coral, { shade: C.coralShade, shadeOffset: [-4, -4], light: C.coralLight, line: 3.5 });
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 4; a += 0.2) {
    const r = 2 + a * 1.25;
    const x = 30 + Math.cos(a) * r;
    const y = 30 + Math.sin(a) * r;
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  return c;
}

/** Chouette perchée sur la galerie du phare. */
export function owl(state: 'ouvert' | 'cligne' | 'contente'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 70);
  const cx = 32;
  paint(ctx, () => blobPath(ctx, cx, 40, 22, 26, createRng(4), 0.03, 12), '#8a6a8f', { shade: '#644a6a', shadeOffset: [-5, -4], line: 3.5 });
  // Aigrettes.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 18, 22);
    ctx.lineTo(cx - 16, 8);
    ctx.lineTo(cx - 6, 18);
    ctx.lineTo(cx + 6, 18);
    ctx.lineTo(cx + 16, 8);
    ctx.lineTo(cx + 18, 22);
    ctx.closePath();
  }, '#8a6a8f', { line: 3.5 });
  // Ventre moucheté.
  ctx.fillStyle = '#d9c3cf';
  ctx.beginPath();
  ctx.ellipse(cx, 48, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Yeux.
  for (const x of [cx - 9, cx + 9]) {
    if (state === 'cligne') {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 6, 28);
      ctx.lineTo(x + 6, 28);
      ctx.stroke();
    } else if (state === 'contente') {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, 30, 6, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      paint(ctx, () => {
        ctx.beginPath();
        ctx.arc(x, 28, 8, 0, Math.PI * 2);
      }, C.saffron, { line: 3 });
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(x - 1, 28, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Bec.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 4, 33);
    ctx.lineTo(cx + 4, 33);
    ctx.lineTo(cx, 40);
    ctx.closePath();
  }, C.saffronShade, { line: 2.5 });
  return c;
}

/** Visage de la lune (calque posé sur la lune du décor). */
export function moonFace(state: 'dort' | 'clin' | 'rougit'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(120, 90);
  ctx.strokeStyle = C.inkSoft;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  // Yeux.
  if (state === 'dort') {
    for (const x of [38, 82]) {
      ctx.beginPath();
      ctx.arc(x, 34, 9, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(38, 36, 9, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    ctx.fillStyle = C.inkSoft;
    ctx.beginPath();
    ctx.ellipse(82, 34, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bouche.
  ctx.beginPath();
  if (state === 'dort') ctx.arc(60, 56, 8, Math.PI * 0.15, Math.PI * 0.85);
  else ctx.arc(60, 50, 16, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  if (state === 'rougit') {
    ctx.fillStyle = 'rgba(240, 116, 94, 0.55)';
    for (const x of [24, 96]) {
      ctx.beginPath();
      ctx.ellipse(x, 54, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

/** Poisson volant qui saute hors de la mer de nuages. */
export function flyingFish(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(78, 44);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(8, 22);
    ctx.quadraticCurveTo(30, 4, 56, 18);
    ctx.lineTo(74, 8);
    ctx.lineTo(70, 22);
    ctx.lineTo(74, 36);
    ctx.lineTo(56, 26);
    ctx.quadraticCurveTo(30, 40, 8, 22);
    ctx.closePath();
  }, '#7fd6e0', { shade: '#4aa8b8', shadeOffset: [0, -5], line: 3.5 });
  // Nageoire-aile.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(30, 18);
    ctx.quadraticCurveTo(38, -2, 52, 4);
    ctx.quadraticCurveTo(44, 12, 40, 20);
    ctx.closePath();
  }, C.cream, { line: 3 });
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(17, 20, 3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// --- Icônes -------------------------------------------------------------------------------

export function heart(full: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(40, 36);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(20, 33);
    ctx.bezierCurveTo(2, 20, 2, 4, 12, 4);
    ctx.bezierCurveTo(17, 4, 20, 9, 20, 11);
    ctx.bezierCurveTo(20, 9, 23, 4, 28, 4);
    ctx.bezierCurveTo(38, 4, 38, 20, 20, 33);
    ctx.closePath();
  }, full ? C.coral : '#3a3550', { shade: full ? C.coralShade : undefined, shadeOffset: [-3, -3], line: 3.5 });
  return c;
}

export function shield(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(30, 34);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(15, 3);
    ctx.lineTo(27, 8);
    ctx.quadraticCurveTo(27, 24, 15, 31);
    ctx.quadraticCurveTo(3, 24, 3, 8);
    ctx.closePath();
  }, '#a3b0d4', { shade: '#6c7aa0', shadeOffset: [-4, 0], line: 3 });
  return c;
}

/** Bannière de vague / titre : ruban crème encré. */
export function ribbon(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w + 40, h + 12);
  for (const side of [0, 1]) {
    paint(ctx, () => {
      ctx.beginPath();
      const x = side === 0 ? 4 : w + 36;
      const dir = side === 0 ? 1 : -1;
      ctx.moveTo(x, 14);
      ctx.lineTo(x + dir * 30, 14);
      ctx.lineTo(x + dir * 30, h + 6);
      ctx.lineTo(x, h + 6);
      ctx.lineTo(x + dir * 12, (h + 20) / 2);
      ctx.closePath();
    }, C.saffronShade, { line: 3.5 });
  }
  paint(ctx, () => roundRectPath(ctx, 20, 4, w, h, 10), C.saffron, { shade: C.saffronShade, shadeOffset: [0, -6], line: 4 });
  return c;
}

/** Panneau de dialogue (début et fin de partie). */
export function dialogPanel(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w + 12, h + 20);
  paint(ctx, () => roundRectPath(ctx, 6, 14, w, h, 30), C.ink, { ink: '' });
  paint(ctx, () => roundRectPath(ctx, 6, 6, w, h, 30), C.night, { line: 5 });
  ctx.strokeStyle = 'rgba(95, 211, 188, 0.35)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, 18, 18, w - 24, h - 24, 22);
  ctx.stroke();
  return c;
}


// --- Destruction du phare --------------------------------------------------------------------

/** Petite pierre de maçonnerie (plusieurs formes selon la graine). */
export function rock(seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(30, 26);
  const r = createRng(seed);
  paint(ctx, () => blobPath(ctx, 15, 13, 10 + r.int(0, 3), 8 + r.int(0, 3), createRng(seed * 3), 0.25, 7), seed % 3 === 0 ? C.coral : C.cream, {
    shade: seed % 3 === 0 ? C.coralShade : C.creamShade,
    shadeOffset: [-3, -3],
    line: 3,
  });
  return c;
}

/** Fissures dessinées par-dessus le phare (niveau 1 ou 2), même cadre que tower(). */
export function cracks(level: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(150, 300);
  ctx.strokeStyle = C.ink;
  ctx.lineCap = 'round';
  const lines: Array<Array<[number, number]>> = [
    [[60, 128], [70, 146], [62, 160], [74, 178], [68, 196]],
    [[96, 220], [88, 236], [98, 250], [90, 268]],
    [[52, 238], [62, 252], [56, 270], [66, 286]],
    [[84, 140], [92, 156], [86, 170]],
  ];
  lines.slice(0, level === 1 ? 2 : 4).forEach((pts, i) => {
    ctx.lineWidth = i < 2 ? 3.5 : 3;
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  });
  return c;
}

/** Tas de gravats après l'effondrement. */
export function rubble(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(200, 70);
  const r = createRng(66);
  for (let i = 0; i < 16; i++) {
    const x = 20 + r.int(0, 160);
    const y = 40 + r.int(0, 22) - Math.max(0, 30 - Math.abs(x - 100) / 3);
    paint(ctx, () => blobPath(ctx, x, y, 12 + r.int(0, 8), 9 + r.int(0, 5), createRng(i + 5), 0.2, 7), i % 3 === 0 ? C.coral : C.cream, {
      shade: i % 3 === 0 ? C.coralShade : C.creamShade,
      shadeOffset: [-3, -3],
      line: 3,
    });
  }
  // La lanterne éteinte, posée de travers au sommet du tas.
  paint(ctx, () => roundRectPath(ctx, 86, 6, 26, 28, 5), '#3f7f7a', { line: 3.5 });
  return c;
}

/** Bulle de moquerie au-dessus d'un monstre qui danse. */
export function bubble(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w + 10, h + 22);
  paint(ctx, () => {
    roundRectPath(ctx, 5, 5, w, h, 16);
  }, C.cream, { line: 3.5 });
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(w / 2 - 8, h + 3);
    ctx.lineTo(w / 2, h + 18);
    ctx.lineTo(w / 2 + 10, h + 3);
    ctx.closePath();
  }, C.cream, { line: 3.5 });
  ctx.fillStyle = C.cream;
  ctx.fillRect(w / 2 - 6, h - 2, 14, 7);
  return c;
}
