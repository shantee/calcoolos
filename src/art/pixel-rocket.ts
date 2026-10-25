/**
 * Pixel art de « Décollage ! » (outil maison PixelForge). Chaque sprite est dessiné
 * à 1 pixel = 1 pixel, puis affiché ×4 sans lissage. Palette vive inspirée des
 * consoles portables, pour un monde vertical plein de petits habitants.
 */
import { PixelCanvas, DIGITS, type Ramp } from './pixelforge';
import { createRng } from '../core/rng';

/** Taille d'un pixel d'art à l'écran. */
export const PX = 4;

export const P = {
  K: '#1a1c2c', // encre
  W: '#f4f4f4',
  w: '#c2d3e0',
  g: '#94b0c2',
  h: '#566c86',
  d: '#333c57',
  R: '#b13e53',
  r: '#ef7d57',
  Y: '#ffcd75',
  y: '#fff1b3',
  L: '#a7f070',
  G: '#38b764',
  T: '#257179',
  N: '#29366f',
  B: '#3b5dc9',
  S: '#41a6f6',
  C: '#73eff7',
  V: '#5d275d',
  v: '#9d5fb5',
  p: '#ff8fb1',
  M: '#e85d9a',
  F: '#ffd7b0',
  n: '#a0663e',
  m: '#5e3a2a',
  X: '#fff4dc',
} as const;

const PAL: Record<string, string> = { ...P };
const RAMP = {
  rouge: [P.V, P.R, P.r, P.Y] as Ramp,
  herbe: [P.T, P.G, P.L] as Ramp,
  terre: [P.m, P.n, '#c98a5a'] as Ramp,
  nuage: [P.g, P.w, P.W] as Ramp,
  metal: [P.d, P.h, P.g, P.w] as Ramp,
  bois: [P.m, P.n, '#c98a5a'] as Ramp,
  feu: [P.R, P.r, P.Y, P.y] as Ramp,
  bonbon: [P.V, P.M, P.p, '#ffd0e0'] as Ramp,
  lune: [P.h, P.g, P.w] as Ramp,
  violet: [P.N, P.V, P.v] as Ramp,
};

function art(rows: readonly string[], extra: Record<string, string> = {}): PixelCanvas {
  const w = Math.max(...rows.map((r) => r.length));
  const pc = new PixelCanvas(w, rows.length);
  pc.pattern(0, 0, rows, { ...PAL, ...extra });
  return pc;
}

// --- La fusée -----------------------------------------------------------------------------------

export type PilotFace = 'normal' | 'joie' | 'peur' | 'ouf';

/** Fusée 15×22 ; le pilote (un petit chat roux) change de tête dans le hublot. */
export function rocket(face: PilotFace): PixelCanvas {
  const pc = art([
    '......KKK......',
    '.....KRRrK.....',
    '....KRRRRrK....',
    '...KRRRRRRrK...',
    '...KWWWWWWwK...',
    '..KWWWKKKWWwK..',
    '..KWWKSSSKWwK..',
    '..KWKSSSSSKwK..',
    '..KWKSSSSSKwK..',
    '..KWKSSSSSKwK..',
    '..KWWKSSSKWwK..',
    '..KWWWKKKWWwK..',
    '..KRRRRRRRRrK..',
    '..KWWWWWWWWwK..',
    '..KWWWBWBWWwK..',
    '.KKWWWWWWWWwKK.',
    'KRKWWWWWWWWwKRK',
    'KRRKWWWWWWwKRRK',
    'KRRKdhhhhhdKRRK',
    'KRK.KKKKKKK.KRK',
    'KK...KhhhK...KK',
    '.....KKKKK.....',
  ]);
  // Le pilote : oreilles et visage dans le hublot.
  const faces: Record<PilotFace, string[]> = {
    normal: ['r...r', 'rrrrr', 'rKrKr', 'rrprr'],
    joie: ['r...r', 'rKrKr', 'rrrrr', 'rKKKr'],
    peur: ['r...r', 'rKrKr', 'rrrrr', 'rrKrr'],
    ouf: ['r...r', 'rrrrr', 'KKrKK', 'rrKrr'],
  };
  pc.pattern(5, 6, faces[face], { r: P.r, K: P.K, p: P.p });
  pc.set(6, 7, P.C);
  return pc;
}

/** Flamme du réacteur : `power` 0 (veilleuse), 1 (poussée), 2 (turbo). */
export function flame(frame: number, power: 0 | 1 | 2): PixelCanvas {
  const len = [5, 12, 17][power];
  const pc = new PixelCanvas(9, len + 2);
  const rng = createRng(frame * 13 + power);
  const ramp = power === 2 ? ([P.B, P.S, P.C, P.W] as Ramp) : RAMP.feu;
  pc.shadeFn(0, 0, 8, len + 1, ramp, (x, y) => {
    const t = y / len;
    const half = (1 - t) * 3.6 + 0.6 + (rng.next() - 0.5) * 0.8;
    const dx = Math.abs(x + 0.5 - 4.5);
    if (dx > half || t > 1) return null;
    return 1 - t * 0.9 - dx / 6;
  }, { dither: 0.9 });
  return pc;
}

