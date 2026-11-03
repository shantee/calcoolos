/**
 * Accès aux jeux : jouer est libre, le compte est facultatif (03/11/2026). `reglerJoueur()` dit seulement qui joue ;
 * sans compte, la partie est anonyme et rien n'est enregistré.
 *
 * `retourSur()` / `destinationApresConnexion()` : un lien « Se connecter » peut porter `?retour=` (accueil ou page de
 * jeu du site seulement, jamais une adresse extérieure) ; Mon espace y ramène après connexion.
 */
import { accountState, siteRoot } from './api';
import { activePlayer, joueurParDefaut, setActivePlayer, syncActivePlayer } from './player';

/** Pages vers lesquelles on peut revenir après connexion : l'accueil ou un jeu, avec leurs paramètres. */
const RETOUR_PERMIS = /^(index\.html|jeu\/[a-z0-9-]+\.html)(\?[^#\s]*)?$/;

/** Adresse de retour sûre (relative à la racine du site), ou null. */
export function retourSur(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  const v = valeur.replace(/^\/+/, '');
  return RETOUR_PERMIS.test(v) && !v.includes('..') ? v : null;
}

/** Lien vers Mon espace (carte « Se connecter » ou « Créer mon compte »), qui ramène ensuite à `retour`. */
export function lienCompte(retour: string | null, carte: 'connexion' | 'inscription' = 'connexion'): string {
  const r = retourSur(retour);
  return `${siteRoot()}compte.html${r ? `?retour=${encodeURIComponent(r)}` : ''}#${carte}`;
}

/** La page courante, vue depuis la racine du site (« jeu/decollage.html?niveau=ce2 »). */
export function pageCourante(): string {
  const racine = new URL(siteRoot(), window.location.href).pathname;
  const chemin = window.location.pathname.startsWith(racine) ? window.location.pathname.slice(racine.length) : window.location.pathname.replace(/^\/+/, '');
  return `${chemin}${window.location.search}`;
}

/**
 * Avant de lancer un jeu : règle qui joue, sans jamais bloquer. Jouer est libre (03/11/2026, correction) :
 * - compte connecté : son joueur (ou le titulaire, ou le profil unique) ; partie suivie ;
 * - visiteur sans compte : partie anonyme, rien n'est enregistré (un joueur resté d'une ancienne session est oublié) ;
 * - serveur injoignable : on garde le joueur déjà choisi (ses résultats partiront plus tard).
 */
export async function reglerJoueur(): Promise<void> {
  const etat = await accountState();
  if (etat?.connecte) {
    syncActivePlayer(etat.profils);
    if (!activePlayer()) setActivePlayer(joueurParDefaut(etat.profils));
  } else if (etat) {
    setActivePlayer(null);
  }
}

/**
 * Où aller une fois connecté (et un joueur choisi), relatif à la racine du site. Un jeu ouvert directement avec son
 * niveau (`jeu/decollage.html?niveau=ce2`) reprend tel quel ; sans niveau, on repasse par l'accueil pour le choisir
 * (`index.html?jouer=decollage`). Sans retour : l'accueil.
 */
export function destinationApresConnexion(retour: string | null): string {
  const r = retourSur(retour);
  if (!r) return 'index.html';
  const jeu = /^jeu\/([a-z0-9-]+)\.html(?:\?(.*))?$/.exec(r);
  if (!jeu) return r;
  const params = new URLSearchParams(jeu[2] ?? '');
  if (params.get('niveau')) return r;
  const calme = params.has('calme') ? '&calme' : '';
  return `index.html?jouer=${jeu[1]}${calme}`;
}
