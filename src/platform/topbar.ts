/**
 * Barre du haut, commune aux pages de la plateforme : logo, espace joueur (juste à côté du logo), liens,
 * inscription / connexion pour un visiteur, choix de la langue.
 *
 * L'espace joueur est un bouton (avatar, nom, statut) qui ouvre un panneau : qui joue, son niveau, ses progrès,
 * changer de joueur, compte. Choisir un joueur prévient la page par l'événement `calcoolos:joueur` ; une page
 * qui ne l'écoute pas est simplement rechargée.
 */
import '../styles/logo.css';
import { api, accountState, type AccountState, type Profile } from './api';
import { avatarImg } from './avatars';
import { h } from './dom';
import { logo } from './logo';
import { activePlayer, setActivePlayer, syncActivePlayer, type ActivePlayer } from './player';
import { localHistory } from './results';
import { TIER_NAMES } from './stats';
import { niveauRetenu } from './niveau';
import { selecteurLangue } from '../i18n/drapeaux';

export type PageId = 'accueil' | 'progres' | 'classements' | 'compte' | 'autre';

/** Événement envoyé à la page quand on choisit un autre joueur depuis la barre. */
export const EVT_JOUEUR = 'calcoolos:joueur';

const LINKS: Array<[PageId, string, string]> = [
  ['accueil', 'index.html', 'Jeux'],
  ['progres', 'tableau.html', 'Mes progrès'],
  ['classements', 'classements.html', 'Classements'],
];

let page: PageId = 'autre';
let etat: AccountState | null = null;
let fermerPanneau: (() => void) | null = null;

/** Construit la barre ; renvoie l'état du compte (null si l'API est injoignable). */
export async function topbar(current: PageId): Promise<AccountState | null> {
  page = current;
  const bar = document.querySelector<HTMLElement>('#barre');
  if (bar) {
    bar.className = 'barre';
    bar.replaceChildren();
    const marque = h('a', { class: 'marque', href: 'index.html', title: 'Accueil' }, logo('barre'));
    const espace = h('div', { class: 'espace-joueur' });
    const nav = h('nav', { class: 'liens', 'aria-label': 'Navigation principale' });
    for (const [id, href, label] of LINKS) {
      nav.append(h('a', { href, 'aria-current': id === current ? 'page' : undefined }, label));
    }
    const compte = h('div', { class: 'barre-compte' });
    bar.append(h('div', { class: 'barre-gauche' }, marque, espace), nav, compte, selecteurLangue());
    // Premier rendu tout de suite (joueur retenu sur l'appareil), puis mis à jour avec la réponse du serveur.
    dessiner(espace, compte, activePlayer(), undefined);
  }
  const state = await accountState();
  etat = state;
  // Déconnecté : on redevient invité ; hors ligne : on garde le joueur (envoi différé).
  if (state?.connecte) syncActivePlayer(state.profils);
  else if (state) setActivePlayer(null);
  rafraichirJoueur();
  return state;
}

/** Redessine l'espace joueur (après un changement de joueur ou de niveau). */
export function rafraichirJoueur(): void {
  const espace = document.querySelector<HTMLElement>('#barre .espace-joueur');
  const compte = document.querySelector<HTMLElement>('#barre .barre-compte');
  if (espace && compte) dessiner(espace, compte, activePlayer(), etat);
}

function choisir(p: Profile | null): void {
  setActivePlayer(p);
  fermerPanneau?.();
  const joueur = activePlayer();
  const evt = new CustomEvent<ActivePlayer | null>(EVT_JOUEUR, { detail: joueur, cancelable: true });
  // La page qui gère le changement appelle preventDefault() ; sinon on recharge pour tout remettre d'accord.
  if (window.dispatchEvent(evt)) window.location.reload();
  else rafraichirJoueur();
}

/**
 * state : undefined = réponse du serveur pas encore arrivée ; null = serveur injoignable.
 */
