import '../i18n/page';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/pixelify-sans/700.css';
import '../styles/accueil.css';
import '../styles/plateforme.css';
import { topbar } from '../platform/topbar';
import { api } from '../platform/api';
import { AVATAR_INVITE, avatarImg } from '../platform/avatars';
import { activePlayer } from '../platform/player';
import { localHistory, type GameId, type StoredResult } from '../platform/results';
import { GAME_NAMES, MODE_NAMES, TIER_NAMES } from '../platform/stats';
import { NIVEAUX, NIVEAU_INFOS, niveauRetenu } from '../platform/niveau';
import { dateCourte, dateLongue, duree, etoiles, score } from '../platform/classement-format';
import { h } from '../platform/dom';
import { demarrerSuivi } from '../platform/suivi';

demarrerSuivi('classements');

interface Row {
  rang?: number;
  nom: string;
  avatar: string;
  score: number;
  famille?: boolean;
  /** Détails de la partie record (absents pour un ancien serveur). */
  parties?: number;
  date?: string;
  gagne?: boolean;
  etoiles?: number;
  duree?: number;
  precision?: number;
}

interface Board {
  jeu: GameId;
  niveau: string;
  mode: string;
  public: Row[];
  famille?: Row[];
}

/** Ordre et présentation des jeux, comme sur l'accueil. */
const JEUX: { jeu: GameId; surtitre: string; page: string }[] = [
  { jeu: 'fusee', surtitre: 'Du village jusqu’aux étoiles', page: 'jeu/decollage.html' },
  { jeu: 'meteores', surtitre: 'Au-dessus de l’archipel', page: 'jeu/pluie-de-meteores.html' },
  { jeu: 'cubes', surtitre: 'L’Atelier des Cubes', page: 'jeu/cubes-de-siege.html' },
  { jeu: 'dragon', surtitre: 'Dans le ciel du soir', page: 'jeu/dragon-gourmand.html' },
];

/**
 * Mascottes : une image `src/images/mascottes/<jeu>.webp` (fusee, meteores, cubes, dragon) s'affiche
 * toute seule sur la bannière du jeu, entre le titre et « Jouer ».
 */
const MASCOTTES = import.meta.glob<string>('../images/mascottes/*.webp', { eager: true, query: '?url', import: 'default' });
const mascotte = (jeu: GameId) => MASCOTTES[`../images/mascottes/${jeu}.webp`];

const root = document.querySelector<HTMLElement>('#contenu')!;
const MEDALS = ['🥇', '🥈', '🥉'];
const MODES = ['defi', 'tranquille'] as const;
const MODE_AIDE: Record<string, string> = { defi: 'avec cœurs et chrono', tranquille: 'rien à perdre' };

const place = (rang: number) => (rang <= 3 ? MEDALS[rang - 1] : `${rang}e`);

/** Infobulle d'une ligne (survol, ou toucher / clavier grâce au focus). */
function bulle(r: Row, titre: string): HTMLElement | null {
  if (!r.date) return null;
  const faits = [
    r.etoiles !== undefined ? h('span', { class: 'etoiles', title: `${r.etoiles} étoile${r.etoiles > 1 ? 's' : ''} sur 3` }, etoiles(r.etoiles)) : null,
    r.gagne !== undefined ? h('span', {}, r.gagne ? 'Partie gagnée' : 'Partie perdue') : null,
    r.precision !== undefined ? h('span', {}, `${Math.round(r.precision * 100)} % de bonnes réponses`) : null,
    r.duree ? h('span', {}, `en ${duree(r.duree)}`) : null,
  ].filter((x): x is HTMLSpanElement => x !== null);
  return h('span', { class: 'bulle', role: 'tooltip' },
    h('b', {}, titre),
    h('span', { class: 'bulle-date' }, `Le ${dateLongue(r.date)}`),
    h('span', { class: 'bulle-faits' }, ...faits),
    r.parties ? h('span', { class: 'bulle-parties' }, r.parties > 1 ? `${r.parties} parties classées à ce niveau` : 'Une seule partie à ce niveau : record du premier coup !') : null);
}

function rowEl(r: Row, me: string | undefined, guest = false): HTMLElement {
  const moi = guest || (r.famille && r.nom === me);
  const cls = [
    r.rang && r.rang <= 3 ? `podium-${r.rang}` : '',
    r.famille ? 'famille' : '',
    moi && !guest ? 'moi' : '',
    guest ? 'invite' : '',
  ].filter(Boolean).join(' ');
  const info = bulle(r, guest ? 'Ton record sur cet appareil' : `Record de ${r.nom}`);
  return h('li', { class: cls || undefined, tabindex: info ? 0 : undefined },
    h('span', { class: 'rang' }, r.rang ? place(r.rang) : guest ? 'toi' : ''),
    avatarImg(r.avatar, 40, ''),
    h('span', { class: 'qui' },
      h('span', { class: 'nom' }, r.nom, moi && !guest ? h('span', { class: 'etiquette' }, 'toi') : null),
      r.date ? h('time', { class: 'quand', datetime: r.date }, dateCourte(r.date)) : null),
    h('span', { class: 'score' }, score(r.score)),
    info);
}

