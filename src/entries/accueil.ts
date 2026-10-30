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
import { NIVEAU_INFOS, estNiveau, niveauDepart, niveauRetenu, pimentsHtml, retenirNiveau } from '../platform/niveau';
import { basculerFavori, lireFavoris, masquerPresentations, ordonnerJeux, presentationsMasquees } from '../platform/favoris';
import { conseilsAccueil } from '../platform/progres';
import { summarize } from '../platform/stats';
import { api, type AccountState, type Profile } from '../platform/api';
import { h } from '../platform/dom';
import type { TierId } from '../core/difficulty';
import { demarrerSuivi, etapeParcours } from '../platform/suivi';

demarrerSuivi('accueil');

const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="niveau"]')];
/** Liens de lancement : y compris ceux de l'univers du joueur, ajoutés plus tard. */
const links = () => document.querySelectorAll<HTMLAnchorElement>('a[data-jeu]');
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
  for (const a of links()) {
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
        ? [h('b', {}, info.nom), ' : ', h('span', {}, info.detail)]
        : ['Plus il y a de piments, plus les calculs sont corsés. Tu peux changer à tout moment.']),
    );
  }
  document.querySelector('#niveau')?.classList.toggle('a-choisir', !lv);
  for (const r of document.querySelectorAll<HTMLElement>('.rappel-niveau')) {
    const piments = h('span', { class: 'rappel-piments' });
    piments.innerHTML = lv ? pimentsHtml(lv) : '';
    r.dataset.niveau = lv ?? '';
    r.replaceChildren(
      piments,
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
    // Le niveau suit le joueur d'un appareil à l'autre : on l'enregistre sur son profil.
    setActivePlayer({ ...p, niveau: value });
    rafraichirJoueur();
    void api.post<{ profils: Profile[] }>(`/profils/${p.id}/modifier`, { niveau: value }).catch(() => null);
  } else if (source === 'joueur') {
    rafraichirJoueur();
  }
}

for (const r of radios) r.addEventListener('change', () => estNiveau(r.value) && setLevel(r.value, 'joueur'));

// Les piments de chaque niveau, et le rappel du niveau près de chaque bouton « Jouer ».
for (const label of document.querySelectorAll<HTMLElement>('.niveaux label')) {
  const id = label.dataset.niveau;
  const zone = label.querySelector('.niveau-piments');
  if (estNiveau(id) && zone) zone.innerHTML = pimentsHtml(id);
}

function piments(id: TierId): HTMLElement {
  const zone = h('span', { class: 'niveau-piments', 'data-niveau': id, 'aria-hidden': 'true' });
  zone.innerHTML = pimentsHtml(id);
  return zone;
}

function rappelNiveau(): HTMLElement {
  const rappel = h('a', { class: 'rappel-niveau', href: '#niveau', title: 'Changer de niveau' });
  rappel.addEventListener('click', (e) => {
    e.preventDefault();
    allerAuNiveau();
  });
  return rappel;
}

for (const actions of document.querySelectorAll<HTMLElement>('.vitrine .actions')) {
  const rappel = rappelNiveau();
  const jouer = actions.querySelector('.jouer');
  if (jouer) jouer.after(rappel);
  else actions.append(rappel);
}

// Les compétences de chaque jeu, aussi sur ses vignettes (une seule source : la vitrine).
for (const v of document.querySelectorAll<HTMLAnchorElement>('.vignette')) {
  const tags = [...document.querySelectorAll(`${v.getAttribute('href')} .competences li`)].slice(0, 2);
  v.append(h('ul', { class: 'vignette-tags', 'aria-hidden': 'true' }, ...tags.map((li) => h('li', {}, li.textContent ?? ''))));
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
let cible: HTMLAnchorElement | null = null;
if (dialogue) {
  const liste = dialogue.querySelector<HTMLElement>('#choix-niveau-liste');
  for (const [id, info] of Object.entries(NIVEAU_INFOS) as Array<[TierId, (typeof NIVEAU_INFOS)[TierId]]>) {
    const b = h('button', { type: 'button', class: 'choix-niveau-option', 'data-niveau': id },
      piments(id),
      h('span', { class: 'niveau-nom' }, info.nom),
      h('small', {}, info.public),
      h('span', { class: 'choix-niveau-exemple', 'aria-hidden': 'true' }, info.exemple));
    b.addEventListener('click', () => {
      setLevel(id, 'joueur');
      dialogue.close();
      if (cible) window.location.href = cible.href;
    });
    liste?.append(b);
  }
}
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-jeu]');
  if (!a || (confirme && level())) return;
  e.preventDefault();
  cible = a;
  if (dialogue?.showModal) dialogue.showModal();
  else allerAuNiveau();
});

