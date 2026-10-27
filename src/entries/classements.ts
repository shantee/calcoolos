import '../i18n/page';
import '@fontsource-variable/bricolage-grotesque';
import '../styles/accueil.css';
import '../styles/plateforme.css';
import { topbar } from '../platform/topbar';
import { api } from '../platform/api';
import { avatarImg } from '../platform/avatars';
import { activePlayer } from '../platform/player';
import { lastGame, localHistory } from '../platform/results';
import { GAME_NAMES, MODE_NAMES, TIER_NAMES } from '../platform/stats';
import { h } from '../platform/dom';

interface Row {
  rang?: number;
  nom: string;
  avatar: string;
  score: number;
}

const root = document.querySelector<HTMLElement>('#contenu')!;

function select(name: string, options: Record<string, string>, value: string): HTMLSelectElement {
  const s = h('select', { name, id: `choix-${name}` });
  for (const [id, label] of Object.entries(options)) s.append(h('option', { value: id, selected: id === value }, label));
  return s;
}

function table(rows: Row[], ranked: boolean): HTMLElement {
  if (rows.length === 0) return h('p', { class: 'discret' }, 'Personne pour l’instant.');
  return h('div', { class: 'defile' }, h('table', { class: 'tableau' },
    h('thead', {}, h('tr', {}, h('th', { class: 'nombre' }, '#'), h('th', {}, 'Joueur'), h('th', { class: 'nombre' }, 'Meilleur score'))),
    h('tbody', {}, ...rows.map((r, i) => h('tr', {},
      h('td', { class: 'nombre' }, String(ranked ? r.rang ?? i + 1 : i + 1)),
      h('td', {}, avatarImg(r.avatar, 32, ''), r.nom),
      h('td', { class: 'nombre' }, String(r.score)),
    ))),
  ));
}

void (async () => {
  const state = await topbar('classements');
  const tier = activePlayer()?.niveau ?? (() => {
    try {
      return localStorage.getItem('calcoolos.niveau') ?? 'explorateur';
    } catch {
      return 'explorateur';
    }
  })();
  // On ouvre sur la dernière partie jouée ici, sinon sur le Dragon en Défi.
  const last = lastGame();
  const jeu = select('jeu', GAME_NAMES, last && last.jeu in GAME_NAMES ? last.jeu : 'dragon');
  const niveau = select('niveau', TIER_NAMES, last && last.niveau in TIER_NAMES ? last.niveau : tier);
  const mode = select('mode', MODE_NAMES, last && last.mode in MODE_NAMES ? last.mode : 'defi');
  const out = h('div', { 'aria-live': 'polite' });
  const load = async () => {
    out.replaceChildren(h('p', { class: 'discret' }, 'Chargement…'));
    const r = await api.get<{ public: Row[]; famille?: Row[] }>(`/classements?jeu=${jeu.value}&niveau=${niveau.value}&mode=${mode.value}`).catch(() => null);
    if (r?.status !== 200) {
      out.replaceChildren(h('p', { class: 'message erreur' }, state ? r?.data.erreur ?? 'Le serveur ne répond pas.' : 'Les classements ont besoin du serveur : indisponible pour le moment.'));
      return;
    }
    const cards = [h('section', { class: 'carte' }, h('h2', {}, 'Classement public'), table(r.data.public, true))];
    if (r.data.famille) cards.push(h('section', { class: 'carte' }, h('h2', {}, 'Dans la famille'), table(r.data.famille, false)));
    else cards.push(guestCard());
    out.replaceChildren(h('div', { class: 'grille' }, ...cards));
  };
  // Invité : ses parties restent sur l'appareil ; on lui montre son meilleur score et comment entrer au classement.
  const guestCard = () => {
    const best = localHistory()
      .filter((x) => x.jeu === jeu.value && x.niveau === niveau.value && x.mode === mode.value)
      .reduce((m, x) => Math.max(m, x.score), -1);
    return h('section', { class: 'carte' }, h('h2', {}, 'Sur cet appareil'),
      best >= 0 ? h('p', {}, 'Ton meilleur score : ', h('b', {}, String(best))) : h('p', { class: 'discret' }, 'Pas encore de partie ici dans ce jeu, ce niveau et ce mode.'),
      h('p', {}, 'En mode invité, les scores restent sur cet appareil. Pour apparaître dans le classement public, gagné ou perdu : '),
      h('a', { class: 'bouton petit', href: 'compte.html#inscription' }, 'Créer mon compte'));
  };
  for (const s of [jeu, niveau, mode]) s.addEventListener('change', () => void load());
  root.replaceChildren(
    h('h1', {}, 'Classements'),
    h('p', { class: 'chapeau' }, 'Un classement par jeu, par niveau et par mode, avec le pseudo de chaque joueur. Toutes les parties comptent, gagnées ou perdues, tant que le score est jugé vraisemblable par le serveur.'),
    h('div', { class: 'onglets' },
      h('label', { class: 'champ' }, 'Jeu', jeu),
      h('label', { class: 'champ' }, 'Niveau', niveau),
      h('label', { class: 'champ' }, 'Mode', mode),
    ),
    out,
  );
  await load();
})();
