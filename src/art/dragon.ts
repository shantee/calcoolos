/**
 * Monde du « Dragon gourmand », dans le style B (Canvas 2D encré, ×2) :
 * ciel de l'archipel au crépuscule, dragon-lanterne, lanternes de papier,
 * chauves-souris rouges à crocs, nuages d'orage, gâteau de lune, montgolfière.
 */
import { C, makeCanvas, paint, blobPath, roundRectPath, smoothClosed } from './variant-b';
import { createRng } from '../core/rng';

export const DR = {
  red: '#e2423a',
  redShade: '#a8282e',
  redLight: '#ff8a6a',
  gold: '#ffc94a',
  goldShade: '#d98a22',
  goldLight: '#fff0b0',
  mane: '#3fd6a8',
  maneShade: '#1f9a7c',
  lantern: '#ff7a3d',
  lanternLight: '#ffd27a',
  bat: '#c8323a',
  batShade: '#7e1d2a',
  storm: '#3a3560',
  stormShade: '#25213f',
};

// --- Ciel et décor ------------------------------------------------------------------------

/** Ciel du crépuscule : nuit en haut, braise à l'horizon, petites étoiles fixes. */
export function sky(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h, 1);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b1030');
  g.addColorStop(0.42, '#1f2056');
  g.addColorStop(0.68, '#4b2b6b');
  g.addColorStop(0.84, '#a84d72');
  g.addColorStop(0.93, '#f08a6a');
  g.addColorStop(1, '#ffc27a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Voie lactée : bande diagonale de poussière lumineuse.
  const rng = createRng(77);
  ctx.save();
  ctx.translate(w * 0.5, h * 0.3);
  ctx.rotate(-0.32);
  const band = ctx.createLinearGradient(0, -90, 0, 90);
  band.addColorStop(0, 'rgba(180, 170, 255, 0)');
  band.addColorStop(0.5, 'rgba(200, 190, 255, 0.10)');
  band.addColorStop(1, 'rgba(180, 170, 255, 0)');
  ctx.fillStyle = band;
  ctx.fillRect(-w, -90, w * 2, 180);
  for (let i = 0; i < 420; i++) {
    const x = (rng.next() - 0.5) * w * 1.6;
    const y = (rng.next() + rng.next() + rng.next() - 1.5) * 70;
    ctx.fillStyle = `rgba(255, 250, 235, ${0.15 + rng.next() * 0.45})`;
    ctx.fillRect(x, y, rng.next() < 0.1 ? 2 : 1, rng.next() < 0.1 ? 2 : 1);
  }
  ctx.restore();
  // Étoiles fixes, plus rares près de l'horizon.
  for (let i = 0; i < 160; i++) {
    const x = rng.next() * w;
    const y = rng.next() ** 1.6 * h * 0.75;
    const r = rng.next() < 0.08 ? 1.6 : 0.8;
    ctx.fillStyle = `rgba(255, 246, 220, ${0.35 + rng.next() * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** Lueur chaude de l'horizon (s'éteint quand la nuit tombe). */
export function duskGlow(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h, 0.5);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255, 160, 110, 0)');
  g.addColorStop(0.7, 'rgba(255, 150, 100, 0.35)');
  g.addColorStop(1, 'rgba(255, 200, 120, 0.7)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** Îles lointaines de l'archipel en silhouette, avec pagodes et fenêtres allumées. */
export function farIslands(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h, 1);
  const rng = createRng(12);
  const layers = [
    { base: h * 0.62, amp: 46, color: '#3b2659', lights: 0.0 },
    { base: h * 0.8, amp: 38, color: '#28193f', lights: 1 },
  ];
  for (const L of layers) {
    ctx.fillStyle = L.color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const peaks: Array<[number, number]> = [];
    let x = -20;
    while (x < w + 40) {
      const width = 90 + rng.next() * 200;
      const top = L.base - rng.next() * L.amp - (rng.next() < 0.25 ? L.amp : 0);
      peaks.push([x + width / 2, top]);
      ctx.quadraticCurveTo(x + width * 0.25, top, x + width / 2, top);
      ctx.quadraticCurveTo(x + width * 0.75, top, x + width, L.base + 6);
      x += width;
    }
    ctx.lineTo(w + 40, h);
    ctx.closePath();
    ctx.fill();
    if (L.lights) {
      // Petites pagodes et lumières de village.
      for (const [px, py] of peaks) {
        if (rng.next() < 0.45) {
          ctx.fillStyle = L.color;
          for (let k = 0; k < 3; k++) {
            const ww = 26 - k * 7;
            const yy = py - 8 - k * 10;
            ctx.beginPath();
            ctx.moveTo(px - ww, yy + 4);
            ctx.quadraticCurveTo(px, yy - 6, px + ww, yy + 4);
            ctx.lineTo(px + ww * 0.6, yy + 8);
            ctx.lineTo(px - ww * 0.6, yy + 8);
            ctx.closePath();
            ctx.fill();
            ctx.fillRect(px - ww * 0.45, yy + 8, ww * 0.9, 6);
          }
        }
        const n = rng.int(1, 4);
        for (let k = 0; k < n; k++) {
          const lx = px + (rng.next() - 0.5) * 60;
          const ly = py + 14 + rng.next() * 20;
          ctx.fillStyle = 'rgba(255, 200, 110, 0.9)';
          ctx.fillRect(lx, ly, 2.5, 2.5);
          ctx.fillStyle = 'rgba(255, 190, 100, 0.18)';
          ctx.beginPath();
          ctx.arc(lx + 1, ly + 1, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  return c;
}

/** Mer sombre aux reflets dorés. */
export function sea(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h, 1);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2c2457');
  g.addColorStop(1, '#120f2c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rng = createRng(31);
  for (let i = 0; i < 90; i++) {
    const y = rng.next() ** 1.4 * h;
    const x = rng.next() * w;
    const len = 10 + rng.next() * 40;
    ctx.strokeStyle = `rgba(255, 190, 140, ${0.08 + (1 - y / h) * 0.25})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  return c;
}

/** Colonne de reflet de lune sur la mer. */
export function moonPath(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h, 1);
  const rng = createRng(8);
  for (let y = 2; y < h; y += 5) {
    const half = (w / 2) * (0.35 + (y / h) * 0.65) * (0.6 + rng.next() * 0.4);
    ctx.fillStyle = `rgba(255, 240, 200, ${0.5 - (y / h) * 0.35})`;
    ctx.fillRect(w / 2 - half + (rng.next() - 0.5) * 10, y, half * 2, 2);
  }
  return c;
}