/** Bouffée de fumée pixel. */
export function puff(size: number): PixelCanvas {
  const pc = new PixelCanvas(size, size);
  pc.ellipse(size / 2, size / 2, size / 2, size / 2, RAMP.nuage, { ambient: 0.4 });
  return pc;
}

/** Étincelle en croix (3 tailles). */
export function spark(color: string, big = false): PixelCanvas {
  return big ? art(['..c..', '..c..', 'ccWcc', '..c..', '..c..'], { c: color }) : art(['.c.', 'cWc', '.c.'], { c: color });
}

// --- Plateformes --------------------------------------------------------------------------------

export type PlatformLook = 'sol' | 'terre' | 'nuage' | 'planche' | 'metal' | 'bonbon';

export function platformLook(zone: number, kind: string): PlatformLook {
  if (kind === 'sol') return 'sol';
  if (kind === 'planete') return 'bonbon';
  return (['terre', 'nuage', 'planche', 'metal', 'metal'] as const)[zone];
}

/** Plateforme de `w` pixels d'art de large. Le dessus est la première ligne pleine. */
export function platform(look: PlatformLook, w: number, fragile: boolean, seed: number): PixelCanvas {
  const rng = createRng(seed);
  switch (look) {
    case 'sol': {
      const pc = new PixelCanvas(w, 26);
      pc.rect(0, 2, w, 24, RAMP.terre, 0.8, 0.2);
      pc.rect(0, 0, w, 4, RAMP.herbe, 1, 0.5);
      for (let x = 0; x < w; x += 2) if (rng.next() < 0.5) pc.set(x, 4, P.G);
      for (let i = 0; i < w / 6; i++) pc.set(rng.int(0, w - 1), rng.int(8, 24), rng.next() < 0.5 ? P.g : P.m);
      return pc;
    }
    case 'terre': {
      const pc = new PixelCanvas(w, 16);
      pc.shadeFn(0, 2, w - 1, 15, RAMP.terre, (x, y) => {
        const inset = ((y - 2) / 14) ** 1.4 * (w / 2 - 3) + (rng.next() < 0.15 ? 1 : 0);
        if (x < inset || x > w - 1 - inset) return null;
        return 0.85 - (y - 2) / 18;
      });
      pc.rect(0, 0, w, 4, RAMP.herbe, 1, 0.55);
      for (let x = 1; x < w - 1; x += 3) if (rng.next() < 0.4) pc.set(x, 4, P.G);
      // Petites racines qui pendent.
      for (let k = 0; k < 3; k++) {
        const rx = rng.int(w / 3, (2 * w) / 3);
        for (let y = 12; y < 15 + rng.int(0, 3); y++) pc.set(rx + (y % 2), y, P.m);
      }
      pc.outline(P.K);
      if (fragile) cracks(pc, rng);
      return pc;
    }
    case 'nuage': {
      const pc = new PixelCanvas(w, 14);
      const bumps = Math.max(3, Math.round(w / 10));
      for (let i = 0; i < bumps; i++) {
        const cx = 4 + (i / (bumps - 1)) * (w - 8);
        pc.ellipse(cx, 6, 6 + rng.int(0, 2), 5 + rng.int(0, 1), fragile ? ([P.h, P.g, P.w] as Ramp) : RAMP.nuage, { ambient: 0.45 });
      }
      pc.rect(2, 3, w - 4, 2, fragile ? ([P.g, P.w] as Ramp) : RAMP.nuage, 1, 1);
      pc.outline(P.N);
      if (fragile) cracks(pc, rng);
      return pc;
    }
    case 'planche': {
      const pc = new PixelCanvas(w, 9);
      pc.rect(0, 1, w, 5, RAMP.bois, 0.95, 0.4);
      for (let x = 6; x < w - 2; x += 8) pc.fill(x, 1, 1, 5, P.m);
      pc.fill(3, 6, 2, 3, P.m);
      pc.fill(w - 5, 6, 2, 3, P.m);
      pc.outline(P.K);
      if (fragile) cracks(pc, rng);
      return pc;
    }
    case 'metal': {
      const pc = new PixelCanvas(w, 10);
      pc.rect(0, 1, w, 5, RAMP.metal, 0.95, 0.45);
      for (let x = 4; x < w - 3; x += 7) pc.set(x, 3, P.d);
      pc.fill(2, 6, w - 4, 2, P.d);
      // Petits réacteurs dessous.
      pc.fill(Math.round(w * 0.25), 8, 3, 2, P.h);
      pc.fill(Math.round(w * 0.75) - 3, 8, 3, 2, P.h);
      pc.outline(P.K);
      if (fragile) cracks(pc, rng);
      return pc;
    }
    case 'bonbon': {
      const pc = new PixelCanvas(w, 18);
      pc.shadeFn(0, 0, w - 1, 17, RAMP.bonbon, (x, y) => 0.95 - y / 24 + (Math.floor((x + y) / 6) % 2 ? 0.08 : 0));
      // Glaçage qui coule.
      for (let x = 0; x < w; x++) {
        const drip = 3 + (Math.sin(x * 0.7) > 0.6 ? rng.int(1, 4) : 0);
        for (let y = 0; y < drip; y++) pc.set(x, y, y === 0 ? P.W : '#ffe8f0');
      }
      // Vermicelles.
      for (let i = 0; i < w / 3; i++) pc.set(rng.int(0, w - 1), rng.int(5, 16), rng.pick([P.Y, P.C, P.L, P.W]));
      return pc;
    }
  }
}

