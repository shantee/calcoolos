/**
 * Barre du haut, commune aux pages de la plateforme : liens et joueur actif.
 */
import { BRAND } from '../brand';
import { accountState, type AccountState } from './api';
import { avatarImg } from './avatars';
import { activePlayer, setActivePlayer, syncActivePlayer } from './player';

export type PageId = 'accueil' | 'progres' | 'classements' | 'compte' | 'autre';

const LINKS: Array<[PageId, string, string]> = [
  ['accueil', 'index.html', 'Jouer'],
  ['progres', 'tableau.html', 'Mes progrès'],
  ['classements', 'classements.html', 'Classements'],
  ['compte', 'compte.html', 'Espace parents'],
];

/** Construit la barre ; renvoie l'état du compte (null si l'API est injoignable). */
export async function topbar(current: PageId): Promise<AccountState | null> {
  const bar = document.querySelector<HTMLElement>('#barre');
  const chip = document.createElement('a');
  if (bar) {
    bar.className = 'barre';
    bar.replaceChildren();
    const brand = document.createElement('a');
    brand.className = 'marque';
    brand.href = 'index.html';
    brand.textContent = BRAND.name;
    const nav = document.createElement('nav');
    nav.className = 'liens';
    nav.setAttribute('aria-label', 'Navigation principale');
    for (const [id, href, label] of LINKS) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      if (id === current) a.setAttribute('aria-current', 'page');
      nav.append(a);
    }
    chip.className = 'joueur';
    chip.href = 'compte.html';
    bar.append(brand, nav, chip);
  }
  const state = await accountState();
  // Déconnecté : on redevient invité ; hors ligne : on garde le joueur (envoi différé).
  let player = activePlayer();
  if (state?.connecte) player = syncActivePlayer(state.profils);
  else if (state) {
    setActivePlayer(null);
    player = null;
  }
  const who = document.createElement('span');
  const sub = document.createElement('small');
  if (player) {
    chip.title = 'Changer de joueur';
    chip.href = 'index.html#qui-joue';
    chip.append(avatarImg(player.avatar, 38, ''));
    who.textContent = player.pseudo;
    sub.textContent = 'joue en ce moment';
  } else {
    chip.append(avatarImg('chouette', 38, ''));
    who.textContent = 'Invité';
    sub.textContent = state?.connecte ? 'choisis un profil' : state ? 'sans compte' : 'hors ligne';
  }
  who.append(sub);
  chip.append(who);
  return state;
}