// --- Qui joue ? (compte connecté) ---------------------------------------------------------------
function choisirJoueur(p: Profile | null): void {
  setActivePlayer(p);
  if (p && estNiveau(p.niveau)) setLevel(p.niveau, 'profil');
  rafraichirJoueur();
  if (etat?.connecte) renderPlayers(etat.profils ?? []);
  void renderCarnet();
}

/** « Qui joue ? » : un bouton par profil du compte, plus l'invité. */
function renderPlayers(profiles: Profile[]): void {
  const zone = document.querySelector<HTMLElement>('#qui-joue-zone');
  const list = document.querySelector<HTMLElement>('#qui-joue');
  if (!zone || !list) return;
  // Un seul profil : aucune question à poser.
  zone.hidden = profiles.length === 1;
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
    list.append(h('p', { class: 'discret' }, 'Aucun profil pour l’instant : ', h('a', { href: 'compte.html' }, 'crée-le dans Mon espace'), '.'));
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
  renderUnivers(null);

  if (etat === null) {
    // Serveur injoignable : pas de compte possible pour l'instant, on joue en invité.
    carnet.hidden = true;
    if (invite) invite.querySelector('a')?.remove();
    return;
  }
  if (!etat?.connecte) {
    const parties = localHistory();
    if (parties.length > 0) {
      renderUnivers(parties);
      const etoiles = parties.reduce((a, r) => a + r.etoiles, 0);
      chapeau.replaceChildren(
        `Tu as déjà joué ${parties.length} ${parties.length > 1 ? 'parties' : 'partie'} sur cet appareil (${etoiles} ★). `,
        'Avec un compte gratuit, tes prochaines parties te suivront partout. Ce n’est pas obligatoire : on peut toujours jouer en invité.',
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
      ? 'Choisis un joueur dans « Qui joue ? » : ses parties seront gardées dans le compte.'
      : 'Crée ton profil : un pseudo et un avatar suffisent, et tes parties seront gardées.';
    actions.replaceChildren(h('a', { class: 'bouton-creer', href: 'compte.html' }, (etat.profils?.length ?? 0) > 0 ? 'Mon espace' : 'Créer mon profil'));
    avantages.hidden = false;
    return;
  }
  titre.textContent = `Le carnet de ${p.pseudo}`;
  chapeau.textContent = 'Ces parties sont gardées dans le compte, sur tous les appareils.';
  actions.replaceChildren(
    h('a', { class: 'bouton-creer', href: `tableau.html?profil=${p.id}` }, 'Voir tous les progrès'),
    h('a', { class: 'lien-connexion', href: 'compte.html' }, 'Mon espace'),
  );
  const r = await api.get<{ resultats: StoredResult[] }>(`/profils/${p.id}/resultats`).catch(() => null);
  if (activePlayer()?.id !== p.id) return;
  renderUnivers(r?.status === 200 ? r.data.resultats : []);
  if (r?.status !== 200) return;
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

// --- L'univers du joueur -------------------------------------------------------------------------
interface JeuVitrine {
  id: string;
  nom: string;
  href: string;
  image: string;
  tags: string[];
}

/** Les jeux, lus dans les vitrines de la page : une seule source pour les noms, liens et compétences. */
function jeuxDeLaPage(): JeuVitrine[] {
  return [...document.querySelectorAll<HTMLElement>('.vitrine')].map((v) => ({
    id: v.id.replace('jeu-', ''),
    nom: v.querySelector('h2')?.textContent ?? '',
    href: v.querySelector('a.jouer')?.getAttribute('href') ?? '',
    image: document.querySelector<HTMLImageElement>(`.vignette[href="#${v.id}"] img`)?.src ?? '',
    tags: [...v.querySelectorAll('.competences li')].map((li) => li.textContent ?? ''),
  }));
}

/** `resultats` null : pas d'univers à montrer (nouveau visiteur, ou choix du joueur en attente). */
function renderUnivers(resultats: readonly StoredResult[] | null): void {
  const zone = document.querySelector<HTMLElement>('#univers');
  const ouverture = document.querySelector<HTMLElement>('.ouverture');
  if (!zone || !ouverture) return;
  const p = activePlayer();
  const profil = p?.id ?? null;
  const perso = !!p && resultats !== null;
  document.body.classList.toggle('accueil-perso', perso);
  zone.hidden = resultats === null;
  document.querySelector<HTMLElement>('#jeux')?.toggleAttribute('hidden', resultats !== null && presentationsMasquees(profil));
  if (resultats === null) return;
  // Le joueur retrouve son univers tout en haut ; l'invité qui revient, juste après l'ouverture.
  if (perso) ouverture.before(zone);
  else ouverture.after(zone);

  const jeux = jeuxDeLaPage();
  const parId = new Map(jeux.map((j) => [j.id, j]));
  const records = new Map<string, number>();
  for (const r of resultats) records.set(r.jeu, Math.max(records.get(r.jeu) ?? 0, r.score));
  const dernier = [...resultats].sort((a, b) => b.date.localeCompare(a.date))[0];
  const reprise = dernier ? parId.get(dernier.jeu) : undefined;

  const tete = h('header', { class: 'univers-tete' },
    avatarImg(p?.avatar ?? AVATAR_INVITE, 72, ''),
    h('div', {},
      h('h2', { id: 'univers-titre' }, p ? `Salut ${p.pseudo} !` : 'Content de te revoir !'),
      h('a', { class: 'lien-progres', href: p ? `tableau.html?profil=${p.id}` : 'tableau.html' }, 'Voir mes progrès')),
    rappelNiveau());

  const blocs: HTMLElement[] = [];
  if (reprise) {
    const record = records.get(reprise.id) ?? 0;
    blocs.push(h('a', { class: 'univers-reprise', 'data-jeu': '', href: reprise.href },
      h('img', { src: reprise.image, alt: '', width: 480, height: 360 }),
      h('span', { class: 'reprise-texte' },
        h('small', {}, 'Ton dernier jeu'),
        h('strong', {}, reprise.nom),
        h('span', { class: 'reprise-record' }, `Meilleur score : ${record}`),
        h('span', { class: 'reprise-bouton' }, 'Reprendre'))));
  }
  const conseils = conseilsAccueil(resultats);
  blocs.push(h('div', { class: 'univers-conseils' },
    h('h3', {}, 'Tes conseils du moment'),
    conseils.length
      ? h('ul', {}, ...conseils.map((m) => h('li', { class: `ton-${m.ton}` }, m.texte)))
      : h('p', {}, 'Joue quelques parties : tes conseils apparaîtront ici, d’après tes vrais résultats.')));

  const grille = h('ul', { class: 'univers-jeux' });
  const dessinerGrille = () => {
    const favoris = lireFavoris(profil);
    grille.replaceChildren(...ordonnerJeux(jeux.map((j) => j.id), favoris).map((id) => {
      const j = parId.get(id)!;
      const fav = favoris.includes(id);
      const etoile = h('button', { type: 'button', class: 'favori', 'aria-pressed': String(fav), 'aria-label': `Favori : ${j.nom}`, title: fav ? 'Retirer des favoris' : 'Ajouter aux favoris' }, fav ? '★' : '☆');
      etoile.addEventListener('click', () => {
        basculerFavori(profil, id);
        dessinerGrille();
        apply();
      });
      const record = records.get(id);
      return h('li', { class: 'tuile-jeu' },
        h('a', { 'data-jeu': '', href: j.href },
          h('img', { src: j.image, alt: '', width: 480, height: 360, loading: 'lazy' }),
          h('strong', {}, j.nom),
          h('small', {}, record ? `Meilleur score : ${record}` : 'Pas encore joué'),
          h('span', { class: 'tuile-tags' }, ...j.tags.slice(0, 2).map((t) => h('span', {}, t)))),
        etoile);
    }));
  };
  dessinerGrille();

  const choix = h('input', { type: 'checkbox', checked: !presentationsMasquees(profil) });
  choix.addEventListener('change', () => {
    masquerPresentations(profil, !choix.checked);
    document.querySelector<HTMLElement>('#jeux')?.toggleAttribute('hidden', !choix.checked);
  });

  zone.replaceChildren(tete, h('div', { class: 'univers-haut' }, ...blocs),
    h('h3', {}, 'Mes jeux'),
    h('p', { class: 'univers-aide' }, 'Touche l’étoile : tes favoris passent en premier.'),
    grille,
    h('label', { class: 'univers-option' }, choix, ' Afficher les grandes présentations des jeux'));
  apply();
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