function cracks(pc: PixelCanvas, rng: ReturnType<typeof createRng>): void {
  for (let k = 0; k < 3; k++) {
    let x = rng.int(4, pc.w - 5);
    for (let y = 1; y < Math.min(pc.h - 1, 6); y++) {
      if (pc.get(x, y) && pc.get(x, y) !== P.K) pc.set(x, y, P.K);
      x += rng.int(-1, 1);
    }
  }
}

/** Hélice sous une plateforme mobile (2 images). */
export function propeller(frame: 0 | 1): PixelCanvas {
  return frame === 0 ? art(['..KK..', '.KhhK.', 'KWWWWK', '..KK..']) : art(['..KK..', '.KhhK.', '..KK..', '..KK..'], {});
}

/** Deux ballons qui tiennent une planche du ciel des dirigeables. */
export function balloons(): PixelCanvas {
  const pc = new PixelCanvas(30, 22);
  pc.ellipse(7, 6, 5, 6, RAMP.rouge, { ambient: 0.35 });
  pc.ellipse(22, 7, 5, 6, [P.T, P.S, P.C] as Ramp, { ambient: 0.35 });
  pc.outline(P.K);
  pc.line(7, 13, 4, 21, P.K);
  pc.line(22, 14, 25, 21, P.K);
  return pc;
}

// --- Bonus --------------------------------------------------------------------------------------

export type PowerLook = 'bouclier' | 'sablier' | 'turbo' | 'etoile' | 'coeur';

export function power(kind: PowerLook): PixelCanvas {
  const rows: Record<PowerLook, string[]> = {
    bouclier: [
      '.KKKKKKKKK.',
      'KSSSSCSSSSK',
      'KSCCCCCCCSK',
      'KSCSSWSSCSK',
      'KSCSWWWSCSK',
      'KSCSSWSSCSK',
      '.KSCSSSCSK.',
      '.KSSCCCSSK.',
      '..KSSSSSK..',
      '...KSSSK...',
      '....KKK....',
    ],
    sablier: [
      'KKKKKKKKKKK',
      'KnnnnnnnnnK',
      '.KwYYYYYwK.',
      '..KwYYYwK..',
      '...KwYwK...',
      '....KYK....',
      '...KwYwK...',
      '..KwwYwwK..',
      '.KwYYYYYwK.',
      'KnnnnnnnnnK',
      'KKKKKKKKKKK',
    ],
    turbo: [
      '...KKKKK...',
      '..KRRRRRK..',
      '.KRRYYRRRK.',
      'KRRRYYRRRRK',
      'KRRYYYYYRRK',
      'KRRRRYYRRRK',
      'KRRRYYRRRRK',
      'KRRRYRRRRRK',
      '.KRRYRRRRK.',
      '..KRRRRRK..',
      '...KKKKK...',
    ],
    etoile: [
      '.....K.....',
      '....KYK....',
      '....KYK....',
      'KKKKYyYKKKK',
      'KYYYyyyYYYK',
      '.KYYyyyYYK.',
      '..KYYYYYK..',
      '..KYYKYYK..',
      '.KYYK.KYYK.',
      '.KYK...KYK.',
      '.KK.....KK.',
    ],
    coeur: [
      '.KKK...KKK.',
      'KrrRK.KRRRK',
      'KrWRRKRRRRK',
      'KRRRRRRRRRK',
      'KRRRRRRRRRK',
      '.KRRRRRRRK.',
      '..KRRRRRK..',
      '...KRRRK...',
      '....KRK....',
      '.....K.....',
    ],
  };
  return art(rows[kind]);
}

/** Petite étoile à attraper (2 images : de face, de profil). */
export function star(frame: 0 | 1): PixelCanvas {
  return frame === 0 ? art(['...K...', '..KYK..', 'KKYyYKK', '.KYYYK.', '.KYKYK.', 'KK...KK']) : art(['.K.', 'KYK', 'KyK', 'KYK', 'KYK', '.K.']);
}

