/**
 * Monde spatial de « Pluie de météores », dans le style B (dessin Canvas 2D
 * encré, ×2). Les alliés restent crème, sarcelle et safran ; les ennemis rouges.
 */
import { C, makeCanvas, paint, blobPath, roundRectPath, softGlow, sparkle } from './variant-b';
import { createRng } from '../core/rng';

export { softGlow, sparkle };

export const SPACE = {
  deep: '#0a0b24',
  violet: '#1d1446',
  nebulaPink: '#ff5fa2',
  nebulaTeal: '#3fd6c4',
  planet: '#2f6f7a',
  planetShade: '#1d4a55',
  red: '#d8433b',
  redShade: '#9e2a2f',
  redLight: '#ff8466',
};

/** Fond : dégradé profond, nébuleuses, planète de l'archipel en bas. */
export function spaceBackground(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h, 1);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SPACE.deep);
  g.addColorStop(0.65, SPACE.violet);
  g.addColorStop(1, '#2a1a52');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rng = createRng(42);
  // Nébuleuses douces.
  for (const [x, y, r, col] of [[220, 180, 260, SPACE.nebulaPink], [760, 120, 300, SPACE.nebulaTeal], [520, 380, 220, '#8a5cff']] as const) {
    const n = ctx.createRadialGradient(x, y, 0, x, y, r);
    n.addColorStop(0, col + '40');
    n.addColorStop(1, col + '00');
    ctx.fillStyle = n;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Étoiles fixes lointaines.
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = rng.next() < 0.15 ? C.saffron : '#dfe6ff';
    ctx.globalAlpha = 0.25 + rng.next() * 0.6;
    ctx.beginPath();
    ctx.arc(rng.int(0, w), rng.int(0, h - 120), rng.next() < 0.1 ? 1.8 : 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Planète en bas : l'archipel vu de l'espace.
  const py = h + 900;
  const r = 1010;
  const halo = ctx.createRadialGradient(w / 2, py, r - 20, w / 2, py, r + 60);
  halo.addColorStop(0, 'rgba(95, 211, 188, 0.5)');
  halo.addColorStop(1, 'rgba(95, 211, 188, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, h - 200, w, 200);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(w / 2, py, r, 0, Math.PI * 2);
  }, SPACE.planet, { shade: SPACE.planetShade, shadeOffset: [-60, 30], line: 5 });
  // Îles et minuscule phare sur l'horizon.
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, py, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#7fb069';
  for (const [x, rw] of [[180, 60], [430, 40], [700, 80], [900, 50]]) {
    ctx.beginPath();
    ctx.ellipse(x, h - 52 + Math.abs(x - w / 2) * 0.04, rw, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = C.cream;
  ctx.fillRect(708, h - 82, 6, 20);
  ctx.fillStyle = C.coral;
  ctx.fillRect(708, h - 76, 6, 4);
  ctx.fillStyle = C.teal;
  ctx.fillRect(707, h - 86, 8, 5);
  return c;
}

/** Couche d'étoiles qui défile (texture répétable). */
export function starLayer(w: number, h: number, count: number, size: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h, 1);
  const rng = createRng(seed);
  for (let i = 0; i < count; i++) {
    const x = rng.int(0, w);
    const y = rng.int(0, h);
    ctx.fillStyle = rng.next() < 0.2 ? '#ffd9ef' : '#ffffff';
    ctx.globalAlpha = 0.5 + rng.next() * 0.5;
    ctx.fillRect(x, y, size, size * (size > 1 ? 3 : 1));
  }
  return c;
}

/** Vaisseau du joueur : soucoupe-fusée crème et sarcelle, petit robot pilote sous la bulle. */
export function ship(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(140, 130);
  const cx = 70;
  // Ailerons.
  for (const dir of [-1, 1]) {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 30, 70);
      ctx.lineTo(cx + dir * 64, 108);
      ctx.lineTo(cx + dir * 54, 118);
      ctx.lineTo(cx + dir * 22, 102);
      ctx.closePath();
    }, C.coral, { shade: C.coralShade, shadeOffset: [0, -4], line: 4 });
  }
  // Coque.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx, 14);
    ctx.bezierCurveTo(cx + 34, 30, cx + 40, 90, cx + 26, 116);
    ctx.lineTo(cx - 26, 116);
    ctx.bezierCurveTo(cx - 40, 90, cx - 34, 30, cx, 14);
    ctx.closePath();
  }, C.cream, { shade: C.creamShade, shadeOffset: [-10, 0], light: '#ffffff', line: 5 });
  // Bandes.
  ctx.fillStyle = C.teal;
  ctx.fillRect(cx - 30, 92, 60, 8);
  // Bulle et robot pilote.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, 56, 20, 0, Math.PI * 2);
  }, '#a8f0e4', { shade: '#5fd3bc', shadeOffset: [-5, -5], line: 4 });
  paint(ctx, () => roundRectPath(ctx, cx - 10, 50, 20, 15, 5), '#e8edf5', { line: 3 });
  ctx.fillStyle = C.teal;
  ctx.fillRect(cx - 6, 55, 4, 4);
  ctx.fillRect(cx + 2, 55, 4, 4);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, 50);
  ctx.lineTo(cx, 42);
  ctx.stroke();
  ctx.fillStyle = C.saffron;
  ctx.beginPath();
  ctx.arc(cx, 41, 3, 0, Math.PI * 2);
  ctx.fill();
  // Reflet de la bulle.
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, 56, 14, Math.PI * 1.1, Math.PI * 1.4);
  ctx.stroke();
  return c;
}

