/**
 * Livraisons magiques de « Panique au phare ! » : engins et effets de glace.
 * Même technique que variant-b.ts (Canvas 2D à ×2, contour encré). Tout ce qui touche
 * aux bonus est doré et lumineux, pour ne jamais être confondu avec un monstre.
 */
import { C, makeCanvas, paint, roundRectPath, blobPath } from './variant-b';
import { createRng } from '../core/rng';

export type Mood = 'normal' | 'surpris' | 'moqueur';

const GOLD = C.saffron;
const GOLD_SHADE = C.saffronShade;
const GLASS = 'rgba(190, 240, 255, 0.32)';

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): () => void {
  return () => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  };
}

/** Œil rond et drôle (pupille regardant vers `look`). */
function goofyEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: [number, number], line = 2.5): void {
  paint(ctx, circle(ctx, x, y, r), '#ffffff', { line });
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(x + look[0] * r * 0.45, y + look[1] * r * 0.45, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + look[0] * r * 0.45 + r * 0.15, y + look[1] * r * 0.45 - r * 0.15, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

/** Œil fermé de rire « ^ ». */
function laughEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.4);
  ctx.quadraticCurveTo(x, y - r, x + r, y + r * 0.4);
  ctx.stroke();
}

function tongue(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(x - 6 * s, y);
    ctx.lineTo(x + 6 * s, y);
    ctx.quadraticCurveTo(x + 7 * s, y + 13 * s, x, y + 13 * s);
    ctx.quadraticCurveTo(x - 7 * s, y + 13 * s, x - 6 * s, y);
    ctx.closePath();
  }, '#ff7a9a', { shade: '#d24d72', shadeOffset: [-2, -2], line: 2.5 });
  ctx.strokeStyle = '#d24d72';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + 2);
  ctx.lineTo(x, y + 9 * s);
  ctx.stroke();
}

// --- Engin 1 : la soucoupe du petit Zarbi ------------------------------------------------------

export const SAUCER_W = 170;
export const SAUCER_H = 104;

/** Soucoupe volante pilotée par un petit extraterrestre à trois yeux. */
export function saucer(mood: Mood): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(SAUCER_W, SAUCER_H);
  const cx = 85;
  // Antennes à boules (dépassent du dôme).
  for (const [x0, x1, col] of [[77, 66, C.coral], [93, 106, C.teal]] as const) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, 30);
    ctx.quadraticCurveTo(x0, 12, x1, mood === 'surpris' ? 5 : 7);
    ctx.stroke();
    ctx.strokeStyle = '#8fd46b';
    ctx.lineWidth = 2;
    ctx.stroke();
    paint(ctx, circle(ctx, x1, mood === 'surpris' ? 5 : 7, 4.5), col, { line: 2.5 });
  }
  // Le pilote : tête verte, trois yeux.
  paint(ctx, () => blobPath(ctx, cx, 41, 24, 18, createRng(5), 0.04, 12), '#8fd46b', { shade: '#5ea64a', shadeOffset: [-4, -4], line: 3 });
  const eyes: Array<[number, number, number]> = [[cx - 13, 37, 6], [cx, 32, 7], [cx + 13, 37, 6]];
  if (mood === 'moqueur') {
    for (const [x, y, r] of eyes) laughEye(ctx, x, y - 3, r * 0.8);
    tongue(ctx, cx + 1, 42, 0.8);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 9, 41);
    ctx.quadraticCurveTo(cx, 46, cx + 10, 41);
    ctx.stroke();
  } else if (mood === 'surpris') {
    for (const [x, y, r] of eyes) goofyEye(ctx, x, y - 2, r * 1.45, [0, 0], 2);
    paint(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(cx, 51, 4.5, 6, 0, 0, Math.PI * 2);
    }, C.ink, { ink: '' });
  } else {
    for (const [x, y, r] of eyes) goofyEye(ctx, x, y, r, [-0.6, 0.5], 2);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 9, 47);
    ctx.quadraticCurveTo(cx, 55, cx + 9, 47);
    ctx.stroke();
  }
  // Dôme de verre (le pilote reste visible à travers).
  const dome = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 40, 66);
    ctx.bezierCurveTo(cx - 40, 0, cx + 40, 0, cx + 40, 66);
    ctx.closePath();
  };
  dome();
  ctx.fillStyle = GLASS;
  ctx.fill();
  ctx.save();
  dome();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx - 6, 46, 28, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();
  ctx.restore();
  dome();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  // Disque.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(cx, 72, 80, 19, 0, 0, Math.PI * 2);
  }, '#c3a8e3', { shade: '#7d5f9e', shadeOffset: [0, -7], light: '#f3e9ff', line: 4 });
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(cx, 66, 50, 8, 0, 0, Math.PI * 2);
  }, '#a387c9', { line: 2.5 });
  // Hublots lumineux tout autour.
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.12 + (i / 6) * 0.76);
    const x = cx - Math.cos(a) * 66;
    const y = 74 + Math.sin(a) * 9;
    paint(ctx, circle(ctx, x, y, 4.2), i % 2 ? C.teal : GOLD, { line: 2 });
  }
  // Trappe du dessous.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(cx, 89, 22, 6, 0, 0, Math.PI * 2);
  }, '#5a3f78', { line: 3 });
  return c;
}

