/**
 * Bouton « Continuer avec Google » (Google Identity Services).
 *
 * Le bouton est celui de Google (dessiné par Google, dans sa langue et ses couleurs). Un clic ouvre la
 * fenêtre de choix du compte ; Google rend alors un jeton d'identité signé, que l'API PHP vérifie
 * (`/api/google`). Aucun accès à Gmail, Drive ou aux contacts : seule l'identité est demandée.
 *
 * Le script de Google n'est chargé que sur Mon espace, et seulement si le serveur annonce un
 * identifiant client (`googleClientId` dans /api/etat). S'il ne se charge pas (Google injoignable,
 * bloqueur), le bouton disparaît simplement : l'e-mail et le mot de passe restent disponibles.
 */
import { langue } from '../i18n/langue';

interface GsiButtonOptions {
  type: 'standard';
  theme: 'outline' | 'filled_blue' | 'filled_black';
  size: 'large';
  text: 'continue_with' | 'signin_with' | 'signup_with';
  shape: 'pill';
  logo_alignment: 'left';
  width: number;
  locale: string;
}

interface Gsi {
  initialize(options: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode: 'popup'; context: 'use'; auto_select: false; itp_support: true }): void;
  renderButton(parent: HTMLElement, options: GsiButtonOptions): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: Gsi } };
  }
}

const SCRIPT = 'https://accounts.google.com/gsi/client';
let chargement: Promise<Gsi | null> | null = null;

/** Charge le script de Google une seule fois ; null s'il est injoignable (8 s au plus). */
function chargerGsi(): Promise<Gsi | null> {
  chargement ??= new Promise((resolve) => {
    const fini = () => resolve(window.google?.accounts?.id ?? null);
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = fini;
    s.onerror = () => resolve(null);
    window.setTimeout(fini, 8000);
    document.head.append(s);
  });
  return chargement;
}

// Google ne garde qu'une fonction de rappel pour la page : celle du dernier affichage. Les boutons
// d'un même écran font tous la même chose (se connecter, ou associer Google au compte).
let rappel: (jeton: string) => void = () => {};
let initialise = false;

/**
 * Place le bouton de Google dans `zone` (vide d'abord : une place réservée de la taille du bouton,
 * pour que rien ne saute). `quandJeton` reçoit le jeton après le choix du compte. Si l'utilisateur
 * ferme la fenêtre de Google, rien ne se passe : il reste sur la page, sans message d'erreur.
 * Rend false (et retire la zone) si Google est indisponible.
 */
export async function boutonGoogle(zone: HTMLElement, clientId: string, quandJeton: (jeton: string) => void): Promise<boolean> {
  zone.classList.add('google-bouton');
  zone.setAttribute('translate', 'no');
  const gsi = await chargerGsi();
  if (!gsi) {
    zone.closest('.google-bloc')?.remove();
    return false;
  }
  if (!initialise) {
    gsi.initialize({
      client_id: clientId,
      callback: (r) => {
        if (typeof r.credential === 'string' && r.credential !== '') rappel(r.credential);
      },
      ux_mode: 'popup',
      context: 'use',
      auto_select: false,
      itp_support: true,
    });
    initialise = true;
  }
  rappel = quandJeton;
  const largeur = Math.round(Math.min(400, Math.max(220, zone.clientWidth || 320)));
  gsi.renderButton(zone, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'left',
    width: largeur,
    locale: langue(),
  });
  return true;
}

/** Après une déconnexion : Google ne reconnecte pas tout seul ce compte au prochain passage. */
export function oublierGoogle(): void {
  window.google?.accounts?.id?.disableAutoSelect();
}
