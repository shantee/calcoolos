/** Panneaux publicitaires de Nova City : marques imaginaires, japonais, smileys.
 * Tout est dessiné au canvas ; aucune image externe. */
export type AdShape = "wide" | "tall" | "square" | "ticker";
export interface Ad {
  shape: AdShape;
  bg: [string, string];
  fg: string;
  title: string;
  sub?: string;
  jp?: string;
  emoji?: string;
  smiley?: boolean;
  /** Clignotement néon (0 = stable). */
  flicker?: number;
}
export const SIZES: Record<AdShape, [number, number]> = {
  wide: [512, 256],
  tall: [128, 512],
  square: [256, 256],
  ticker: [4096, 128],
};
export const ADS: Ad[] = [
  { shape: "wide", bg: ["#ff2d55", "#ffb800"], fg: "#fff6c9", title: "ラーメン", sub: "RAMEN TURBO · 24 H / 24", emoji: "🍜" },
  { shape: "wide", bg: ["#d0002f", "#5a0018"], fg: "#ffffff", title: "MULTIPLI-COLA", sub: "7 × 8 = 56 BULLES !", emoji: "🥤", flicker: 0.3 },
  { shape: "wide", bg: ["#ff5fc8", "#7b2cff"], fg: "#fff0fb", title: "CAFÉ CHAT-ROBOT", jp: "ネコカフェ", emoji: "🐱" },
  { shape: "square", bg: ["#ffe600", "#ff9500"], fg: "#221100", title: "SOURIS !", sub: "TU VOLES", smiley: true },
  { shape: "wide", bg: ["#00c2ff", "#0047ff"], fg: "#e9fbff", title: "SUSHI ORBITAL", jp: "寿司", emoji: "🍣" },
  { shape: "wide", bg: ["#ffd400", "#111111"], fg: "#ffd400", title: "TAXI VOLANT", sub: "APPELLE LE 9 × 9 = 81", emoji: "🚖" },
  { shape: "tall", bg: ["#ff2a6d", "#3a0021"], fg: "#ffe3ef", title: "未来都市" },
  { shape: "wide", bg: ["#00ff9d", "#006b5a"], fg: "#002b23", title: "がんばって！", sub: "COURAGE, PILOTE !", emoji: "💪" },
  { shape: "wide", bg: ["#ff7a00", "#ff004c"], fg: "#fff4e0", title: "PIZZA QUANTIQUE", sub: "LIVRÉE AVANT TA COMMANDE", emoji: "🍕" },
  { shape: "square", bg: ["#7df9ff", "#1a6dff"], fg: "#ffffff", title: "ありがとう", sub: "MERCI !", emoji: "🙏" },
  { shape: "wide", bg: ["#ff00aa", "#ffea00"], fg: "#ffffff", title: "TABLE DE 7", sub: "EN PROMO · −77 %", emoji: "🏷️", flicker: 0.5 },
  { shape: "tall", bg: ["#00e5ff", "#002a4d"], fg: "#e5fdff", title: "ネオン" },
  { shape: "wide", bg: ["#a100ff", "#ff2fd0"], fg: "#ffffff", title: "KARAOKÉ ROBOT", jp: "カラオケ", emoji: "🎤" },
  { shape: "square", bg: ["#ff3b3b", "#ffcf3b"], fg: "#ffffff", title: "最高！", sub: "LE TOP DU TOP", emoji: "🔥" },
  { shape: "wide", bg: ["#b8f2ff", "#ff9bd2"], fg: "#3a1060", title: "GLACE À L'ANTIMATIÈRE", sub: "PARFUM TROU NOIR", emoji: "🍦" },
  { shape: "tall", bg: ["#ffe600", "#4a3500"], fg: "#fffbe0", title: "東京二〇九九" },
  { shape: "wide", bg: ["#00b36b", "#00331f"], fg: "#c8ffe5", title: "DRAGON EXPRESS", jp: "ドラゴン", emoji: "🐉" },
  { shape: "wide", bg: ["#222244", "#000000"], fg: "#7dfcff", title: "0 × TOUT = 0", sub: "LA BOUTIQUE DES ZÉROS", emoji: "🍩", flicker: 0.4 },
  { shape: "wide", bg: ["#ff6a3d", "#9d1dff"], fg: "#fff", title: "TAKOYAKI", jp: "たこ焼き", emoji: "🐙" },
  { shape: "square", bg: ["#ff8ad8", "#ffd1f0"], fg: "#7a0057", title: "かわいい", sub: "KAWAII", emoji: "✨" },
  { shape: "wide", bg: ["#00d4ff", "#00ff88"], fg: "#003040", title: "BANQUE SMILEY", sub: "INTÉRÊTS EN SOURIRES", smiley: true },
  { shape: "wide", bg: ["#3d00b8", "#00e1ff"], fg: "#ffffff", title: "PARKING OVNI", sub: "2 H GRATUITES · NIVEAU −9", emoji: "🛸" },
  { shape: "tall", bg: ["#9dff00", "#1d3300"], fg: "#f4ffe0", title: "ゲーム" },
  { shape: "wide", bg: ["#ffcc00", "#ff3d00"], fg: "#2a0a00", title: "10 × 10 = 100", sub: "CENT POUR CENT CERVEAU", emoji: "⭐" },
  { shape: "wide", bg: ["#c7a0ff", "#5c2a9e"], fg: "#fff", title: "BUBBLE TEA COSMIQUE", jp: "タピオカ", emoji: "🧋" },
  { shape: "wide", bg: ["#ff4d8d", "#4dd2ff"], fg: "#ffffff", title: "CHAUSSETTES", sub: "ANTI-GRAVITÉ · TAILLE UNIQUE", emoji: "🧦" },
  { shape: "square", bg: ["#ffffff", "#c9c9c9"], fg: "#111", title: "ÉCOLE PANDA", sub: "PILOTES DÈS 6 ANS", emoji: "🐼" },
  { shape: "tall", bg: ["#ff00d4", "#2b0033"], fg: "#ffe0fb", title: "元気一杯" },
  { shape: "wide", bg: ["#0f0f2a", "#3a0f5c"], fg: "#ffe66d", title: "LUNE → 3 MIN", sub: "NAVETTE TOUTES LES 6 × 7 S", emoji: "🌙", flicker: 0.3 },
  { shape: "square", bg: ["#00ffe1", "#008cff"], fg: "#ffffff", title: "すごい！", sub: "TROP FORT", emoji: "🤩" },
  { shape: "tall", bg: ["#ff9100", "#3b1a00"], fg: "#fff2e0", title: "電気屋" },
  { shape: "wide", bg: ["#ff1e56", "#1e1eff"], fg: "#ffffff", title: "ROBO-COIFFEUR", sub: "COUPE LASER EN 0,3 S", emoji: "💇" },
  { shape: "ticker", bg: ["#000000", "#12002a"], fg: "#ffea00", title: "★ FLASH INFO ★ UN PILOTE A RÉCITÉ LA TABLE DE 9 EN 4 SECONDES ★ ニュース ★ MÉTÉO : PLUIE DE CONFETTIS SUR LE QUARTIER 8 ★ 6 × 7 = 42 ★" },
  { shape: "ticker", bg: ["#00121f", "#002a3a"], fg: "#5dfdff", title: "♪ RADIO NÉON ♪ いらっしゃいませ ♪ 8 × 8 = 64 ♪ LES ROBOTS AUSSI RÉVISENT ♪ ご注意ください ♪ VITESSE + CALCUL = ARC-EN-CIEL ♪" },
];