/** Rayon tracteur de la soucoupe (à afficher en mode additif). */
export function tractorBeam(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(120, 90, 1);
  const g = ctx.createLinearGradient(0, 0, 0, 90);
  g.addColorStop(0, 'rgba(232, 255, 244, 0.85)');
  g.addColorStop(1, 'rgba(95, 211, 188, 0.08)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(80, 0);
  ctx.lineTo(118, 90);
  ctx.lineTo(2, 90);
  ctx.closePath();
  ctx.fill();
  return c;
}

// --- Engin 2 : le dirigeable-poisson de la souris aviatrice -------------------------------------

export const BLIMP_W = 196;
export const BLIMP_H = 132;

/** Ballon en forme de poisson-lune ventru, nacelle et souris aviatrice. */
export function blimp(mood: Mood): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(BLIMP_W, BLIMP_H);
  // Cordages de la nacelle.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  for (const [x0, x1] of [[78, 82], [116, 112]]) {
    ctx.beginPath();
    ctx.moveTo(x0, 80);
    ctx.lineTo(x1, 106);
    ctx.stroke();
  }
  // Queue (à droite : il vole vers la gauche).
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(150, 44);
    ctx.quadraticCurveTo(176, 18, 188, 22);
    ctx.quadraticCurveTo(178, 46, 188, 72);
    ctx.quadraticCurveTo(176, 74, 150, 54);
    ctx.closePath();
  }, '#ff8fb1', { shade: '#d0607f', shadeOffset: [-3, -3], line: 3.5 });
  // Piquants ronds tout autour (c'est un poisson-lune gonflé).
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI * 0.95 + (i / 12) * Math.PI * 1.85;
    const x = 92 + Math.cos(a) * 64;
    const y = 46 + Math.sin(a) * 42;
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a + 0.35) * 4 - Math.cos(a) * 6, y + Math.sin(a + 0.35) * 4 - Math.sin(a) * 6);
      ctx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
      ctx.lineTo(x + Math.cos(a - 0.35) * 4 - Math.cos(a) * 6, y + Math.sin(a - 0.35) * 4 - Math.sin(a) * 6);
      ctx.closePath();
    }, C.cream, { line: 2.5 });
  }
  // Corps à rayures.
  const body = () => blobPath(ctx, 92, 46, 62, 41, createRng(12), 0.025, 16);
  paint(ctx, body, '#ffb3c1', { shade: '#e07e98', shadeOffset: [-6, -8], light: '#fff0f3', line: 0, ink: '' });
  ctx.save();
  body();
  ctx.clip();
  ctx.fillStyle = 'rgba(246, 236, 216, 0.85)';
  for (const x of [84, 116, 144]) {
    ctx.beginPath();
    ctx.ellipse(x, 46, 7, 46, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  body();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 4;
  ctx.stroke();
  // Nageoire de côté.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(98, 58);
    ctx.quadraticCurveTo(112, 52, 120, 68);
    ctx.quadraticCurveTo(108, 70, 98, 58);
    ctx.closePath();
  }, '#ff8fb1', { line: 2.5 });
  // Visage du ballon : gros œil et bouche en cul-de-poule.
  if (mood === 'surpris') goofyEye(ctx, 56, 36, 15, [0, 0], 3);
  else goofyEye(ctx, 56, 38, 11, [-0.7, 0.2], 3);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(32, 56, 8, mood === 'surpris' ? 9 : 6, 0, 0, Math.PI * 2);
  }, '#ff7a5c', { line: 3 });
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.ellipse(31, 56, 3, mood === 'surpris' ? 5 : 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // La souris aviatrice dans sa nacelle.
  const mx = 97;
  const my = 100;
  for (const ex of [mx - 14, mx + 14]) {
    paint(ctx, circle(ctx, ex, my - 12, 9), '#a8a4b8', { line: 3 });
    paint(ctx, circle(ctx, ex, my - 12, 4.5), '#ffb3c1', { ink: '' });
  }
  paint(ctx, () => blobPath(ctx, mx, my, 13, 12, createRng(3), 0.03, 10), '#c4c0d2', { shade: '#8f8aa3', shadeOffset: [-3, -3], line: 3 });
  // Lunettes d'aviateur relevées sur le front.
  ctx.strokeStyle = C.woodDark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(mx - 13, my - 6);
  ctx.lineTo(mx + 13, my - 6);
  ctx.stroke();
  for (const gx of [mx - 6, mx + 6]) paint(ctx, circle(ctx, gx, my - 7, 4.5), '#8fe3f0', { line: 2.2 });
  if (mood === 'moqueur') {
    laughEye(ctx, mx - 5, my + 1, 3);
    laughEye(ctx, mx + 5, my + 1, 3);
    tongue(ctx, mx, my + 7, 0.55);
  } else if (mood === 'surpris') {
    goofyEye(ctx, mx - 5, my + 1, 4.5, [0, 0.3], 1.8);
    goofyEye(ctx, mx + 5, my + 1, 4.5, [0, 0.3], 1.8);
  } else {
    ctx.fillStyle = C.ink;
    for (const ex of [mx - 5, mx + 5]) {
      ctx.beginPath();
      ctx.arc(ex - 1, my + 1, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  paint(ctx, circle(ctx, mx - 1, my + 6, 2.5), '#ff7a9a', { line: 1.5 });
  // Moustaches.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.3;
  for (const s of [-1, 1]) {
    for (const dy of [-2, 2]) {
      ctx.beginPath();
      ctx.moveTo(mx + s * 5, my + 6);
      ctx.lineTo(mx + s * 16, my + 6 + dy);
      ctx.stroke();
    }
  }
  // Nacelle en osier.
  paint(ctx, () => roundRectPath(ctx, 74, 106, 46, 20, 6), C.woodLight, { shade: C.wood, shadeOffset: [0, -5], line: 3 });
  ctx.strokeStyle = C.wood;
  ctx.lineWidth = 1.5;
  for (const x of [86, 97, 108]) {
    ctx.beginPath();
    ctx.moveTo(x, 108);
    ctx.lineTo(x, 124);
    ctx.stroke();
  }
  return c;
}

/** Hélice vue de profil (on la fait tourner en écrasant l'image). */
export function propeller(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(16, 40);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(8, 20, 5, 18, 0, 0, Math.PI * 2);
  }, C.creamShade, { line: 2.5 });
  paint(ctx, circle(ctx, 8, 20, 3.5), C.coral, { line: 2 });
  return c;
}

// --- Chargement et étiquette ----------------------------------------------------------------------

/** Paquet-cadeau doré à étoile : le chargement de l'engin. */
export function crate(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(60, 58);
  paint(ctx, () => roundRectPath(ctx, 6, 16, 48, 38, 7), GOLD, { shade: GOLD_SHADE, shadeOffset: [-5, -5], light: '#fff3c4', line: 3.5 });
  ctx.fillStyle = C.teal;
  ctx.fillRect(26, 17, 8, 36);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 17, 8, 36);
  // Nœud.
  for (const s of [-1, 1]) {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(30, 16);
      ctx.quadraticCurveTo(30 + s * 18, 0, 30 + s * 16, 14);
      ctx.closePath();
    }, C.teal, { line: 2.5 });
  }
  star(ctx, 30, 36, 9, '#ffffff');
  return c;
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, line = 2): void {
  paint(ctx, () => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }, fill, line === 0 ? { ink: '' } : { line });
}