/** Grande lune crème cratérisée (le visage est un calque à part). */
export function moon(r: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(r * 2 + 12, r * 2 + 12);
  const cx = r + 6;
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
  }, '#fbf0d2', { shade: '#e9d3a6', shadeOffset: [-r * 0.18, -r * 0.14], line: 4 });
  const rng = createRng(5);
  for (let i = 0; i < 6; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.next() * r * 0.7;
    const cr = 4 + rng.next() * r * 0.16;
    ctx.fillStyle = 'rgba(214, 186, 140, 0.45)';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cx + Math.sin(a) * d, cr, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** Nuage de nuit bordé de lumière de lune. */
export function nightCloud(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h, 1);
  const rng = createRng(seed);
  const path = () => {
    const pts: Array<[number, number]> = [];
    const bumps = 6;
    for (let i = 0; i <= bumps; i++) {
      pts.push([10 + (i / bumps) * (w - 20), h * 0.5 - rng.int(0, Math.floor(h * 0.38))]);
    }
    pts.push([w - 6, h - 8], [6, h - 8]);
    smoothClosed(ctx, pts);
  };
  const seedState = rng.next();
  void seedState;
  ctx.save();
  path();
  ctx.fillStyle = 'rgba(92, 72, 140, 0.85)';
  ctx.fill();
  ctx.restore();
  return c;
}

