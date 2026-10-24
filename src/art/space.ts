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
  // Petite planète annelée au loin.
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#f7b7a3';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(150, 150, 62, 14, -0.3, Math.PI, Math.PI * 2);
  ctx.stroke();
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(150, 150, 30, 0, Math.PI * 2);
  }, '#e07a8a', { shade: '#a8506a', shadeOffset: [-8, -8], line: 3 });
  ctx.strokeStyle = '#f7b7a3';
  ctx.beginPath();
  ctx.ellipse(150, 150, 62, 14, -0.3, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
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
  // Logement de la bulle (le pilote est un calque à part : voir pilot()).
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, 56, 23, 0, Math.PI * 2);
  }, '#6b6f8c', { line: 4 });
  return c;
}

export type PilotFace = 'normal' | 'content' | 'inquiet' | 'oups';

/** Bulle de la cabine avec le petit robot pilote ; son visage change selon la partie. */
export function pilot(face: PilotFace): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(48, 48);
  const cx = 24;
  const cy = 24;
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  }, '#a8f0e4', { shade: '#5fd3bc', shadeOffset: [-5, -5], line: 4 });
  // Antenne.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(face === 'inquiet' ? cx + 4 : cx, cy - 14);
  ctx.stroke();
  ctx.fillStyle = face === 'oups' ? C.coral : C.saffron;
  ctx.beginPath();
  ctx.arc(face === 'inquiet' ? cx + 4 : cx, cy - 15, 3, 0, Math.PI * 2);
  ctx.fill();
  // Tête.
  paint(ctx, () => roundRectPath(ctx, cx - 11, cy - 6, 22, 17, 5), '#e8edf5', { line: 3 });
  ctx.fillStyle = C.tealDeep;
  ctx.strokeStyle = C.tealDeep;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  if (face === 'normal') {
    ctx.fillRect(cx - 7, cy - 1, 4, 4);
    ctx.fillRect(cx + 3, cy - 1, 4, 4);
  } else if (face === 'content') {
    for (const x of [cx - 5, cx + 5]) {
      ctx.beginPath();
      ctx.arc(x, cy + 2, 2.6, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 4, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  } else if (face === 'inquiet') {
    ctx.fillRect(cx - 6, cy, 3, 3);
    ctx.fillRect(cx + 3, cy, 3, 3);
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 7);
    ctx.lineTo(cx - 2, cy + 6);
    ctx.lineTo(cx + 1, cy + 7);
    ctx.lineTo(cx + 4, cy + 6);
    ctx.stroke();
    ctx.fillStyle = '#7fd6ff';
    ctx.beginPath();
    ctx.ellipse(cx + 14, cy - 2, 2.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // « Oups » : yeux en > <.
    for (const [x, d] of [[cx - 5, 1], [cx + 5, -1]] as const) {
      ctx.beginPath();
      ctx.moveTo(x - 2 * d, cy - 1);
      ctx.lineTo(x + 2 * d, cy + 1.5);
      ctx.lineTo(x - 2 * d, cy + 4);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy + 8, 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Reflet de la bulle.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, Math.PI * 1.1, Math.PI * 1.4);
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
export type Mood = 'colere' | 'peur';

/** Goutte de sueur (peur). */
function sweat(ctx: CanvasRenderingContext2D, x: number, y: number, s = 1): void {
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(x, y - 7 * s);
    ctx.quadraticCurveTo(x + 6 * s, y + 2 * s, x, y + 5 * s);
    ctx.quadraticCurveTo(x - 6 * s, y + 2 * s, x, y - 7 * s);
    ctx.closePath();
  }, '#7fd6ff', { line: 2 });
}

export function meteor(seed: number, gold = false, mood: Mood = 'colere'): HTMLCanvasElement {
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
  if (mood === 'peur') {
    // Visé par le vaisseau : grands yeux affolés qui regardent en bas, bouche tremblante.
    for (const [x, d] of [[cx - 13, 1], [cx + 13, -1]] as const) {
      paint(ctx, () => {
        ctx.beginPath();
        ctx.arc(x, cy - 4, 10, 0, Math.PI * 2);
      }, '#ffffff', { line: 3 });
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(x, cy + 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x - 8 * d, cy - 16);
      ctx.lineTo(x + 7 * d, cy - 22);
      ctx.stroke();
    }
    paint(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(cx, cy + 18, 9, 7, 0, 0, Math.PI * 2);
    }, '#3a0f1a', { line: 3 });
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(cx - 6, cy + 12, 12, 3);
    sweat(ctx, cx + 33, cy - 20);
    sweat(ctx, cx - 34, cy - 8, 0.7);
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
export function robot(frame: 0 | 1, mood: Mood = 'colere'): HTMLCanvasElement {
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
  if (mood === 'peur') {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.arc(cx, 44, 15, 0, Math.PI * 2);
    }, '#ffffff', { line: 3.5 });
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(cx + (frame ? 2 : -2), 50, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, 40, 22, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    sweat(ctx, cx + 30, 34);
  } else {
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
  }
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
export function mothership(frame: 0 | 1, mood: Mood = 'colere'): HTMLCanvasElement {
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
  // Deux yeux furieux (ou affolés quand il ne lui reste presque plus rien).
  for (const [x, dir] of [[cx - 44, 1], [cx + 44, -1]] as const) {
    if (mood === 'peur') {
      paint(ctx, () => {
        ctx.beginPath();
        ctx.ellipse(x, 98, 24, 22, 0, 0, Math.PI * 2);
      }, '#ffffff', { line: 4 });
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(x + (frame ? 3 : -3), 108, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x - 26 * dir, 72);
      ctx.lineTo(x + 20 * dir, 62);
      ctx.stroke();
      continue;
    }
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
  if (mood === 'peur') {
    sweat(ctx, cx + 104, 70, 1.8);
    sweat(ctx, cx - 100, 84, 1.3);
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

// --- Habitants et détails ------------------------------------------------------------------

/** Baleine cosmique qui nage vers la droite ; la queue bat (deux images). */
export function whale(frame: 0 | 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(380, 170);
  const body = '#6c7bd9';
  const shade = '#4b56a8';
  // Queue.
  const ty = frame ? -14 : 14;
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(84, 92);
    ctx.quadraticCurveTo(40, 88 + ty * 0.4, 14, 60 + ty);
    ctx.quadraticCurveTo(30, 88 + ty * 0.5, 12, 124 + ty);
    ctx.quadraticCurveTo(44, 104 + ty * 0.3, 90, 108);
    ctx.closePath();
  }, shade, { line: 4 });
  // Corps.
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(80, 100);
    ctx.bezierCurveTo(110, 30, 270, 20, 340, 70);
    ctx.bezierCurveTo(372, 92, 360, 132, 320, 138);
    ctx.bezierCurveTo(240, 150, 130, 140, 80, 100);
    ctx.closePath();
  };
  paint(ctx, shape, body, { shade, shadeOffset: [0, -10], light: '#a9b4ff', line: 5 });
  // Ventre rayé.
  ctx.save();
  shape();
  ctx.clip();
  ctx.fillStyle = '#c9d4ff';
  ctx.beginPath();
  ctx.ellipse(250, 142, 110, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8f9ce6';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(170 + i * 26, 124);
    ctx.lineTo(176 + i * 26, 150);
    ctx.stroke();
  }
  ctx.restore();
  // Taches d'étoiles sur le dos.
  ctx.fillStyle = C.saffron;
  for (const [x, y, r] of [[150, 58, 3], [190, 46, 4], [232, 44, 2.5], [270, 52, 3.5], [214, 64, 2], [300, 66, 2.5]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Nageoire.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(230, 120);
    ctx.quadraticCurveTo(220, 150, 196, 160);
    ctx.quadraticCurveTo(232, 156, 254, 126);
    ctx.closePath();
  }, shade, { line: 3.5 });
  // Œil endormi et sourire.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(318, 92, 7, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(330, 110, 14, Math.PI * 0.3, Math.PI * 0.75);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 143, 177, 0.6)';
  ctx.beginPath();
  ctx.ellipse(304, 108, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** Chat astronaute (tête dans une bulle, combinaison blanche). */
export function cat(frame: 0 | 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(84, 96);
  const cx = 42;
  // Corps et pattes.
  paint(ctx, () => roundRectPath(ctx, cx - 16, 50, 32, 34, 12), '#eef1f8', { shade: '#c9cfe0', shadeOffset: [-5, 0], line: 3.5 });
  paint(ctx, () => roundRectPath(ctx, cx - 7, 62, 14, 10, 3), C.teal, { line: 2.5 });
  // Patte qui salue.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(cx + 14, 58);
  ctx.lineTo(cx + 26, frame ? 38 : 46);
  ctx.stroke();
  ctx.strokeStyle = '#eef1f8';
  ctx.lineWidth = 5;
  ctx.stroke();
  // Queue rousse qui sort de la combinaison.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx - 14, 78);
  ctx.quadraticCurveTo(cx - 34, 84, cx - 30, frame ? 62 : 68);
  ctx.stroke();
  ctx.strokeStyle = '#f2a65a';
  ctx.lineWidth = 4;
  ctx.stroke();
  // Bulle du casque.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, 32, 26, 0, Math.PI * 2);
  }, 'rgba(168, 240, 228, 0.55)', { line: 3.5 });
  // Tête de chat roux.
  for (const d of [-1, 1]) {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(cx + d * 6, 22);
      ctx.lineTo(cx + d * 16, 10);
      ctx.lineTo(cx + d * 17, 28);
      ctx.closePath();
    }, '#f2a65a', { line: 2.5 });
  }
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(cx, 34, 15, 13, 0, 0, Math.PI * 2);
  }, '#f2a65a', { shade: '#d9853a', shadeOffset: [-3, -3], line: 3 });
  ctx.fillStyle = C.ink;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + d * 6, 32, 2.2, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = C.coral;
  ctx.beginPath();
  ctx.moveTo(cx - 2, 37);
  ctx.lineTo(cx + 2, 37);
  ctx.lineTo(cx, 39.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.2;
  for (const d of [-1, 1]) {
    for (const k of [-2, 2]) {
      ctx.beginPath();
      ctx.moveTo(cx + d * 6, 39 + k * 0.5);
      ctx.lineTo(cx + d * 16, 37 + k);
      ctx.stroke();
    }
  }
  // Reflet.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, 32, 20, Math.PI * 1.15, Math.PI * 1.45);
  ctx.stroke();
  return c;
}

