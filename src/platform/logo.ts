/**
 * Logo animé de Calcoolos : un mot-personnage. Les deux « o » du milieu sont des yeux ; le logo calcule de tête.
 *
 * - Immobile, c'est un mot « autocollant » (lettres safran cerclées d'encre) dont les yeux regardent le visiteur.
 * - Grand (accueil) : à l'arrivée, les lettres tombent en place, les yeux s'ouvrent, puis le logo lève les yeux
 *   vers une bulle de pensée où apparaît un calcul du niveau choisi ; il réfléchit, trouve, et ses yeux sourient.
 *   Ensuite il reste calme : un clin d'œil de temps en temps, et une nouvelle pensée seulement au clic (ou très
 *   rarement, quand la page est visible).
 * - Barre : le même mot en petit ; les yeux suivent le pointeur et font un clin d'œil au survol.
 * Animations réduites (système ou ?calme) : rien ne bouge, le logo est complet tel quel.
 * Tout est en DOM et CSS (aucune image). Le nom lisible est fourni par un texte masqué.
 */
import { BRAND } from '../brand';
import { pickExpression } from '../core/expressions';
import { createRng } from '../core/rng';
import type { TierId } from '../core/difficulty';

export type LogoTaille = 'grand' | 'barre';

export interface LogoOptions {
  /** Niveau dont on tire les calculs de la bulle de pensée (grand logo). */
  niveau?: () => TierId | null;
}

/** Inclinaisons fixes des lettres : une ligne de base qui sautille légèrement, sans hasard. */
const PENTES = [-3, 2, -2, 3, 0, 0, -2, 2, -3];

const calme = (): boolean =>
  new URLSearchParams(window.location.search).has('calme') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

interface Perso {
  racine: HTMLElement;
  yeux: HTMLElement[];
  pupilles: HTMLElement[];
  /** Pendant une scène (pensée, arrivée), le pointeur ne commande plus le regard. */
  occupe: boolean;
}

const vivants = new Set<Perso>();
let ecoute = false;

/** Regard en fractions du rayon de l'œil (-1 à 1). */
function viser(y: Perso, dx: number, dy: number): void {
  for (const p of y.pupilles) {
    p.style.setProperty('--rx', dx.toFixed(3));
    p.style.setProperty('--ry', dy.toFixed(3));
  }
}

/** Fait regarder un point de l'écran (coordonnées client) ; null = droit devant. */
function regarder(y: Perso, x: number | null, yy: number | null): void {
  for (let i = 0; i < y.yeux.length; i++) {
    const r = y.yeux[i].getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (x !== null && yy !== null && r.width > 0) {
      const ax = x - (r.left + r.width / 2);
      const ay = yy - (r.top + r.height / 2);
      const d = Math.hypot(ax, ay) || 1;
      // Plus le point est loin, plus la pupille va vers le bord.
      const k = Math.min(1, d / (r.width * 3));
      dx = (ax / d) * k;
      dy = (ay / d) * k;
    }
    y.pupilles[i].style.setProperty('--rx', dx.toFixed(3));
    y.pupilles[i].style.setProperty('--ry', dy.toFixed(3));
  }
}