/** Petite bulle de bouclier autour de la fusée. */
export function bubble(): PixelCanvas {
  const pc = new PixelCanvas(26, 32);
  pc.shadeFn(0, 0, 25, 31, [P.S, P.C, P.W] as Ramp, (x, y) => {
    const dx = (x + 0.5 - 13) / 13;
    const dy = (y + 0.5 - 16) / 16;
    const d = dx * dx + dy * dy;
    if (d > 1 || d < 0.78) return null;
    return dy < -0.3 && dx < -0.2 ? 1 : 0.4;
  }, { dither: 0 });
  return pc;
}

// --- Habitants ----------------------------------------------------------------------------------

export type FriendLook = 'vache' | 'enfant' | 'nuageux' | 'mouton' | 'oiseau' | 'roi' | 'robot' | 'alien' | 'astronaute' | 'ourson';

/** Habitants des plateformes (2 images : repos, joie). */
export function friend(kind: FriendLook, frame: 0 | 1): PixelCanvas {
  const up = frame === 1;
  switch (kind) {
    case 'vache':
      return art([
        '.KK.............',
        'KWWK.KKKKKKKKK..',
        'KKWWKWWWKKWWWWK.',
        '.KWWWWWKKKKWWWWK',
        'KpppWWWWWWWWKKWK',
        up ? 'KpKpWWWKKWWWKKWK' : 'KpppWWWKKWWWKKWK',
        '.KKKWWWKKWWWWWWK',
        '...KWWWWWWWWWWWK',
        '...KKWKKKKKKWKKK',
        '...KdK.....KdK..',
        '...KK......KK...',
      ]);
    case 'enfant':
      return art(up ? [
        'K.......K',
        'KK.KKK.KK',
        '.KKnnnKK.',
        '..KFFFK..',
        '..KKFKK..',
        '..KFFFK..',
        '.KKRRRKK.',
        '..KRRRK..',
        '..KBBBK..',
        '..KBKBK..',
        '..KK.KK..',
      ] : [
        '.........',
        '...KKK...',
        '..KnnnK..',
        '..KFFFK..',
        '..KKFKK..',
        '..KFFFK..',
        '.KKRRRKK.',
        'KFKRRRKFK',
        '.KKBBBKK.',
        '..KBKBK..',
        '..KK.KK..',
      ]);
    case 'nuageux':
      return art([
        up ? 'K..KKKKKK..K' : '...KKKKKK...',
        up ? 'KWKWWWWWWKWK' : '..KWWWWWWK..',
        '.KWWWWWWWWK.',
        'KWWKWWWWKWWK',
        'KWWKWWWWKWWK',
        'KWpWWWWWWpWK',
        up ? 'KWWWKWWKWWWK' : 'KWWWWKKWWWWK',
        up ? '.KWWWKKWWWK.' : '.KWWWWWWWWK.',
        '..KwwKKwwK..',
        '...KK..KK...',
      ]);
    case 'mouton':
      return art([
        '..KKK.KKK....',
        '.KWWWKWWWK...',
        'KWWWWWWWWWKKK',
        'KWWWWWWWWKddK',
        up ? 'KWWWWWWWWKKdK' : 'KWWWWWWWWKdKK',
        '.KWWWWWWWKddK',
        '..KdKKKdK.KK.',
        '..KdK.KdK....',
        '..KK..KK.....',
      ]);
    case 'oiseau':
      return art(up ? [
        '.K.....K..',
        'KSK...KSK.',
        '.KSK.KSK..',
        '..KSSSKKK.',
        '..KSSSKYYK',
        '...KKKKK..',
      ] : [
        '..........',
        '..KKKKKK..',
        '.KSSSSSKKK',
        'KSSSSSSKYK',
        '.KKSSSKKK.',
        '...KKK....',
      ]);
    case 'roi':
      return art([
        up ? 'KYKYKYK.' : '.KYKYK..',
        '.KYYYYK.',
        '.KFFFFK.',
        '.KFKKFK.',
        '.KWWWWK.',
        up ? 'KKWKKWKK' : '.KWWWWK.',
        'KVVVVVVK',
        'KVYVVYVK',
        'KVVVVVVK',
        '.KK..KK.',
      ]);
    case 'robot':
      return art([
        '....R....',
        '....K....',
        '.KKKKKKK.',
        '.KhhhhhK.',
        '.KhCKCKhK'.slice(0, 9),
        '.KhhhhhK.',
        up ? 'KKKKKKKKK' : '.KKKKKKK.',
        up ? 'K.KhYhK.K' : 'KhKhYhKhK',
        '..KhhhK..',
        '..KdKdK..',
        '..KK.KK..',
      ]);
    case 'alien':
      return art([
        up ? 'K.......K' : '.K.....K.',
        '.K.....K.',
        '..KKKKK..',
        '.KLLLLLK.',
        'KLKKLKKLK',
        'KLKWLKWLK',
        '.KLLLLLK.',
        up ? 'KKLKKKLKK' : '..KLLLK..',
        '..KGGGK..',
        '..KGKGK..',
        '..KK.KK..',
      ]);
    case 'astronaute':
      return art([
        '..KKKKK..',
        '.KWWWWWK.',
        'KWKSSSKWK',
        'KWSCSSSWK',
        'KWKSSSKWK',
        '.KWWWWWK.',
        up ? 'KKWRWRWKK' : '.KWRWRWK.',
        up ? 'K.KWWWK.K' : 'KWKWWWKWK',
        '..KWWWK..',
        '..KWKWK..',
        '..KK.KK..',
      ]);
    case 'ourson':
      return art([
        '.KK...KK.',
        'KppK.KppK',
        'KpppppppK',
        'KpKpppKpK',
        'KpppKpppK',
        '.KpMMMpK.',
        up ? 'KKpppppKK' : '.KpppppK.',
        up ? 'K.KpppK.K' : 'KpKpppKpK',
        '..KpppK..',
        '..KpKpK..',
        '..KK.KK..',
      ]);
  }
}