/** Canard en plastique perdu dans l'espace (bonus caché). */
export function duck(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(76, 64);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(36, 42, 28, 17, 0, 0, Math.PI * 2);
  }, '#ffd23f', { shade: '#f0a92a', shadeOffset: [-5, -5], line: 3.5 });
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(50, 22, 14, 0, Math.PI * 2);
  }, '#ffd23f', { shade: '#f0a92a', shadeOffset: [-4, -4], line: 3.5 });
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(60, 22);
    ctx.quadraticCurveTo(74, 22, 72, 28);
    ctx.quadraticCurveTo(64, 30, 60, 27);
    ctx.closePath();
  }, '#ff8a3d', { line: 2.5 });
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(53, 18, 2.6, 0, Math.PI * 2);
  ctx.fill();
  // Aile.
  ctx.strokeStyle = '#d9902a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(30, 40, 10, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
  return c;
}

/** Petit robot d'entretien de la station ; bras levés pour la joie ou la panique. */
export function tinyBot(arms: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(40, 50);
  const cx = 20;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 4;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + d * 9, 30);
    ctx.lineTo(cx + d * 17, arms ? 14 : 38);
    ctx.stroke();
  }
  paint(ctx, () => roundRectPath(ctx, cx - 6, 40, 12, 8, 3), '#6b6f8c', { line: 2.5 });
  paint(ctx, () => roundRectPath(ctx, cx - 10, 24, 20, 18, 6), C.cream, { shade: C.creamShade, shadeOffset: [-3, 0], line: 3 });
  paint(ctx, () => roundRectPath(ctx, cx - 11, 8, 22, 17, 6), '#e8edf5', { line: 3 });
  ctx.fillStyle = C.tealDeep;
  ctx.fillRect(cx - 6, 14, 4, 4);
  ctx.fillRect(cx + 2, 14, 4, 4);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, 8);
  ctx.lineTo(cx, 2);
  ctx.stroke();
  ctx.fillStyle = C.coral;
  ctx.beginPath();
  ctx.arc(cx, 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** Pièces détachées projetées par un robot qui explose. */
export function part(kind: 'engrenage' | 'ressort' | 'boulon'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(30, 30);
  if (kind === 'engrenage') {
    paint(ctx, () => {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = i % 2 ? 9 : 13;
        ctx.lineTo(15 + Math.cos(a) * r, 15 + Math.sin(a) * r);
      }
      ctx.closePath();
    }, '#a9adc4', { line: 2.5 });
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(15, 15, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'ressort') {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 5;
    const path = () => {
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) ctx.lineTo(i % 2 ? 22 : 8, 4 + i * 4.4);
    };
    path();
    ctx.stroke();
    ctx.strokeStyle = '#d9d2e6';
    ctx.lineWidth = 2.5;
    path();
    ctx.stroke();
  } else {
    paint(ctx, () => roundRectPath(ctx, 12, 10, 6, 16, 2), '#a9adc4', { line: 2.5 });
    paint(ctx, () => roundRectPath(ctx, 7, 5, 16, 7, 2), '#c9cde0', { line: 2.5 });
  }
  return c;
}