function ecouterPointeur(): void {
  if (ecoute) return;
  ecoute = true;
  let px: number | null = null;
  let py: number | null = null;
  let prevu = false;
  const maj = () => {
    prevu = false;
    for (const y of vivants) if (!y.occupe && y.racine.isConnected) regarder(y, px, py);
  };
  const suivre = (x: number | null, yy: number | null) => {
    px = x;
    py = yy;
    if (!prevu) {
      prevu = true;
      requestAnimationFrame(maj);
    }
  };
  window.addEventListener('pointermove', (e) => suivre(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerdown', (e) => suivre(e.clientX, e.clientY), { passive: true });
  document.documentElement.addEventListener('pointerleave', () => suivre(null, null));
  window.addEventListener('blur', () => suivre(null, null));
}

function cligner(y: Perso, seul?: number): void {
  for (const [i, o] of y.yeux.entries()) {
    if (seul !== undefined && i !== seul) continue;
    o.classList.remove('cligne');
    void o.offsetWidth;
    o.classList.add('cligne');
  }
}

/** Clignements espacés au hasard (3 à 7 s), seulement quand la page est visible. */
function clignerParfois(y: Perso): void {
  const suite = () => {
    window.setTimeout(() => {
      if (!y.racine.isConnected) return;
      if (!document.hidden && !y.occupe) cligner(y);
      suite();
    }, 3000 + Math.random() * 4000);
  };
  suite();
}

/** Inclinaison de repos d'une lettre (portée par ses deux couches, voir logo.css). */
function poser(el: HTMLElement, deg: number): void {
  el.style.setProperty('--pente', `${deg}deg`);
}

/** L'inclinaison de repos est portée par les deux couches de la lettre ; on n'anime que le déplacement. */
function sautiller(el: HTMLElement, hauteur: number): Animation {
  return el.animate(
    [
      { transform: 'none' },
      { transform: `translateY(-${hauteur}em) rotate(-4deg)`, offset: 0.35 },
      { transform: 'translateY(0.02em) scale(1.04, 0.96)', offset: 0.7 },
      { transform: 'none' },
    ],
    { duration: 520, easing: 'cubic-bezier(.3,.7,.3,1)' },
  );
}

// --- La bulle de pensée -------------------------------------------------------------------------

interface Bulle {
  boite: HTMLElement;
  texte: HTMLElement;
  points: HTMLElement[];
  etincelles: HTMLElement[];
}

function creerBulle(): Bulle {
  const boite = document.createElement('span');
  boite.className = 'pensee';
  const points = [1, 2].map((n) => {
    const p = document.createElement('span');
    p.className = `pensee-point pensee-point-${n}`;
    return p;
  });
  const nuage = document.createElement('span');
  nuage.className = 'pensee-nuage';
  const texte = document.createElement('span');
  texte.className = 'pensee-texte';
  nuage.append(texte);
  const etincelles = [1, 2, 3].map((n) => {
    const e = document.createElement('span');
    e.className = `etincelle etincelle-${n}`;
    return e;
  });
  boite.append(...points, nuage, ...etincelles);
  return { boite, texte, points, etincelles };
}

const DOUX = 'cubic-bezier(.3,1.4,.5,1)';

/**
 * Une pensée : la bulle se gonfle avec un calcul, les yeux réfléchissent (regard en l'air, de gauche à droite),
 * la réponse apparaît, les yeux sourient, puis la bulle s'efface.
 */
async function penser(y: Perso, b: Bulle, niveau: TierId, courte = false): Promise<void> {
  if (y.occupe) return;
  y.occupe = true;
  const e = pickExpression(niveau, createRng(Date.now() & 0xffffffff));
  b.texte.textContent = e.text;
  b.boite.classList.remove('trouve');
  b.boite.classList.add('visible');

  // Les yeux montent vers la bulle, puis la bulle naît : petits points, puis le nuage.
  viser(y, 0.55, -0.75);
  for (const [i, p] of b.points.entries()) {
    p.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 260, delay: i * 110, easing: DOUX, fill: 'both' });
  }
  const nuage = b.texte.parentElement!;
  await nuage.animate(
    [{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
    { duration: 420, delay: 200, easing: DOUX, fill: 'both' },
  ).finished.catch(() => undefined);

  // Réflexion : le regard parcourt le calcul.
  const lecture: Array<[number, number, number]> = courte
    ? [[0.15, -0.8, 380], [0.75, -0.6, 380]]
    : [[0.1, -0.85, 420], [0.8, -0.6, 420], [0.35, -0.9, 380]];
  for (const [dx, dy, ms] of lecture) {
    viser(y, dx, dy);
    await sleep(ms);
  }

  // Trouvé : la réponse remplace le calcul, les yeux sourient, trois étincelles.
  b.texte.textContent = `${e.text} = ${e.answer}`;
  b.boite.classList.add('trouve');
  nuage.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 360, easing: DOUX });
  for (const [i, s] of b.etincelles.entries()) {
    s.animate(
      [
        { transform: 'scale(0) rotate(0deg)', opacity: 1 },
        { transform: 'scale(1) rotate(90deg)', opacity: 1, offset: 0.4 },
        { transform: 'scale(0.4) rotate(180deg)', opacity: 0 },
      ],
      { duration: 700, delay: i * 70, easing: 'ease-out', fill: 'both' },
    );
  }
  viser(y, 0, 0);
  for (const o of y.yeux) o.classList.add('content');
  await sleep(courte ? 1100 : 1400);
  for (const o of y.yeux) o.classList.remove('content');

  // La bulle s'efface (le nuage d'abord, puis les points).
  await nuage.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.6)', opacity: 0 }], {
    duration: 260,
    easing: 'ease-in',
    fill: 'both',
  }).finished.catch(() => undefined);
  for (const p of b.points) p.animate([{ transform: 'scale(1)' }, { transform: 'scale(0)' }], { duration: 180, easing: 'ease-in', fill: 'both' });
  await sleep(200);
  b.boite.classList.remove('visible', 'trouve');
  y.occupe = false;
}

