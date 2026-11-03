import '../i18n/page';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/pixelify-sans/700.css';
import '../styles/accueil.css';
import '../styles/plateforme.css';
import { EVT_JOUEUR, rafraichirJoueur, topbar } from '../platform/topbar';
import { logo } from '../platform/logo';
import { motsVifs } from '../platform/mots-vifs';
import { AVATAR_INVITE, avatarImg } from '../platform/avatars';
import { activePlayer, setActivePlayer } from '../platform/player';
import { flushQueue, lastGame, type StoredResult } from '../platform/results';
import { lienCompte } from '../platform/acces';
import { EXEMPLES_PAR_JEU, NIVEAU_INFOS, estNiveau, familleDuJeu, niveauDepart, niveauRetenu, retenirNiveau } from '../platform/niveau';
import { monterManege, type Manege } from '../platform/manege';
import { basculerFavori, lireFavoris, masquerPresentations, ordonnerJeux, presentationsMasquees } from '../platform/favoris';
import { conseilsAccueil } from '../platform/progres';
import { summarize } from '../platform/stats';
import { api, type AccountState, type Profile } from '../platform/api';
import { h } from '../platform/dom';
import type { TierId } from '../core/difficulty';
import { demarrerSuivi, etapeParcours } from '../platform/suivi';

demarrerSuivi('accueil');

/** Liens de lancement : y compris ceux de l'univers du joueur, ajoutés plus tard. */
const links = () => document.querySelectorAll<HTMLAnchorElement>('a[data-jeu]');
// ?calme (comme « réduire les animations ») vaut pour l'accueil et suit dans les jeux.
const calmeUrl = new URLSearchParams(window.location.search).has('calme');
const calme = calmeUrl || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let etat: AccountState | null | undefined;
/** Se résout avec la réponse du serveur : un clic sur « Jouer » avant elle l'attend (compte ou visiteur ?). */
let etatConnu: (e: AccountState | null) => void = () => {};
const etatPret = new Promise<AccountState | null>((r) => (etatConnu = r));
/** Dernier niveau choisi : proposé d'office au lancement d'un jeu. Rien pour un nouveau venu. */
let niveauActuel: TierId | null = null;
let leManege: Manege | null = null;

// --- Logo ---------------------------------------------------------------------------------------
document.querySelector('#titre')?.replaceChildren(logo('grand', { niveau: level }));
motsVifs(document.querySelector<HTMLElement>('#mots-vifs'));

// --- Niveau -------------------------------------------------------------------------------------
function level(): TierId | null {
  return niveauActuel;
}

/** Les liens de lancement emportent le dernier niveau (si la fenêtre n'est pas disponible) et le mode calme. */
function apply(): void {
  for (const a of links()) {
    const url = new URL(a.getAttribute('href') ?? '', window.location.href);
    if (!a.hasAttribute('data-sans-choix')) {
      if (niveauActuel) url.searchParams.set('niveau', niveauActuel);
      else url.searchParams.delete('niveau');
    }
    if (calmeUrl) url.searchParams.set('calme', '');
    a.href = url.toString();
  }
}

/**
 * source : « joueur » (retenu sur l'appareil, et sur le profil actif s'il y en a un),
 * « profil » (niveau du profil choisi), « retenu » (retrouvé au chargement).
 * La promesse se termine quand le profil est enregistré.
 */
async function setLevel(value: TierId, source: 'joueur' | 'profil' | 'retenu'): Promise<void> {
  niveauActuel = value;
  if (source !== 'retenu') retenirNiveau(value);
  if (source === 'joueur') etapeParcours('niveau');
  apply();
  const p = activePlayer();
  if (source !== 'joueur') return;
  if (p && p.niveau !== value && etat?.connecte) {
    // Le niveau suit le joueur d'un appareil à l'autre : on l'enregistre sur son profil.
    setActivePlayer({ ...p, niveau: value });
    rafraichirJoueur();
    await api.post<{ profils: Profile[] }>(`/profils/${p.id}/modifier`, { niveau: value }).catch(() => null);
  } else {
    rafraichirJoueur();
  }
}