const EMOJI_FONT = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
const FONT = 'Inter, "Noto Sans CJK JP", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif';

function fit(ctx: CanvasRenderingContext2D, text: string, max: number, size: number, weight = 900) {
  let s = size;
  do ctx.font = `${weight} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > max && (s -= 2) > 10);
  return s;
}

function smiley(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = "#ffe14d";
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.09;
  ctx.shadowColor = "#fff27a";
  ctx.shadowBlur = r * 0.4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.fillStyle = color;
  for (const dx of [-0.35, 0.35]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * r, y - 0.25 * r, r * 0.1, r * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y + 0.05 * r, r * 0.55, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

/** Smiley géant sur fond transparent (hologramme). */
export function paintSmiley(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  smiley(canvas.getContext("2d")!, 128, 128, 100, "#3a1d00");
  return canvas;
}
/** Dessine une publicité dans un nouveau canvas. */
export function paintAd(ad: Ad): HTMLCanvasElement {
  const [w, h] = SIZES[ad.shape];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const grad = ad.shape === "tall" ? ctx.createLinearGradient(0, 0, 0, h) : ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, ad.bg[0]);
  grad.addColorStop(1, ad.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Trame d'écran et cadre néon.
  ctx.fillStyle = "#00000022";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  ctx.strokeStyle = ad.fg;
  ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.035);
  ctx.shadowColor = ad.fg;
  ctx.shadowBlur = 14;
  ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - 2 * ctx.lineWidth, h - 2 * ctx.lineWidth);
  ctx.fillStyle = ad.fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (ad.shape === "ticker") {
    ctx.shadowBlur = 10;
    ctx.font = `900 76px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(ad.title, 20, h / 2 + 4, w - 40);
    return canvas;
  }
  if (ad.shape === "tall") {
    const chars = [...ad.title];
    const step = (h - 40) / chars.length;
    ctx.font = `900 ${Math.min(96, step * 0.9)}px ${FONT}`;
    chars.forEach((c, i) => ctx.fillText(c, w / 2, 20 + step * (i + 0.5)));
    return canvas;
  }
  const hasIcon = ad.emoji || ad.smiley;
  const icon = ad.shape === "square" ? h * 0.25 : h * 0.3;
  const textX = ad.shape === "wide" && hasIcon ? w * 0.6 : w / 2;
  const textW = ad.shape === "wide" && hasIcon ? w * 0.68 : w * 0.85;
  if (ad.shape === "wide" && hasIcon) {
    if (ad.smiley) smiley(ctx, w * 0.15, h / 2, icon, "#3a1d00");
    else {
      ctx.shadowBlur = 0;
      ctx.font = `${icon * 1.7}px ${EMOJI_FONT}`;
      ctx.fillText(ad.emoji!, w * 0.15, h / 2 + 6);
    }
  }
  ctx.fillStyle = ad.fg;
  ctx.shadowColor = ad.fg;
  ctx.shadowBlur = 18;
  if (ad.shape === "square") {
    if (ad.smiley) smiley(ctx, w / 2, h * 0.36, icon, "#3a1d00");
    else if (ad.emoji) {
      ctx.shadowBlur = 0;
      ctx.font = `${icon * 1.6}px ${EMOJI_FONT}`;
      ctx.fillText(ad.emoji, w / 2, h * 0.36);
      ctx.shadowBlur = 18;
    }
    fit(ctx, ad.title, textW, 52);
    ctx.fillText(ad.title, w / 2, h * 0.72);
    if (ad.sub) {
      fit(ctx, ad.sub, textW, 22, 700);
      ctx.shadowBlur = 4;
      ctx.fillText(ad.sub, w / 2, h * 0.87);
    }
    return canvas;
  }
  const lines = [ad.jp, ad.title, ad.sub].filter(Boolean) as string[];
  const ys = lines.length === 3 ? [0.26, 0.55, 0.8] : lines.length === 2 ? [0.4, 0.72] : [0.5];
  lines.forEach((line, i) => {
    const main = line === ad.title;
    fit(ctx, line, textW, main ? 64 : line === ad.jp ? 46 : 26, main ? 900 : 700);
    ctx.shadowBlur = main ? 18 : 6;
    ctx.fillText(line, textX, h * ys[i]);
  });
  return canvas;
}