/** Pièce d'or (pluie de pièces du météore doré). */
export function coin(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(30, 30);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(15, 15, 12, 0, Math.PI * 2);
  }, '#ffd23f', { shade: '#e8a52c', shadeOffset: [-3, -3], light: '#fff2b8', line: 3 });
  ctx.strokeStyle = '#c98a1c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(15, 15, 7, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

/** Traînée d'étoile filante (dégradé). */
export function streak(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(220, 8, 1);
  const g = ctx.createLinearGradient(0, 0, 220, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(214, 1);
  ctx.arc(214, 4, 3, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  return c;
}

/** Viseur qui verrouille une cible. */
export function reticle(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(130, 130);
  ctx.lineCap = 'round';
  for (const [col, w] of [[C.ink, 9], [C.saffron, 4.5]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI / 2) + Math.PI / 4;
      ctx.beginPath();
      ctx.arc(65, 65, 54, a - 0.45, a + 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(65 + Math.cos(a - Math.PI / 4) * 48, 65 + Math.sin(a - Math.PI / 4) * 48);
      ctx.lineTo(65 + Math.cos(a - Math.PI / 4) * 62, 65 + Math.sin(a - Math.PI / 4) * 62);
      ctx.stroke();
    }
  }
  return c;
}

/** Étoile de score (fin de partie). */
export function scoreStar(full: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(70, 68);
  paint(ctx, () => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 ? 13 : 30;
      ctx.lineTo(35 + Math.cos(a) * r, 36 + Math.sin(a) * r);
    }
    ctx.closePath();
  }, full ? '#ffd23f' : '#2a2c55', { shade: full ? '#e8a52c' : undefined, shadeOffset: [-4, -4], light: full ? '#fff2b8' : undefined, line: 4 });
  return c;
}

/** Halo rouge sur les bords de l'écran (danger). */
export function vignette(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h, 0.5);
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.65);
  g.addColorStop(0, 'rgba(255, 40, 70, 0)');
  g.addColorStop(1, 'rgba(255, 40, 70, 0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}