/** Pastille colorée du niveau (« CE1 », ★ pour Aventurier). */
function pastille(id: TierId): HTMLElement {
  return h('span', { class: 'niveau-pastille', 'data-niveau': id, 'aria-hidden': 'true' }, NIVEAU_INFOS[id].sigle);
}

{
  const depart = niveauDepart(activePlayer()?.niveau, niveauRetenu());
  if (depart.niveau) void setLevel(depart.niveau, 'retenu');
  apply();
}

// --- La difficulté se choisit au lancement de chaque jeu ------------------------------------------
/** Laisse le temps d'enregistrer le niveau sur le profil, sans jamais retarder le jeu davantage. */
const ATTENTE_PROFIL_MS = 400;
const dialogue = document.querySelector<HTMLDialogElement>('#choix-niveau');
const options = new Map<TierId, HTMLButtonElement>();
let cible: HTMLAnchorElement | null = null;
if (dialogue) {
  const liste = dialogue.querySelector<HTMLElement>('#choix-niveau-liste');
  for (const [id, info] of Object.entries(NIVEAU_INFOS) as Array<[TierId, (typeof NIVEAU_INFOS)[TierId]]>) {
    const b = h('button', { type: 'button', class: 'choix-niveau-option', 'data-niveau': id },
      pastille(id),
      h('span', { class: 'niveau-nom' }, info.long),
      h('span', { class: 'choix-niveau-exemple', 'aria-hidden': 'true' }),
      h('small'));
    b.addEventListener('click', async () => {
      await Promise.race([setLevel(id, 'joueur'), new Promise((fini) => setTimeout(fini, ATTENTE_PROFIL_MS))]);
      if (cible) window.location.href = cible.href;
    });
    options.set(id, b);
    liste?.append(b);
  }
  // Un clic à côté de la fenêtre l'annule.
  dialogue.addEventListener('click', (e) => {
    if (e.target === dialogue) dialogue.close();
  });
}
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-jeu]:not([data-sans-choix])');
  if (!a || !dialogue?.showModal) return;
  e.preventDefault();
  void (async () => {
    // Plus de mode invité : sans compte, on propose d'abord de s'inscrire ou de se connecter.
    if (!peutJouer(etat === undefined ? await etatPret : etat)) proposerCompte(a);
    else ouvrirChoix(a);
  })();
});

/** Peut-on lancer un jeu d'ici ? Compte connecté, ou serveur injoignable avec un joueur déjà choisi sur l'appareil. */
function peutJouer(e: AccountState | null): boolean {
  return !!e?.connecte || (e === null && activePlayer() !== null);
}

/** Nom du jeu d'un lien de lancement (vitrine ou tuile). */
function nomDuJeu(a: HTMLAnchorElement): string {
  return a.closest('.vitrine')?.querySelector('h2')?.textContent ?? a.querySelector('strong')?.textContent ?? '';
}

/** « decollage » pour un lien vers jeu/decollage.html. */
function slugDuJeu(a: HTMLAnchorElement): string | null {
  return /\/jeu\/([a-z0-9-]+)\.html$/.exec(new URL(a.href).pathname)?.[1] ?? null;
}

const compteRequis = document.querySelector<HTMLDialogElement>('#compte-requis');
compteRequis?.addEventListener('click', (e) => {
  if (e.target === compteRequis) compteRequis.close();
});

/** Visiteur : la fenêtre « crée ton compte ou connecte-toi », qui ramènera au choix du niveau de ce jeu. */
function proposerCompte(a: HTMLAnchorElement): void {
  if (!compteRequis?.showModal) {
    window.location.href = lienCompte(retourVers(a), 'inscription');
    return;
  }
  compteRequis.querySelector('#compte-requis-jeu')?.replaceChildren(nomDuJeu(a));
  const retour = retourVers(a);
  compteRequis.querySelector<HTMLAnchorElement>('#compte-requis-inscription')?.setAttribute('href', lienCompte(retour, 'inscription'));
  compteRequis.querySelector<HTMLAnchorElement>('#compte-requis-connexion')?.setAttribute('href', lienCompte(retour, 'connexion'));
  compteRequis.showModal();
  compteRequis.querySelector<HTMLElement>('#compte-requis-inscription')?.focus();
}