/** Flamme du réacteur (deux images pour le scintillement). */
export function thruster(frame: 0 | 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(40, 50);
  const len = frame ? 46 : 36;
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.quadraticCurveTo(20, len + 6, 32, 2);
    ctx.closePath();
  }, C.saffron, { ink: '' });
  ctx.fillStyle = '#fff6dc';
  ctx.beginPath();
  ctx.moveTo(14, 2);
  ctx.quadraticCurveTo(20, len * 0.6, 26, 2);
  ctx.fill();
  return c;
}

/** Météore ennemi : rocher rouge cratéré, yeux mauvais et crocs. */
export function meteor(seed: number, gold = false): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(110, 110);
  const cx = 55;
  const cy = 58;
  const body = gold ? C.saffron : SPACE.red;
  const shade = gold ? C.saffronShade : SPACE.redShade;
  paint(ctx, () => blobPath(ctx, cx, cy, 42, 40, createRng(seed), 0.12, 11), body, { shade, shadeOffset: [-9, -9], light: gold ? '#fff2b8' : SPACE.redLight, line: 5 });
  // Cratères.
  ctx.fillStyle = shade;
  for (const [x, y, r] of [[cx - 22, cy - 18, 6], [cx + 24, cy - 12, 5], [cx + 18, cy + 22, 7]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (gold) {
    // Le doré sourit d'un air malin : c'est un bonus.
    ctx.fillStyle = C.ink;
    for (const x of [cx - 12, cx + 12]) {
      ctx.beginPath();
      ctx.arc(x, cy - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy + 6, 12, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    return c;
  }
  // Yeux jaunes en colère.
  for (const [x, dir] of [[cx - 13, 1], [cx + 13, -1]] as const) {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(x, cy - 4, 8, 7, 0, 0, Math.PI * 2);
    }, '#ffd34a', { line: 3 });
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.ellipse(x, cy - 3, 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 10, cy - 14 - dir * 3);
    ctx.lineTo(x + 10, cy - 14 + dir * 3);
    ctx.lineTo(x + 10, cy - 10 + dir * 3);
    ctx.lineTo(x - 10, cy - 10 - dir * 3);
    ctx.closePath();
    ctx.fill();
  }
  // Crocs.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 12);
    ctx.quadraticCurveTo(cx, cy + 6, cx + 16, cy + 12);
    ctx.quadraticCurveTo(cx, cy + 30, cx - 16, cy + 12);
    ctx.closePath();
  }, '#3a0f1a', { line: 3 });
  ctx.fillStyle = '#fffaf0';
  for (let i = 0; i < 4; i++) {
    const x = cx - 12 + i * 8;
    ctx.beginPath();
    ctx.moveTo(x, cy + 10);
    ctx.lineTo(x + 6, cy + 10);
    ctx.lineTo(x + 3, cy + 17);
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

/** Robot ennemi : soucoupe rouge, œil unique, antennes et pinces. */
export function robot(frame: 0 | 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(130, 110);
  const cx = 65;
  // Pinces.
  for (const dir of [-1, 1]) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx + dir * 34, 68);
    ctx.lineTo(cx + dir * 48, 92 + (frame ? 4 : 0) * dir);
    ctx.stroke();
    ctx.strokeStyle = '#8a8fa8';
    ctx.lineWidth = 3;
    ctx.stroke();
    paint(ctx, () => {
      ctx.beginPath();
      ctx.arc(cx + dir * 48, 96 + (frame ? 4 : 0) * dir, 7, Math.PI * 0.1, Math.PI * 1.9);
    }, '#8a8fa8', { line: 3 });
  }
  // Antennes.
  for (const dir of [-1, 1]) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + dir * 12, 26);
    ctx.lineTo(cx + dir * 22, 8);
    ctx.stroke();
    ctx.fillStyle = frame ? '#ff4d6d' : C.saffron;
    ctx.beginPath();
    ctx.arc(cx + dir * 22, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Soucoupe.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(cx, 66, 56, 18, 0, 0, Math.PI * 2);
  }, '#6b6f8c', { shade: '#45486a', shadeOffset: [0, -6], line: 4 });
  // Tête-dôme rouge.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 36, 64);
    ctx.bezierCurveTo(cx - 36, 16, cx + 36, 16, cx + 36, 64);
    ctx.closePath();
  }, SPACE.red, { shade: SPACE.redShade, shadeOffset: [-8, -4], light: SPACE.redLight, line: 4.5 });
  // Œil unique.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, 44, 13, 0, Math.PI * 2);
  }, '#ffd34a', { line: 3.5 });
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.ellipse(cx + (frame ? 3 : -3), 45, 3.5, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 18, 26);
  ctx.lineTo(cx + 18, 32);
  ctx.lineTo(cx + 18, 36);
  ctx.lineTo(cx - 18, 30);
  ctx.closePath();
  ctx.fill();
  // Hublots lumineux.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = (i + frame) % 2 ? '#ff4d6d' : C.saffron;
    ctx.beginPath();
    ctx.arc(cx - 36 + i * 18, 72, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** Robot-Mère (boss) : énorme tête de robot rouge avec mâchoire d'acier. */
export function mothership(frame: 0 | 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(360, 220);
  const cx = 180;
  // Réacteurs latéraux.
  for (const dir of [-1, 1]) {
    paint(ctx, () => roundRectPath(ctx, cx + dir * 150 - 22, 80, 44, 70, 14), '#6b6f8c', { shade: '#45486a', shadeOffset: [-6, 0], line: 4 });
    ctx.fillStyle = frame ? '#ff4d6d' : C.saffron;
    ctx.beginPath();
    ctx.arc(cx + dir * 150, 116, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // Crâne.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 120, 150);
    ctx.bezierCurveTo(cx - 130, 30, cx + 130, 30, cx + 120, 150);
    ctx.closePath();
  }, SPACE.red, { shade: SPACE.redShade, shadeOffset: [-16, -10], light: SPACE.redLight, line: 6 });
  // Plaques rivetées.
  ctx.fillStyle = '#d9d2e6';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.1 + i * 0.13);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 96, 132 + Math.sin(a) * 80, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Deux yeux furieux.
  for (const [x, dir] of [[cx - 44, 1], [cx + 44, -1]] as const) {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(x, 98, 24, 18, 0, 0, Math.PI * 2);
    }, '#ffd34a', { shade: '#e8a52c', shadeOffset: [-3, -3], line: 4 });
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.ellipse(x + (frame ? 4 : -4), 100, 5, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 30, 68 - dir * 6);
    ctx.lineTo(x + 30, 68 + dir * 10);
    ctx.lineTo(x + 30, 78 + dir * 10);
    ctx.lineTo(x - 30, 78 - dir * 6);
    ctx.closePath();
    ctx.fill();
  }
  // Mâchoire d'acier à dents carrées.
  paint(ctx, () => roundRectPath(ctx, cx - 90, 140, 180, 52, 14), '#6b6f8c', { shade: '#45486a', shadeOffset: [0, -8], line: 5 });
  ctx.fillStyle = '#3a0f1a';
  ctx.fillRect(cx - 74, 152, 148, 26);
  ctx.fillStyle = '#fffaf0';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 72 + i * 21, 152);
    ctx.lineTo(cx - 54 + i * 21, 152);
    ctx.lineTo(cx - 63 + i * 21, 166 + (frame ? 2 : 0));
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

