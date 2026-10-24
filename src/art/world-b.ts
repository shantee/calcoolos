/**
 * Monde de « Cubes de siège » (direction B retenue le 24/10/2026) :
 * monstres supplémentaires, petits habitants du décor et icônes.
 * Même technique que variant-b.ts : dessin Canvas 2D à ×2, contour encré.
 */
import { C, FONT, RES, makeCanvas, paint, blobPath, roundRectPath, enemy as mordillon } from './variant-b';
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

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look = -0.4, lid = 0): void {
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.05, 0, 0, Math.PI * 2);
  }, '#ffffff', { line: 3.5 });
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.ellipse(x + look * r * 0.45, y + 1, r * 0.42, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + look * r * 0.45 + 2, y - 2, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  if (lid > 0) {
    // Paupière lourde : l'air endormi du Carapaçon.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.05, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#5f8f88';
    ctx.fillRect(x - r - 2, y - r - 2, r * 2 + 4, r * 2 * lid + 2);
    ctx.restore();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r + r * 2 * lid);
    ctx.lineTo(x + r, y - r + r * 2 * lid);
    ctx.stroke();
  }
}

/** Trotte-menu : petit, lilas, grandes jambes, toujours pressé. */
function trotteur(frame: 0 | 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(CREATURE_W, CREATURE_H);
  const cx = 76;
  const cy = 98;
  const body = '#b79ad8';
  // Longues jambes en compas.
  const stride = frame === 0 ? [-14, 12] : [12, -14];
  [[62, stride[0]], [90, stride[1]]].forEach(([x, dx]) => {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(x, 118);
    ctx.lineTo(x + dx, 152);
    ctx.stroke();
    ctx.strokeStyle = '#8a6bb3';
    ctx.lineWidth = 4;
    ctx.stroke();
    paint(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(x + dx - 4, 154, 11, 4.5, 0, 0, Math.PI * 2);
    }, '#8a6bb3', { line: 3.5 });
  });
  arms(ctx, [[50, 92], [102, 92]], body);
  const shape = () => blobPath(ctx, cx, cy, 36, 30, createRng(3), 0.05, 14);
  paint(ctx, shape, body, { shade: '#8a6bb3', shadeOffset: [-7, -7], light: '#dccbf2', line: 5 });
  // Antenne à boule.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx + 6, cy - 28);
  ctx.quadraticCurveTo(cx + 18, cy - 50, cx + 30, cy - 44);
  ctx.stroke();
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx + 30, cy - 44, 6, 0, Math.PI * 2);
  }, C.saffron, { line: 3 });
  // Deux yeux ronds qui louchent vers le phare.
  eye(ctx, cx - 12, cy - 4, 11, -0.6);
  eye(ctx, cx + 12, cy - 6, 9, -0.6);
  // Petit sourire pressé.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy + 14);
  ctx.quadraticCurveTo(cx, cy + 20, cx + 10, cy + 13);
  ctx.stroke();
  return c;
}

/** Carapaçon : lent, endormi, coiffé d'une lourde carapace. */
function carapacon(frame: 0 | 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(CREATURE_W, CREATURE_H);
  const cx = 75;
  const cy = 104;
  const body = '#7fb3aa';
  const legs = frame === 0 ? [0, -5] : [-5, 0];
  [[48, legs[0]], [92, legs[1]]].forEach(([x, dy]) => {
    paint(ctx, () => roundRectPath(ctx, x, 130 + dy, 20, 22, 8), '#5f8f88', { line: 4 });
  });
  arms(ctx, [[30, 104], [120, 104]], body);
  const shape = () => blobPath(ctx, cx, cy + 4, 52, 36, createRng(9), 0.03, 16);
  paint(ctx, shape, body, { shade: '#5f8f88', shadeOffset: [-8, -8], light: '#c4e3dc', line: 5 });
  // Carapace en dôme avec plaques et rivets.
  const shell = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 60, cy - 2);
    ctx.bezierCurveTo(cx - 56, cy - 66, cx + 56, cy - 66, cx + 60, cy - 2);
    ctx.quadraticCurveTo(cx, cy + 10, cx - 60, cy - 2);
    ctx.closePath();
  };
  paint(ctx, shell, '#6c7aa0', { shade: '#4c5878', shadeOffset: [-10, -8], light: '#a3b0d4', line: 5 });
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  for (const [x0, y0, x1, y1] of [[cx - 30, cy - 46, cx - 22, cy], [cx + 2, cy - 54, cx + 2, cy + 4], [cx + 32, cy - 44, cx + 26, cy]]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.fillStyle = C.saffron;
  for (const [x, y] of [[cx - 44, cy - 14], [cx - 12, cy - 30], [cx + 18, cy - 28], [cx + 44, cy - 14]]) {
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Yeux mi-clos sous la carapace.
  eye(ctx, cx - 16, cy + 14, 11, -0.5, 0.45);
  eye(ctx, cx + 14, cy + 14, 11, -0.5, 0.45);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy + 34);
  ctx.lineTo(cx + 8, cy + 33);
  ctx.stroke();
  return c;
}

/** Roi Mordillon : un Mordillon couronné, dessiné plus grand. */
function roi(frame: 0 | 1): HTMLCanvasElement {
  const base = mordillon(frame);
  const [c, ctx] = makeCanvas(CREATURE_W, CREATURE_H);
  ctx.drawImage(base, 0, 0, CREATURE_W, CREATURE_H);
  const cx = 75;
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 30, 52);
    ctx.lineTo(cx - 34, 26);
    ctx.lineTo(cx - 16, 40);
    ctx.lineTo(cx, 20);
    ctx.lineTo(cx + 16, 40);
    ctx.lineTo(cx + 34, 26);
    ctx.lineTo(cx + 30, 52);
    ctx.closePath();
  }, C.saffron, { shade: C.saffronShade, shadeOffset: [-6, 0], line: 4 });
  ctx.fillStyle = C.coral;
  for (const x of [cx - 16, cx, cx + 16]) {
    ctx.beginPath();
    ctx.arc(x, 44, 4, 0, Math.PI * 2);
    ctx.fill();
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
      return roi(frame);
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