// --- Décor --------------------------------------------------------------------------------------

export function house(roof: string, seed: number): PixelCanvas {
  const rng = createRng(seed);
  const pc = art([
    '.......KK.........',
    '.......KdK........',
    '......KKKKK.......',
    '.....KrrrrrK......',
    '....KrrrrrrrK.....',
    '...KrrrrrrrrrK....',
    '..KrrrrrrrrrrrK...',
    '.KKKKKKKKKKKKKKK..',
    '..KXXXXXXXXXXXK...',
    '..KXKKKXXXKKKXK...',
    '..KXKYKXXXKYKXK...',
    '..KXKKKXXXKKKXK...',
    '..KXXXXKKKXXXXK...',
    '..KXXXXKnKXXXXK...',
    '..KXXXXKnKXXXXK...',
    '..KXXXXKnKXXXXK...',
    '..KKKKKKKKKKKKK...',
  ], { r: roof });
  if (rng.next() < 0.5) pc.set(11, 10, P.y);
  return pc;
}

export function tree(seed: number): PixelCanvas {
  const pc = new PixelCanvas(14, 20);
  const rng = createRng(seed);
  pc.fill(6, 12, 2, 8, P.n);
  for (let i = 0; i < 4; i++) pc.ellipse(4 + rng.int(0, 6), 5 + rng.int(0, 5), 4 + rng.int(0, 2), 4, RAMP.herbe, { ambient: 0.3 });
  pc.outline(P.K);
  for (let i = 0; i < 3; i++) pc.set(rng.int(2, 11), rng.int(2, 10), P.r);
  return pc;
}

export function windmillBody(): PixelCanvas {
  return art([
    '.....KKKK.....',
    '....KXXXXK....',
    '....KXXXXK....',
    '...KXXXXXXK...',
    '...KXXXXXXK...',
    '...KXXKYKXK...',
    '...KXXXXXXK...',
    '..KXXXXXXXXK..',
    '..KXXXXXXXXK..',
    '..KXXXXXXXXK..',
    '.KXXXXXXXXXXK.',
    '.KXXXKKKXXXXK.',
    '.KXXXKnKXXXXK.',
    'KXXXXKnKXXXXXK',
    'KKKKKKKKKKKKKK',
  ]);
}

export function windmillBlades(): PixelCanvas {
  const pc = new PixelCanvas(27, 27);
  for (let a = 0; a < 4; a++) {
    for (let t = 2; t < 13; t++) {
      const ang = (a * Math.PI) / 2;
      const x = Math.round(13 + Math.cos(ang) * t);
      const y = Math.round(13 + Math.sin(ang) * t);
      const nx = Math.round(-Math.sin(ang));
      const ny = Math.round(Math.cos(ang));
      pc.set(x, y, P.n);
      if (t > 4) for (let k = 1; k <= 3; k++) pc.set(x + nx * k, y + ny * k, k === 3 ? P.w : P.W);
    }
  }
  pc.outline(P.K);
  pc.fill(12, 12, 3, 3, P.K);
  return pc;
}

/** Tour de lancement avec ses petites lumières. */
export function launchTower(): PixelCanvas {
  const pc = new PixelCanvas(12, 48);
  pc.fill(2, 0, 2, 48, P.h);
  pc.fill(8, 0, 2, 48, P.h);
  for (let y = 2; y < 48; y += 6) {
    pc.line(2, y, 9, y + 5, P.d);
    pc.line(9, y, 2, y + 5, P.d);
  }
  pc.outline(P.K);
  pc.fill(0, 0, 12, 2, P.R);
  return pc;
}