/** Station à protéger : dôme sarcelle posé sur l'horizon. */
export function station(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(300, 110);
  const cx = 150;
  paint(ctx, () => roundRectPath(ctx, 20, 70, 260, 34, 14), '#6b6f8c', { shade: '#45486a', shadeOffset: [0, -6], line: 4 });
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 100, 74);
    ctx.bezierCurveTo(cx - 100, 4, cx + 100, 4, cx + 100, 74);
    ctx.closePath();
  }, '#a8f0e4', { shade: '#5fd3bc', shadeOffset: [-14, 0], light: '#ffffff', line: 5 });
  // Hublots et antenne.
  ctx.fillStyle = C.saffron;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(46 + i * 42, 88, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, 22);
  ctx.lineTo(cx, 4);
  ctx.stroke();
  return c;
}

/** Plaque sombre portant le calcul. */
export function plate(w: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w + 8, 46);
  paint(ctx, () => roundRectPath(ctx, 4, 4, w, 38, 14), 'rgba(16, 20, 50, 0.92)', { line: 3.5 });
  return c;
}

/** Morceau de roche (débris d'explosion). */
export function shard(seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(24, 24);
  paint(ctx, () => blobPath(ctx, 12, 12, 8, 6, createRng(seed), 0.35, 6), seed % 2 ? SPACE.red : SPACE.redShade, { line: 2.5 });
  return c;
}