/** Grandes fenêtres avec habitants animés : deux images côte à côte (uOffset 0 / 0,5).
 * Chaque image contient 2 × 2 fenêtres. */
export function paintPeople(variant: number, hue: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  let seed = variant * 9301 + 49297;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const kinds = Array.from({ length: 4 }, () => Math.floor(rnd() * 5));
  const shirts = Array.from({ length: 4 }, () => `hsl(${Math.floor(rnd() * 360)} 85% 60%)`);
  const rooms = Array.from({ length: 4 }, (_, i) => `hsl(${(hue + i * 25 + rnd() * 30) % 360} 70% ${55 + rnd() * 15}%)`);
  for (let frame = 0; frame < 2; frame++)
    for (let w = 0; w < 4; w++) {
      const ox = frame * 256 + (w % 2) * 128,
        oy = Math.floor(w / 2) * 128;
      ctx.fillStyle = "#0b0f1f";
      ctx.fillRect(ox, oy, 128, 128);
      ctx.fillStyle = rooms[w];
      ctx.fillRect(ox + 8, oy + 8, 112, 112);
      // Lampe, plante, cadre : un intérieur vivant.
      ctx.fillStyle = "#ffffff55";
      ctx.fillRect(ox + 16, oy + 18, 22, 16);
      ctx.fillStyle = "#2f8f4e";
      ctx.beginPath();
      ctx.arc(ox + 104, oy + 96, 10, 0, Math.PI * 2);
      ctx.fill();
      const kind = kinds[w];
      const sway = kind === 1 ? (frame ? 8 : -8) : 0;
      const cx = ox + 64 + sway,
        base = oy + 120;
      ctx.lineCap = "round";
      if (kind === 3) {
        // Chat qui remue la queue.
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.ellipse(cx, base - 18, 22, 16, 0, 0, Math.PI * 2);
        ctx.arc(cx - 14, base - 40, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - 26, base - 50);
        ctx.lineTo(cx - 22, base - 64);
        ctx.lineTo(cx - 16, base - 52);
        ctx.moveTo(cx - 10, base - 52);
        ctx.lineTo(cx - 4, base - 64);
        ctx.lineTo(cx, base - 48);
        ctx.fill();
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cx + 20, base - 20);
        ctx.quadraticCurveTo(cx + 40, base - 40, cx + (frame ? 30 : 46), base - 62);
        ctx.stroke();
        ctx.fillStyle = "#ffe14d";
        ctx.fillRect(cx - 20, base - 44, 4, 4);
        ctx.fillRect(cx - 11, base - 44, 4, 4);
        continue;
      }
      const robot = kind === 4;
      ctx.strokeStyle = robot ? "#c9d6e8" : shirts[w];
      ctx.lineWidth = 10;
      // Bras : coucou (0), danse (1, 2) ou robot.
      const arms =
        kind === 0
          ? [[-24, -30], frame ? [24, -78] : [30, -66]]
          : kind === 2
            ? frame
              ? [[-28, -76], [28, -40]]
              : [[-28, -40], [28, -76]]
            : frame
              ? [[-30, -74], [30, -74]]
              : [[-30, -44], [30, -44]];
      for (const [dx, dy] of arms) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.sign(dx) * 10, base - 58);
        ctx.lineTo(cx + dx, base + dy);
        ctx.stroke();
      }
      ctx.fillStyle = robot ? "#c9d6e8" : shirts[w];
      ctx.fillRect(cx - 14, base - 64, 28, 40);
      ctx.fillStyle = "#1d2440";
      ctx.fillRect(cx - 12, base - 26, 9, 26);
      ctx.fillRect(cx + 3, base - 26, 9, 26);
      ctx.fillStyle = robot ? "#e6eefc" : `hsl(${25 + variant * 7} 55% ${60 + (w % 2) * 12}%)`;
      if (robot) ctx.fillRect(cx - 14, base - 94, 28, 26);
      else {
        ctx.beginPath();
        ctx.arc(cx, base - 80, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = robot ? "#3bf0ff" : "#1d1d1d";
      ctx.fillRect(cx - 7, base - 84, 4, 4);
      ctx.fillRect(cx + 3, base - 84, 4, 4);
      ctx.strokeStyle = robot ? "#3bf0ff" : "#1d1d1d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, base - 77, 5, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }
  return canvas;
}
