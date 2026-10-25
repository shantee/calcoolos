/**
 * Plein écran et retour à l'accueil, communs aux quatre jeux.
 *
 * - Deux boutons ronds discrets en bas à droite du jeu : « Accueil » et « Plein écran » (entrer / sortir).
 * - Le jeu passe en plein écran quand on clique ou touche « Jouer », si le navigateur l'accepte.
 *   Les navigateurs n'autorisent le plein écran que juste après un geste (clic, toucher, touche) :
 *   on ne contourne jamais cette règle ; si la demande échoue, le jeu continue dans la page.
 * - Si le joueur quitte le plein écran (Échap, bouton), on ne le lui réimpose plus dans cet onglet.
 * - C'est la page entière qui passe en plein écran (et non le seul canvas) : les boutons restent
 *   visibles et Phaser se recadre tout seul (mode FIT, proportions gardées, jamais étiré).
 */
import type Phaser from 'phaser';

type DocPE = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type ElemPE = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const doc = document as DocPE;
const racine = document.documentElement as ElemPE;
const REFUS = 'calcoolos.pleinEcran.quitte';

/** Le navigateur sait-il mettre un élément en plein écran ? (non sur iPhone, par exemple) */
function possible(): boolean {
  const req = racine.requestFullscreen ?? racine.webkitRequestFullscreen;
  const permis = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false;
  return typeof req === 'function' && permis;
}

/** Ouvert depuis l'écran d'accueil (application installée) : déjà sans barre du navigateur. */
function dejaApplication(): boolean {
  return matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
}

export function estPleinEcran(): boolean {
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

function lireRefus(): boolean {
  try {
    return sessionStorage.getItem(REFUS) === '1';
  } catch {
    return false;
  }
}

function noterRefus(refus: boolean): void {
  try {
    if (refus) sessionStorage.setItem(REFUS, '1');
    else sessionStorage.removeItem(REFUS);
  } catch {
    /* stockage indisponible : tant pis */
  }
}

let installe = false;
let enCours = false;
let depart = false;

async function entrer(): Promise<boolean> {
  if (estPleinEcran() || enCours || !possible()) return estPleinEcran();
  enCours = true;
  try {
    if (racine.requestFullscreen) await racine.requestFullscreen({ navigationUI: 'hide' });
    else await racine.webkitRequestFullscreen?.();
    // Sur tablette ou téléphone, on préfère le paysage (refusé sans conséquence ailleurs).
    if (matchMedia('(pointer: coarse)').matches) {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await o.lock?.('landscape').catch(() => undefined);
    }
  } catch {
    /* refusé par le navigateur : le jeu continue dans la page */
  } finally {
    enCours = false;
  }
  return estPleinEcran();
}

async function sortir(): Promise<void> {
  if (!estPleinEcran()) return;
  try {
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch {
    /* déjà sorti */
  }
}

const ICONES = {
  accueil: ['M4 11.5 12 4l8 7.5', 'M6.5 10v9.5h4v-5h3v5h4V10'],
  entrer: ['M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'],
  sortir: ['M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'],
};

function icone(nom: keyof typeof ICONES): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICONES[nom]) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

/** Coin où poser les boutons, en unités de la scène (1280 × 720) : bord droit et milieu vertical. */
export interface Coin {
  droite: number;
  milieu: number;
}

/**
 * Installe les boutons sur la page d'un jeu, en bas à droite, à l'endroit libre de chaque jeu
 * (le coin même est souvent pris par « Son », un pavé ou un panneau).
 */
export function installerPleinEcran(game: Phaser.Game, coin: Coin = { droite: 1268, milieu: 690 }): void {
  if (installe) return;
  installe = true;
  const barre = document.createElement('nav');
  barre.className = 'commandes-jeu';
  barre.setAttribute('aria-label', 'Commandes de la page');

  const accueil = document.querySelector<HTMLAnchorElement>('a.retour') ?? document.createElement('a');
  accueil.className = 'cmd';
  accueil.href = accueil.getAttribute('href') ?? '../index.html';
  accueil.title = 'Retour à l’accueil';
  accueil.setAttribute('aria-label', 'Retour à l’accueil');
  accueil.replaceChildren(icone('accueil'));
  accueil.addEventListener('click', () => {
    depart = true;
  });
  barre.append(accueil);

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'cmd';
  const maj = () => {
    const pe = estPleinEcran();
    bouton.replaceChildren(icone(pe ? 'sortir' : 'entrer'));
    const t = pe ? 'Quitter le plein écran (Échap)' : 'Plein écran';
    bouton.title = t;
    bouton.setAttribute('aria-label', t);
    bouton.setAttribute('aria-pressed', String(pe));
  };
  bouton.addEventListener('click', () => {
    if (estPleinEcran()) {
      noterRefus(true);
      void sortir();
    } else {
      noterRefus(false);
      void entrer();
    }
    // Le clavier reste au jeu (Entrée ne doit pas rappuyer sur ce bouton).
    bouton.blur();
  });
  if (possible() && !dejaApplication()) barre.append(bouton);
  maj();
  document.body.append(barre);

  const placer = () => {
    const canvas = game.canvas;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const petit = r.height < 480;
    barre.classList.toggle('petit', petit);
    const b = barre.getBoundingClientRect();
    barre.style.left = `${Math.round(r.left + (coin.droite / 1280) * r.width - b.width)}px`;
    // Jamais sous le bord du jeu (petits écrans : les boutons sont alors plus grands que l'espace prévu).
    const haut = Math.min(r.top + (coin.milieu / 720) * r.height - b.height / 2, r.bottom - b.height - 4);
    barre.style.top = `${Math.round(haut)}px`;
  };
  const surChangement = () => {
    // Sortie par Échap ou par le système : on ne réimpose plus le plein écran dans cet onglet.
    if (!estPleinEcran() && !depart) noterRefus(true);
    maj();
    requestAnimationFrame(() => {
      game.scale.refresh();
      placer();
    });
  };
  document.addEventListener('fullscreenchange', surChangement);
  document.addEventListener('webkitfullscreenchange', surChangement);
  window.addEventListener('resize', placer);
  window.addEventListener('pagehide', () => {
    depart = true;
  });
  game.scale.on('resize', placer);
  const attendre = () => {
    if (!game.canvas) return void requestAnimationFrame(attendre);
    placer();
    if ('ResizeObserver' in window) new ResizeObserver(placer).observe(game.canvas);
  };
  attendre();
}

/**
 * À appeler quand le joueur lance une partie (clic, toucher ou touche sur « Jouer »).
 * Avec la souris ou le clavier, le geste est déjà reconnu : on demande tout de suite.
 * Au doigt, Chrome ne le reconnaît qu'au lever du doigt : on attend donc ce geste-là.
 */
export function pleinEcranAuDemarrage(): void {
  if (!installe || estPleinEcran() || !possible() || dejaApplication() || lireRefus()) return;
  const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  if (ua?.isActive) {
    void entrer();
    return;
  }
  const evts = ['pointerup', 'touchend', 'click', 'keyup'] as const;
  const une = () => {
    stop();
    void entrer();
  };
  const stop = () => {
    for (const e of evts) window.removeEventListener(e, une, true);
    clearTimeout(minuterie);
  };
  for (const e of evts) window.addEventListener(e, une, true);
  // Pas de plein écran surprise plus tard : seulement le geste qui a lancé la partie.
  const minuterie = setTimeout(stop, 1500);
}