/** Touche du pavé numérique. */
export function key(w: number, h: number, kind: 'chiffre' | 'effacer'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w + 8, h + 14);
  const top = kind === 'chiffre' ? C.cream : '#6e6788';
  const side = kind === 'chiffre' ? C.tan : '#4a4462';
  paint(ctx, () => roundRectPath(ctx, 4, 10, w, h, 14), side, { line: 4 });
  paint(ctx, () => roundRectPath(ctx, 4, 4, w, h, 14), top, { shade: kind === 'chiffre' ? C.creamShade : '#5c5678', shadeOffset: [-4, -5], light: '#ffffff', line: 4 });
  return c;
}

/** Icône de bouclier (vie de la station). */
export function shieldIcon(full: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(34, 38);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(17, 3);
    ctx.lineTo(31, 9);
    ctx.quadraticCurveTo(31, 27, 17, 35);
    ctx.quadraticCurveTo(3, 27, 3, 9);
    ctx.closePath();
  }, full ? C.teal : '#3a3550', { shade: full ? '#3fae9a' : undefined, shadeOffset: [-4, 0], line: 3.5 });
  return c;
}

/** Panneau du pavé numérique. */
export function keypadPanel(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w + 10, h + 10);
  paint(ctx, () => roundRectPath(ctx, 5, 5, w, h, 26), 'rgba(16, 20, 50, 0.9)', { line: 5 });
  ctx.strokeStyle = 'rgba(95, 211, 188, 0.35)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, 15, 15, w - 20, h - 20, 18);
  ctx.stroke();
  return c;
}