/** Nuage d'orage grognon ; `charge` : il s'illumine avant l'éclair. */
export function stormCloud(charge: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(200, 120);
  const rng = createRng(9);
  const path = () => {
    const pts: Array<[number, number]> = [
      [20, 92], [12, 66], [34, 44], [58, 30], [86, 18], [118, 22], [146, 30], [174, 50], [190, 76], [178, 98], [140, 104], [96, 106], [56, 104],
    ];
    smoothClosed(ctx, pts.map(([x, y]) => [x + (rng.next() - 0.5) * 4, y + (rng.next() - 0.5) * 4] as [number, number]));
  };
  paint(ctx, path, charge ? '#5d5590' : DR.storm, { shade: DR.stormShade, shadeOffset: [0, -10], line: 4 });
  if (charge) {
    ctx.save();
    path();
    ctx.clip();
    const g = ctx.createRadialGradient(100, 80, 4, 100, 80, 80);
    g.addColorStop(0, 'rgba(255, 250, 180, 0.8)');
    g.addColorStop(1, 'rgba(255, 250, 180, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 200, 120);
    ctx.restore();
  }
  // Sourcils froncés et yeux.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 4;
  for (const [x, s] of [[78, 1], [122, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x - 14 * s, 54);
    ctx.lineTo(x + 8 * s, 62);
    ctx.stroke();
    ctx.fillStyle = charge ? '#fff6a0' : C.cream;
    ctx.beginPath();
    ctx.ellipse(x, 70, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(x + 1, 72, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bouche boudeuse.
  ctx.beginPath();
  ctx.arc(100, 96, 9, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  return c;
}

/** Éclair zigzag (blanc-jaune, halo). */
export function bolt(h: number, seed: number): HTMLCanvasElement {
  const w = 90;
  const [c, ctx] = makeCanvas(w, h, 1);
  const rng = createRng(seed);
  const pts: Array<[number, number]> = [[w / 2, 0]];
  let x = w / 2;
  for (let y = 30; y < h; y += 30 + rng.next() * 30) {
    x = Math.max(12, Math.min(w - 12, x + (rng.next() - 0.5) * 50));
    pts.push([x, y]);
  }
  pts.push([x, h]);
  for (const [col, lw] of [['rgba(255, 240, 150, 0.25)', 22], ['rgba(255, 250, 200, 0.6)', 10], ['#ffffff', 4]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  }
  return c;
}

/** Aurore boréale (rideaux verts et roses) pour la victoire. */
export function aurora(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h, 0.5);
  const cols = ['rgba(95, 255, 190, ALPHA)', 'rgba(120, 200, 255, ALPHA)', 'rgba(255, 120, 200, ALPHA)'];
  const rng = createRng(3);
  for (let band = 0; band < 3; band++) {
    for (let x = 0; x < w; x += 3) {
      const base = h * (0.3 + band * 0.12) + Math.sin(x / 140 + band * 2) * 40 + Math.sin(x / 47 + band) * 12;
      const len = 120 + Math.sin(x / 90 + band * 3) * 60 + rng.next() * 30;
      const g = ctx.createLinearGradient(0, base - len, 0, base);
      g.addColorStop(0, cols[band].replace('ALPHA', '0'));
      g.addColorStop(0.8, cols[band].replace('ALPHA', String(0.22 + rng.next() * 0.1)));
      g.addColorStop(1, cols[band].replace('ALPHA', '0'));
      ctx.fillStyle = g;
      ctx.fillRect(x, base - len, 3, len);
    }
  }
  return c;
}

// --- Le dragon ------------------------------------------------------------------------------

export type DragonFace = 'normal' | 'gueule' | 'content' | 'beurk' | 'aie';

export const HEAD_W = 140;
export const HEAD_H = 120;
/** Point d'attache du cou dans la texture de la tête (origine de rotation). */
export const HEAD_ORIGIN = { x: 38 / HEAD_W, y: 64 / HEAD_H };

/** Tête du dragon, tournée vers la droite. */
export function dragonHead(face: DragonFace): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(HEAD_W, HEAD_H);
  const sick = face === 'beurk';
  const skin = sick ? '#9fbf5a' : DR.red;
  const skinShade = sick ? '#6f8f3a' : DR.redShade;
  const open = face === 'gueule';
  // Crinière en flammes (derrière).
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(52, 30);
    ctx.quadraticCurveTo(30, 6, 8, 18);
    ctx.quadraticCurveTo(22, 26, 14, 36);
    ctx.quadraticCurveTo(2, 40, 0, 58);
    ctx.quadraticCurveTo(14, 56, 16, 66);
    ctx.quadraticCurveTo(4, 78, 8, 94);
    ctx.quadraticCurveTo(22, 84, 30, 92);
    ctx.quadraticCurveTo(40, 98, 52, 86);
    ctx.closePath();
  }, DR.mane, { shade: DR.maneShade, shadeOffset: [4, -5], line: 3.5 });
  // Cornes dorées.
  for (const [dy, len] of [[0, 1], [8, 0.8]] as const) {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(60, 30 + dy);
      ctx.quadraticCurveTo(44, 10 + dy, 22 * len + 8, 4 + dy * 1.4);
      ctx.quadraticCurveTo(40, 16 + dy, 50 + dy, 36 + dy);
      ctx.closePath();
    }, DR.gold, { shade: DR.goldShade, shadeOffset: [2, 3], line: 3 });
  }
  // Mâchoire inférieure (s'ouvre).
  const jawDrop = open ? 18 : 0;
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(48, 70);
    ctx.quadraticCurveTo(80, 76 + jawDrop, 116, 76 + jawDrop * 1.2);
    ctx.quadraticCurveTo(124, 80 + jawDrop * 1.2, 116, 88 + jawDrop * 1.2);
    ctx.quadraticCurveTo(80, 98 + jawDrop, 50, 90);
    ctx.closePath();
  }, sick ? '#c7d98a' : C.cream, { shade: C.creamShade, shadeOffset: [0, -4], line: 3.5 });
  if (open || face === 'beurk') {
    // Intérieur de la gueule et langue.
    ctx.fillStyle = '#5a1630';
    ctx.beginPath();
    ctx.moveTo(60, 68);
    ctx.quadraticCurveTo(90, 72 + jawDrop * 0.6, 118, 72 + jawDrop);
    ctx.lineTo(116, 76 + jawDrop * 1.1);
    ctx.quadraticCurveTo(84, 78 + jawDrop, 58, 74);
    ctx.closePath();
    ctx.fill();
    paint(ctx, () => {
      ctx.beginPath();
      if (face === 'beurk') ctx.ellipse(112, 90, 12, 7, 0.4, 0, Math.PI * 2);
      else ctx.ellipse(92, 74 + jawDrop * 0.8, 14, 5, 0.1, 0, Math.PI * 2);
    }, '#ff7aa8', { line: 2.5 });
  }
  // Barbe sous la mâchoire.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(56, 88 + jawDrop * 0.5);
    ctx.quadraticCurveTo(52, 108, 40, 116);
    ctx.quadraticCurveTo(62, 112, 70, 92 + jawDrop * 0.6);
    ctx.closePath();
  }, DR.gold, { shade: DR.goldShade, shadeOffset: [3, -3], line: 3 });
  // Crâne et museau.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(40, 64);
    ctx.quadraticCurveTo(38, 30, 66, 26);
    ctx.quadraticCurveTo(84, 24, 96, 40);
    ctx.quadraticCurveTo(108, 44, 124, 48);
    ctx.quadraticCurveTo(138, 52, 134, 64);
    ctx.quadraticCurveTo(130, 74, 116, 74);
    ctx.quadraticCurveTo(84, 72, 60, 74);
    ctx.quadraticCurveTo(44, 76, 40, 64);
    ctx.closePath();
  }, skin, { shade: skinShade, shadeOffset: [3, -6], light: sick ? '#d8f0a0' : DR.redLight, line: 4 });
  // Écailles dorées sur le front.
  ctx.strokeStyle = sick ? '#7f9f4a' : DR.goldShade;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(58 + i * 9, 38 + i * 1, 5, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  // Narine en spirale.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(124, 56, 4, Math.PI * 0.2, Math.PI * 1.7);
  ctx.stroke();
  // Crocs (petits, sympathiques).
  ctx.fillStyle = C.cream;
  for (const x of [100, 112]) {
    ctx.beginPath();
    ctx.moveTo(x - 4, 73);
    ctx.lineTo(x, 81 + (open ? 2 : 0));
    ctx.lineTo(x + 4, 73);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Sourire.
  if (!open && face !== 'beurk') {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(70, 72);
    ctx.quadraticCurveTo(92, 78, 112, 72);
    ctx.stroke();
  }
  // Œil.
  const ex = 78;
  const ey = 46;
  if (face === 'content') {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ex, ey + 4, 9, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 140, 170, 0.7)';
    ctx.beginPath();
    ctx.ellipse(ex + 18, ey + 18, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (face === 'aie') {
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.3) {
      const r = 1 + a * 0.9;
      const x = ex + Math.cos(a) * r;
      const y = ey + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(ex, ey, 11, 13, 0, 0, Math.PI * 2);
    }, '#fffbe8', { line: 3.5 });
    ctx.fillStyle = sick ? '#6f8f3a' : '#f0a020';
    ctx.beginPath();
    ctx.arc(ex + 3, ey + 1, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.ellipse(ex + 4, ey + 1, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + 1, ey - 4, 2.6, 0, Math.PI * 2);
    ctx.fill();
    // Sourcil.
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (open) ctx.moveTo(ex - 12, ey - 20), ctx.quadraticCurveTo(ex, ey - 26, ex + 12, ey - 20);
    else ctx.moveTo(ex - 12, ey - 16), ctx.quadraticCurveTo(ex, ey - 21, ex + 13, ey - 14);
    ctx.stroke();
  }
  if (sick) {
    // Joue verte et goutte.
    ctx.fillStyle = 'rgba(120, 200, 90, 0.7)';
    ctx.beginPath();
    ctx.ellipse(96, 62, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** Segment du corps (rond, vu de dessus) ; `or` : écaille d'or d'un objectif réussi. */
export function segment(kind: 'corps' | 'or' | 'ventre'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  const gold = kind === 'or';
  const fill = gold ? DR.gold : DR.red;
  const shade = gold ? DR.goldShade : DR.redShade;
  // Crête dorsale (petites pointes vers le haut).
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(14, 18);
    ctx.lineTo(22, 2);
    ctx.lineTo(30, 14);
    ctx.lineTo(38, 0);
    ctx.lineTo(46, 14);
    ctx.lineTo(52, 6);
    ctx.lineTo(52, 22);
    ctx.closePath();
  }, gold ? '#fff0b0' : DR.mane, { shade: gold ? DR.gold : DR.maneShade, shadeOffset: [0, 3], line: 3 });
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(32, 34, 26, 24, 0, 0, Math.PI * 2);
  }, fill, { shade, shadeOffset: [0, -6], light: gold ? '#fff8d8' : DR.redLight, line: 3.5 });
  // Écailles.
  ctx.strokeStyle = gold ? '#c27c18' : '#b9312f';
  ctx.lineWidth = 2.2;
  for (const [x, y] of [[22, 28], [36, 26], [29, 38], [43, 38], [16, 40]]) {
    ctx.beginPath();
    ctx.arc(x, y, 6, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  }
  // Ventre crème.
  ctx.fillStyle = gold ? '#fff3c4' : C.cream;
  ctx.beginPath();
  ctx.ellipse(32, 52, 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (gold) {
    // Petite gemme.
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(32, 24);
      ctx.lineTo(40, 33);
      ctx.lineTo(32, 42);
      ctx.lineTo(24, 33);
      ctx.closePath();
    }, '#5fd3bc', { light: '#e8fff4', line: 2.5 });
  }
  if (kind === 'ventre') {
    // Creux lumineux où loge la lanterne avalée.
    const g = ctx.createRadialGradient(32, 34, 2, 32, 34, 24);
    g.addColorStop(0, 'rgba(255, 230, 150, 0.9)');
    g.addColorStop(1, 'rgba(255, 180, 90, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 34, 24, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** Petite patte griffue (accrochée sous certains segments). */
export function leg(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(34, 34);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.quadraticCurveTo(20, 6, 22, 20);
    ctx.lineTo(16, 22);
    ctx.quadraticCurveTo(14, 12, 4, 12);
    ctx.closePath();
  }, DR.red, { shade: DR.redShade, shadeOffset: [0, -3], line: 3 });
  ctx.strokeStyle = C.ink;
  ctx.fillStyle = C.cream;
  ctx.lineWidth = 2;
  for (const dx of [-5, 0, 5]) {
    ctx.beginPath();
    ctx.moveTo(19 + dx, 21);
    ctx.lineTo(21 + dx, 30);
    ctx.lineTo(23 + dx, 21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  return c;
}

/** Queue en pinceau de flammes. */
export function tail(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(90, 64);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(84, 26);
    ctx.quadraticCurveTo(60, 20, 44, 26);
    ctx.quadraticCurveTo(26, 4, 4, 10);
    ctx.quadraticCurveTo(20, 20, 10, 30);
    ctx.quadraticCurveTo(0, 40, 6, 56);
    ctx.quadraticCurveTo(24, 46, 44, 40);
    ctx.quadraticCurveTo(62, 44, 84, 38);
    ctx.closePath();
  }, DR.mane, { shade: DR.maneShade, shadeOffset: [4, -4], line: 3.5 });
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(70, 32, 18, 11, 0, 0, Math.PI * 2);
  }, DR.red, { shade: DR.redShade, shadeOffset: [0, -4], line: 3.5 });
  return c;
}