/** Montgolfière rayée avec son passager. */
export function hotAirBalloon(): PixelCanvas {
  const pc = new PixelCanvas(18, 26);
  pc.shadeFn(0, 0, 17, 15, RAMP.rouge, (x, y) => {
    const dx = (x + 0.5 - 9) / 8.5;
    const dy = (y + 0.5 - 8) / 8;
    if (dx * dx + dy * dy > 1 && !(y > 10 && Math.abs(dx) < 1 - (y - 10) / 8)) return null;
    return Math.floor(x / 3) % 2 ? 0.95 : 0.55;
  }, { dither: 0 });
  pc.outline(P.K);
  pc.line(4, 15, 7, 20, P.K);
  pc.line(13, 15, 10, 20, P.K);
  pc.pattern(6, 18, ['.KK.', 'KFFK'], {});
  pc.fill(6, 20, 6, 5, P.n);
  pc.fill(6, 20, 6, 1, P.K);
  pc.pattern(6, 18, ['.KK.', 'KFFK'], {});
  pc.set(7, 19, P.F);
  return pc;
}

/** Dirigeable avec passagers aux hublots. */
export function zeppelin(): PixelCanvas {
  const pc = new PixelCanvas(46, 22);
  pc.ellipse(22, 8, 21, 8, [P.V, P.v, '#c79be0', P.w] as Ramp, { ambient: 0.3 });
  for (let x = 6; x < 40; x += 8) pc.line(x, 2, x, 14, '#7a4a92');
  pc.pattern(40, 3, ['.KK', 'KRK', 'KRK', 'KRK', '.KK'], {});
  pc.outline(P.K);
  pc.fill(14, 16, 16, 5, P.n);
  pc.fill(14, 16, 16, 1, P.K);
  for (let x = 16; x < 29; x += 4) {
    pc.set(x, 18, P.Y);
    pc.set(x + 1, 18, P.F);
  }
  pc.line(14, 15, 18, 13, P.K);
  pc.line(29, 15, 25, 13, P.K);
  return pc;
}

export function kite(): PixelCanvas {
  return art(['....K....', '...KYK...', '..KYYRK..', '.KYYYRRK.', 'KYYYYRRRK', '.KRRRYYK.', '..KRRYK..', '...KRK...', '....K....']);
}

/** Château posé sur un nuage (le roi des nuages y habite). */
export function castle(): PixelCanvas {
  const pc = new PixelCanvas(44, 40);
  for (const cx of [8, 22, 36]) pc.ellipse(cx, 33, 9, 6, RAMP.nuage, { ambient: 0.5 });
  pc.rect(10, 12, 24, 20, [P.h, P.g, P.w] as Ramp, 0.9, 0.5);
  for (const tx of [6, 34]) {
    pc.rect(tx, 6, 6, 26, [P.h, P.g, P.w] as Ramp, 0.95, 0.5);
    pc.pattern(tx - 1, 0, ['...K....', '..KMK...', '.KMMMK..', 'KMMMMMK.'], {});
  }
  for (let x = 10; x < 34; x += 4) pc.fill(x, 10, 2, 2, P.g);
  pc.fill(19, 22, 6, 10, P.n);
  pc.fill(14, 15, 2, 3, P.Y);
  pc.fill(28, 15, 2, 3, P.Y);
  pc.outline(P.K);
  pc.pattern(21, 0, ['K', 'KRR', 'KRR', 'K', 'K', 'K'], {});
  return pc;
}

export function rainbow(w: number): PixelCanvas {
  const h = Math.round(w / 2);
  const pc = new PixelCanvas(w, h);
  const cols = [P.R, P.r, P.Y, P.L, P.S, P.v];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x + 0.5 - w / 2, y + 0.5 - h) / (w / 2);
      const band = Math.floor((1 - d) * 20);
      if (band >= 0 && band < cols.length) pc.set(x, y, cols[band]);
    }
  }
  return pc;
}

export function satellite(): PixelCanvas {
  return art([
    '..........K.........',
    '.........KYK........',
    'KKKKKK...KhK...KKKKKK',
    'KBSBSK..KwwwK..KBSBSK',
    'KSBSBKKKKwKwKKKKSBSBK',
    'KBSBSK..KwwwK..KBSBSK',
    'KKKKKK...KKK...KKKKKK',
  ]);
}

export function ufo(frame: 0 | 1): PixelCanvas {
  return art([
    '.......KKKKK........',
    '......KCKLKCK.......',
    '.....KCCLLLCCK......',
    '..KKKKKKKKKKKKKKK...',
    '.KhwwwwwwwwwwwwwhK..',
    'KhhhhhhhhhhhhhhhhhK.',
    '.KK' + (frame ? 'Y' : 'R') + 'KK' + (frame ? 'R' : 'Y') + 'KK' + (frame ? 'Y' : 'R') + 'KK' + (frame ? 'R' : 'Y') + 'KK' + (frame ? 'Y' : 'R') + 'KKK..',
    '...KKKKKKKKKKKKK....',
  ]);
}

