import '../i18n/page';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/pixelify-sans/700.css';
import '../styles/accueil.css';
import '../styles/plateforme.css';
import { EVT_JOUEUR, rafraichirJoueur, topbar } from '../platform/topbar';
import { logo } from '../platform/logo';
import { AVATAR_INVITE, avatarImg } from '../platform/avatars';
import { activePlayer, setActivePlayer } from '../platform/player';
import { flushQueue, localHistory, type StoredResult } from '../platform/results';
import { NIVEAU_INFOS, estNiveau, niveauDepart, niveauRetenu, retenirNiveau } from '../platform/niveau';
import { summarize } from '../platform/stats';
import { api, type AccountState, type Profile } from '../platform/api';
import { h } from '../platform/dom';
import type { TierId } from '../core/difficulty';
import { demarrerSuivi, etapeParcours } from '../platform/suivi';

demarrerSuivi('accueil');

const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="niveau"]')];
const links = document.querySelectorAll<HTMLAnchorElement>('a[data-jeu]');
// ?calme (comme « réduire les animations ») vaut pour l'accueil et suit dans les jeux.
const calmeUrl = new URLSearchParams(window.location.search).has('calme');
const calme = calmeUrl || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let etat: AccountState | null | undefined;
/** Faux tant qu'un nouveau venu n'a pas choisi : le premier « Jouer » lui demande alors son niveau. */
let confirme = false;

// --- Logo ---------------------------------------------------------------------------------------
document.querySelector('#titre')?.replaceChildren(logo('grand', { niveau: level }));

// --- Niveau -------------------------------------------------------------------------------------
function level(): TierId | null {
  const v = radios.find((r) => r.checked)?.value;
  return estNiveau(v) ? v : null;
}

/** Les liens « Jouer » emportent le niveau ; les rappels près des boutons l'affichent. */
function apply(): void {
  const lv = level();
  for (const a of links) {
    const url = new URL(a.getAttribute('href') ?? '', window.location.href);
    if (lv) url.searchParams.set('niveau', lv);
    else url.searchParams.delete('niveau');
    if (calmeUrl) url.searchParams.set('calme', '');
    a.href = url.toString();
  }
  const info = lv ? NIVEAU_INFOS[lv] : null;
  const detail = document.querySelector('#niveau-detail');
  if (detail) {
    detail.replaceChildren(
      ...(info
        ? [h('b', {}, info.nom), ' — ', h('span', {}, info.public), '. ', h('span', {}, info.detail)]
        : ['Choisis le niveau qui te correspond : tu pourras en changer à tout moment.']),
    );
  }
  document.querySelector('#niveau')?.classList.toggle('a-choisir', !lv);
  for (const r of document.querySelectorAll<HTMLElement>('.rappel-niveau')) {
    r.replaceChildren(
      avatarImg(info?.avatar ?? AVATAR_INVITE, 34, ''),
      h('span', {}, info ? h('span', {}, 'Niveau ', h('b', {}, info.nom)) : h('b', {}, 'Niveau à choisir'), h('small', {}, info ? 'changer' : 'avant de jouer')),
    );
  }
}

/**
 * source : « joueur » (un clic : retenu sur l'appareil, et sur le profil actif s'il y en a un),
 * « profil » (niveau du profil choisi), « retenu » (retrouvé au chargement).
 */
function setLevel(value: TierId, source: 'joueur' | 'profil' | 'retenu'): void {
  const radio = radios.find((r) => r.value === value);
  if (!radio) return;
  radio.checked = true;
  confirme = true;
  if (source !== 'retenu') retenirNiveau(value);
  if (source === 'joueur') etapeParcours('niveau');
  apply();
  const p = activePlayer();
  if (source === 'joueur' && p && p.niveau !== value && etat?.connecte) {
    // Le niveau suit l'enfant d'un appareil à l'autre : on l'enregistre sur son profil.
    setActivePlayer({ ...p, niveau: value });
    rafraichirJoueur();
    void api.post<{ profils: Profile[] }>(`/profils/${p.id}/modifier`, { niveau: value }).catch(() => null);
  } else if (source === 'joueur') {
    rafraichirJoueur();
  }
}

for (const r of radios) r.addEventListener('change', () => estNiveau(r.value) && setLevel(r.value, 'joueur'));