// --- Lanternes ------------------------------------------------------------------------------

/** Lanterne de papier ; `gold` pour les objectifs spéciaux et le ventre en fête. */
export function lantern(gold = false): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(76, 96);
  const body = gold ? DR.gold : DR.lantern;
  // Halo intérieur.
  const glow = ctx.createRadialGradient(38, 46, 4, 38, 46, 40);
  glow.addColorStop(0, 'rgba(255, 230, 160, 0.55)');
  glow.addColorStop(1, 'rgba(255, 180, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 76, 96);
  // Fil.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(38, 0);
  ctx.lineTo(38, 12);
  ctx.stroke();
  // Chapeau et pied.
  for (const y of [12, 76]) {
    paint(ctx, () => roundRectPath(ctx, 24, y, 28, 8, 3), '#3a2a3a', { line: 2.5 });
  }
  // Corps de papier.
  paint(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(38, 47, 31, 28, 0, 0, Math.PI * 2);
  }, body, { shade: gold ? DR.goldShade : '#d4502a', shadeOffset: [5, -5], line: 3.5 });
  // Lumière au centre (le chiffre se lit dessus).
  const inner = ctx.createRadialGradient(38, 47, 2, 38, 47, 26);
  inner.addColorStop(0, gold ? '#fffbe0' : '#fff2c8');
  inner.addColorStop(0.65, gold ? 'rgba(255, 240, 180, 0.85)' : 'rgba(255, 220, 160, 0.8)');
  inner.addColorStop(1, 'rgba(255, 200, 140, 0)');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.ellipse(38, 47, 27, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  // Côtes du papier.
  ctx.strokeStyle = gold ? 'rgba(190, 120, 20, 0.5)' : 'rgba(170, 60, 30, 0.45)';
  ctx.lineWidth = 2;
  for (const k of [-0.62, 0.62]) {
    ctx.beginPath();
    ctx.ellipse(38, 47, Math.abs(k) * 31, 28, 0, Math.PI * (k < 0 ? 0.5 : -0.5), Math.PI * (k < 0 ? 1.5 : 0.5));
    ctx.stroke();
  }
  // Pompon.
  ctx.strokeStyle = gold ? DR.goldShade : C.coralShade;
  ctx.lineWidth = 3;
  for (const dx of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.moveTo(38, 84);
    ctx.lineTo(38 + dx, 95);
    ctx.stroke();
  }
  return c;
}

