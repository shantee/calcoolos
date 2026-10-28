/**
 * « Décollage ! » — arcade, plateformes verticales et calcul mental, en pixel art.
 *
 * Un calcul apparaît ; chaque bonne réponse donne une poussée à la fusée. Entre
 * deux poussées, on la pilote (flèches, Q/D, boutons à l'écran) pour se poser sur
 * une plateforme. Du village jusqu'à la planète Bonbon, en passant par la mer de
 * nuages, le ciel des dirigeables et l'espace.
 *
 * Toute la logique est dans session.ts ; ici on montre, on anime, on fait vivre.
 */
import Phaser from 'phaser';
import * as A from '../../art/pixel-rocket';
import { P, PX } from '../../art/pixel-rocket';
import type { PixelCanvas } from '../../art/pixelforge';
import { Sfx } from '../sfx';
import { RocketSession, PLATFORM_ART, SUMMIT, ZONES, MAX_VX, MAX_LIVES, type Platform, type RocketEvent, type Star } from './session';
import type { Grade } from '../../core/calc-grade';
import { TIERS, type Tier, type TierId } from '../../core/difficulty';
import type { Mode } from '../../core/waves';
import { reportResult, outcomeText } from '../../platform/results';
import { pleinEcranAuDemarrage } from '../plein-ecran';

export const W = 1280;
export const H = 720;
const FONT = '"Minecraftia", "Symboles pixel", monospace';
const RECORD_KEY = 'calcoolos.fusee.records';
const NUM = 'f-num';
const NUMBER_RE = new RegExp(`^[${A.NUMBER_CHARS.replace(/[-\]\\^]/g, '\\$&')}]+$`);
const tint = (hex: string): number => parseInt(hex.slice(1), 16);

/**
 * Images fournies par Philippe (src/images/decollage/, originaux dans sources-images/decollage/), déjà à leur
 * taille d'affichage. Le nom du fichier est la clé de texture : `vache-0.webp` → `f-vache-0`. Comme `tx()` ne
 * dessine une texture que si elle n'existe pas encore, une image fournie remplace le dessin par code du même nom.
 */
const PROVIDED: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../../images/decollage/*.webp', { eager: true, query: '?url', import: 'default' })).map(([path, url]) => [
    `f-${path.split('/').pop()!.replace('.webp', '')}`,
    url,
  ]),
);

/** Trois enfants différents (enfant, enfant2, enfant3) ; le dessin par code de secours est le même pour tous. */
const KIDS = ['enfant', 'enfant2', 'enfant3'];
const lookKind = (look: string): A.FriendLook => look.replace(/\d+$/, '') as A.FriendLook;

/**
 * Jauge d'altitude dessinée par Philippe (sources-images/decollage/), déjà à sa taille d'affichage.
 * GAUGE_Y : hauteur à l'écran du bas de la fusée pour l'altitude 0 puis pour le haut de chaque étage
 * (village → bande verte, nuages et dirigeables → bande de ciel, espace → bande étoilée, Bonbon → bande rose).
 */
const GAUGE_X = 4;
const GAUGE_TOP = 92;
const GAUGE_MID = GAUGE_X + 48;
const GAUGE_Y = [574, 433, 389, 344, 231, 156];

/** Couleur de l'encadré selon la difficulté du calcul ; les points disent aussi la difficulté (daltoniens). */
const GRADE_LOOK: Record<Grade, { fill: string; edge: string; text: string; label: string }> = {
  facile: { fill: '#1e4d36', edge: P.G, text: P.L, label: 'facile ●' },
  moyen: { fill: P.m, edge: '#f08a2c', text: '#ffb05a', label: 'moyen ●●' },
  difficile: { fill: P.V, edge: P.R, text: P.p, label: 'difficile ●●●' },
};

/**
 * Minecraftia est plus grande que Pixelify Sans à taille égale (les tailles du code datent de Pixelify) :
 * on la réduit d'un cinquième, puis on arrondit au multiple de 8 px pour que ses pixels restent nets
 * (32 px : un pixel de police = 4 px, comme le pixel art).
 */
function style(size: number, color: string, stroke = 0): Phaser.Types.GameObjects.Text.TextStyle {
  const px = Math.max(16, Math.round((size * 0.8) / 8) * 8);
  return { fontFamily: FONT, fontSize: `${px}px`, color, stroke: P.K, strokeThickness: stroke };
}

/** Couleur du ciel selon l'altitude : bleu du matin, coucher violet, nuit de l'espace. */
const SKY: Array<[number, number]> = [
  [0, 0x8fd3ff],
  [1300, 0x6cc0f5],
  [3000, 0x41a6f6],
  [3900, 0x7f6fd6],
  [4600, 0x5d3f9e],
  [5400, 0x29366f],
  [6200, 0x14152a],
  [7600, 0x2c1745],
];

function skyAt(alt: number): number {
  for (let i = 1; i < SKY.length; i++) {
    if (alt <= SKY[i][0]) {
      const [a0, c0] = SKY[i - 1];
      const [a1, c1] = SKY[i];
      const t = (alt - a0) / (a1 - a0);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(c0), Phaser.Display.Color.ValueToColor(c1), 100, Math.round(t * 100));
      return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    }
  }
  return SKY[SKY.length - 1][1];
}

const FRIEND_LINES: Record<string, string[]> = {
  vache: ['Meuh !', 'Bon vol !'],
  enfant: ['Trop fort !', 'Coucou !'],
  nuageux: ['Bienvenue !', 'Doux, hein ?', 'Salut !'],
  mouton: ['Bêêê !', 'Moelleux !'],
  oiseau: ['Piou !', 'Joli vol !'],
  roi: ['Bravo, pilote !', 'Mon royaume !'],
  robot: ['Bip boup !', 'Calcul validé !'],
  alien: ['Gloubi !', 'Salut terrien !'],
  astronaute: ['Houston, ça va !', 'Bel atterrissage !'],
  ourson: ['Miam !', 'Youpi !'],
};

interface PlatformView {
  p: Platform;
  img: Phaser.GameObjects.Image;
  extras: Phaser.GameObjects.GameObject[];
  power: Phaser.GameObjects.Image | null;
  friend: Phaser.GameObjects.Image | null;
}

export class RocketScene extends Phaser.Scene {
  private tier!: Tier;
  private seed = 1;
  private session: RocketSession | null = null;
  private sfx = new Sfx();
  private reducedMotion = false;
  private speedBoost = 1;

  // Monde
  private sky!: Phaser.GameObjects.Rectangle;
  private starsBg!: Phaser.GameObjects.TileSprite;
  private views = new Map<number, PlatformView>();
  private starViews = new Map<number, Phaser.GameObjects.Image>();
  private decor: Phaser.GameObjects.GameObject[] = [];
  private blades: Phaser.GameObjects.Image | null = null;
  private kiteLine!: Phaser.GameObjects.Graphics;
  private kite: Phaser.GameObjects.Image | null = null;
  private dancers: Phaser.GameObjects.Image[] = [];

  // Fusée
  private ship!: Phaser.GameObjects.Container;
  private hull!: Phaser.GameObjects.Image;
  private fire!: Phaser.GameObjects.Image;
  private bubble!: Phaser.GameObjects.Image;
  private thrustUntil = 0;
  private turboFlame = false;
  private faceUntil = 0;
  private face: A.PilotFace = 'normal';
  private rescuing = false;
  private steerKeys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private steerButtons = { left: false, right: false };
  private steerOverride: -1 | 0 | 1 | null = null;
  private camY = 0;

  // Interface
  private qPanel!: Phaser.GameObjects.Container;
  private qBg!: Phaser.GameObjects.Image;
  private qTag!: Phaser.GameObjects.Text;
  private qText!: Phaser.GameObjects.BitmapText;
  private qTokens: Phaser.GameObjects.BitmapText[] = [];
  private qBar!: Phaser.GameObjects.Graphics;
  private lastTick = 0;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private comboLabel!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.BitmapText;
  private altText!: Phaser.GameObjects.BitmapText;
  private altMarker!: Phaser.GameObjects.Image;
  private hud!: Phaser.GameObjects.Container;
  private soundText!: Phaser.GameObjects.Text;
  private arrows: Phaser.GameObjects.Image[] = [];
  private keys = new Map<string, Phaser.GameObjects.Container>();
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayButtons: Array<{ c: Phaser.GameObjects.Container; run: () => void }> = [];
  private overlayFocus = 0;
  private paused = false;
  private ending = false;
  private startedAt = 0;
  private musicLevel = 0;

  constructor() {
    super('decollage');
  }