/** Après connexion, retour à l'accueil sur ce jeu, fenêtre du niveau ouverte (`index.html?jouer=decollage`). */
function retourVers(a: HTMLAnchorElement): string {
  const slug = slugDuJeu(a);
  const calmeQ = calmeUrl ? '&calme' : '';
  return slug ? `index.html?jouer=${slug}${calmeQ}` : 'index.html';
}

/** La fenêtre du choix de la difficulté, pour ce lien de lancement. */
function ouvrirChoix(a: HTMLAnchorElement): void {
  if (!dialogue?.showModal) {
    window.location.href = a.href;
    return;
  }
  cible = a;
  dialogue.querySelector('#choix-niveau-jeu')?.replaceChildren(nomDuJeu(a));
  const exemples = EXEMPLES_PAR_JEU[familleDuJeu(a.href)];
  for (const [id, b] of options) {
    const { exemple, detail } = exemples[id];
    b.querySelector('.choix-niveau-exemple')?.replaceChildren(exemple);
    b.querySelector('small')?.replaceChildren(detail);
    b.classList.toggle('choisi', id === niveauActuel);
  }
  dialogue.showModal();
  options.get(niveauActuel ?? 'cp')?.focus();
}

/**
 * Retour de la connexion (`?jouer=decollage`) : le manège se place sur ce jeu et la fenêtre du niveau s'ouvre.
 * Le paramètre est retiré de l'adresse, pour ne pas rouvrir la fenêtre à chaque rechargement.
 */
function reprendreLancement(): void {
  const url = new URL(window.location.href);
  const slug = url.searchParams.get('jouer');
  if (slug === null) return;
  url.searchParams.delete('jouer');
  history.replaceState(history.state, '', url.toString());
  if (!peutJouer(etat ?? null)) return;
  const a = [...document.querySelectorAll<HTMLAnchorElement>('.vitrine a.jouer[data-jeu]')].find((l) => slugDuJeu(l) === slug);
  if (!a) return;
  const vitrines = [...document.querySelectorAll('.vitrine')];
  const i = vitrines.indexOf(a.closest('.vitrine') as Element);
  if (i >= 0) leManege?.aller(i);
  ouvrirChoix(a);
}

// --- Qui joue ? (compte connecté) ---------------------------------------------------------------
function choisirJoueur(p: Profile | null): void {
  setActivePlayer(p);
  if (p && estNiveau(p.niveau)) void setLevel(p.niveau, 'profil');
  rafraichirJoueur();
  if (etat?.connecte) renderPlayers(etat.profils ?? []);
  void renderCarnet();
}

