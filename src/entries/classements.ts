import '../i18n/page';
import '@fontsource-variable/bricolage-grotesque';
import '../styles/accueil.css';
import '../styles/plateforme.css';
import { topbar } from '../platform/topbar';
import { api } from '../platform/api';
import { AVATAR_INVITE, avatarImg } from '../platform/avatars';
import { activePlayer } from '../platform/player';
import { localHistory, type GameId } from '../platform/results';
import { GAME_NAMES, MODE_NAMES, TIER_NAMES } from '../platform/stats';
import { h } from '../platform/dom';

interface Row {
  rang?: number;
  nom: string;
  avatar: string;
  score: number;
  famille?: boolean;
}

interface Board {
  jeu: GameId;
  niveau: string;
  mode: string;
  public: Row[];
  famille?: Row[];
}

const root = document.querySelector<HTMLElement>('#contenu')!;
const MEDALS = ['🥇', '🥈', '🥉'];
const MODES = ['defi', 'tranquille'];

const boardTitle = (b: Board) => `${TIER_NAMES[b.niveau] ?? b.niveau} · ${MODE_NAMES[b.mode] ?? b.mode}`;
const place = (rang: number) => (rang <= 3 ? MEDALS[rang - 1] : `${rang}e`);

function rowEl(r: Row, me: string | undefined): HTMLElement {
  const cls = [r.famille ? 'famille' : '', r.famille && r.nom === me ? 'moi' : ''].filter(Boolean).join(' ');
  return h('li', { class: cls || undefined },
    h('span', { class: 'rang' }, r.rang ? place(r.rang) : ''),
    avatarImg(r.avatar, 28, ''),
    h('span', { class: 'nom' }, r.nom),
    h('span', { class: 'score' }, String(r.score)));
}

/** Un classement : le top, puis les joueurs de la famille plus loin (avec leur rang), ou le score de l'invité. */
function boardEl(b: Board, me: string | undefined, guestBest: number | null): HTMLElement {
  const top = b.public.filter((r) => (r.rang ?? 0) <= 5);
  const after = b.public.filter((r) => (r.rang ?? 0) > 5);
  const list = h('ol', { class: 'podium' }, ...top.map((r) => rowEl(r, me)));
  if (after.length > 0) list.append(h('li', { class: 'ellipse', 'aria-hidden': 'true' }, '…'), ...after.map((r) => rowEl(r, me)));
  if (guestBest !== null) {
    list.append(h('li', { class: 'invite' }, h('span', { class: 'rang' }), avatarImg(AVATAR_INVITE, 28, ''),
      h('span', { class: 'nom' }, 'Toi (cet appareil)'), h('span', { class: 'score' }, String(guestBest))));
  }
  const vide = b.public.length === 0 && guestBest === null;
  return h('section', { class: `classement${vide ? ' vide' : ''}` },
    h('h3', {}, boardTitle(b)),
    vide ? h('p', { class: 'discret' }, 'Personne pour l’instant : à toi de jouer !') : list);
}

/** Classement en famille : seulement les tableaux où au moins deux profils ont joué (renvoyés par le serveur). */
function familyCard(boards: Board[]): HTMLElement | null {
  const played = boards.filter((b) => b.famille);
  if (played.length === 0) return null;
  return h('section', { class: 'carte famille-classements' },
    h('h2', {}, 'Dans la famille'),
    h('ul', {}, ...played.map((b) => h('li', {},
      h('b', {}, `${GAME_NAMES[b.jeu]} · ${boardTitle(b)} : `),
      ...b.famille!.flatMap((r, i) => [i > 0 ? ' · ' : '', `${MEDALS[i] ?? `${i + 1}e`} ${r.nom} ${r.score}`]),
    ))));
}

void (async () => {
  const state = await topbar('classements');
  const me = activePlayer()?.pseudo;
  root.replaceChildren(h('h1', {}, 'Classements'), h('p', { class: 'chapeau' }, 'Chargement…'));
  const r = await api.get<{ classements: Board[] }>('/classements').catch(() => null);
  if (r?.status !== 200) {
    root.replaceChildren(h('h1', {}, 'Classements'),
      h('p', { class: 'message erreur' }, state ? r?.data.erreur ?? 'Le serveur ne répond pas.' : 'Les classements ont besoin du serveur : indisponible pour le moment.'));
    return;
  }
  const boards = r.data.classements;
  const connected = state?.connecte === true;
  // Invité : ses parties restent sur l'appareil ; on glisse son meilleur score dans chaque classement.
  const history = connected ? [] : localHistory();
  const guestBest = (b: Board) => {
    const best = history.filter((x) => x.jeu === b.jeu && x.niveau === b.niveau && x.mode === b.mode).reduce((m, x) => Math.max(m, x.score), -1);
    return best >= 0 ? best : null;
  };

  const games = Object.keys(GAME_NAMES) as GameId[];
  const sections = games.map((jeu) => h('section', { class: 'jeu-classements', id: `jeu-${jeu}` },
    h('h2', {}, GAME_NAMES[jeu]),
    ...MODES.map((mode) => h('div', { class: 'classements-ligne' },
      ...boards.filter((b) => b.jeu === jeu && b.mode === mode).map((b) => boardEl(b, me, connected ? null : guestBest(b))))),
  ));
  root.replaceChildren(
    h('h1', {}, 'Classements'),
    h('p', { class: 'chapeau' }, 'Tous les jeux, tous les niveaux, en Défi et en Tranquille. Toutes les parties comptent, gagnées ou perdues, tant que le score est jugé vraisemblable par le serveur.'),
    h('nav', { class: 'sommaire-jeux', 'aria-label': 'Aller au jeu' }, ...games.map((jeu) => h('a', { href: `#jeu-${jeu}` }, GAME_NAMES[jeu]))),
    connected
      ? familyCard(boards) ?? ''
      : h('section', { class: 'carte invite-classements' },
        h('p', {}, 'En mode invité, tes scores restent sur cet appareil : ils apparaissent ici en pointillés, mais pas dans le classement des autres. Pour y entrer, gagné ou perdu : ',
          h('a', { class: 'bouton petit', href: 'compte.html#inscription' }, 'Créer mon compte'))),
    ...sections,
  );
})();
