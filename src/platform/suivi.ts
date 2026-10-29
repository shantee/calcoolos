/**
 * Mesure d'audience maison (lue dans Calcoolos Analytics, tool.zfx.fr/calcoolos/).
 *
 * Ce qui part vers le serveur : un identifiant aléatoire de ce navigateur (sans lien avec la
 * personne), un identifiant de visite, le type d'appareil (ordinateur, tablette, téléphone), la
 * page d'arrivée, le temps actif sur le site, et pour chaque partie le jeu, le niveau, le mode, le
 * temps de jeu actif et l'issue. Jamais de cookie, d'adresse, de touche, de clic ni de position.
 *
 * Temps ACTIF : une seconde compte si la page est visible et que le joueur a touché le clavier, la
 * souris ou l'écran dans la dernière minute (et, pour une partie, si elle n'est pas en pause). Un
 * onglet oublié ouvert ne compte donc pas. Les durées envoyées sont des cumuls : le serveur garde la
 * plus grande, un envoi perdu ou répété ne fausse rien. Tout est léger (une addition par seconde, un
 * petit envoi toutes les 30 s au plus) et ne bloque jamais le jeu : une erreur réseau est ignorée.
 */
import { apiUrl } from './api';
import { activePlayer } from './player';

export type PageSuivie = 'accueil' | 'compte' | 'tableau' | 'classements' | 'confidentialite' | 'cubes' | 'meteores' | 'dragon' | 'fusee' | 'neon' | 'autre';
export type Appareil = 'ordinateur' | 'tablette' | 'telephone';

/** Sans geste depuis ce délai, le temps ne compte plus (ms). */
export const INACTIVITE = 60_000;
/** Une visite se termine après 30 minutes sans activité (ms). */
export const FIN_VISITE = 30 * 60_000;
const SIGNAL = 30_000;
const CLE_VISITEUR = 'calcoolos.visiteur';
const CLE_VISITE = 'calcoolos.visite';
/** Les navigateurs pilotés (tests automatiques) ne sont pas comptés, sauf demande explicite. */
const CLE_TEST = 'calcoolos.suivi-test';

interface Visite {
  id: string;
  /** Dernière activité (ms). */
  dernier: number;
  /** Secondes actives depuis le début de la visite. */
  actif: number;
}

interface Partie {
  cle: string;
  jeu: string;
  niveau: string;
  mode: string;
  actif: number;
  pause: boolean;
  /** Début de la partie (ms). */
  debut: number;
}

/** Ce que la fin d'une partie transmet au résultat : sa clé, son début et son temps de jeu actif. */
export interface FinPartie {
  cle: string;
  debut: string;
  actif: number;
}

type Evenement = Record<string, string | number | boolean>;

/** Identifiant aléatoire de 22 caractères (base64url). */
export function nouvelId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Type d'appareil, sans empreinte : pointeur grossier (doigt) et petite largeur d'écran. */
export function appareil(doigt: boolean, largeur: number, hauteur: number): Appareil {
  if (!doigt) return 'ordinateur';
  return Math.min(largeur, hauteur) < 600 ? 'telephone' : 'tablette';
}

/** Cette seconde compte-t-elle comme active ? */
export function secondeActive(visible: boolean, maintenant: number, dernierGeste: number, pause = false): boolean {
  return visible && !pause && maintenant - dernierGeste < INACTIVITE;
}

/** La visite enregistrée est-elle encore en cours (sinon, une nouvelle commence) ? */
export function visiteEnCours(v: Visite | null, maintenant: number): v is Visite {
  return !!v && typeof v.id === 'string' && /^[A-Za-z0-9_-]{16,32}$/.test(v.id) && maintenant - v.dernier < FIN_VISITE;
}

function lire<T>(cle: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(cle) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: unknown): void {
  try {
    localStorage.setItem(cle, typeof valeur === 'string' ? valeur : JSON.stringify(valeur));
  } catch {
    /* stockage indisponible : la mesure continue en mémoire pour cette page */
  }
}

let page: PageSuivie = 'autre';
let visiteur = '';
let memoireVisite: Visite | null = null;
let partie: Partie | null = null;
let file: Evenement[] = [];
let dernierGeste = Date.now();
let dejaEnvoye = -1;
let dernierEnvoi = 0;
let demarre = false;
let horloge = false;

function visite(): Visite {
  const now = Date.now();
  const v = lire<Visite>(CLE_VISITE) ?? memoireVisite;
  if (visiteEnCours(v, now)) return (memoireVisite = v);
  memoireVisite = { id: nouvelId(), dernier: now, actif: 0 };
  dejaEnvoye = -1;
  file.unshift({ type: 'page' });
  ecrire(CLE_VISITE, memoireVisite);
  return memoireVisite;
}

function corps(): string {
  const v = visite();
  const doigt = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const p = activePlayer();
  const data: Record<string, unknown> = {
    v: visiteur,
    s: v.id,
    appareil: appareil(doigt, window.screen?.width ?? 1024, window.screen?.height ?? 768),
    page,
    actif: v.actif,
    ev: file.splice(0, 40),
  };
  if (p) data.profil = p.id;
  return JSON.stringify(data);
}