/** « Qui joue ? » : un bouton par profil du compte. */
function renderPlayers(profiles: Profile[]): void {
  const zone = document.querySelector<HTMLElement>('#qui-joue-zone');
  const list = document.querySelector<HTMLElement>('#qui-joue');
  if (!zone || !list) return;
  // Un seul profil (déjà choisi) : aucune question à poser.
  zone.hidden = profiles.length === 1 && activePlayer() !== null;
  list.replaceChildren();
  const current = activePlayer();
  const add = (label: string, avatar: string, pressed: boolean, onPick: () => void) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(pressed) }, avatarImg(avatar, 56, ''), label);
    b.addEventListener('click', onPick);
    list.append(b);
  };
  for (const p of profiles) add(p.pseudo, p.avatar, current?.id === p.id, () => choisirJoueur(p));
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
  const visiteur = document.querySelector<HTMLElement>('#accueil-visiteur');
  renderUnivers(null);

  if (etat === null) {
    // Serveur injoignable : ni connexion ni inscription possibles pour l'instant.
    carnet.hidden = true;
    if (visiteur) visiteur.hidden = true;
    return;
  }
  // Visiteur : page d'accueil épurée (logo, manège, carnet des avantages), sans tableau de bord.
  // L'ancien historique invité de ce navigateur n'est plus montré (ni effacé).
  if (!etat?.connecte) return;

  // Compte connecté.
  if (visiteur) visiteur.hidden = true;
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
    // Première entrée du srcset : la plus petite image, assez grande pour une tuile.
    image: v.querySelector('img')?.srcset.split(' ')[0] ?? '',
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
  // Le joueur retrouve son univers tout en haut.
  if (perso) ouverture.before(zone);
  else document.querySelector('#jeux')?.after(zone);

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
      h('a', { class: 'lien-progres', href: p ? `tableau.html?profil=${p.id}` : 'tableau.html' }, 'Voir mes progrès')));

  const blocs: HTMLElement[] = [];
  if (reprise) {
    const record = records.get(reprise.id) ?? 0;
    // « Reprendre » relance au niveau de la dernière partie, sans repasser par le choix.
    // Sur un autre appareil, seul le serveur connaît le dernier jeu : le manège s'y place aussi.
    if (!window.location.hash) leManege?.aller(jeux.indexOf(reprise));
    const lien = new URL(reprise.href, window.location.href);
    // Dernière partie jouée à un ancien niveau à piments : pas de classe devinée, la fenêtre de choix s'ouvre.
    const connu = estNiveau(dernier.niveau);
    if (connu) lien.searchParams.set('niveau', dernier.niveau);
    blocs.push(h('a', { class: 'univers-reprise', 'data-jeu': '', ...(connu ? { 'data-sans-choix': '' } : {}), href: lien.toString() },
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
    h('label', { class: 'univers-option' }, choix, ' Afficher le manège des jeux'));
  apply();
}

/** Le manège : il s'ouvre sur le jeu de l'adresse (#jeu-neon), sinon sur le dernier joué. */
function manege(): Manege | null {
  const racine = document.querySelector<HTMLElement>('#jeux');
  if (!racine) return null;
  const vitrines = [...racine.querySelectorAll<HTMLElement>('.vitrine')];
  const indexDe = (id: string) => vitrines.findIndex((v) => v.id === id);
  const voulu = indexDe(window.location.hash.slice(1));
  return monterManege(racine, {
    calme,
    leger: appareilModeste(),
    depart: voulu >= 0 ? voulu : Math.max(indexDe(`jeu-${lastGame()?.jeu ?? ''}`), 0),
    surChangement: (v) => changerAmbiance(v.dataset.univers ?? ''),
  });
}

/** Appareil qui annonce peu de mémoire ou de cœurs (`?leger` pour l'essayer). Le manège repère aussi seul un appareil lent. */
function appareilModeste(): boolean {
  const memoire = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return new URLSearchParams(window.location.search).has('leger') || memoire <= 2 || navigator.hardwareConcurrency <= 2;
}

/**
 * Le fond prend l'ambiance du jeu de face. Recolorer la page entière la ferait repeindre à chaque image, pendant que
 * les cartes tournent : on pose l'ancienne couleur sur un calque, qui s'efface sans rien redessiner.
 */
function changerAmbiance(univers: string): void {
  const root = document.documentElement;
  if (root.dataset.univers === univers) return;
  const avant = getComputedStyle(document.body).backgroundColor;
  root.dataset.univers = univers;
  if (calme) return;
  document.querySelector('.ambiance-fondu')?.remove();
  const fondu = h('div', { class: 'ambiance-fondu', 'aria-hidden': 'true' });
  fondu.style.backgroundColor = avant;
  document.body.prepend(fondu);
  void fondu.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: 'ease' }).finished.finally(() => fondu.remove()).catch(() => {});
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

document.documentElement.classList.toggle('calme', calme);
leManege = manege();
window.addEventListener('hashchange', () => {
  const i = [...document.querySelectorAll('.vitrine')].findIndex((v) => `#${v.id}` === window.location.hash);
  if (i >= 0) leManege?.aller(i);
});
pointer();

void (async () => {
  etat = await topbar('accueil');
  etatConnu(etat);
  if (etat?.connecte) {
    renderPlayers(etat.profils ?? []);
    const p = activePlayer();
    if (p && estNiveau(p.niveau)) void setLevel(p.niveau, 'profil');
    if (window.location.hash === '#qui-joue') document.querySelector('#qui-joue-zone')?.scrollIntoView();
  }
  reprendreLancement();
  await renderCarnet();
  if (etat?.connecte) await flushQueue();
})();