export function smallPlanet(r: number, ramp: Ramp, ring: boolean): PixelCanvas {
  const pc = new PixelCanvas(r * 2 + (ring ? 12 : 2), r * 2 + 2);
  const cx = pc.w / 2;
  pc.ellipse(cx, r + 1, r, r, ramp, { ambient: 0.2 });
  if (ring) {
    for (let x = 0; x < pc.w; x++) {
      const y = Math.round(r + 1 + (x - cx) * 0.18);
      if (Math.abs(x - cx) > r - 2 || x % 2) pc.set(x, y, P.Y);
    }
  }
  pc.outline(P.K);
  return pc;
}

export function moon(): PixelCanvas {
  const pc = new PixelCanvas(30, 30);
  pc.ellipse(15, 15, 14, 14, RAMP.lune, { ambient: 0.25 });
  const rng = createRng(4);
  for (let i = 0; i < 5; i++) pc.ellipse(rng.int(6, 24), rng.int(6, 24), 2, 2, [P.h, P.g] as Ramp, { ambient: 0.5 });
  pc.outline(P.K);
  // Elle fait un clin d'œil.
  pc.pattern(9, 12, ['K....KK', '...K...', '..KKK..'].map((r, i) => (i === 2 ? '.' + r : r)), {});
  return pc;
}

export function comet(): PixelCanvas {
  const pc = new PixelCanvas(40, 10);
  pc.shadeFn(0, 0, 39, 9, [P.N, P.B, P.S, P.C, P.W] as Ramp, (x, y) => {
    const t = x / 39;
    const half = 1 + t * 4;
    if (Math.abs(y + 0.5 - 5) > half) return null;
    return t;
  });
  pc.ellipse(36, 5, 3, 3, [P.C, P.W] as Ramp, { ambient: 0.8 });
  return pc;
}

/** Nuage de fond (parallaxe), doux. */
export function cloud(w: number, h: number, seed: number, dark = false): PixelCanvas {
  const pc = new PixelCanvas(w, h);
  const rng = createRng(seed);
  const n = Math.max(3, Math.round(w / 12));
  for (let i = 0; i < n; i++) {
    const cx = 6 + (i / (n - 1)) * (w - 12);
    const ry = h / 2 - 1 - rng.int(0, Math.floor(h / 5));
    pc.ellipse(cx, h - ry - 1, Math.max(5, w / n), ry, dark ? ([P.N, P.B, P.S] as Ramp) : RAMP.nuage, { ambient: 0.55 });
  }
  return pc;
}

/** Collines lointaines (bande de fond du village). */
export function hills(w: number, h: number): PixelCanvas {
  const pc = new PixelCanvas(w, h);
  pc.shadeFn(0, 0, w - 1, h - 1, [P.T, P.G] as Ramp, (x, y) => {
    const top = h * 0.45 + Math.sin(x / 23) * h * 0.18 + Math.sin(x / 9) * 3;
    return y < top ? null : 0.7 - (y - top) / h;
  });
  return pc;
}

/** Tuile d'étoiles pour l'espace. */
export function starTile(size: number, seed: number): PixelCanvas {
  const pc = new PixelCanvas(size, size);
  const rng = createRng(seed);
  for (let i = 0; i < size / 2; i++) {
    const x = rng.int(0, size - 1);
    const y = rng.int(0, size - 1);
    pc.set(x, y, rng.pick([P.W, P.w, P.C, P.Y]));
    if (rng.next() < 0.1) {
      pc.set(x + 1, y, P.g);
      pc.set(x - 1, y, P.g);
      pc.set(x, y + 1, P.g);
      pc.set(x, y - 1, P.g);
    }
  }
  return pc;
}

/** La planète Bonbon vue de près : sucettes, cannes, maisons en guimauve. */
export function candyVillage(w: number): PixelCanvas {
  const pc = new PixelCanvas(w, 40);
  const rng = createRng(21);
  for (let x = 6; x < w - 6; x += rng.int(14, 24)) {
    const kind = rng.int(0, 2);
    if (kind === 0) {
      // Sucette.
      const hgt = rng.int(18, 30);
      pc.fill(x, 40 - hgt, 1, hgt, P.W);
      pc.ellipse(x + 0.5, 40 - hgt - 4, 5, 5, rng.pick([RAMP.bonbon, [P.T, P.S, P.C] as Ramp, [P.G, P.L, P.y] as Ramp]), { ambient: 0.5, dither: 0 });
    } else if (kind === 1) {
      // Canne en sucre d'orge.
      for (let y = 18; y < 40; y++) pc.set(x, y, Math.floor(y / 2) % 2 ? P.R : P.W);
      for (let i = 0; i < 5; i++) pc.set(x + i, 18 - Math.round(Math.sin((i / 4) * Math.PI) * 3), i % 2 ? P.R : P.W);
    } else {
      // Maison en guimauve.
      pc.rect(x - 4, 28, 10, 12, [P.p, '#ffd0e0', P.W] as Ramp, 0.9, 0.5);
      pc.fill(x - 1, 33, 3, 7, P.M);
      pc.fill(x - 5, 26, 12, 2, P.W);
    }
  }
  pc.outline(P.K);
  return pc;
}