// Un petit personnage par niveau, et le rappel du niveau près de chaque bouton « Jouer ».
for (const label of document.querySelectorAll<HTMLElement>('.niveaux label')) {
  const id = label.dataset.niveau;
  if (estNiveau(id)) label.querySelector('.niveau-perso')?.append(avatarImg(NIVEAU_INFOS[id].avatar, 64, ''));
}
for (const actions of document.querySelectorAll<HTMLElement>('.vitrine .actions')) {
  const rappel = h('a', { class: 'rappel-niveau', href: '#niveau', title: 'Changer de niveau' });
  rappel.addEventListener('click', (e) => {
    e.preventDefault();
    allerAuNiveau();
  });
  const jouer = actions.querySelector('.jouer');
  if (jouer) jouer.after(rappel);
  else actions.append(rappel);
}

function allerAuNiveau(): void {
  const fs = document.querySelector<HTMLElement>('#niveau');
  if (!fs) return;
  fs.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'center' });
  (radios.find((r) => r.checked) ?? radios[0])?.focus({ preventScroll: true });
  if (!calme) {
    fs.classList.remove('signale');
    void fs.offsetWidth;
    fs.classList.add('signale');
  }
}

{
  const depart = niveauDepart(activePlayer()?.niveau, niveauRetenu());
  if (depart.niveau) setLevel(depart.niveau, 'retenu');
  confirme = depart.confirme;
  apply();
}

// --- Première partie sans niveau : on le demande une fois -----------------------------------------
const dialogue = document.querySelector<HTMLDialogElement>('#choix-niveau');
let cible = '';
if (dialogue) {
  const liste = dialogue.querySelector<HTMLElement>('#choix-niveau-liste');
  for (const [id, info] of Object.entries(NIVEAU_INFOS) as Array<[TierId, (typeof NIVEAU_INFOS)[TierId]]>) {
    const b = h('button', { type: 'button', class: 'choix-niveau-option', 'data-niveau': id },
      avatarImg(info.avatar, 64, ''),
      h('span', { class: 'niveau-nom' }, info.nom),
      h('small', {}, info.public),
      h('span', { class: 'choix-niveau-exemple', 'aria-hidden': 'true' }, info.exemple));
    b.addEventListener('click', () => {
      setLevel(id, 'joueur');
      dialogue.close();
      const a = [...links].find((l) => l.dataset.cible === cible);
      if (a) window.location.href = a.href;
    });
    liste?.append(b);
  }
}
links.forEach((a, i) => {
  a.dataset.cible = String(i);
  a.addEventListener('click', (e) => {
    if (confirme && level()) return;
    e.preventDefault();
    cible = a.dataset.cible ?? '';
    if (dialogue?.showModal) dialogue.showModal();
    else allerAuNiveau();
  });
});

// --- Qui joue ? (compte connecté) ---------------------------------------------------------------
function choisirJoueur(p: Profile | null): void {
  setActivePlayer(p);
  if (p && estNiveau(p.niveau)) setLevel(p.niveau, 'profil');
  rafraichirJoueur();
  if (etat?.connecte) renderPlayers(etat.profils ?? []);
  void renderCarnet();
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
    const b = h('button', { type: 'button', 'aria-pressed': String(pressed) }, avatarImg(avatar, 56, ''), label);
    b.addEventListener('click', onPick);
    list.append(b);
  };
  for (const p of profiles) add(p.pseudo, p.avatar, current?.id === p.id, () => choisirJoueur(p));
  add('Invité', AVATAR_INVITE, !current, () => choisirJoueur(null));
  if (profiles.length === 0) {
    list.append(h('p', { class: 'discret' }, 'Aucun profil pour l’instant : ', h('a', { href: 'compte.html' }, 'crée-en un dans l’espace famille'), '.'));
  }
}

// La barre prévient quand on change de joueur depuis son panneau : on met la page à jour sans la recharger.
window.addEventListener(EVT_JOUEUR, (e) => {
  e.preventDefault();
  const joueur = (e as CustomEvent<{ id: number } | null>).detail;
  const p = etat?.profils?.find((x) => x.id === joueur?.id) ?? null;
  choisirJoueur(p);
});