/** Un classement : le top, puis les joueurs de la famille plus loin (avec leur rang), ou le score de l'invité. */
function boardEl(b: Board, page: string, me: string | undefined, guest: StoredResult | null, mien: boolean): HTMLElement {
  const top = b.public.filter((r) => (r.rang ?? 0) <= 5);
  const after = b.public.filter((r) => (r.rang ?? 0) > 5);
  const list = h('ol', { class: 'podium' }, ...top.map((r) => rowEl(r, me)));
  if (after.length > 0) list.append(h('li', { class: 'ellipse', 'aria-hidden': 'true' }, '⋮'), ...after.map((r) => rowEl(r, me)));
  if (guest) {
    list.append(rowEl({ nom: 'Toi (cet appareil)', avatar: AVATAR_INVITE, score: guest.score, date: guest.date, gagne: guest.gagne,
      etoiles: guest.etoiles, duree: guest.duree, precision: guest.precision }, me, true));
  }
  const vide = b.public.length === 0 && !guest;
  const info = NIVEAU_INFOS[b.niveau as keyof typeof NIVEAU_INFOS];
  const rang = NIVEAUX.indexOf(b.niveau as (typeof NIVEAUX)[number]) + 1;
  return h('section', { class: `classement${vide ? ' vide' : ''}${mien ? ' mon-niveau' : ''}`, 'data-niveau': b.niveau },
    h('header', {},
      h('span', { class: 'crans', 'aria-hidden': 'true' }, ...[1, 2, 3, 4].map((i) => h('i', { class: i <= rang ? 'plein' : undefined }))),
      h('h3', {}, TIER_NAMES[b.niveau] ?? b.niveau),
      info ? h('span', { class: 'public' }, info.public) : null,
      mien ? h('span', { class: 'etiquette' }, 'ton niveau') : null),
    vide
      ? h('p', { class: 'personne' }, 'Personne pour l’instant. ',
        h('a', { href: `${page}?niveau=${b.niveau}` }, 'À toi de jouer !'))
      : list);
}

/** Classement en famille : seulement les tableaux où au moins deux profils ont joué (renvoyés par le serveur). */
function familyCard(boards: Board[]): HTMLElement | null {
  const played = boards.filter((b) => b.famille);
  if (played.length === 0) return null;
  // Repliée par défaut : les joueurs de la famille ressortent déjà dans chaque tableau.
  return h('details', { class: 'carte famille-classements' },
    h('summary', {}, h('h2', {}, 'Dans la famille'), h('span', { class: 'discret' }, `${played.length} tableau${played.length > 1 ? 'x' : ''} où plusieurs d’entre vous ont joué`)),
    h('ul', {}, ...played.map((b) => h('li', {},
      h('b', {}, `${GAME_NAMES[b.jeu]} · ${TIER_NAMES[b.niveau] ?? b.niveau} · ${MODE_NAMES[b.mode] ?? b.mode} : `),
      ...b.famille!.flatMap((r, i) => [i > 0 ? ' · ' : '', `${MEDALS[i] ?? `${i + 1}e`} ${r.nom} ${score(r.score)}`]),
    ))));
}

/** Meilleure place du joueur actif (ou d'un membre de la famille) dans un jeu, pour la bannière. */
function meilleurePlace(boards: Board[], me: string | undefined): { rang: number; b: Board } | null {
  let best: { rang: number; b: Board } | null = null;
  for (const b of boards) {
    const r = b.public.find((x) => x.famille && x.nom === me);
    if (r?.rang && (!best || r.rang < best.rang)) best = { rang: r.rang, b };
  }
  return best;
}

/** Bannière du jeu : illustration de l'accueil en fond, emblème, titre, mascotte éventuelle, « Jouer ». */
function banniere(jeu: GameId, surtitre: string, page: string, boards: Board[], me: string | undefined): HTMLElement {
  const nb = new Set(boards.flatMap((b) => b.public.map((r) => r.nom))).size;
  const pl = meilleurePlace(boards, me);
  const img = mascotte(jeu);
  return h('header', { class: 'banniere' },
    h('span', { class: 'banniere-fond', 'aria-hidden': 'true' }),
    h('span', { class: 'embleme', 'aria-hidden': 'true' }),
    h('div', { class: 'banniere-texte' },
      h('p', { class: 'surtitre' }, surtitre),
      h('h2', {}, GAME_NAMES[jeu]),
      h('p', { class: 'resume' },
        pl ? h('span', { class: 'ma-place' }, `${place(pl.rang)} Ta meilleure place : ${pl.rang === 1 ? '1re' : `${pl.rang}e`} en ${TIER_NAMES[pl.b.niveau]} · ${MODE_NAMES[pl.b.mode]}`)
          : nb > 0 ? `${nb} joueur${nb > 1 ? 's' : ''} sur les podiums` : 'Aucun record pour l’instant : le premier sera le tien ?')),
    img ? h('img', { class: 'mascotte', src: img, alt: '', 'aria-hidden': 'true' }) : h('span', { class: 'mascotte place-libre', 'aria-hidden': 'true' }),
    h('a', { class: 'jouer', href: page }, 'Jouer', h('span', { class: 'visuel-masque' }, ` à ${GAME_NAMES[jeu]}`)));
}