/** Arrivée sur le site : les lettres tombent en place, les yeux s'ouvrent et regardent autour d'eux. */
async function arrivee(y: Perso, lettres: HTMLElement[]): Promise<void> {
  y.occupe = true;
  for (const o of y.yeux) o.classList.add('ferme');
  viser(y, 0, 0);
  const chutes = lettres.map((l, i) =>
    l.animate(
      [
        { transform: 'translateY(-0.55em) rotate(-8deg)', opacity: 0 },
        { transform: 'translateY(0.04em) scale(1.05, 0.93)', opacity: 1, offset: 0.6 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 560, delay: 80 + i * 60, easing: 'cubic-bezier(.3,.8,.4,1)', fill: 'backwards' },
    ),
  );
  // Les yeux s'ouvrent dès qu'ils ont atterri… regardent à gauche, à droite, puis le visiteur.
  const iYeux = lettres.findIndex((l) => l.classList.contains('logo-yeux'));
  await chutes[Math.max(0, iYeux)]?.finished.catch(() => undefined);
  await sleep(140);
  for (const o of y.yeux) o.classList.remove('ferme');
  await sleep(260);
  viser(y, -0.8, 0.1);
  await sleep(380);
  viser(y, 0.8, 0.1);
  await sleep(380);
  viser(y, 0, 0.15);
  await sleep(300);
  y.occupe = false;
}

/** Construit le logo. */
export function logo(taille: LogoTaille, options: LogoOptions = {}): HTMLElement {
  const racine = document.createElement('span');
  racine.className = `logo logo-${taille}`;
  racine.translate = false;
  racine.setAttribute('translate', 'no');

  const lu = document.createElement('span');
  lu.className = 'visuel-masque';
  lu.textContent = BRAND.name;

  const mot = document.createElement('span');
  mot.className = 'logo-mot';
  mot.setAttribute('aria-hidden', 'true');

  const nom = BRAND.name;
  const iYeux = nom.toLowerCase().indexOf('oo');
  const lettres: HTMLElement[] = [];
  const y: Perso = { racine, yeux: [], pupilles: [], occupe: false };
  for (let i = 0, n = 0; i < nom.length; i++, n++) {
    if (i === iYeux) {
      const paire = document.createElement('span');
      paire.className = 'logo-yeux';
      for (let k = 0; k < 2; k++) {
        const oeil = document.createElement('span');
        oeil.className = 'oeil';
        const pupille = document.createElement('span');
        pupille.className = 'pupille';
        oeil.append(pupille);
        paire.append(oeil);
        y.yeux.push(oeil);
        y.pupilles.push(pupille);
      }
      poser(paire, 0);
      mot.append(paire);
      lettres.push(paire);
      i++;
      n++;
      continue;
    }
    // Deux couches : le contour d'encre dessous (data-l), la lettre dégradée dessus.
    const l = document.createElement('span');
    l.className = 'logo-lettre';
    l.dataset.l = nom[i];
    l.textContent = nom[i];
    poser(l, PENTES[n % PENTES.length]);
    mot.append(l);
    lettres.push(l);
  }
  racine.append(lu, mot);
  if (y.yeux.length === 0 || calme()) return racine;

  vivants.add(y);
  ecouterPointeur();
  clignerParfois(y);
  if (taille === 'barre') {
    racine.addEventListener('pointerenter', () => {
      if (!y.occupe) cligner(y, 1);
    });
    return racine;
  }

  const bulle = creerBulle();
  mot.append(bulle.boite);
  const niveau = () => options.niveau?.() ?? 'explorateur';
  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(racine);
  }

  // L'arrivée attend la police (positions réelles), puis la première pensée.
  requestAnimationFrame(() => {
    const go = async () => {
      await arrivee(y, lettres);
      await sleep(250);
      await penser(y, bulle, niveau());
      // Ensuite, une pensée de loin en loin (25 à 40 s), seulement si on la voit.
      const suite = () =>
        window.setTimeout(async () => {
          if (!racine.isConnected) return;
          if (visible && !document.hidden) await penser(y, bulle, niveau(), true);
          suite();
        }, 25000 + Math.random() * 15000);
      suite();
    };
    if (document.fonts?.status === 'loaded') void go();
    else document.fonts.ready.then(go, go);
  });

  // Un clic (ou un doigt) sur le logo : une nouvelle pensée.
  mot.addEventListener('click', () => void penser(y, bulle, niveau(), true));
  // Survol d'une lettre : elle sautille à peine.
  for (const l of lettres) {
    l.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' && !l.getAnimations().length) sautiller(l, 0.06);
    });
  }
  return racine;
}