/** Drapeau planté au sommet. */
export function flag(frame: 0 | 1): PixelCanvas {
  return art(frame ? ['KKKKKKK', 'KYYRRYK', 'KYRRYYK', 'KKKKKKK', 'K', 'K', 'K', 'K', 'K', 'K'] : ['KKKKKK.', 'KYYRRYK', 'KYRRYYK', 'KKKKKK.', 'K', 'K', 'K', 'K', 'K', 'K']);
}

/** Le canard en plastique de Pluie de météores, perdu ici aussi (clin d'œil). */
export function duck(): PixelCanvas {
  return art(['.....KKK....', '....KYYYK...', '....KYKYKrr.', '....KYYYKKK.', '.KK.KYYYK...', 'KYYKYYYYYK..', 'KYYYYYYYYYK.', '.KYYYYYYYYK.', '..KKKKKKKK..']);
}

// --- Police des nombres -------------------------------------------------------------------------

/**
 * Police pixel des calculs : les chiffres de PixelForge (traits de 2 pixels, un 5
 * qu'on ne confond pas avec un S) et les signes + − × ÷ = ? dessinés pareil.
 */
export const NUMBER_CHARS = ' 0123456789+−-×÷=?_m%()';
export const GLYPH_W = 10;
export const GLYPH_H = 13;

const SIGNS: Record<string, string[]> = {
  ' ': [],
  '+': ['', '', '..##', '..##', '######', '######', '..##', '..##'],
  '−': ['', '', '', '', '######', '######'],
  '-': ['', '', '', '', '######', '######'],
  '×': ['', '', '##..##', '.####.', '..##', '.####.', '##..##'],
  '÷': ['', '..##', '..##', '', '######', '######', '', '..##', '..##'],
  '=': ['', '', '', '######', '######', '', '######', '######'],
  '?': ['.####.', '##..##', '....##', '...##', '..##', '..##', '', '..##', '..##'],
  _: ['', '', '', '', '', '', '', '', '', '######'],
  m: ['', '', '', '##.##', '#######', '##.#.##', '##.#.##', '##.#.##', '##.#.##', '##.#.##'],
  '%': ['', '##...#', '##..##', '...##', '..##', '.##', '##..##', '#...##'],
  '(': ['...##', '..##', '.##', '.##', '.##', '.##', '.##', '.##', '..##', '...##'],
  ')': ['.##', '..##', '...##', '...##', '...##', '...##', '...##', '...##', '..##', '.##'],
};

export function numberFont(): PixelCanvas {
  const pc = new PixelCanvas(GLYPH_W * NUMBER_CHARS.length, GLYPH_H);
  [...NUMBER_CHARS].forEach((ch, i) => {
    const g = new PixelCanvas(GLYPH_W - 1, GLYPH_H - 1);
    g.pattern(1, 1, DIGITS[ch] ?? SIGNS[ch] ?? [], { '#': P.W });
    g.outline(P.K);
    pc.stamp(g, i * GLYPH_W, 0);
  });
  return pc;
}

// --- Interface ----------------------------------------------------------------------------------

/** Cadre pixel (panneau de calcul, boutons). */
export function frame(w: number, h: number, fill: string, light: string, ink: string = P.K): PixelCanvas {
  const pc = new PixelCanvas(w, h);
  pc.fill(1, 0, w - 2, h, ink);
  pc.fill(0, 1, w, h - 2, ink);
  pc.fill(1, 1, w - 2, h - 3, fill);
  pc.fill(2, 1, w - 4, 1, light);
  pc.fill(1, 2, 1, h - 5, light);
  pc.fill(1, h - 2, w - 2, 1, ink);
  return pc;
}

export function arrow(dir: -1 | 1, pressed: boolean): PixelCanvas {
  const pc = frame(22, 18, pressed ? P.Y : P.N, pressed ? P.y : P.B);
  const tri = dir < 0 ? ['....K', '...KK', '..KKK', '.KKKK', '..KKK', '...KK', '....K'] : ['K....', 'KK...', 'KKK..', 'KKKK.', 'KKK..', 'KK...', 'K....'];
  pc.pattern(8, 5, tri, { K: pressed ? P.K : P.W });
  return pc;
}

export function heartIcon(full: boolean): PixelCanvas {
  return art(['.KK.KK.', 'KRrKRRK', 'KRRRRRK', '.KRRRK.', '..KRK..', '...K...'], full ? {} : { R: P.d, r: P.h });
}

export function miniRocket(): PixelCanvas {
  return art(['.K.', 'KRK', 'KWK', 'KWK', 'RKR']);
}