/** Envoie ce qui est en attente. `fermeture` : la page se ferme, on passe par sendBeacon. */
function envoyer(fermeture = false): void {
  if (!demarre) return;
  const v = visite();
  if (file.length === 0 && v.actif === dejaEnvoye) return;
  dejaEnvoye = v.actif;
  dernierEnvoi = Date.now();
  const url = apiUrl('/suivi');
  const body = corps();
  try {
    if (fermeture && navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return;
    void fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'same-origin' }).catch(() => undefined);
  } catch {
    /* jamais d'erreur visible pour le joueur */
  }
}

function seconde(): void {
  const now = Date.now();
  const visible = document.visibilityState === 'visible';
  if (!secondeActive(visible, now, dernierGeste)) return;
  // Le temps de jeu actif est compté même sans mesure d'audience : il part avec le résultat.
  if (partie && secondeActive(visible, now, dernierGeste, partie.pause)) partie.actif++;
  if (!demarre) return;
  const v = visite();
  v.actif++;
  v.dernier = now;
  ecrire(CLE_VISITE, v);
  if (now - dernierEnvoi >= SIGNAL) {
    if (partie) file.push({ type: 'jeu', p: partie.cle, actif: partie.actif, jeu: partie.jeu, niveau: partie.niveau, mode: partie.mode });
    envoyer();
  }
}

/** À appeler une fois par page, dès son chargement. */
export function demarrerSuivi(p: PageSuivie): void {
  if (demarre) return;
  if (navigator.webdriver && lire<number>(CLE_TEST) !== 1) return;
  demarre = true;
  page = p;
  visiteur = lire<string>(CLE_VISITEUR) ?? '';
  if (!/^[A-Za-z0-9_-]{16,32}$/.test(visiteur)) {
    visiteur = nouvelId();
    ecrire(CLE_VISITEUR, JSON.stringify(visiteur));
  }
  const v = visite();
  if (file[0]?.type !== 'page') file.unshift({ type: 'page' });
  v.dernier = Date.now();
  ecrire(CLE_VISITE, v);
  demarrerHorloge();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (partie) file.push({ type: 'jeu', p: partie.cle, actif: partie.actif, jeu: partie.jeu, niveau: partie.niveau, mode: partie.mode });
      envoyer(true);
    }
  });
  window.addEventListener('pagehide', () => {
    // Page quittée en pleine partie : abandon (le temps joué jusque-là est gardé).
    if (partie) finir('abandon');
    envoyer(true);
  });
  envoyer();
}

const geste = (): void => {
  dernierGeste = Date.now();
};

/** Horloge d'une seconde et écoute des gestes, une seule fois par page. */
function demarrerHorloge(): void {
  if (horloge) return;
  horloge = true;
  // Seul l'instant du dernier geste est retenu (sur cet appareil), jamais le geste lui-même.
  for (const type of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel']) {
    window.addEventListener(type, geste, { passive: true, capture: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') geste();
  });
  window.setInterval(seconde, 1000);
}

function finir(issue: 'terminee' | 'abandon', gagne?: boolean, score?: number): FinPartie | null {
  if (!partie) return null;
  const ev: Evenement = { type: 'fin', p: partie.cle, actif: partie.actif, issue, jeu: partie.jeu, niveau: partie.niveau, mode: partie.mode };
  if (gagne !== undefined) ev.gagne = gagne;
  if (score !== undefined) ev.score = Math.max(0, Math.round(score));
  if (demarre) file.push(ev);
  const fin = { cle: partie.cle, debut: new Date(partie.debut).toISOString(), actif: partie.actif };
  partie = null;
  return fin;
}

/** Une partie commence (bouton Tranquille / Défi). Une partie précédente non finie est un abandon. */
export function partieCommence(jeu: string, niveau: string, mode: string): void {
  if (partie) finir('abandon');
  demarrerHorloge();
  partie = { cle: nouvelId(), jeu, niveau, mode, actif: 0, pause: false, debut: Date.now() };
  dernierGeste = Date.now();
  if (!demarre) return;
  file.push({ type: 'debut', p: partie.cle, jeu, niveau, mode });
  envoyer();
}

/**
 * Fin normale (écran de fin). Renvoie la clé de la partie (jointe au résultat envoyé au serveur, qui ne
 * l'enregistre qu'une fois), son début et son temps de jeu actif (pauses et arrière-plan exclus).
 */
export function partieTerminee(gagne: boolean, score: number): FinPartie | null {
  const fin = finir('terminee', gagne, score);
  if (fin) envoyer();
  return fin;
}

/** Pause du jeu (bouton II) : le temps de jeu s'arrête, le temps sur le site continue. */
export function partiePause(enPause: boolean): void {
  if (partie) partie.pause = enPause;
}

/** Étapes du parcours : niveau choisi sur l'accueil, compte créé. */
export function etapeParcours(type: 'niveau' | 'inscription'): void {
  if (!demarre) return;
  file.push({ type });
  envoyer();
}