/** Étiquette dorée du calcul bonus (fond sombre, texte posé par la scène). */
export function cartouche(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w + 8, h + 10);
  paint(ctx, () => roundRectPath(ctx, 4, 6, w, h, h / 2), C.ink, { ink: '' });
  paint(ctx, () => roundRectPath(ctx, 4, 2, w, h, h / 2), GOLD, { shade: GOLD_SHADE, shadeOffset: [0, -4], line: 3.5 });
  paint(ctx, () => roundRectPath(ctx, 11, 8, w - 14, h - 12, (h - 12) / 2), '#241d3a', { line: 2.5 });
  star(ctx, 24, h / 2 + 2, 7, GOLD);
  star(ctx, w - 16, h / 2 + 2, 7, GOLD);
  return c;
}

/** Bloc transparent du Coup de froid, puis fissuré avant le dégel. */
export function iceBlock(w: number, h: number, cracked: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w + 8, h + 8);
  const block = () => roundRectPath(ctx, 4, 4, w, h, 14);
  block();
  ctx.fillStyle = 'rgba(170, 230, 255, 0.42)';
  ctx.fill();
  ctx.save();
  block();
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.moveTo(10, h * 0.1);
  ctx.lineTo(w * 0.35, 4);
  ctx.lineTo(w * 0.45, 4);
  ctx.lineTo(14, h * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(w * 0.7, 10, 6, h * 0.5);
  ctx.restore();
  block();
  ctx.strokeStyle = '#e8fbff';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(29, 26, 43, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (cracked) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    for (const [x, y, pts] of [[w * 0.55, 4, [[-14, 30], [8, 52], [-6, 80]]], [w, h * 0.55, [[-30, -6], [-44, 18]]], [4, h * 0.7, [[26, 4], [40, -18]]]] as Array<[number, number, number[][]]>) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (const [dx, dy] of pts) ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
    }
  }
  return c;
}

/** Éclat de glace. */
export function shard(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(18, 22);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(9, 1);
    ctx.lineTo(16, 12);
    ctx.lineTo(8, 21);
    ctx.lineTo(2, 9);
    ctx.closePath();
  }, '#bfefff', { line: 1.8 });
  return c;
}

/** Œil exorbité (le monstre n'en revient pas). */
