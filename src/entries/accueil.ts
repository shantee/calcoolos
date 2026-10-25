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
const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="niveau"]')];
const links = document.querySelectorAll<HTMLAnchorElement>('a[data-jeu]');
// ?calme (comme « réduire les animations ») vaut pour l'accueil et suit dans les jeux.
const calme =
  new URLSearchParams(window.location.search).has('calme') ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function level(): string {
  return radios.find((r) => r.checked)?.value ?? 'explorateur';
}

function apply(): void {
  for (const a of links) {
    const url = new URL(a.getAttribute('href') ?? '', window.location.href);
    url.searchParams.set('niveau', level());
    if (new URLSearchParams(window.location.search).has('calme')) url.searchParams.set('calme', '');
    a.href = url.toString();
  }
}

function setLevel(value: string, remember: boolean): void {
  const radio = radios.find((r) => r.value === value);
  if (!radio) return;
  radio.checked = true;
  if (remember) {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignoré */
    }
  }
  apply();
}

try {
  const saved = localStorage.getItem(KEY);
  if (saved) setLevel(saved, false);
} catch {
  /* stockage indisponible */
}
for (const r of radios) r.addEventListener('change', () => setLevel(r.value, true));
apply();

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

/**
 * Mise en scène de la page : l'ambiance du fond suit le jeu en cours de lecture, le repère de progression
 * s'allume, les vitrines apparaissent en douceur. Sans IntersectionObserver ou en mode calme, tout reste
 * simplement affiché.
 */
function stage(): void {
  const root = document.documentElement;
  const vitrines = [...document.querySelectorAll<HTMLElement>('.vitrine')];
  const reperes = document.querySelector<HTMLElement>('.reperes');
  root.classList.toggle('calme', calme);
  if (!('IntersectionObserver' in window)) return;

  // Ligne de lecture au milieu de l'écran : la vitrine qui la traverse donne l'ambiance.
  const lecture = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        root.dataset.univers = el.dataset.univers ?? 'ouverture';
        for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-repere]')) {
          if (a.dataset.repere === el.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        }
      }
    },
    { rootMargin: '-50% 0px -50% 0px' },
  );
  const ouverture = document.querySelector<HTMLElement>('.ouverture');
  if (ouverture) lecture.observe(ouverture);
  for (const v of vitrines) lecture.observe(v);

  // Le repère n'apparaît qu'une fois les jeux atteints.
  const jeux = document.querySelector('#jeux');
  if (reperes && jeux) {
    new IntersectionObserver(([e]) => reperes.classList.toggle('visible', e.isIntersecting), {
      rootMargin: '-40% 0px -40% 0px',
    }).observe(jeux);
  }

  if (calme) return;
  root.classList.add('anime');
  const apparition = new IntersectionObserver(
    (entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );
  for (const v of vitrines) apparition.observe(v);
}

/** Petits effets au pointeur (souris seulement) : l'illustration suit le regard, « Jouer » attire le curseur. */
function pointer(): void {
  if (calme || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const follow = (el: HTMLElement, onMove: (x: number, y: number) => void) => {
    el.addEventListener('pointermove', (ev) => {
      const r = el.getBoundingClientRect();
      onMove(((ev.clientX - r.left) / r.width) * 2 - 1, ((ev.clientY - r.top) / r.height) * 2 - 1);
    });
    el.addEventListener('pointerleave', () => onMove(0, 0));
  };
  for (const fig of document.querySelectorAll<HTMLElement>('.vitrine-image')) {
    follow(fig, (x, y) => {
      fig.style.setProperty('--px', x.toFixed(3));
      fig.style.setProperty('--py', y.toFixed(3));
    });
  }
  for (const btn of document.querySelectorAll<HTMLElement>('a.jouer')) {
    follow(btn, (x, y) => {
      btn.style.setProperty('--mx', `${(x * 5).toFixed(1)}px`);
      btn.style.setProperty('--my', `${(y * 4).toFixed(1)}px`);
    });
  }
}

stage();
pointer();

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