// --- Habitants du ciel --------------------------------------------------------------------

/** Chauve-souris rouge à crocs. `frame` : ailes hautes/basses ; `brulee` : toute noircie. */
export function bat(frame: 0 | 1, state: 'mechante' | 'peur' | 'brulee' = 'mechante'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(120, 90);
  const burnt = state === 'brulee';
  const fill = burnt ? '#3a3040' : DR.bat;
  const shade = burnt ? '#241c2a' : DR.batShade;
  const up = frame === 0;
  // Ailes membraneuses.
  for (const s of [-1, 1]) {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(60 + s * 14, 44);
      if (up) {
        ctx.quadraticCurveTo(60 + s * 34, 4, 60 + s * 56, 10);
        ctx.quadraticCurveTo(60 + s * 50, 22, 60 + s * 56, 34);
        ctx.quadraticCurveTo(60 + s * 42, 32, 60 + s * 40, 44);
        ctx.quadraticCurveTo(60 + s * 28, 40, 60 + s * 16, 54);
      } else {
        ctx.quadraticCurveTo(60 + s * 40, 40, 60 + s * 56, 66);
        ctx.quadraticCurveTo(60 + s * 44, 64, 60 + s * 40, 76);
        ctx.quadraticCurveTo(60 + s * 32, 66, 60 + s * 24, 72);
        ctx.quadraticCurveTo(60 + s * 20, 60, 60 + s * 12, 58);
      }
      ctx.closePath();
    }, burnt ? '#2a2230' : '#9e2a36', { shade: burnt ? '#1a141e' : '#6e1a28', shadeOffset: [0, -4], line: 3.5 });
  }
  // Oreilles pointues.
  for (const s of [-1, 1]) {
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(60 + s * 6, 30);
      ctx.lineTo(60 + s * 16, 12);
      ctx.lineTo(60 + s * 20, 34);
      ctx.closePath();
    }, fill, { line: 3 });
  }
  // Corps rond.
  paint(ctx, () => blobPath(ctx, 60, 46, 22, 21, createRng(21), 0.04, 12), fill, { shade, shadeOffset: [-4, -4], light: burnt ? undefined : DR.redLight, line: 3.5 });
  if (burnt) {
    // Yeux étourdis, petite fumée : elle redevient toute gentille.
    ctx.strokeStyle = '#f6ecd8';
    ctx.lineWidth = 2.5;
    for (const x of [52, 68]) {
      ctx.beginPath();
      ctx.moveTo(x - 4, 38);
      ctx.lineTo(x + 4, 46);
      ctx.moveTo(x + 4, 38);
      ctx.lineTo(x - 4, 46);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(60, 56, 4, 0, Math.PI * 2);
    ctx.stroke();
    return c;
  }
  const scared = state === 'peur';
  // Yeux jaunes, sourcils méchants (ou effrayés).
  for (const s of [-1, 1]) {
    const x = 60 + s * 9;
    paint(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(x, 40, scared ? 7 : 6, scared ? 8 : 6, 0, 0, Math.PI * 2);
    }, scared ? '#ffffff' : '#ffe24a', { line: 2.5 });
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(x - s * (scared ? 0 : 1), scared ? 41 : 41, scared ? 2 : 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    if (scared) {
      ctx.moveTo(x - 6, 28 - s * 2);
      ctx.lineTo(x + 6, 28 + s * 2);
    } else {
      ctx.moveTo(x - s * 9, 30);
      ctx.lineTo(x + s * 4, 36);
    }
    ctx.stroke();
  }
  // Gueule à crocs.
  paint(ctx, () => {
    ctx.beginPath();
    if (scared) ctx.ellipse(60, 56, 6, 7, 0, 0, Math.PI * 2);
    else {
      ctx.moveTo(46, 50);
      ctx.quadraticCurveTo(60, 66, 74, 50);
      ctx.quadraticCurveTo(60, 56, 46, 50);
      ctx.closePath();
    }
  }, '#3a0d18', { line: 2.5 });
  if (!scared) {
    ctx.fillStyle = '#fff8ea';
    for (const [x, dir] of [[50, 1], [56, 1], [64, 1], [70, 1]] as const) {
      ctx.beginPath();
      ctx.moveTo(x - 2.5, 52);
      ctx.lineTo(x, 52 + 7 * dir);
      ctx.lineTo(x + 2.5, 53);
      ctx.closePath();
      ctx.fill();
    }
  }
  return c;
}