/** Onglets Défi / Tranquille d'un jeu ; le choix est commun à tous les jeux et retenu sur l'appareil. */
const CLE_MODE = 'calcoolos.classements.mode';
function modeRetenu(): string {
  try {
    const v = localStorage.getItem(CLE_MODE);
    return v === 'tranquille' ? v : 'defi';
  } catch {
    return 'defi';
  }
}

function choisirMode(mode: string): void {
  for (const tab of document.querySelectorAll<HTMLButtonElement>('.onglets-mode [role="tab"]')) {
    const on = tab.dataset.mode === mode;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
  }
  for (const panel of document.querySelectorAll<HTMLElement>('.niveaux[data-mode]')) panel.hidden = panel.dataset.mode !== mode;
  try {
    localStorage.setItem(CLE_MODE, mode);
  } catch {
    /* navigation privée : le choix ne sera pas retenu */
  }
}

function onglets(jeu: GameId): HTMLElement {
  const tabs = MODES.map((mode) => h('button', { type: 'button', role: 'tab', id: `onglet-${jeu}-${mode}`, 'data-mode': mode, 'aria-controls': `niveaux-${jeu}-${mode}` },
    h('b', {}, MODE_NAMES[mode]), h('small', {}, MODE_AIDE[mode])));
  const bar = h('div', { class: 'onglets-mode', role: 'tablist', 'aria-label': `Mode de ${GAME_NAMES[jeu]}` }, ...tabs);
  bar.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]');
    if (tab?.dataset.mode) choisirMode(tab.dataset.mode);
  });
  bar.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const other = tabs.find((t) => t.getAttribute('aria-selected') !== 'true');
    if (other?.dataset.mode) {
      choisirMode(other.dataset.mode);
      other.focus();
    }
  });
  return bar;
}

void (async () => {
  const state = await topbar('classements');
  const joueur = activePlayer();
  const me = joueur?.pseudo;
  root.replaceChildren(h('h1', {}, 'Classements'), h('p', { class: 'chapeau' }, 'Chargement…'));
  const r = await api.get<{ classements: Board[] }>('/classements').catch(() => null);
  if (r?.status !== 200) {
    root.replaceChildren(h('h1', {}, 'Classements'),
      h('p', { class: 'message erreur' }, state ? r?.data.erreur ?? 'Le serveur ne répond pas.' : 'Les classements ont besoin du serveur : indisponible pour le moment.'));
    return;
  }
  const boards = r.data.classements;
  const connected = state?.connecte === true;
  const monNiveau = (connected ? joueur?.niveau : null) ?? niveauRetenu();
  // Invité : ses parties restent sur l'appareil ; on glisse son meilleur score dans chaque classement.
  const history = connected ? [] : localHistory();
  const guestBest = (b: Board) => history
    .filter((x) => x.jeu === b.jeu && x.niveau === b.niveau && x.mode === b.mode)
    .reduce<StoredResult | null>((m, x) => (!m || x.score > m.score ? x : m), null);

  const sections = JEUX.map(({ jeu, surtitre, page }) => {
    const mine = boards.filter((b) => b.jeu === jeu);
    return h('section', { class: 'jeu-classements', id: `jeu-${jeu}`, 'data-univers': jeu, 'aria-label': GAME_NAMES[jeu] },
      banniere(jeu, surtitre, page, mine, me),
      onglets(jeu),
      ...MODES.map((mode) => h('div', { class: 'niveaux', 'data-mode': mode, role: 'tabpanel', id: `niveaux-${jeu}-${mode}`, 'aria-labelledby': `onglet-${jeu}-${mode}` },
        ...mine.filter((b) => b.mode === mode).map((b) => boardEl(b, page, me, connected ? null : guestBest(b), b.niveau === monNiveau)))));
  });
  root.replaceChildren(
    h('h1', {}, 'Classements'),
    h('p', { class: 'chapeau' }, 'Les meilleurs scores de chaque jeu, niveau par niveau, en Défi et en Tranquille. Toutes les parties comptent, gagnées ou perdues, tant que le score est jugé vraisemblable par le serveur. Survole (ou touche) une ligne pour voir le détail du record.'),
    h('nav', { class: 'sommaire-jeux', 'aria-label': 'Aller au jeu' },
      ...JEUX.map(({ jeu }) => h('a', { href: `#jeu-${jeu}`, 'data-univers': jeu }, h('span', { class: 'embleme', 'aria-hidden': 'true' }), GAME_NAMES[jeu]))),
    connected
      ? familyCard(boards) ?? ''
      : h('section', { class: 'carte invite-classements' },
        h('p', {}, 'En mode invité, tes scores restent sur cet appareil : ils apparaissent ici en pointillés, mais pas dans le classement des autres. Pour y entrer, gagné ou perdu : ',
          h('a', { class: 'bouton petit', href: 'compte.html#inscription' }, 'Créer mon compte'))),
    ...sections,
  );
  choisirMode(modeRetenu());
})();
