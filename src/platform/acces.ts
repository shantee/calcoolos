/**
 * Accès aux jeux (03/11/2026) : plus de mode invité, il faut un compte et un profil pour jouer.
 *
 * - `exigerJoueur()` garde chaque page de jeu, y compris ouverte directement par son adresse : sans compte, on part
 *   vers la connexion (ou l'inscription) avec `?retour=` ; après connexion, Mon espace ramène au jeu demandé.
 * - `retourSur()` ne laisse revenir que vers l'accueil ou une page de jeu du site (jamais une adresse extérieure).
 *
 * Serveur injoignable : on ne bloque pas un joueur déjà choisi sur cet appareil (ses résultats partent plus tard,
 * file d'attente de results.ts) ; sans joueur, on l'envoie vers Mon espace, qui explique la panne.
 */
import { accountState, siteRoot, type AccountState } from './api';
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

export type Acces =
  | { ok: true; etat: AccountState | null }
  | { ok: false; vers: string };

/**
 * Décision pure (testée) : peut-on jouer ? `etat` null = serveur injoignable.
 * Un compte sans joueur choisi prend le joueur par défaut (titulaire, ou profil unique) ; s'il faut choisir ou créer
 * un profil, on part vers Mon espace, qui ramènera au jeu.
 */
export function decider(etat: AccountState | null, joueur: { id: number } | null, retour: string): Acces {
  if (etat === null) return joueur ? { ok: true, etat } : { ok: false, vers: lienCompte(retour) };
  if (!etat.connecte) return { ok: false, vers: lienCompte(retour) };
  const profils = etat.profils ?? [];
  if (joueur && profils.some((p) => p.id === joueur.id)) return { ok: true, etat };
  const defaut = joueurParDefaut(profils);
  if (defaut) return { ok: true, etat };
  return { ok: false, vers: `${siteRoot()}compte.html?retour=${encodeURIComponent(retourSur(retour) ?? 'index.html')}` };
}

/**
 * Garde d'une page de jeu : `true` si l'on peut jouer (le joueur actif est alors réglé), sinon la page part vers la
 * connexion et la promesse ne se résout jamais (le jeu ne démarre pas).
 */
export async function exigerJoueur(): Promise<boolean> {
  const etat = await accountState();
  const d = decider(etat, activePlayer(), pageCourante());
  if (!d.ok) {
    window.location.replace(d.vers);
    return new Promise<boolean>(() => {});
  }
  if (etat?.connecte) {
    syncActivePlayer(etat.profils);
    if (!activePlayer()) setActivePlayer(joueurParDefaut(etat.profils));
  }
  return true;
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