function dessiner(espace: HTMLElement, compte: HTMLElement, joueur: ActivePlayer | null, state: AccountState | null | undefined): void {
  fermerPanneau?.();
  const connecte = !!state?.connecte;
  const niveau = TIER_NAMES[joueur?.niveau ?? niveauRetenu() ?? ''] ?? null;

  // --- Le bouton : avatar, nom, statut.
  const nom = h('span', { class: 'joueur-nom' }, joueur ? joueur.pseudo : 'Invité');
  const statut = h('small', { class: 'joueur-statut' },
    joueur ? (niveau ? `Niveau ${niveau}` : 'joue en ce moment')
      : state === undefined ? '…'
      : connecte ? 'choisis un profil'
      : state ? 'sans compte' : 'hors ligne');
  const bouton = h('button', {
    type: 'button',
    class: `joueur${joueur ? ' joueur-profil' : ' joueur-invite'}`,
    'aria-expanded': 'false',
    'aria-controls': 'panneau-joueur',
    'aria-haspopup': 'true',
  },
  h('span', { class: 'joueur-avatar' }, avatarImg(joueur?.avatar ?? 'chouette', 40, '')),
  h('span', { class: 'joueur-texte' }, nom, statut),
  h('span', { class: 'joueur-chevron', 'aria-hidden': 'true' }));
  bouton.title = 'Espace joueur';

  // --- Le panneau.
  const panneau = h('div', { class: 'panneau-joueur', id: 'panneau-joueur', role: 'dialog', 'aria-label': 'Espace joueur', hidden: true });
  const tete = h('div', { class: 'panneau-tete' },
    avatarImg(joueur?.avatar ?? 'chouette', 64, ''),
    h('div', {},
      h('p', { class: 'panneau-nom' }, joueur ? joueur.pseudo : connecte ? 'Personne n’est choisi' : 'Tu joues en invité'),
      h('p', { class: 'panneau-sous' },
        joueur ? 'Ses parties sont gardées dans l’espace famille.'
          : connecte ? 'Choisis qui joue pour garder ses parties.'
          : state === null ? 'Serveur injoignable : tes parties restent sur cet appareil.'
          : 'Tes parties restent dans ce navigateur.')),
  );
  panneau.append(tete);

  if (niveau) {
    panneau.append(h('p', { class: 'panneau-niveau' }, 'Niveau ', h('b', {}, niveau), ' · ',
      h('a', { href: 'index.html#niveau' }, 'changer')));
  }

  if (connecte) {
    const liste = h('div', { class: 'panneau-profils', role: 'group', 'aria-label': 'Qui joue ?' });
    for (const p of state?.profils ?? []) {
      const b = h('button', { type: 'button', 'aria-pressed': String(joueur?.id === p.id) }, avatarImg(p.avatar, 36, ''), p.pseudo);
      b.addEventListener('click', () => choisir(p));
      liste.append(b);
    }
    const inv = h('button', { type: 'button', 'aria-pressed': String(!joueur) }, avatarImg('chouette', 36, ''), 'Invité');
    inv.addEventListener('click', () => choisir(null));
    liste.append(inv);
    panneau.append(h('p', { class: 'panneau-titre' }, 'Qui joue ?'), liste);
    const sortir = h('button', { type: 'button', class: 'panneau-lien' }, 'Se déconnecter');
    sortir.addEventListener('click', async () => {
      await api.post('/deconnexion').catch(() => null);
      setActivePlayer(null);
      window.location.reload();
    });
    panneau.append(h('div', { class: 'panneau-actions' },
      h('a', { class: 'bouton petit', href: joueur ? `tableau.html?profil=${joueur.id}` : 'tableau.html' }, 'Voir les progrès'),
      h('a', { class: 'bouton petit secondaire', href: 'compte.html' }, 'Espace famille')),
    h('p', { class: 'panneau-compte' }, h('span', {}, state?.email ?? ''), sortir));
  } else {
    const parties = localHistory();
    const etoiles = parties.reduce((a, r) => a + r.etoiles, 0);
    if (parties.length > 0) {
      panneau.append(h('p', { class: 'panneau-local' },
        `${parties.length} ${parties.length > 1 ? 'parties' : 'partie'} · ${etoiles} ★ sur cet appareil`));
    }
    if (state) {
      panneau.append(
        h('p', { class: 'panneau-invite' }, 'Avec un compte gratuit, tes scores, records et succès te suivent sur tous tes appareils.'),
        h('div', { class: 'panneau-actions' },
          h('a', { class: 'bouton petit', href: 'compte.html#inscription' }, 'Créer mon compte'),
          h('a', { class: 'bouton petit secondaire', href: 'compte.html#connexion' }, 'Se connecter')),
      );
    }
    panneau.append(h('p', { class: 'panneau-compte' }, h('a', { href: 'tableau.html' }, 'Mes progrès sur cet appareil')));
  }

  const ouvrir = (oui: boolean) => {
    panneau.hidden = !oui;
    bouton.setAttribute('aria-expanded', String(oui));
    if (oui) {
      fermerPanneau = () => ouvrir(false);
      panneau.querySelector<HTMLElement>('button, a')?.focus();
    } else if (fermerPanneau) {
      fermerPanneau = null;
    }
  };
  bouton.addEventListener('click', () => ouvrir(panneau.hidden));
  espace.replaceChildren(bouton, panneau);
  espace.onkeydown = (e) => {
    if (e.key === 'Escape' && !panneau.hidden) {
      ouvrir(false);
      bouton.focus();
    }
  };

  // --- À droite : inscription et connexion pour un visiteur, espace famille pour un compte.
  if (connecte) {
    compte.replaceChildren(h('a', { class: 'lien-compte', href: 'compte.html', 'aria-current': page === 'compte' ? 'page' : undefined }, 'Espace famille'));
  } else if (state === null) {
    compte.replaceChildren();
  } else {
    compte.replaceChildren(
      h('a', { class: 'lien-compte', href: 'compte.html#connexion', 'aria-current': page === 'compte' ? 'page' : undefined }, 'Se connecter'),
      h('a', { class: 'bouton-compte', href: 'compte.html#inscription' }, 'Créer mon compte'),
    );
  }
}

// Un clic en dehors du panneau le ferme.
document.addEventListener('click', (e) => {
  if (!fermerPanneau) return;
  const t = e.target as Element | null;
  if (t && !t.closest('.espace-joueur')) fermerPanneau();
});
