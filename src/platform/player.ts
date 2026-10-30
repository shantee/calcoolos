/**
 * Joueur actif sur cet appareil : un profil du compte, ou l'invité.
 * Retenu dans le navigateur (aucun cookie) ; le serveur vérifie toujours que le
 * profil appartient bien au compte connecté.
 */
import type { Profile } from './api';

const KEY = 'calcoolos.joueur';

export interface ActivePlayer {
  id: number;
  pseudo: string;
  avatar: string;
  niveau: string;
}

export function activePlayer(): ActivePlayer | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ActivePlayer;
    return typeof p.id === 'number' && typeof p.pseudo === 'string' ? p : null;
  } catch {
    return null;
  }
}

export function setActivePlayer(p: Profile | ActivePlayer | null): void {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify({ id: p.id, pseudo: p.pseudo, avatar: p.avatar, niveau: p.niveau }));
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : on reste invité */
  }
}

/** Qui joue juste après la connexion : le titulaire, ou le seul profil du compte ; sinon on laisse choisir. */
export function joueurParDefaut(profiles: readonly Profile[] | undefined): Profile | null {
  return profiles?.find((p) => p.personnel) ?? (profiles?.length === 1 ? profiles[0] : null);
}

/** Remet le joueur actif en accord avec les profils du compte (supprimé, renommé…). */
export function syncActivePlayer(profiles: Profile[] | undefined): ActivePlayer | null {
  const cur = activePlayer();
  if (!cur) return null;
  const fresh = profiles?.find((p) => p.id === cur.id);
  setActivePlayer(fresh ?? null);
  return fresh ? activePlayer() : null;
}