/** Gâteau de lune (bonus). */
export function mooncake(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  paint(ctx, () => {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 26 : 29;
      ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    ctx.closePath();
  }, '#e8a24a', { shade: '#b8742c', shadeOffset: [-4, -4], light: '#ffd590', line: 3.5 });
  paint(ctx, () => {
    ctx.beginPath();
    ctx.arc(32, 32, 17, 0, Math.PI * 2);
  }, '#f3bd62', { line: 2.5 });
  // Motif de fleur.
  ctx.strokeStyle = '#b8742c';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(32 + Math.cos(a) * 9, 32 + Math.sin(a) * 9, 5, 3, a, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Petit visage content.
  ctx.fillStyle = C.ink;
  for (const x of [27, 37]) {
    ctx.beginPath();
    ctx.arc(x, 31, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = C.ink;
  ctx.beginPath();
  ctx.arc(32, 34, 4, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
  return c;
}

/** Montgolfière rayée (l'escargot voyage dans la nacelle). */
export function balloon(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(110, 150);
  const env = () => {
    ctx.beginPath();
    ctx.moveTo(55, 4);
    ctx.bezierCurveTo(112, 4, 108, 70, 70, 96);
    ctx.lineTo(40, 96);
    ctx.bezierCurveTo(2, 70, -2, 4, 55, 4);
    ctx.closePath();
  };
  paint(ctx, env, C.cream, { line: 0, ink: '' });
  ctx.save();
  env();
  ctx.clip();
  const stripes = [C.teal, C.cream, C.coral, C.cream, C.saffron, C.cream, C.teal];
  stripes.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(i * 16, 0, 16, 100);
  });
  ctx.fillStyle = 'rgba(29, 26, 43, 0.18)';
  ctx.fillRect(70, 0, 40, 100);
  ctx.restore();
  env();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  // Cordes.
  ctx.lineWidth = 2;
  for (const [a, b] of [[42, 38], [68, 72]]) {
    ctx.beginPath();
    ctx.moveTo(a, 96);
    ctx.lineTo(b, 118);
    ctx.stroke();
  }
  // Nacelle.
  paint(ctx, () => roundRectPath(ctx, 34, 116, 42, 26, 5), C.woodLight, { shade: C.wood, shadeOffset: [0, -4], line: 3 });
  ctx.strokeStyle = C.woodDark;
  ctx.lineWidth = 1.5;
  for (const y of [124, 132]) {
    ctx.beginPath();
    ctx.moveTo(36, y);
    ctx.lineTo(74, y);
    ctx.stroke();
  }
  return c;
}

/** Bandeau-parchemin de l'objectif. */
export function scroll(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w + 40, h + 16);
  paint(ctx, () => roundRectPath(ctx, 20, 8, w, h, 10), '#fbefd2', { shade: '#ead2a2', shadeOffset: [0, -8], line: 4 });
  for (const x of [4, w + 22]) {
    paint(ctx, () => roundRectPath(ctx, x, 0, 14, h + 16, 7), DR.red, { shade: DR.redShade, shadeOffset: [-3, 0], line: 3.5 });
    paint(ctx, () => {
      ctx.beginPath();
      ctx.arc(x + 7, 4, 6, 0, Math.PI * 2);
      ctx.arc(x + 7, h + 12, 6, 0, Math.PI * 2);
    }, DR.gold, { line: 2.5 });
  }
  return c;
}

/** Flamme (particule) : goutte dégradée blanc → jaune → orange. */
export function flame(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(40, 40, 1);
  const g = ctx.createRadialGradient(20, 20, 1, 20, 20, 19);
  g.addColorStop(0, 'rgba(255, 255, 230, 1)');
  g.addColorStop(0.3, 'rgba(255, 220, 90, 0.95)');
  g.addColorStop(0.65, 'rgba(255, 120, 40, 0.7)');
  g.addColorStop(1, 'rgba(220, 40, 30, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(20, 20, 19, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** Bouffée de fumée douce. */
export function smoke(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(48, 48, 1);
  const g = ctx.createRadialGradient(24, 24, 2, 24, 24, 23);
  g.addColorStop(0, 'rgba(120, 110, 150, 0.6)');
  g.addColorStop(1, 'rgba(120, 110, 150, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 48, 48);
  return c;
}

/** Petite écaille dorée (particule). */
export function scale(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(18, 18);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(9, 2);
    ctx.quadraticCurveTo(17, 9, 9, 16);
    ctx.quadraticCurveTo(1, 9, 9, 2);
    ctx.closePath();
  }, DR.gold, { light: '#fff8d8', line: 2 });
  return c;
}

/** Petit cœur rose (particule). */
export function tinyHeart(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(22, 20);
  paint(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(11, 18);
    ctx.bezierCurveTo(-2, 9, 3, -1, 11, 5);
    ctx.bezierCurveTo(19, -1, 24, 9, 11, 18);
    ctx.closePath();
  }, '#ff7aa8', { line: 2 });
  return c;
}

/** Note de musique (le dragon chantonne). */
export function note(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(24, 30);
  ctx.fillStyle = C.cream;
  ctx.strokeStyle = C.cream;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(8, 24, 6, 4.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(13, 23);
  ctx.lineTo(13, 3);
  ctx.quadraticCurveTo(20, 6, 22, 12);
  ctx.stroke();
  return c;
}

/** Goutte de pluie (particule). */
export function raindrop(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(4, 26, 1);
  const g = ctx.createLinearGradient(0, 0, 0, 26);
  g.addColorStop(0, 'rgba(180, 200, 255, 0)');
  g.addColorStop(1, 'rgba(200, 220, 255, 0.7)');
  ctx.fillStyle = g;
  ctx.fillRect(1, 0, 2, 26);
  return c;
}