  /** Texture pixel : dessinée une fois, affichée ×4 sans lissage. */
  private tx(key: string, make: () => PixelCanvas): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, make().toCanvas());
    return key;
  }

  /**
   * Texte en Minecraftia. On glisse un séparateur invisible entre « f » et « i »/« l » : avec
   * Pixelify Sans, la ligature manquante affichait « Défi » en « DéA » (gardé par sécurité).
   */
  private txt(x: number, y: number, text: string, st: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    return this.add.text(x, y, noLigature(text), st);
  }

  /** Nombres et calculs, avec la police pixel lisible (un 5 n'est pas un S). */
  private num(x: number, y: number, text: string, scale = PX): Phaser.GameObjects.BitmapText {
    return this.add.bitmapText(x, y, NUM, text).setScale(scale).setOrigin(0.5);
  }

  /**
   * Un calcul : chaque morceau (nombre, signe) est un texte à part, séparé par un
   * petit espace. Les chiffres d'un même nombre restent collés (on lit 28, pas 2 8).
   */
  private setCalc(text: string): void {
    this.qText.setText('');
    for (const t of this.qTokens) t.destroy();
    const parts = text.split(' ').map((w) => this.num(0, -8, w));
    const gap = 18;
    const total = parts.reduce((a, t) => a + t.displayWidth, 0) + gap * (parts.length - 1);
    let x = -total / 2;
    for (const t of parts) {
      t.setOrigin(0, 0.5).setX(x);
      x += t.displayWidth + gap;
    }
    this.qTokens = parts;
    this.qPanel.add(parts);
  }

  private tintCalc(color: string | null): void {
    for (const t of this.qTokens) {
      if (color) t.setTint(tint(color));
      else t.clearTint();
    }
  }

  private registerFont(): void {
    if (this.cache.bitmapFont.exists(NUM)) return;
    const key = this.tx('f-numfont', A.numberFont);
    // Phaser 4 renvoie directement l'entrée du cache ({ data, texture, frame }).
    const entry = Phaser.GameObjects.RetroFont.Parse(this, {
      image: key,
      width: A.GLYPH_W,
      height: A.GLYPH_H,
      chars: A.NUMBER_CHARS,
      charsPerRow: A.NUMBER_CHARS.length,
      spacing: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
      lineSpacing: 0,
    } as unknown as Phaser.Types.GameObjects.BitmapText.RetroFontConfig);
    this.cache.bitmapFont.add(NUM, entry);
  }

  private sprite(x: number, y: number, key: string, make: () => PixelCanvas): Phaser.GameObjects.Image {
    return this.add.image(x, y, this.tx(key, make)).setScale(this.px(key));
  }

  /** Grossissement d'une texture : ×4 pour un dessin par code, ×1 pour une image fournie (déjà à sa taille). */
  private px(key: string): number {
    return key in PROVIDED ? 1 : PX;
  }

  preload(): void {
    for (const [key, url] of Object.entries(PROVIDED)) this.load.image(key, url);
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    this.seed = Number(params.get('graine')) || Math.floor(Math.random() * 1e9);
    this.tier = TIERS[params.get('niveau') as TierId] ?? TIERS.explorateur;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || params.has('calme');
    this.speedBoost = Math.min(10, Math.max(1, Number(params.get('accelere')) || 1));
    this.input.addPointer(2);
    this.registerFont();

    this.sky = this.add.rectangle(W / 2, H / 2, W, H, skyAt(0)).setScrollFactor(0).setDepth(-100);
    this.starsBg = this.add.tileSprite(0, 0, W / PX, H / PX, this.tx('f-stars', () => A.starTile(64, 3))).setOrigin(0).setScale(PX).setScrollFactor(0).setDepth(-95).setAlpha(0);
    this.kiteLine = this.add.graphics().setDepth(-6);
    this.buildDecor();
    this.buildShip();
    this.buildHud();
    this.bindInput();
    this.newWorld();
    this.showIntro();

    (window as unknown as { __fusee: unknown }).__fusee = {
      session: () => this.session,
      start: (mode: Mode) => this.startGame(mode),
      answer: () => {
        const q = this.session?.question;
        if (q) for (const d of String(q.expr.answer)) this.onDigit(d);
      },
      wrong: () => {
        const q = this.session?.question;
        if (q) for (const d of String(q.expr.answer + 1).padStart(String(q.expr.answer).length, '1').slice(-String(q.expr.answer).length)) this.onDigit(d);
      },
      steer: (d: -1 | 0 | 1 | null) => (this.steerOverride = d),
      overlay: () => this.overlay !== null,
      ending: () => this.ending,
      rescuing: () => this.rescuing,
      pause: () => this.pause(),
      resume: () => this.resume(),
    };
  }

  // --- Décor du monde vertical -------------------------------------------------------------------
  private wy(alt: number): number {
    return -alt;
  }

  private buildDecor(): void {
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.decor.push(o);
      return o;
    };
    // Collines lointaines et sol du village (toute la largeur).
    if ('f-hills' in PROVIDED) {
      // Montagnes de Philippe en parallaxe : elles défilent moins vite que le sol. Au départ, leur pied (160 px au-dessus
      // du bas de l'image, prolongé dessous pour ne pas laisser voir le ciel en montant) est posé sur le sol.
      const f = 0.75;
      add(this.add.image(W / 2, this.wy(0) + (H - 130) * (1 - f) + 160, 'f-hills').setOrigin(0.5, 1).setDepth(-60).setScrollFactor(1, f));
    } else add(this.sprite(W / 2, this.wy(0) - 6, 'f-hills', () => A.hills(330, 70)).setOrigin(0.5, 1).setDepth(-60).setScrollFactor(1, 0.9));
    add(this.sprite(W / 2, this.wy(0), 'f-ground', () => A.platform('sol', 330, false, 1)).setOrigin(0.5, 0).setDepth(-2));
    // Village : maisons, arbres, moulin, tour de lancement, vache, enfants.
    [[70, P.R, 1], [215, P.B, 2], [1080, P.G, 3], [1215, P.V, 4]].forEach(([x, roof, s]) => {
      add(this.sprite(x as number, this.wy(0) + 2, `f-house-${s}`, () => A.house(roof as string, s as number)).setOrigin(0.5, 1).setDepth(-8));
    });
    [140, 290, 1000, 1150].forEach((x, i) => add(this.sprite(x, this.wy(0) + 2, `f-tree-${i}`, () => A.tree(i + 7)).setOrigin(0.5, 1).setDepth(-9)));
    add(this.sprite(1000, this.wy(0) - 2, 'f-mill', A.windmillBody).setOrigin(0.5, 1).setDepth(-7));
    this.blades = add(this.sprite(1000, this.wy(0) - 2 - 48, 'f-blades', A.windmillBlades).setDepth(-6));
    add(this.sprite(720, this.wy(0) + 2, 'f-tower', A.launchTower).setOrigin(0.5, 1).setDepth(-3));
    const cow = add(this.sprite(380, this.wy(0) + 2, 'f-vache-0', () => A.friend('vache', 0)).setOrigin(0.5, 1).setDepth(-1).setInteractive({ useHandCursor: true }));
    cow.on('pointerdown', () => {
      this.sfx.unlock();
      this.sfx.moo();
      cow.setTexture(this.tx('f-vache-1', () => A.friend('vache', 1)));
      this.say(cow.x, cow.y - 70, 'Meuh !');
      this.time.delayedCall(600, () => cow.setTexture('f-vache-0'));
    });
    [470, 860, 930].forEach((x, i) => {
      const kid = add(this.sprite(x, this.wy(0) + 2, `f-${KIDS[i]}-0`, () => A.friend('enfant', 0)).setOrigin(0.5, 1).setDepth(-1).setFlipX(i === 1));
      this.dancers.push(kid);
    });
    // Le cerf-volant d'un enfant, très haut au bout de sa ficelle.
    this.kite = add(this.sprite(1120, this.wy(520), 'f-kite', A.kite).setDepth(-6));
    // Volée d'oiseaux (petit dessin du code ; l'oiseau posé sur les nuages est celui de Philippe), montgolfière.
    for (let i = 0; i < 4; i++) {
      const b = add(this.sprite(80 + i * 34, this.wy(900 + (i % 2) * 22), 'f-oiseau-vol', () => A.friend('oiseau', 0)).setDepth(-10).setFlipX(true));
      this.tweens.add({ targets: b, x: b.x + 1300, duration: 26000, repeat: -1, delay: i * 120 });
    }
    const balloon = add(this.sprite(90, this.wy(1150), 'f-balloon', A.hotAirBalloon).setDepth(-10));
    if (!this.reducedMotion) this.tweens.add({ targets: balloon, y: balloon.y - 40, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Mer de nuages : nuages de fond, moutons, arc-en-ciel.
    const rng = new Phaser.Math.RandomDataGenerator(['nuages']);
    for (let i = 0; i < 26; i++) {
      const alt = rng.between(1100, 4600);
      const w = rng.between(40, 90);
      const c = add(this.sprite(rng.between(-100, W + 100), this.wy(alt) * 0.8, `f-cloud-${i}`, () => A.cloud(w, Math.round(w / 3), i)).setDepth(-70).setScrollFactor(1, 0.8).setAlpha(alt > 3800 ? 0.5 : 0.85));
      if (!this.reducedMotion) this.tweens.add({ targets: c, x: c.x + rng.between(-160, 160), duration: rng.between(18000, 30000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    add(this.sprite(1110, this.wy(2500) * 0.85, 'f-rainbow', () => A.rainbow(70)).setDepth(-75).setScrollFactor(1, 0.85).setAlpha(0.8));
    const sheep = add(this.sprite(1160, this.wy(1900), 'f-cloudside', () => A.cloud(40, 14, 77)).setDepth(-5));
    add(this.sprite(sheep.x, sheep.y - 30, 'f-mouton-0', () => A.friend('mouton', 0)).setDepth(-4));
    add(this.sprite(70, this.wy(2600), 'f-cloudside2', () => A.cloud(36, 12, 78)).setDepth(-5));
    add(this.sprite(70, this.wy(2600) - 28, 'f-nuageux-0', () => A.friend('nuageux', 0)).setDepth(-4));

    // Ciel des dirigeables : château du roi des nuages, dirigeable, cerfs-volants.
    const castle = add(this.sprite(1140, this.wy(3900), 'f-castle', A.castle).setDepth(-6).setOrigin(0.5, 1));
    // Le roi se tient sur le rempart du milieu (à 68 % de la hauteur du château fourni, 82 % de celui du code).
    const wall = 'f-castle' in PROVIDED ? 0.68 : 0.82;
    add(this.sprite(1140, this.wy(3900) - castle.displayHeight * wall, 'f-roi-0', () => A.friend('roi', 0)).setDepth(-5).setOrigin(0.5, 1));
    const zep = add(this.sprite(-200, this.wy(3450), 'f-zeppelin', A.zeppelin).setDepth(-12));
    this.tweens.add({ targets: zep, x: W + 220, duration: 40000, repeat: -1 });
    const balloon2 = add(this.sprite(110, this.wy(4300), 'f-balloon', A.hotAirBalloon).setDepth(-12));
    if (!this.reducedMotion) this.tweens.add({ targets: balloon2, y: balloon2.y - 30, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Espace : satellite, lune qui fait un clin d'œil, planète à anneaux, soucoupe, comète, astronaute.
    const sat = add(this.sprite(1150, this.wy(5200), 'f-sat', A.satellite).setDepth(-12));
    if (!this.reducedMotion) this.tweens.add({ targets: sat, angle: 360, duration: 30000, repeat: -1 });
    add(this.sprite(1120, this.wy(5900) * 0.6, 'f-moon', A.moon).setDepth(-80).setScrollFactor(1, 0.6));
    add(this.sprite(120, this.wy(6400) * 0.6, 'f-planet', () => A.smallPlanet(12, [P.N, P.B, P.S, P.C], true)).setDepth(-80).setScrollFactor(1, 0.6));
    add(this.sprite(1150, this.wy(7000) * 0.6, 'f-planet2', () => A.smallPlanet(7, [P.V, P.R, P.r], false)).setDepth(-80).setScrollFactor(1, 0.6));
    const ufo = add(this.sprite(-120, this.wy(5650), 'f-ufo-0', () => A.ufo(0)).setDepth(-11));
    this.tx('f-ufo-1', () => A.ufo(1));
    this.tweens.add({ targets: ufo, x: W + 120, duration: 16000, repeat: -1, repeatDelay: 6000, onRepeat: () => ufo.setY(this.wy(5650 + Phaser.Math.Between(-150, 150))) });
    this.time.addEvent({ delay: 300, loop: true, callback: () => ufo.setTexture(ufo.texture.key === 'f-ufo-0' ? 'f-ufo-1' : 'f-ufo-0') });
    const astro = add(this.sprite(1170, this.wy(6150), 'f-astronaute-0', () => A.friend('astronaute', 0)).setDepth(-11));
    if (!this.reducedMotion) this.tweens.add({ targets: astro, angle: { from: -20, to: 20 }, y: astro.y - 20, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const duck = add(this.sprite(90, this.wy(6650), 'f-duck', A.duck).setDepth(-11).setInteractive({ useHandCursor: true }));
    duck.on('pointerdown', () => {
      this.sfx.unlock();
      this.sfx.quack();
      this.say(duck.x + 40, duck.y - 40, 'Coin !');
    });
    if (!this.reducedMotion) this.tweens.add({ targets: duck, angle: 360, duration: 9000, repeat: -1 });
    this.time.addEvent({ delay: 9000, loop: true, callback: () => this.comet() });

    // La planète Bonbon, au sommet.
    add(this.sprite(W / 2, this.wy(SUMMIT), 'f-candy', () => A.platform('bonbon', 330, false, 9)).setOrigin(0.5, 0).setDepth(-2));
    add(this.sprite(W / 2, this.wy(SUMMIT) + 2, 'f-village', () => A.candyVillage(320)).setOrigin(0.5, 1).setDepth(-3));
    const flag = add(this.sprite(820, this.wy(SUMMIT) + 2, 'f-flag-0', () => A.flag(0)).setOrigin(0, 1).setDepth(-1));
    this.tx('f-flag-1', () => A.flag(1));
    this.time.addEvent({ delay: 400, loop: true, callback: () => flag.setTexture(flag.texture.key === 'f-flag-0' ? 'f-flag-1' : 'f-flag-0') });
    [300, 420, 900, 1000].forEach((x) => {
      const b = add(this.sprite(x, this.wy(SUMMIT) + 2, 'f-ourson-0', () => A.friend('ourson', 0)).setOrigin(0.5, 1).setDepth(-1));
      this.dancers.push(b);
    });
    // Les habitants bougent un peu (2 images).
    this.time.addEvent({ delay: 650, loop: true, callback: () => this.wiggleDancers() });
  }

  private wiggleDancers(): void {
    for (const d of this.dancers) {
      const key = d.texture.key;
      const base = key.replace(/-[01]$/, '');
      if (Math.random() < 0.4) d.setTexture(key.endsWith('-0') ? this.tx(`${base}-1`, () => A.friend(lookKind(base.slice(2)), 1)) : `${base}-0`);
    }
  }

  private comet(): void {
    if (this.paused || !this.session || this.session.altitude < 4500) return;
    const y = this.cameras.main.scrollY + Phaser.Math.Between(80, 300);
    const c = this.sprite(W + 60, y, 'f-comet', A.comet).setDepth(-50).setAngle(-12);
    this.tweens.add({ targets: c, x: -200, y: y + 160, duration: 2600, onComplete: () => c.destroy() });
  }

  /** Plateformes, bonus, habitants et étoiles du monde de la partie. */
  private newWorld(): void {
    for (const v of this.views.values()) {
      v.img.destroy();
      v.extras.forEach((e) => e.destroy());
      v.power?.destroy();
      v.friend?.destroy();
    }
    this.views.clear();
    for (const s of this.starViews.values()) s.destroy();
    this.starViews.clear();
    const s = this.session ?? new RocketSession(this.tier.id, this.seed, 'tranquille');
    for (const p of s.platforms) {
      if (p.kind === 'sol' || p.kind === 'planete') continue;
      const look = A.platformLook(p.zone, p.kind);
      const wArt = Math.round(p.w / PX);
      let img: Phaser.GameObjects.Image;
      const art = p.art && `f-${p.art}-0` in PROVIDED ? p.art : null;
      if (art) {
        // Plateforme dessinée par Philippe : le sol est à `top` pixels sous le haut de l'image.
        img = this.add.image(p.x, this.wy(p.y), `f-${art}-0`).setDepth(0);
        img.setOrigin(0.5, PLATFORM_ART[art].top / img.height);
      } else img = this.sprite(p.x, this.wy(p.y), `f-plat-${look}-${wArt}-${p.kind === 'fragile' ? 1 : 0}-${p.id}`, () => A.platform(look, wArt, p.kind === 'fragile', p.id)).setOrigin(0.5, 0).setDepth(0);
      const extras: Phaser.GameObjects.GameObject[] = [];
      if (p.kind === 'mobile') {
        const bottom = img.y + img.displayHeight * (1 - img.originY) - (art ? 6 : 0);
        const prop = this.sprite(p.x, bottom, 'f-prop-0', () => A.propeller(0)).setOrigin(0.5, 0).setDepth(-1);
        for (let i = 1; i < 4; i++) this.tx(`f-prop-${i}`, () => A.propeller(i));
        extras.push(prop);
      }
      if (look === 'planche' && !art) extras.push(this.sprite(p.x, this.wy(p.y) - 2, 'f-balloons', A.balloons).setOrigin(0.5, 1).setDepth(-1).setAlpha(0.95));
      let power: Phaser.GameObjects.Image | null = null;
      if (p.power) {
        const kind = p.power;
        power = this.sprite(p.x, this.wy(p.y) - 34, `f-pow-${kind}`, () => A.power(kind)).setDepth(5);
        if (!this.reducedMotion) this.tweens.add({ targets: power, y: power.y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      let friend: Phaser.GameObjects.Image | null = null;
      if (p.friend) {
        const kind = p.friend;
        const side = p.id % 2 ? 1 : -1;
        const look = kind === 'enfant' ? KIDS[p.id % KIDS.length] : kind;
        friend = this.sprite(p.x, this.wy(p.y) + 4, `f-${look}-0`, () => A.friend(kind, 0)).setOrigin(0.5, 1).setDepth(4).setFlipX(side > 0);
        // Près du bord, sans trop dépasser (les images fournies sont plus grandes que les dessins).
        const dx = side * (p.w / 2 - Math.max(22, friend.displayWidth / 2 - 8));
        friend.x += dx;
        friend.setData('kind', kind);
        friend.setData('look', look);
        friend.setData('dx', dx);
      }
      this.views.set(p.id, { p, img, extras, power, friend });
    }
    this.tx('f-star-0', () => A.star(0));
    this.tx('f-star-1', () => A.star(1));
    for (const st of s.stars) this.starViews.set(st.id, this.sprite(st.x, this.wy(st.y) - 20, 'f-star-0', () => A.star(0)).setDepth(6));
  }

  // --- La fusée ----------------------------------------------------------------------------------
  private buildShip(): void {
    (['normal', 'joie', 'peur', 'ouf'] as A.PilotFace[]).forEach((f) => this.tx(`f-rocket-${f}`, () => A.rocket(f)));
    for (let i = 0; i < 3; i++) for (const pw of [0, 1, 2] as const) this.tx(`f-flame-${pw}-${i}`, () => A.flame(i, pw));
    this.fire = this.add.image(0, -2, 'f-flame-0-0').setOrigin(0.5, 0).setScale(this.px('f-flame-0-0'));
    this.hull = this.add.image(0, 0, 'f-rocket-normal').setOrigin(0.5, 1).setScale(this.px('f-rocket-normal'));
    this.bubble = this.add.image(0, -this.hull.displayHeight / 2, this.tx('f-bubble', A.bubble)).setScale(PX).setVisible(false);
    this.ship = this.add.container(640, 0, [this.fire, this.hull, this.bubble]).setDepth(10);
    this.tx('f-puff-3', () => A.puff(3));
    this.tx('f-puff-5', () => A.puff(5));
    for (const c of [P.Y, P.C, P.p, P.L, P.W, P.r]) this.tx(`f-spark-${c}`, () => A.spark(c));
    this.tx('f-spark-big', () => A.spark(P.Y, true));
  }

  private setFace(face: A.PilotFace, ms: number): void {
    this.face = face;
    this.faceUntil = this.time.now + ms;
  }

  private puff(x: number, y: number, big = false): void {
    const p = this.add.image(x, y, big ? 'f-puff-5' : 'f-puff-3').setScale(PX).setDepth(9).setAlpha(0.9);
    this.tweens.add({ targets: p, y: y + Phaser.Math.Between(10, 40), x: x + Phaser.Math.Between(-30, 30), alpha: 0, scale: PX * 1.5, duration: 600, onComplete: () => p.destroy() });
  }

  private burst(x: number, y: number, colors: string[], n: number): void {
    const count = this.reducedMotion ? Math.ceil(n / 3) : n;
    for (let i = 0; i < count; i++) {
      const c = colors[i % colors.length];
      const s = this.add.image(x, y, this.tx(`f-spark-${c}`, () => A.spark(c))).setScale(PX).setDepth(12);
      const a = Math.random() * Math.PI * 2;
      const d = Phaser.Math.Between(30, 120);
      this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: Phaser.Math.Between(400, 800), ease: 'Cubic.easeOut', onComplete: () => s.destroy() });
    }
  }

  private placeShip(time: number): void {
    const s = this.session;
    const r = s?.rocket ?? { x: 640, y: 0, vx: 0, vy: 0, on: 1 };
    if (!this.rescuing) this.ship.setPosition(r.x, this.wy(r.y));
    const flying = r.on === null;
    const tilt = flying ? (r.vx / MAX_VX) * 16 : 0;
    this.ship.setAngle(Phaser.Math.Linear(this.ship.angle, tilt, 0.2));
    // Flamme : forte pendant la poussée, veilleuse en vol, éteinte posée.
    const thrusting = time < this.thrustUntil;
    const frame = Math.floor(time / 70) % 3;
    if (thrusting) this.fire.setTexture(`f-flame-${this.turboFlame ? 2 : 1}-${frame}`).setVisible(true);
    else if (flying) this.fire.setTexture(`f-flame-0-${frame}`).setVisible(true);
    else this.fire.setVisible(false);
    if (thrusting && !this.reducedMotion && frame === 0) this.puff(this.ship.x + Phaser.Math.Between(-8, 8), this.ship.y + 50);
    // Visage du pilote.
    let face: A.PilotFace = 'normal';
    if (time < this.faceUntil) face = this.face;
    else if (s && flying && r.vy < -430) face = 'peur';
    else if (s?.question && s.question.left / s.question.time < 0.25) face = 'peur';
    this.hull.setTexture(`f-rocket-${face}`);
    this.bubble.setVisible(!!s?.shield);
    if (s?.shield) this.bubble.setAlpha(0.6 + Math.sin(time / 150) * 0.25);
  }

  private followCamera(dt: number): void {
    const target = this.rescuing ? this.ship.y : this.wy(this.session?.rocket.y ?? 0);
    const want = Math.min(-(H - 130), target - H * 0.6);
    this.camY += (want - this.camY) * Math.min(1, dt * 4);
    this.cameras.main.setScroll(0, Math.round(this.camY));
    const alt = -(this.camY + H * 0.6);
    this.sky.setFillStyle(skyAt(Math.max(0, alt)));
    this.starsBg.setAlpha(Phaser.Math.Clamp((alt - 4300) / 1400, 0, 1));
    this.starsBg.tilePositionY = this.camY / (PX * 6);
  }

  // --- Interface ---------------------------------------------------------------------------------
  private buildHud(): void {
    const fixed = <T extends Phaser.GameObjects.GameObject & { setScrollFactor(x: number): T }>(o: T): T => o.setScrollFactor(0);
    // Panneau du calcul.
    this.qPanel = this.add.container(W / 2, 74).setScrollFactor(0).setDepth(60);
    for (const [g, look] of Object.entries(GRADE_LOOK)) this.tx(`f-qpanel-${g}`, () => A.gradePanel(104, 30, look.fill, look.edge));
    this.qBg = this.add.image(0, 0, 'f-qpanel-facile').setScale(PX);
    // Étiquette de difficulté, juste sous l'encadré.
    this.qTag = this.txt(0, 74, '', style(20, P.W, 5)).setOrigin(0.5);
    this.qText = this.num(0, -8, '');
    this.qBar = this.add.graphics();
    this.qPanel.add([this.qBg, this.qTag, this.qText, this.qBar]);
    this.qPanel.setVisible(false);
    fixed(this.txt(84, 14, 'Score', style(22, P.W, 5)).setDepth(60));
    this.scoreText = fixed(this.num(170, 30, '0', 3).setOrigin(0, 0.5).setDepth(60));
    this.comboLabel = fixed(this.txt(84, 58, '', style(20, P.Y, 5)).setDepth(60));
    this.comboText = fixed(this.num(150, 70, '', 3).setOrigin(0, 0.5).setDepth(60).setTint(tint(P.Y)));
    // Altimètre : la jauge des étages, la fusée qui grimpe, la planète Bonbon en haut.
    fixed(this.add.image(GAUGE_X, GAUGE_TOP, 'f-jauge').setOrigin(0).setDepth(59));
    this.altMarker = fixed(this.add.image(GAUGE_MID, GAUGE_Y[0], 'f-jauge-fusee').setOrigin(0.5, 1).setDepth(61));
    this.altText = fixed(this.num(GAUGE_MID, 604, '0m', 2));
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(60);
    // Son et pause.
    this.soundText = fixed(this.txt(W - 20, H - 12, '', style(18, P.W, 4)).setOrigin(1, 1).setDepth(60).setInteractive({ useHandCursor: true }));
    this.soundText.on('pointerdown', () => this.toggleSound());
    this.setMuted(this.sfx.muted);
    const pause = fixed(this.add.image(W - 40, 40, this.tx('f-pause', () => {
      const pc = A.frame(14, 14, P.N, P.B);
      pc.fill(4, 4, 2, 6, P.W);
      pc.fill(8, 4, 2, 6, P.W);
      return pc;
    })).setScale(PX).setDepth(60).setInteractive({ useHandCursor: true }));
    pause.on('pointerdown', () => this.pause());
    this.buildKeypad();
    this.buildArrows();
  }

  private buildKeypad(): void {
    const labels = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0'];
    this.tx('f-key', () => A.frame(16, 14, P.N, P.B));
    this.tx('f-key-on', () => A.frame(16, 14, P.Y, P.y));
    labels.forEach((label, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 1084 + col * 72;
      const y = 400 + row * 66;
      const c = this.add.container(x, y).setScrollFactor(0).setDepth(60);
      const bg = this.add.image(0, 0, 'f-key').setScale(PX);
      const t = label === '⌫' ? this.add.image(0, -2, this.tx('f-backspace', A.backspaceIcon)).setScale(PX) : this.num(0, -2, label, 3);
      c.add([bg, t]);
      c.setSize(64, 56).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        if (label === '⌫') this.onBackspace();
        else this.onDigit(label);
      });
      this.keys.set(label, c);
    });
  }

  private buildArrows(): void {
    for (const dir of [-1, 1] as const) {
      const img = this.add.image(dir < 0 ? 90 : 200, H - 70, this.tx(`f-arrow-${dir}-0`, () => A.arrow(dir, false))).setScale(PX).setScrollFactor(0).setDepth(60).setInteractive({ useHandCursor: true });
      this.tx(`f-arrow-${dir}-1`, () => A.arrow(dir, true));
      const set = (on: boolean) => {
        if (dir < 0) this.steerButtons.left = on;
        else this.steerButtons.right = on;
        img.setTexture(`f-arrow-${dir}-${on ? 1 : 0}`);
      };
      img.on('pointerdown', () => {
        this.sfx.unlock();
        set(true);
      });
      img.on('pointerup', () => set(false));
      img.on('pointerout', () => set(false));
      this.arrows.push(img);
    }
  }

  private flashKey(label: string): void {
    const c = this.keys.get(label);
    if (!c) return;
    const mark = c.list[1] as Phaser.GameObjects.BitmapText | Phaser.GameObjects.Image;
    (c.list[0] as Phaser.GameObjects.Image).setTexture('f-key-on');
    mark.setTint(tint(P.N));
    this.time.delayedCall(110, () => {
      (c.list[0] as Phaser.GameObjects.Image).setTexture('f-key');
      mark.clearTint();
    });
  }

  private refreshQuestion(): void {
    const s = this.session;
    const q = s?.question;
    if (!s || !q) return;
    const typed = s.typed;
    const need = String(q.expr.answer).length;
    const slot = typed + '_'.repeat(Math.max(0, need - typed.length));
    this.setCalc(`${q.expr.text} = ${typed ? slot : '?'}`);
    this.tintCalc(null);
  }

  private drawTimer(): void {
    const q = this.session?.question;
    this.qBar.clear();
    if (!q) return;
    const k = Phaser.Math.Clamp(q.left / q.time, 0, 1);
    const w = 352;
    const blocks = Math.ceil((w * k) / 8);
    // Barre neutre (les couleurs disent la difficulté) ; elle clignote quand le temps presse.
    const col = k > 0.3 || Math.floor(this.time.now / 160) % 2 ? 0xf4f4f4 : 0x566c86;
    this.qBar.fillStyle(0x1a1c2c, 1).fillRect(-w / 2 - 4, 28, w + 8, 16);
    this.qBar.fillStyle(col, 1);
    for (let i = 0; i < blocks; i++) this.qBar.fillRect(-w / 2 + i * 8, 32, 6, 8);
    // Tic-tac quand le temps presse.
    if (k < 0.3 && this.time.now - this.lastTick > 450) {
      this.lastTick = this.time.now;
      this.sfx.tick(k < 0.15);
      if (!this.reducedMotion) this.tweens.add({ targets: this.qPanel, x: { from: W / 2 - 4, to: W / 2 }, duration: 120 });
    }
  }

  private refreshHud(): void {
    const s = this.session;
    if (!s) return;
    this.scoreText.setText(String(s.score));
    this.comboLabel.setText(s.combo > 1 ? 'Série' : '');
    this.comboText.setText(s.combo > 1 ? `×${s.combo}` : '');
    this.hud.removeAll(true);
    let x = W - 110;
    let y = 40;
    if (s.lives !== null) {
      // Huit cœurs, qui se vident par moitiés ; les bonus passent sur la ligne du dessous.
      for (let i = 0; i < MAX_LIVES; i++) {
        const fill: A.HeartFill = s.lives >= i + 1 ? 'plein' : s.lives >= i + 0.5 ? 'demi' : 'vide';
        this.hud.add(this.add.image(x - i * 31, 40, this.tx(`f-heart-${fill}`, () => A.heartIcon(fill))).setScale(PX));
      }
      y = 88;
    }
    const icons: Array<[boolean, string, A.PowerLook, string]> = [
      [s.shield, 'bouclier', 'bouclier', ''],
      [s.turbo, 'turbo', 'turbo', ''],
      [s.slow > 0, 'sablier', 'sablier', `×${s.slow}`],
    ];
    for (const [on, , look, label] of icons) {
      if (!on) continue;
      this.hud.add(this.add.image(x, y, `f-pow-${look}`).setScale(3));
      if (label) this.hud.add(this.txt(x + 16, y + 6, label, style(16, P.W, 4)));
      x -= 50;
    }
  }

  private refreshAltimeter(): void {
    const s = this.session;
    const alt = s ? s.altitude : 0;
    // Interpolation par étage : chaque étage a sa bande sur la jauge.
    let y = GAUGE_Y[GAUGE_Y.length - 1];
    let prev = 0;
    for (let i = 0; i < ZONES.length; i++) {
      const top = ZONES[i].top;
      if (alt <= top) {
        y = GAUGE_Y[i] + ((Math.max(0, alt) - prev) / (top - prev)) * (GAUGE_Y[i + 1] - GAUGE_Y[i]);
        break;
      }
      prev = top;
    }
    this.altMarker.setY(y);
    this.altText.setText(`${Math.round(alt / 8)}m`);
  }

  private toggleSound(): void {
    this.sfx.unlock();
    this.setMuted(this.sfx.toggle());
  }

  private setMuted(m: boolean): void {
    this.soundText.setText(m ? 'Son : coupé (M)' : 'Son : activé (M)');
  }

  private setMusic(level: number | null): void {
    if (level === null) {
      this.sfx.music(false);
      return;
    }
    this.musicLevel = level;
    this.sfx.music(true, level, 'fusee');
  }

  private say(x: number, y: number, text: string, ms = 1100): void {
    const t = this.txt(x, y, text, { ...style(18, P.K), backgroundColor: P.X, padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(40);
    t.x = Phaser.Math.Clamp(t.x, Math.max(120, t.width / 2 + 8), W - 290);
    if (!this.reducedMotion) this.tweens.add({ targets: t, y: y - 10, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 250, onComplete: () => t.destroy() });
  }

  private floatText(x: number, y: number, text: string, color: string, size = 28): void {
    const t = NUMBER_RE.test(text) ? this.num(x, y, text, 3).setTint(tint(color)).setDepth(41) : this.txt(x, y, text, style(size, color, 6)).setOrigin(0.5).setDepth(41);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 1000, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private banner(text: string, color: string, hold = 1600): void {
    const t = this.txt(W / 2 - 60, H / 2 - 60, text, style(48, color, 8)).setOrigin(0.5).setScrollFactor(0).setDepth(70).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: H / 2 - 80, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: hold, duration: 400, onComplete: () => t.destroy() });
  }

  // --- Entrées -----------------------------------------------------------------------------------
  private bindInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.steerKeys = kb.addKeys('LEFT,RIGHT,Q,A,D') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown', (e: KeyboardEvent) => {
      // Chiffres : rangée du haut (sans Maj, quelle que soit la disposition) ou pavé numérique.
      const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
      if (m) {
        this.onDigit(m[1]);
        return;
      }
      if (e.key === 'Backspace') this.onBackspace();
      if (e.key === 'm' || e.key === 'M') this.toggleSound();
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.paused) this.resume();
        else this.pause();
        return;
      }
      if (this.overlay && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        this.overlayFocus = (this.overlayFocus + 1) % Math.max(1, this.overlayButtons.length);
        this.refreshOverlayFocus();
      }
      if (this.overlay && (e.key === 'Enter' || e.key === ' ')) {
        this.sfx.unlock();
        this.overlayButtons[this.overlayFocus]?.run();
      }
    });
  }

  private steer(): -1 | 0 | 1 {
    if (this.steerOverride !== null) return this.steerOverride;
    const k = this.steerKeys;
    const left = this.steerButtons.left || k.LEFT?.isDown || k.Q?.isDown || k.A?.isDown;
    const right = this.steerButtons.right || k.RIGHT?.isDown || k.D?.isDown;
    return left && !right ? -1 : right && !left ? 1 : 0;
  }

  private isPlaying(): boolean {
    return !!this.session && this.session.phase === 'play' && !this.overlay && !this.ending && !this.paused;
  }

  private onDigit(d: string): void {
    const s = this.session;
    if (!this.isPlaying() || !s || this.rescuing) return;
    this.sfx.unlock();
    this.flashKey(d);
    if (!s.question) return;
    const q = s.question;
    this.sfx.key(Number(d));
    const r = s.input(d);
    if (r.kind === 'pending') {
      this.refreshQuestion();
      return;
    }
    if (r.kind === 'wrong') {
      this.sfx.buzz();
      this.setFace('peur', 700);
      // On montre la bonne réponse : on apprend aussi en se trompant.
      this.setCalc(`${q.expr.text} = ${r.expected}`);
      this.tintCalc(P.r);
      this.qBar.clear();
      if (!this.reducedMotion) this.tweens.add({ targets: this.qPanel, x: { from: W / 2 - 12, to: W / 2 }, duration: 400, ease: 'Elastic.easeOut' });
      this.loseHeart(r.lifeLost);
      return;
    }
    // Bonne réponse : poussée !
    this.setCalc(`${q.expr.text} = ${q.expr.answer}`);
    this.tintCalc(P.L);
    this.qBar.clear();
    if (!this.reducedMotion) this.tweens.add({ targets: this.qPanel, scale: { from: 1.08, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    this.sfx.thrust(r.turbo);
    this.thrustUntil = this.time.now + 520;
    this.turboFlame = r.turbo;
    this.setFace('joie', 700);
    this.floatText(this.ship.x + 70, this.ship.y - 80, `+${r.points}`, P.Y, 26);
    this.burst(this.ship.x, this.ship.y - 40, [P.Y, P.W, P.L], 8);
    if (r.turbo) this.floatText(this.ship.x, this.ship.y - 130, 'TURBO !', P.C, 34);
    if (s.combo > 0 && s.combo % 5 === 0) {
      this.sfx.feverOn();
      this.floatText(this.ship.x, this.ship.y - 160, `Série de ${s.combo} !`, P.p, 32);
    }
    if (!this.reducedMotion) for (let i = 0; i < 4; i++) this.puff(this.ship.x + Phaser.Math.Between(-20, 20), this.ship.y + Phaser.Math.Between(0, 20), true);
    this.refreshHud();
  }

  /** Calcul raté en Défi : « -½ ♥ » ou « -1 ♥ » au-dessus de la fusée, défaite s'il n'en reste plus. */
  private loseHeart(lost: number): void {
    this.refreshHud();
    if (lost > 0) this.floatText(this.ship.x - 70, this.ship.y - 90, lost < 1 ? '-½ ♥' : '-1 ♥', P.r, 28);
    if (this.session?.phase === 'lost') this.time.delayedCall(700, () => this.defeat());
  }

  private onBackspace(): void {
    this.flashKey('⌫');
    this.session?.backspace();
    this.refreshQuestion();
  }

  // --- Boucle ------------------------------------------------------------------------------------
  update(time: number, delta: number): void {
    if (this.paused) return;
    const dt = Math.min(0.05, delta / 1000);
    if (this.blades && !this.reducedMotion) this.blades.angle += dt * 60;
    this.animateWorld(time);
    this.placeShip(time);
    this.followCamera(dt);
    this.refreshAltimeter();
    const s = this.session;
    if (!s || !this.isPlaying() || this.rescuing) return;
    const events = s.step(dt * this.speedBoost, this.steer());
    for (const ev of events) this.onEvent(ev);
    this.drawTimer();
  }

  private animateWorld(time: number): void {
    const s = this.session;
    const frame = Math.floor(time / 70) % 4;
    for (const v of this.views.values()) {
      const p = v.p;
      if (p.gone) continue;
      v.img.x = p.x;
      // Les plateformes qui ont un visage gardent l'air surpris tant que la fusée est dessus.
      if (p.art && `f-${p.art}-1` in PROVIDED) {
        const key = `f-${p.art}-${s?.rocket.on === p.id ? 1 : 0}`;
        if (v.img.texture.key !== key) v.img.setTexture(key);
      }
      for (const e of v.extras) {
        const img = e as Phaser.GameObjects.Image;
        img.x = p.x;
        if (img.texture.key.startsWith('f-prop')) img.setTexture(`f-prop-${frame}`);
      }
      if (v.power) v.power.x = p.x;
      if (v.friend) {
        v.friend.x = p.x + (v.friend.getData('dx') as number);
        // L'habitant reste réveillé (joyeux) tant que la fusée est sur sa plateforme.
        const key = `f-${v.friend.getData('look') as string}-${s?.rocket.on === p.id ? 1 : 0}`;
        if (v.friend.texture.key !== key && this.textures.exists(key)) v.friend.setTexture(key);
      }
    }
    const sf = Math.floor(time / 250) % 2;
    for (const [id, img] of this.starViews) {
      const st = s?.stars.find((x) => x.id === id);
      if (st?.taken) continue;
      img.setTexture(`f-star-${sf}`);
    }
    // Le cerf-volant tire sur sa ficelle.
    if (this.kite) {
      this.kite.x = 1120 + Math.sin(time / 900) * 30;
      this.kite.y = this.wy(520) + Math.cos(time / 700) * 14;
      this.kiteLine.clear().lineStyle(2, 0x1a1c2c, 0.7);
      const c = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(this.kite.x, this.kite.y + 16), new Phaser.Math.Vector2(this.kite.x - 60, this.wy(200)), new Phaser.Math.Vector2(930, this.wy(0) - 30));
      c.draw(this.kiteLine, 24);
    }
  }

  private onEvent(ev: RocketEvent): void {
    const s = this.session!;
    switch (ev.type) {
      case 'question': {
        const look = GRADE_LOOK[ev.q.grade];
        this.qBg.setTexture(`f-qpanel-${ev.q.grade}`);
        this.qTag.setText(look.label).setColor(look.text);
        this.qPanel.setVisible(true);
        this.qPanel.setScale(1).setX(W / 2);
        this.refreshQuestion();
        if (!this.reducedMotion) this.tweens.add({ targets: this.qPanel, scaleY: { from: 0.3, to: 1 }, duration: 180, ease: 'Back.easeOut' });
        break;
      }
      case 'timeout':
        this.sfx.timeout();
        this.setCalc(`${ev.q.expr.text} = ${ev.q.expr.answer}`);
        this.tintCalc(P.g);
        this.qBar.clear();
        this.loseHeart(ev.lifeLost);
        break;
      case 'land': {
        const v = this.views.get(ev.platform.id);
        this.sfx.land(ev.hard);
        for (let i = 0; i < (ev.hard ? 6 : 3); i++) this.puff(this.ship.x + Phaser.Math.Between(-30, 30), this.ship.y - 4, ev.hard);
        if (ev.hard) {
          this.setFace('peur', 900);
          if (!this.reducedMotion) this.cameras.main.shake(220, 0.008);
          this.floatText(this.ship.x, this.ship.y - 110, ev.lifeLost ? 'Ouille ! -1 ♥' : 'Ouille !', P.r, 30);
          if (s.phase === 'lost') this.time.delayedCall(800, () => this.defeat());
        } else if (!this.reducedMotion && v) {
          this.tweens.add({ targets: v.img, y: v.img.y + 6, duration: 90, yoyo: true });
        }
        if (ev.record) this.floatText(this.ship.x + 60, this.ship.y - 60, '+50', P.L, 22);
        if (v?.friend) {
          const kind = v.friend.getData('kind') as string;
          const look = v.friend.getData('look') as string;
          v.friend.setTexture(this.tx(`f-${look}-1`, () => A.friend(kind as A.FriendLook, 1)));
          this.say(v.friend.x, v.friend.y - 70, Phaser.Utils.Array.GetRandom(FRIEND_LINES[kind] ?? ['Salut !']));
          if (kind === 'vache') this.sfx.moo();
          else if (kind === 'oiseau') this.sfx.chirp();
          else if (kind === 'robot' || kind === 'alien') this.sfx.robotBeep();
          else this.sfx.yay();
        }
        this.refreshHud();
        break;
      }
      case 'power': {
        const v = this.views.get(ev.platform.id);
        if (v?.power) {
          const icon = v.power;
          v.power = null;
          this.tweens.killTweensOf(icon);
          this.tweens.add({ targets: icon, y: icon.y - 60, scale: PX * 1.6, alpha: 0, duration: 500, onComplete: () => icon.destroy() });
        }
        this.sfx.powerUp();
        this.burst(this.ship.x, this.ship.y - 60, [P.Y, P.C, P.p, P.W], 14);
        const label: Record<string, string> = { bouclier: 'Bouclier !', sablier: 'Plus de temps !', turbo: 'Turbo prêt !', etoile: '+200', coeur: s.lives !== null ? '+1 ♥' : '+100' };
        this.floatText(this.ship.x, this.ship.y - 140, label[ev.kind], P.C, 32);
        this.setFace('joie', 900);
        this.refreshHud();
        break;
      }
      case 'star': {
        const img = this.starViews.get(ev.star.id);
        if (img) this.collectStar(img, ev.star);
        break;
      }
      case 'crumble': {
        const v = this.views.get(ev.platform.id);
        this.sfx.crumble();
        if (v) {
          const objs = [v.img, ...v.extras, ...(v.friend ? [v.friend] : [])] as Phaser.GameObjects.Image[];
          for (const o of objs) if (o.getData('y0') === undefined) o.setData('y0', o.y);
          const pouf = 'f-nuage-pouf' in PROVIDED && ev.platform.art?.startsWith('nuage');
          this.tweens.add({ targets: pouf ? objs.slice(1) : objs, y: '+=260', alpha: 0, angle: 12, duration: 900, ease: 'Quad.easeIn' });
          if (pouf) {
            // Le nuage fissuré éclate : « POUF ! »
            v.img.setAlpha(0);
            const img = this.add.image(v.img.x, v.img.y, 'f-nuage-pouf').setDepth(6);
            this.tweens.add({ targets: img, y: img.y - 30, alpha: 0, duration: 900, delay: 300, onComplete: () => img.destroy() });
          }
          for (let i = 0; i < 6; i++) this.puff(v.img.x + Phaser.Math.Between(-v.img.displayWidth / 2, v.img.displayWidth / 2), v.img.y + 10);
        }
        break;
      }
      case 'regrow': {
        // La plateforme fragile se reforme dans un nuage d'étincelles.
        const v = this.views.get(ev.platform.id);
        if (v) {
          const objs = [v.img, ...v.extras, ...(v.friend ? [v.friend] : [])] as Phaser.GameObjects.Image[];
          this.tweens.killTweensOf(objs);
          for (const o of objs) o.setAngle(0).setY(o.getData('y0') as number);
          this.tweens.add({ targets: objs, alpha: { from: 0, to: 1 }, duration: 500 });
          this.burst(v.img.x, v.img.y + 10, [P.W, P.C, P.Y], 8);
        }
        break;
      }
      case 'fall':
        this.rescue(ev.lifeLost, ev.shieldUsed, ev.to);
        break;
      case 'zone':
        this.sfx.fanfare();
        this.banner(ZONES[ev.zone].name, ev.zone >= 3 ? P.C : P.Y);
        this.setMusic(ev.zone >= 3 ? 2 : ev.zone >= 2 ? 1 : 0);
        break;
      case 'won':
        this.celebrate();
        break;
      case 'lost':
        if (!this.rescuing) this.time.delayedCall(600, () => this.defeat());
        break;
    }
  }

  private collectStar(img: Phaser.GameObjects.Image, _st: Star): void {
    this.sfx.coinTick(this.session?.stats.stars ?? 0);
    this.burst(img.x, img.y, [P.Y, P.W], 5);
    this.tweens.add({ targets: img, y: img.y - 40, alpha: 0, scale: PX * 1.6, duration: 350, onComplete: () => img.destroy() });
    this.starViews.delete(_st.id);
  }

  /**
   * Chute : la fusée tombe hors de l'écran, puis l'oiseau de secours la ramène
   * sur sa dernière plateforme (le bouclier, lui, la fait rebondir en bulle).
   */
  private rescue(lifeLost: boolean, shieldUsed: boolean, to: Platform): void {
    this.rescuing = true;
    this.qPanel.setVisible(false);
    this.sfx.whistle();
    this.setFace('peur', 1500);
    const fromX = this.ship.x;
    const fromY = this.ship.y;
    const toY = this.wy(to.y);
    // La montgolfière de secours descend, accroche la fusée au bout d'une corde.
    const bird = this.sprite(fromX, fromY - 400, 'f-balloon', A.hotAirBalloon).setDepth(11);
    const rope = this.add.graphics().setDepth(10.5);
    const flap = this.time.addEvent({ delay: 16, loop: true, callback: () => {
      rope.clear().lineStyle(4, 0x1a1c2c, 1).lineBetween(bird.x, bird.y + 50, this.ship.x, this.ship.y - 88);
    } });
    this.time.delayedCall(500, () => {
      this.sfx.rescue();
      this.say(fromX, fromY - 140, shieldUsed ? 'Le bouclier te protège !' : lifeLost ? 'Je te ramène ! (-1 ♥)' : 'Je te ramène !', 1400);
    });
    this.tweens.add({
      targets: bird,
      y: fromY - 180,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: [bird, this.ship],
          x: to.x,
          y: (target: unknown) => (target === bird ? toY - 230 : toY),
          duration: 1300,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            rope.clear();
            flap.paused = true;
            this.tweens.add({ targets: bird, y: bird.y - 500, x: bird.x + 300, duration: 1600, onComplete: () => {
              flap.remove();
              rope.destroy();
              bird.destroy();
            } });
            this.rescuing = false;
            this.setFace('ouf', 1200);
            this.refreshHud();
            if (this.session?.phase === 'lost') this.defeat();
          },
        });
      },
    });
  }

  // --- Pause, fin --------------------------------------------------------------------------------
  private pause(): void {
    if (this.paused || this.overlay || this.ending || !this.session) return;
    this.paused = true;
    this.tweens.pauseAll();
    this.time.paused = true;
    this.sfx.music(false);
    const c = this.openOverlay(150, 72);
    c.add(this.txt(W / 2, H / 2 - 70, 'Pause', style(56, P.Y, 8)).setOrigin(0.5));
    c.add(this.txt(W / 2, H / 2 - 14, 'La fusée flotte en apesanteur…', style(24, P.W)).setOrigin(0.5));
    this.addOverlayButton(W / 2 - 130, H / 2 + 60, 'Accueil', false, () => {
      window.location.href = '../index.html';
    });
    this.addOverlayButton(W / 2 + 130, H / 2 + 60, 'Reprendre', true, () => this.resume());
    this.overlayFocus = 1;
    this.refreshOverlayFocus();
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.overlay?.destroy(true);
    this.overlay = null;
    this.overlayButtons = [];
    this.tweens.resumeAll();
    this.time.paused = false;
    this.setMusic(this.musicLevel);
  }

  private celebrate(): void {
    this.ending = true;
    this.setMusic(null);
    this.qPanel.setVisible(false);
    this.sfx.victoryJingle();
    this.setFace('joie', 6000);
    this.banner('Bienvenue sur la planète Bonbon !', P.p, 3200);
    // Feu d'artifice pixel et oursons qui sautent de joie.
    for (let i = 0; i < (this.reducedMotion ? 3 : 12); i++) {
      this.time.delayedCall(200 + i * 300, () => {
        const x = Phaser.Math.Between(150, 1000);
        const y = this.cameras.main.scrollY + Phaser.Math.Between(120, 320);
        this.burst(x, y, [[P.p, P.Y, P.W], [P.C, P.L, P.W], [P.M, P.r, P.Y]][i % 3], 22);
        this.sfx.firework(0);
      });
    }
    for (const d of this.dancers) {
      if (!d.texture.key.includes('ourson')) continue;
      if (!this.reducedMotion) this.tweens.add({ targets: d, y: d.y - 40, duration: 260, yoyo: true, repeat: 8, delay: Phaser.Math.Between(0, 300), ease: 'Quad.easeOut' });
    }
    this.time.delayedCall(4600, () => this.showEnd(true));
  }

  private defeat(): void {
    if (this.ending) return;
    this.ending = true;
    this.setMusic(null);
    this.qPanel.setVisible(false);
    this.sfx.defeat();
    this.banner('Plus de cœurs… la fusée rentre au garage', P.r, 2400);
    this.time.delayedCall(2800, () => this.showEnd(false));
  }

  private records(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(RECORD_KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  private makeButton(x: number, y: number, label: string, primary: boolean, run: () => void): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setScrollFactor(0).setDepth(101);
    c.add(this.add.image(0, 0, this.tx(`f-btn-${primary ? 1 : 0}`, () => (primary ? A.frame(56, 15, P.Y, P.y) : A.frame(56, 15, P.h, P.g)))).setScale(PX));
    c.add(this.txt(0, -4, label, style(28, primary ? P.K : P.W)).setOrigin(0.5));
    c.setSize(228, 60).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.sfx.unlock();
      run();
    });
    return c;
  }

  private openOverlay(wArt: number, hArt: number, veil = 0.55): Phaser.GameObjects.Container {
    this.overlay?.destroy(true);
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x1a1c2c, veil).setInteractive());
    c.add(this.add.image(W / 2, H / 2, this.tx(`f-dialog-${wArt}-${hArt}`, () => A.frame(wArt, hArt, P.N, P.B))).setScale(PX));
    this.overlay = c;
    this.overlayButtons = [];
    this.overlayFocus = 0;
    return c;
  }

  private addOverlayButton(x: number, y: number, label: string, primary: boolean, run: () => void): void {
    const b = this.makeButton(x, y, label, primary, run);
    this.overlay?.add(b);
    this.overlayButtons.push({ c: b, run });
    this.refreshOverlayFocus();
  }

  private refreshOverlayFocus(): void {
    this.overlayButtons.forEach((b, i) => b.c.setScale(i === this.overlayFocus ? 1.06 : 1));
  }

  private showIntro(): void {
    const c = this.openOverlay(178, 136);
    const top = H / 2 - 272;
    c.add(this.txt(W / 2, top + 64, 'Décollage !', style(64, P.Y, 10)).setOrigin(0.5));
    c.add(this.txt(W / 2, top + 140, [
      'Chaque bonne réponse fait décoller la fusée.',
      'Entre deux calculs, pilote-la pour te poser sur une plateforme !',
    ].join('\n'), { ...style(24, P.W), align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    const ex = this.add.container(W / 2, top + 236);
    ex.add(this.num(-150, 0, '9 + 9 = 18', 3).setTint(tint(P.L)));
    ex.add(this.txt(30, 0, '→', style(36, P.W, 6)).setOrigin(0.5));
    ex.add(this.add.image(90, 20, 'f-rocket-joie').setOrigin(0.5, 1).setScale(this.px('f-rocket-joie') * 0.8));
    ex.add(this.add.image(90, 22, 'f-flame-1-0').setOrigin(0.5, 0).setScale(this.px('f-flame-1-0') * 0.8));
    c.add(ex);
    c.add(this.txt(W / 2, top + 330, `Chiffres : clavier ou pavé  ·  Pilote : ← → (ou Q D)  ·  Niveau ${this.tier.label}`, style(18, P.C)).setOrigin(0.5));
    // Les trois couleurs de calculs, chacune écrite dans sa couleur.
    const legend = (['facile', 'moyen', 'difficile'] as const).map((g) => this.txt(0, top + 362, GRADE_LOOK[g].label, style(18, GRADE_LOOK[g].text, 4)).setOrigin(0, 0.5));
    const tail = this.txt(0, top + 362, ': plus c’est dur, plus ça rapporte', style(18, P.g)).setOrigin(0, 0.5);
    const row = [...legend, tail];
    let lx = W / 2 - (row.reduce((a, t) => a + t.width, 0) + 14 * (row.length - 1)) / 2;
    for (const t of row) {
      t.setX(lx);
      lx += t.width + 14;
      c.add(t);
    }
    this.addOverlayButton(W / 2 - 140, top + 440, 'Tranquille', false, () => this.startGame('tranquille'));
    this.addOverlayButton(W / 2 + 140, top + 440, 'Défi', true, () => this.startGame('defi'));
    c.add(this.txt(W / 2 - 140, top + 486, 'plus de temps,\nrien à perdre', { ...style(16, P.g), align: 'center' }).setOrigin(0.5));
    c.add(this.txt(W / 2 + 140, top + 486, '8 cœurs : un raté\ncoûte ½ ♥, 1 ♥ si vert', { ...style(16, P.g), align: 'center' }).setOrigin(0.5));
    this.overlayFocus = 1;
    this.refreshOverlayFocus();
  }

  /** Étoiles : 1 pour la planète, 1 pour 85 % de calculs justes, 1 pour 95 % sans chute. */
  private starsFor(won: boolean): number {
    const s = this.session;
    if (!s || !won) return 0;
    let n = 1;
    if (s.accuracy() >= 0.85) n++;
    if (s.accuracy() >= 0.95 && s.stats.falls === 0) n++;
    return n;
  }

  private showEnd(won: boolean): void {
    const s = this.session;
    if (!s) return;
    const key = `${this.tier.id}-${s.mode}`;
    const rec = this.records();
    const best = rec[key] ?? 0;
    const isRecord = s.score > best;
    if (isRecord) {
      rec[key] = s.score;
      try {
        localStorage.setItem(RECORD_KEY, JSON.stringify(rec));
      } catch {
        /* stockage indisponible */
      }
    }
    const c = this.openOverlay(178, 150, won ? 0.5 : 0.4);
    const top = H / 2 - 300;
    c.add(this.txt(W / 2, top + 58, won ? 'Planète Bonbon atteinte !' : `Altitude ${Math.round(s.best / 8)} m`, style(48, won ? P.p : P.Y, 8)).setOrigin(0.5));
    const stars = this.starsFor(won);
    for (let i = 0; i < 3; i++) {
      const st = this.add.image(W / 2 + (i - 1) * 80, top + 128, this.tx('f-bigstar-0', () => A.power('etoile').swap({ [P.Y]: P.h, [P.y]: P.g }))).setScale(PX * 1.3);
      c.add(st);
      if (i < stars) {
        this.time.delayedCall(350 + i * 380, () => {
          st.setTexture(this.tx('f-bigstar-1', () => A.power('etoile')));
          this.sfx.star(i);
          this.burst(st.x, st.y, [P.Y, P.W], 10);
          if (!this.reducedMotion) this.tweens.add({ targets: st, scale: { from: PX * 2.4, to: PX * 1.3 }, duration: 300, ease: 'Back.easeOut' });
        });
      }
    }
    c.add(this.txt(W / 2 - 20, top + 192, 'Score', style(32, P.W, 6)).setOrigin(1, 0.5));
    c.add(this.num(W / 2, top + 194, String(s.score), 3).setOrigin(0, 0.5));
    c.add(this.txt(W / 2, top + 228, isRecord ? 'Nouveau record !' : `Record : ${best}`, style(20, isRecord ? P.Y : P.g)).setOrigin(0.5));
    const lines: Array<[string, string]> = [
      ['Plus haute altitude', `${Math.round(s.best / 8)}m`],
      ['Calculs justes', `${s.stats.correct} (${Math.round(s.accuracy() * 100)} %)`],
      ['Meilleure série', `${s.stats.bestCombo}`],
      ['Étoiles attrapées', `${s.stats.stars}`],
      ['Chutes rattrapées', `${s.stats.falls}`],
    ];
    lines.forEach(([label, value], i) => {
      const y = top + 274 + i * 34;
      c.add(this.txt(W / 2 - 250, y, label, style(22, P.w)).setOrigin(0, 0.5));
      c.add(NUMBER_RE.test(value) ? this.num(W / 2 + 250, y, value, 2).setOrigin(1, 0.5) : this.txt(W / 2 + 250, y, value, style(22, P.W)).setOrigin(1, 0.5));
    });
    const status = this.txt(W / 2, top + 456, 'Enregistrement…', style(18, P.C)).setOrigin(0.5);
    c.add(status);
    void reportResult({
      jeu: 'fusee',
      niveau: this.tier.id,
      mode: s.mode,
      score: s.score,
      gagne: won,
      etoiles: stars,
      duree: (Date.now() - this.startedAt) / 1000,
      precision: s.accuracy(),
      ops: s.stats.byOp,
      details: { altitude: Math.round(s.best / 8), justes: s.stats.correct, serie: s.stats.bestCombo, etoiles: s.stats.stars, chutes: s.stats.falls },
    }).then((o) => status.active && status.setText(outcomeText(o)));
    this.addOverlayButton(W / 2 - 130, top + 520, 'Accueil', false, () => {
      window.location.href = '../index.html';
    });
    this.addOverlayButton(W / 2 + 130, top + 520, 'Rejouer', true, () => this.showIntro());
    this.overlayFocus = 1;
    this.refreshOverlayFocus();
  }

  private startGame(mode: Mode): void {
    pleinEcranAuDemarrage();
    this.overlay?.destroy(true);
    this.overlay = null;
    this.overlayButtons = [];
    this.paused = false;
    this.time.paused = false;
    this.tweens.resumeAll();
    this.ending = false;
    this.rescuing = false;
    this.seed = (this.seed * 7919 + 13) % 1e9;
    this.session = new RocketSession(this.tier.id, this.seed, mode);
    this.newWorld();
    this.startedAt = Date.now();
    this.thrustUntil = 0;
    this.camY = -(H - 130);
    this.ship.setPosition(640, 0).setAngle(0);
    this.qPanel.setVisible(false);
    this.refreshHud();
    this.setMusic(0);
    this.banner(ZONES[0].name, P.Y, 1200);
    // Les enfants du village saluent le départ.
    for (const d of this.dancers) if (d.texture.key.includes('enfant') && !this.reducedMotion) this.tweens.add({ targets: d, y: d.y - 12, duration: 200, yoyo: true, repeat: 5 });
  }
}

function noLigature(text: string): string {
  return text.replace(/f(?=[il])/g, 'f\u200c');
}