// --- Le carnet : avantages d'un compte (visiteur) ou vrais progrès du joueur ---------------------
async function renderCarnet(): Promise<void> {
  const carnet = document.querySelector<HTMLElement>('#carnet');
  const titre = document.querySelector<HTMLElement>('#carnet-titre');
  const chapeau = document.querySelector<HTMLElement>('#carnet-chapeau');
  const actions = document.querySelector<HTMLElement>('#carnet-actions');
  const avantages = document.querySelector<HTMLElement>('#avantages');
  if (!carnet || !titre || !chapeau || !actions || !avantages) return;
  const invite = document.querySelector<HTMLElement>('#statut-invite');

  if (etat === null) {
    // Serveur injoignable : pas de compte possible pour l'instant, on joue en invité.
    carnet.hidden = true;
    if (invite) invite.querySelector('a')?.remove();
    return;
  }
  if (!etat?.connecte) {
    const parties = localHistory();
    if (parties.length > 0) {
      const etoiles = parties.reduce((a, r) => a + r.etoiles, 0);
      chapeau.replaceChildren(
        `Tu as déjà joué ${parties.length} ${parties.length > 1 ? 'parties' : 'partie'} sur cet appareil (${etoiles} ★). `,
        'Avec un compte gratuit, ouvert par un parent, tes prochaines parties te suivront partout. Ce n’est pas obligatoire : on peut toujours jouer en invité.',
      );
    }
    return;
  }

  // Compte connecté.
  if (invite) invite.hidden = true;
  carnet.classList.add('carnet-connecte');
  const p = activePlayer();
  if (!p) {
    titre.textContent = 'Qui joue aujourd’hui ?';
    chapeau.textContent = (etat.profils?.length ?? 0) > 0
      ? 'Choisis un joueur dans « Qui joue ? » : ses parties seront gardées dans l’espace famille.'
      : 'Ajoute un profil pour chaque enfant (un pseudo et un avatar suffisent) : ses parties seront gardées.';
    actions.replaceChildren(h('a', { class: 'bouton-creer', href: 'compte.html' }, (etat.profils?.length ?? 0) > 0 ? 'Espace famille' : 'Ajouter un profil'));
    avantages.hidden = false;
    return;
  }
  titre.textContent = `Le carnet de ${p.pseudo}`;
  chapeau.textContent = 'Ses parties sont gardées dans l’espace famille, sur tous vos appareils.';
  actions.replaceChildren(
    h('a', { class: 'bouton-creer', href: `tableau.html?profil=${p.id}` }, 'Voir tous ses progrès'),
    h('a', { class: 'lien-connexion', href: 'compte.html' }, 'Espace famille'),
  );
  const r = await api.get<{ resultats: StoredResult[] }>(`/profils/${p.id}/resultats`).catch(() => null);
  if (r?.status !== 200 || activePlayer()?.id !== p.id) return;
  const s = summarize(r.data.resultats);
  const record = s.records.reduce<(typeof s.records)[number] | null>((m, x) => (!m || x.score > m.score ? x : m), null);
  const succes = s.badges.filter((b) => b.earned).length;
  const tuile = (valeur: string, texte: string, couleur: string) =>
    h('li', { class: 'chiffre-carnet', style: `--c: ${couleur}` }, h('strong', {}, valeur), h('span', {}, texte));
  avantages.replaceChildren(
    tuile(String(s.games), s.games > 1 ? 'parties jouées' : 'partie jouée', 'var(--ciel)'),
    tuile(`${s.stars} ★`, 'étoiles gagnées', 'var(--safran)'),
    tuile(`${succes} / ${s.badges.length}`, 'succès débloqués', 'var(--corail)'),
    tuile(record ? String(record.score) : '–', record ? 'meilleur score' : 'pas encore de record', 'var(--sarcelle)'),
  );
  avantages.classList.add('avantages-chiffres');
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
  for (const v of [...vitrines, ...document.querySelectorAll<HTMLElement>('.carnet')]) apparition.observe(v);
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
  etat = await topbar('accueil');
  if (etat?.connecte) {
    renderPlayers(etat.profils ?? []);
    const p = activePlayer();
    if (p && estNiveau(p.niveau)) setLevel(p.niveau, 'profil');
    if (window.location.hash === '#qui-joue') document.querySelector('#qui-joue-zone')?.scrollIntoView();
  }
  await renderCarnet();
  if (etat?.connecte) await flushQueue();
})();
