import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/pixelify-sans/700.css';
import '../styles/accueil.css';
import '../styles/plateforme.css';
import { topbar } from '../platform/topbar';
import { avatarImg } from '../platform/avatars';
import { activePlayer, setActivePlayer } from '../platform/player';
import { flushQueue } from '../platform/results';
import type { Profile } from '../platform/api';

// Le niveau choisi est transmis au jeu (?niveau=…) et retenu localement.
const KEY = 'calcoolos.niveau';
const select = document.querySelector<HTMLSelectElement>('#niveau');
const links = document.querySelectorAll<HTMLAnchorElement>('a[data-jeu]');

function apply(): void {
  if (!select) return;
  for (const a of links) {
    const url = new URL(a.getAttribute('href') ?? '', window.location.href);
    url.searchParams.set('niveau', select.value);
    a.href = url.toString();
  }
}

function setLevel(value: string, remember: boolean): void {
  if (!select || ![...select.options].some((o) => o.value === value)) return;
  select.value = value;
  if (remember) {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignoré */
    }
  }
  apply();
}

if (select) {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) setLevel(saved, false);
  } catch {
    /* stockage indisponible */
  }
  select.addEventListener('change', () => setLevel(select.value, true));
  apply();
}

/** « Qui joue ? » : un bouton par profil de la famille, plus l'invité. */
function renderPlayers(profiles: Profile[]): void {
  const zone = document.querySelector<HTMLElement>('#qui-joue-zone');
  const list = document.querySelector<HTMLElement>('#qui-joue');
  if (!zone || !list) return;
  zone.hidden = false;
  list.replaceChildren();
  const current = activePlayer();
  const add = (label: string, avatar: string, pressed: boolean, onPick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(pressed));
    b.append(avatarImg(avatar, 56, ''), document.createTextNode(label));
    b.addEventListener('click', () => {
      onPick();
      renderPlayers(profiles);
      void topbar('accueil');
    });
    list.append(b);
  };
  for (const p of profiles) {
    add(p.pseudo, p.avatar, current?.id === p.id, () => {
      setActivePlayer(p);
      setLevel(p.niveau, true);
    });
  }
  add('Invité', 'chouette', !current, () => setActivePlayer(null));
  if (profiles.length === 0) {
    const p = document.createElement('p');
    p.className = 'discret';
    p.innerHTML = 'Aucun profil pour l’instant : <a href="compte.html">crée-en un dans l’espace parents</a>.';
    list.append(p);
  }
}

void (async () => {
  const state = await topbar('accueil');
  if (state?.connecte) {
    renderPlayers(state.profils ?? []);
    const p = activePlayer();
    if (p) setLevel(p.niveau, false);
    if (window.location.hash === '#qui-joue') document.querySelector('#qui-joue-zone')?.scrollIntoView();
    await flushQueue();
  }
})();
