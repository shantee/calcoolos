import '../i18n/page';
import { t } from '../i18n/traduire';
import '@fontsource-variable/bricolage-grotesque';
import '../styles/accueil.css';
import '../styles/plateforme.css';
import { topbar } from '../platform/topbar';
import { api, apiUrl, type AccountState, type Profile } from '../platform/api';
import { AVATAR_INVITE, AVATAR_PAR_DEFAUT, AVATARS, avatarId, avatarImg } from '../platform/avatars';
import { activePlayer, joueurParDefaut, setActivePlayer } from '../platform/player';
import { lireFavoris } from '../platform/favoris';
import { GAME_NAMES, GAME_PAGES, TIER_NAMES, summarize } from '../platform/stats';
import type { GameId, StoredResult } from '../platform/results';
import { field, h, showErrors } from '../platform/dom';
import { boutonGoogle, oublierGoogle } from '../platform/google';
import { pseudoAuHasard } from '../platform/pseudos';
import { demarrerSuivi, etapeParcours } from '../platform/suivi';
import { NIVEAU_INFOS, niveauRetenu, retenirNiveau } from '../platform/niveau';
import type { TierId } from '../core/difficulty';

demarrerSuivi('compte');

const root = document.querySelector<HTMLElement>('#contenu')!;

function tierSelect(name: string, value = 'explorateur'): HTMLSelectElement {
  const s = h('select', { name });
  for (const [id, label] of Object.entries(TIER_NAMES)) s.append(h('option', { value: id, selected: id === value }, `${label} · ${NIVEAU_INFOS[id as TierId].public}`));
  return s;
}

function avatarPicker(name: string, value = AVATAR_PAR_DEFAUT): HTMLFieldSetElement {
  const fs = h('fieldset', { class: 'avatars-choix' }, h('legend', {}, 'Avatar'));
  for (const [id, a] of Object.entries(AVATARS)) {
    const input = h('input', { type: 'radio', name, value: id, checked: id === avatarId(value), 'aria-label': a.label });
    fs.append(h('label', { title: a.label }, input, avatarImg(id, 52, '')));
  }
  return fs;
}

/** Champ « Pseudo » avec le bouton « Aide-moi à trouver un pseudo » (jeux de mots sur les maths). */
function pseudoField(value = ''): HTMLElement {
  const input = h('input', { name: 'pseudo', value, maxlength: 20, required: true, placeholder: 'ex. Lina, Super Noé' });
  const aide = h('button', { class: 'bouton petit secondaire pseudo-aide', type: 'button' }, '🎲 Aide-moi à trouver un pseudo');
  aide.addEventListener('click', () => {
    input.value = pseudoAuHasard(input.value);
    input.focus();
  });
  return h('div', { class: 'champ-pseudo' },
    field('Pseudo', input, 'pseudo', 'Un surnom suffit, pas besoin de ton vrai nom. Il apparaît dans les classements publics.'),
    aide);
}

function busy(form: HTMLFormElement, on: boolean): void {
  for (const b of form.querySelectorAll('button')) b.disabled = on;
}

// --- Continuer avec Google -------------------------------------------------------------------------
/**
 * Bloc « Continuer avec Google » + « ou avec une adresse e-mail ». Le bouton de Google arrive
 * quand son script est chargé ; s'il ne vient pas, le bloc disparaît et le formulaire reste.
 */
function blocGoogle(clientId: string): HTMLElement {
  const zone = h('div', {});
  const bloc = h('div', { class: 'google-bloc' },
    zone,
    h('p', { class: 'message', role: 'status' }),
    h('p', { class: 'google-mention' },
      'Première fois ? Le compte est créé aussitôt : tu confirmes être adulte et avoir lu la ',
      h('a', { href: 'confidentialite.html' }, 'page de confidentialité'), '. Calcoolos ne reçoit de Google que ton adresse e-mail.'),
    h('p', { class: 'ou' }, h('span', {}, 'ou avec une adresse e-mail')),
  );
  requestAnimationFrame(() => void boutonGoogle(zone, clientId, connexionGoogle));
  return bloc;
}

function messagesGoogle(texte: string, classe: 'erreur' | 'ok' | '' = 'erreur'): void {
  for (const m of root.querySelectorAll<HTMLElement>('.google-bloc .message, .google-compte .message')) {
    m.className = classe ? `message ${classe}` : 'message';
    m.textContent = texte;
  }
}

/** Juste après la connexion : le titulaire (ou le seul profil) joue, sans rien avoir à choisir. */
function apresConnexion(state: AccountState): void {
  if (!activePlayer()) setActivePlayer(joueurParDefaut(state.profils));
}

/** Jeton reçu de Google (Mon espace, non connecté) : connexion, ou création du compte. */
async function connexionGoogle(jeton: string): Promise<void> {
  messagesGoogle(t('Connexion…'), '');
  const r = await api.post<AccountState>('/google', { credential: jeton, adulte: true }).catch(() => null);
  if (r?.status === 200 || r?.status === 201) {
    if (r.status === 201) etapeParcours('inscription');
    if (window.location.hash) history.replaceState(null, '', window.location.pathname);
    apresConnexion(r.data);
    return void render(r.data);
  }
  messagesGoogle(r?.data.erreur ?? t('Le serveur ne répond pas.'));
}

// --- Non connecté -------------------------------------------------------------------------------
function renderGuest(googleClientId?: string): void {
  const msgLogin = h('p', { class: 'message', role: 'status' });
  const login = h('form', { class: 'formulaire', novalidate: true },
    field('Adresse e-mail', h('input', { type: 'email', name: 'email', autocomplete: 'email', required: true }), 'email'),
    field('Mot de passe', h('input', { type: 'password', name: 'motDePasse', autocomplete: 'current-password', required: true }), 'motDePasse'),
    msgLogin,
    h('div', { class: 'actions' }, h('button', { class: 'bouton', type: 'submit' }, 'Se connecter')),
  );
  login.addEventListener('submit', async (e) => {
    e.preventDefault();
    busy(login, true);
    const data = new FormData(login);
    const r = await api.post<AccountState>('/connexion', { email: data.get('email'), motDePasse: data.get('motDePasse') }).catch(() => null);
    busy(login, false);
    if (r?.status === 200) {
      apresConnexion(r.data);
      return void render(r.data);
    }
    showErrors(login, msgLogin, r?.data ?? { erreur: 'Le serveur ne répond pas.' });
  });

  const msgSignup = h('p', { class: 'message', role: 'status' });
  const signup = h('form', { class: 'formulaire', novalidate: true },
    field('Adresse e-mail', h('input', { type: 'email', name: 'email', autocomplete: 'email', required: true }), 'email'),
    field('Mot de passe', h('input', { type: 'password', name: 'motDePasse', autocomplete: 'new-password', minlength: 10, required: true }), 'motDePasse', '10 caractères au moins.'),
    h('label', { class: 'case' }, h('input', { type: 'checkbox', name: 'adulte', required: true }),
      h('span', {}, 'Je suis adulte et j’ai lu la ', h('a', { href: 'confidentialite.html' }, 'page de confidentialité'), '.')),
    h('span', { class: 'erreur-champ', 'data-erreur': 'adulte' }),
    msgSignup,
    h('div', { class: 'actions' }, h('button', { class: 'bouton', type: 'submit' }, 'Créer mon compte')),
  );
  signup.addEventListener('submit', async (e) => {
    e.preventDefault();
    busy(signup, true);
    const data = new FormData(signup);
    const r = await api.post<AccountState>('/inscription', { email: data.get('email'), motDePasse: data.get('motDePasse'), adulte: data.get('adulte') === 'on' }).catch(() => null);
    busy(signup, false);
    if (r?.status === 201) {
      etapeParcours('inscription');
      render(r.data);
      window.scrollTo(0, 0);
      return;
    }
    showErrors(signup, msgSignup, r?.data ?? { erreur: 'Le serveur ne répond pas.' });
  });

  // Arrivée par « Créer mon compte » (#inscription) ou « Se connecter » (#connexion) : la bonne carte en
  // premier, le curseur dans son premier champ.
  const cartes = {
    connexion: h('section', { class: 'carte', id: 'connexion', 'aria-labelledby': 't-login' }, h('h2', { id: 't-login' }, 'Se connecter'),
      googleClientId ? blocGoogle(googleClientId) : null,
      login),
    inscription: h('section', { class: 'carte', id: 'inscription', 'aria-labelledby': 't-signup' },
      h('h2', { id: 't-signup' }, 'Créer mon compte'),
      h('p', { class: 'discret' }, 'Gratuit, pour jouer et suivre tes progrès. Les comptes sont ouverts par des adultes : pour un enfant, c’est un adulte qui crée le compte, puis son profil.'),
      googleClientId ? blocGoogle(googleClientId) : null,
      signup),
  };
  const voulu = window.location.hash === '#inscription' ? 'inscription' : window.location.hash === '#connexion' ? 'connexion' : null;
  root.replaceChildren(
    h('h1', {}, 'Mon espace'),
    h('p', { class: 'chapeau' }, 'Un compte garde tes scores, tes records et tes progrès sur tous tes appareils. Crée ton profil en un instant, et ajoute ceux de tes enfants si tu le souhaites. Sans compte, on peut toujours jouer en invité.'),
    h('div', { class: 'grille' }, ...(voulu === 'inscription' ? [cartes.inscription, cartes.connexion] : [cartes.connexion, cartes.inscription])),
  );
  if (voulu) {
    cartes[voulu].classList.add('carte-voulue');
    cartes[voulu].querySelector<HTMLInputElement>('form input')?.focus({ preventScroll: true });
    cartes[voulu].scrollIntoView({ block: 'center' });
  }
}

// --- Connecté -----------------------------------------------------------------------------------
/** Chiffres réels et favoris d'un profil, dans sa carte (rien d'affiché tant que le serveur n'a pas répondu). */
function resumeProfil(p: Profile): HTMLElement {
  const zone = h('div', { class: 'profil-resume' });
  void api.get<{ resultats: StoredResult[] }>(`/profils/${p.id}/resultats`).catch(() => null).then((r) => {
    if (r?.status !== 200) return;
    const s = summarize(r.data.resultats);
    const record = s.records.reduce((m, x) => Math.max(m, x.score), 0);
    const tuile = (valeur: string, texte: string) => h('li', {}, h('strong', {}, valeur), h('span', {}, texte));
    zone.prepend(h('ul', { class: 'profil-chiffres' },
      tuile(String(s.games), s.games > 1 ? 'parties jouées' : 'partie jouée'),
      tuile(`${s.stars} ★`, 'étoiles gagnées'),
      tuile(record ? String(record) : '–', 'meilleur score')));
  });
  const favoris = lireFavoris(p.id).filter((j): j is GameId => j in GAME_NAMES);
  if (favoris.length) {
    zone.append(h('p', { class: 'profil-favoris' }, '★ Favoris : ', ...favoris.flatMap((j, i) => [i ? ' · ' : '', h('a', { href: GAME_PAGES[j] }, GAME_NAMES[j])])));
  } else if (p.personnel) {
    zone.append(h('p', { class: 'discret' }, 'Pas encore de favori : touche une étoile dans Mes jeux, sur l’accueil.'));
  }
  return zone;
}

function profileCard(p: Profile, refresh: (profiles: Profile[]) => void): HTMLElement {
  const msg = h('p', { class: 'message', role: 'status' });
  const playing = activePlayer()?.id === p.id;
  const play = h('button', { class: 'bouton petit', type: 'button' }, playing ? 'Joue en ce moment' : 'Jouer avec ce profil');
  play.addEventListener('click', () => {
    setActivePlayer(p);
    window.location.href = 'index.html';
  });

  // Le titulaire désigne lui-même son profil : jamais de conversion automatique d'un profil d'enfant.
  const designer = h('button', { class: 'bouton petit secondaire', type: 'button' }, p.personnel ? 'Ce n’est pas mon profil' : 'C’est mon profil personnel');
  designer.addEventListener('click', async () => {
    if (!p.personnel && !window.confirm(t(`« ${p.pseudo} » est bien ton propre profil, et non celui d’un enfant ?`))) return;
    const r = await api.post<{ profils: Profile[] }>(`/profils/${p.id}/personnel`, { personnel: !p.personnel }).catch(() => null);
    if (r?.status === 200) return refresh(r.data.profils);
    showErrors(edit, msg, r?.data ?? { erreur: 'Le serveur ne répond pas.' });
  });

  const edit = h('form', { class: 'formulaire', novalidate: true },
    pseudoField(p.pseudo),
    field('Niveau', tierSelect('niveau', p.niveau), 'niveau'),
    avatarPicker(`avatar-${p.id}`, p.avatar),
    h('div', { class: 'actions' }, h('button', { class: 'bouton petit', type: 'submit' }, 'Enregistrer')),
  );
  edit.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(edit);
    const r = await api.post<{ profils: Profile[] }>(`/profils/${p.id}/modifier`, { pseudo: d.get('pseudo'), niveau: d.get('niveau'), avatar: d.get(`avatar-${p.id}`) }).catch(() => null);
    if (r?.status === 200) {
      const fresh = r.data.profils.find((x) => x.id === p.id);
      if (fresh && activePlayer()?.id === p.id) setActivePlayer(fresh);
      return refresh(r.data.profils);
    }
    showErrors(edit, msg, r?.data ?? { erreur: 'Le serveur ne répond pas.' });
  });

  const del = h('button', { class: 'bouton petit danger', type: 'button' }, 'Supprimer ce profil');
  del.addEventListener('click', async () => {
    if (!window.confirm(t(`Supprimer le profil « ${p.pseudo} » et tous ses résultats ? C’est définitif.`))) return;
    const r = await api.post<{ profils: Profile[] }>(`/profils/${p.id}/supprimer`).catch(() => null);
    if (r?.status === 200) {
      if (activePlayer()?.id === p.id) setActivePlayer(null);
      refresh(r.data.profils);
    }
  });

  return h('article', { class: 'carte profil' },
    h('div', { class: 'profil-tete' }, avatarImg(p.avatar, 64, ''), h('div', {}, h('h3', {}, p.pseudo), h('span', { class: 'discret' }, `Niveau ${TIER_NAMES[p.niveau] ?? p.niveau}`))),
    resumeProfil(p),
    h('div', { class: 'actions' }, play, h('a', { class: 'bouton petit secondaire', href: `tableau.html?profil=${p.id}` }, p.personnel ? 'Mes progrès' : 'Voir ses progrès')),
    h('details', {}, h('summary', {}, 'Modifier le pseudo, l’avatar ou le niveau'), edit),
    h('details', {}, h('summary', {}, 'Autres réglages'), h('div', { class: 'actions' }, designer, del)),
    msg,
  );
}

/** « Mon profil » : la même étape après une inscription (e-mail ou Google) et pour un ancien compte familial. */
function carteMonProfil(enfants: number): HTMLElement {
  const msg = h('p', { class: 'message', role: 'status' });
  const form = h('form', { class: 'formulaire', novalidate: true },
    pseudoField(),
    field('Niveau', tierSelect('niveau', niveauRetenu() ?? 'explorateur'), 'niveau'),
    h('details', {}, h('summary', {}, 'Choisir mon avatar'), avatarPicker('avatar-perso')),
    msg,
    h('div', { class: 'actions' }, h('button', { class: 'bouton', type: 'submit' }, 'Créer mon profil et jouer')),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    busy(form, true);
    const d = new FormData(form);
    const r = await api.post<{ profils: Profile[] }>('/profils', { pseudo: d.get('pseudo'), niveau: d.get('niveau'), avatar: d.get('avatar-perso'), personnel: true }).catch(() => null);
    busy(form, false);
    if (r?.status === 201) {
      const moi = r.data.profils.find((p) => p.personnel);
      if (moi) {
        setActivePlayer(moi);
        retenirNiveau(moi.niveau as TierId);
      }
      window.location.href = 'index.html';
      return;
    }
    showErrors(form, msg, r?.data ?? { erreur: 'Le serveur ne répond pas.' });
  });
  return h('section', { class: 'carte carte-mon-profil', 'aria-labelledby': 't-moi' },
    h('h2', { id: 't-moi' }, enfants ? 'Toi aussi, tu peux jouer !' : 'Bienvenue ! Crée ton profil'),
    h('p', { class: 'discret' }, enfants
      ? 'Crée ton propre profil : tes scores restent séparés de ceux de tes enfants, et il ne compte pas dans leurs six places.'
      : 'Un pseudo, et c’est parti. Tu pourras tout changer ensuite.'),
    form);
}

/** Qui joue, toujours visible ; le changement de joueur n'apparaît que s'il y a plusieurs profils. */
function bandeauJoueur(profiles: Profile[], refresh: (profiles: Profile[]) => void): HTMLElement | null {
  if (profiles.length === 0) return null;
  const actif = profiles.find((p) => p.id === activePlayer()?.id) ?? null;
  const choix = profiles.length > 1 ? h('div', { class: 'bandeau-choix', role: 'group', 'aria-label': 'Qui joue ?' }) : null;
  for (const p of profiles) {
    const b = h('button', { type: 'button', 'aria-pressed': String(actif?.id === p.id) }, avatarImg(p.avatar, 32, ''), p.personnel ? `${p.pseudo} (moi)` : p.pseudo);
    b.addEventListener('click', () => {
      setActivePlayer(p);
      refresh(profiles);
    });
    choix?.append(b);
  }
  return h('section', { class: 'carte bandeau-joueur', 'aria-label': 'Qui joue ?' },
    h('div', { class: 'bandeau-qui' },
      avatarImg(actif?.avatar ?? AVATAR_INVITE, 56, ''),
      h('p', {}, h('small', {}, actif ? 'Joue en ce moment' : 'Personne n’est choisi'), h('strong', {}, actif?.pseudo ?? 'Choisis qui joue'))),
    actif ? h('div', { class: 'actions' }, h('a', { class: 'bouton', href: 'index.html' }, 'Jouer'), h('a', { class: 'bouton secondaire', href: `tableau.html?profil=${actif.id}` }, 'Voir les progrès')) : null,
    choix);
}

function newProfileCard(refresh: (profiles: Profile[]) => void): HTMLElement {
  const msg = h('p', { class: 'message', role: 'status' });
  const form = h('form', { class: 'formulaire', novalidate: true },
    pseudoField(),
    field('Niveau', tierSelect('niveau'), 'niveau'),
    avatarPicker('avatar-nouveau'),
    msg,
    h('div', { class: 'actions' }, h('button', { class: 'bouton', type: 'submit' }, 'Ajouter le profil')),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    busy(form, true);
    const d = new FormData(form);
    const r = await api.post<{ profils: Profile[] }>('/profils', { pseudo: d.get('pseudo'), niveau: d.get('niveau'), avatar: d.get('avatar-nouveau') }).catch(() => null);
    busy(form, false);
    if (r?.status === 201) {
      // Premier profil : il devient le joueur actif.
      if (!activePlayer() && r.data.profils.length === 1) setActivePlayer(r.data.profils[0]);
      return refresh(r.data.profils);
    }
    showErrors(form, msg, r?.data ?? { erreur: 'Le serveur ne répond pas.' });
  });
  return h('section', { class: 'carte', 'aria-labelledby': 't-new' }, h('h2', { id: 't-new' }, 'Nouveau profil d’enfant'), form);
}

/** Connexion avec Google depuis Mon espace : associer (ou dissocier) un compte Google. */
function blocGoogleCompte(state: AccountState): HTMLElement | null {
  if (state.google) {
    if (!state.motDePasse) {
      return h('div', { class: 'google-compte' }, h('p', {}, 'Ce compte a été créé avec Google : connecte-toi avec « Continuer avec Google ».'));
    }
    const msg = h('p', { class: 'message', role: 'status' });
    const form = h('form', { class: 'formulaire', novalidate: true },
      h('p', {}, 'Tu pourras toujours te connecter avec ton adresse e-mail et ton mot de passe.'),
      field('Mot de passe', h('input', { type: 'password', name: 'motDePasse', autocomplete: 'current-password' }), 'motDePasse'),
      msg,
      h('div', { class: 'actions' }, h('button', { class: 'bouton petit secondaire', type: 'submit' }, 'Dissocier Google')),
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await api.post<AccountState>('/google/dissocier', { motDePasse: new FormData(form).get('motDePasse') }).catch(() => null);
      if (r?.status === 200) return void render(r.data);
      showErrors(form, msg, r?.data ?? { erreur: 'Le serveur ne répond pas.' });
    });
    return h('div', { class: 'google-compte' },
      h('p', {}, h('span', { class: 'google-pastille', 'aria-hidden': 'true' }, 'G'), 'Compte Google associé : un clic sur « Continuer avec Google » suffit pour te connecter.'),
      h('details', {}, h('summary', {}, 'Dissocier Google'), form));
  }
  if (!state.googleClientId) return null;
  const zone = h('div', {});
  requestAnimationFrame(() => void boutonGoogle(zone, state.googleClientId!, async (jeton) => {
    messagesGoogle(t('Association…'), '');
    const r = await api.post<AccountState>('/google/associer', { credential: jeton }).catch(() => null);
    if (r?.status === 200) {
      render(r.data);
      messagesGoogle(t('Compte Google associé.'), 'ok');
      return;
    }
    messagesGoogle(r?.data.erreur ?? t('Le serveur ne répond pas.'));
  }));
  return h('div', { class: 'google-compte google-bloc-compte' },
    h('h3', {}, 'Se connecter plus vite'),
    h('p', {}, 'Associe ton compte Google : la prochaine fois, un clic suffira, sans mot de passe. Tes profils et leurs résultats restent les mêmes.'),
    zone,
    h('p', { class: 'message', role: 'status' }));
}

function accountCard(state: AccountState): HTMLElement {
  const email = state.email ?? '';
  const msgPw = h('p', { class: 'message', role: 'status' });
  const pw = h('form', { class: 'formulaire', novalidate: true },
    field('Mot de passe actuel', h('input', { type: 'password', name: 'ancien', autocomplete: 'current-password' }), 'ancien'),
    field('Nouveau mot de passe', h('input', { type: 'password', name: 'nouveau', autocomplete: 'new-password', minlength: 10 }), 'nouveau', '10 caractères au moins.'),
    msgPw,
    h('div', { class: 'actions' }, h('button', { class: 'bouton petit', type: 'submit' }, 'Changer le mot de passe')),
  );
  pw.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(pw);
    const r = await api.post('/mot-de-passe', { ancien: d.get('ancien'), nouveau: d.get('nouveau') }).catch(() => null);
    if (r?.status === 200) {
      pw.reset();
      msgPw.className = 'message ok';
      msgPw.textContent = 'Mot de passe changé.';
      return;
    }
    showErrors(pw, msgPw, r?.data ?? { erreur: 'Le serveur ne répond pas.' });
  });

  const msgDel = h('p', { class: 'message', role: 'status' });
  const del = h('form', { class: 'formulaire', novalidate: true },
    h('p', {}, 'Supprime le compte, tous les profils et tous les résultats. C’est immédiat et définitif.'),
    state.motDePasse === false
      ? field('Recopie l’adresse du compte pour confirmer', h('input', { type: 'email', name: 'confirmation', autocomplete: 'off' }), 'confirmation')
      : field('Mot de passe', h('input', { type: 'password', name: 'motDePasse', autocomplete: 'current-password' }), 'motDePasse'),
    msgDel,
    h('div', { class: 'actions' }, h('button', { class: 'bouton petit danger', type: 'submit' }, 'Supprimer mon compte')),
  );
  del.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.confirm(t('Supprimer définitivement le compte et toutes ses données ?'))) return;
    const d = new FormData(del);
    const r = await api.post('/supprimer-compte', { motDePasse: d.get('motDePasse'), confirmation: d.get('confirmation') }).catch(() => null);
    if (r?.status === 200) {
      setActivePlayer(null);
      window.location.reload();
      return;
    }
    showErrors(del, msgDel, r?.data ?? { erreur: 'Le serveur ne répond pas.' });
  });

  const logout = h('button', { class: 'bouton secondaire', type: 'button' }, 'Se déconnecter');
  logout.addEventListener('click', async () => {
    await api.post('/deconnexion').catch(() => null);
    oublierGoogle();
    setActivePlayer(null);
    window.location.reload();
  });

  return h('section', { class: 'carte', 'aria-labelledby': 't-account' },
    h('h2', { id: 't-account' }, 'Mon compte'),
    h('p', {}, 'Connecté avec ', h('b', {}, email), '.'),
    h('div', { class: 'actions' }, logout, h('a', { class: 'bouton secondaire', href: apiUrl('/export'), download: 'calcoolos-mes-donnees.json' }, 'Télécharger mes données')),
    blocGoogleCompte(state),
    state.motDePasse === false ? null : h('details', {}, h('summary', {}, 'Changer le mot de passe'), pw),
    h('details', {}, h('summary', {}, 'Supprimer le compte'), del),
  );
}

function renderAccount(state: AccountState): void {
  const zone = h('div', { class: 'mon-espace' });
  const refresh = (profiles: Profile[]) => {
    const moi = profiles.find((p) => p.personnel);
    const enfants = profiles.filter((p) => !p.personnel);
    const grille = h('div', { class: 'grille' }, ...enfants.map((p) => profileCard(p, refreshAll)));
    if (enfants.length < 6) grille.append(newProfileCard(refreshAll));
    const ajout = h('details', { class: 'ajout-enfants', id: 'ajout-enfant', open: enfants.length > 0 },
      h('summary', {}, enfants.length ? `Profils de mes enfants (${enfants.length} sur 6)` : 'Souhaites-tu aussi créer des profils pour tes enfants ?'),
      h('p', { class: 'discret' }, 'Tu gères leurs réglages et tu suis leurs progrès. Ils jouent sous un simple pseudo, sans adresse e-mail ; leur meilleur score apparaît dans les classements publics sous ce pseudo.'),
      grille);
    zone.replaceChildren(...[
      bandeauJoueur(profiles, refreshAll),
      moi ? h('section', { 'aria-labelledby': 't-profil' }, h('h2', { id: 't-profil' }, 'Mon profil'), profileCard(moi, refreshAll)) : carteMonProfil(enfants.length),
      ajout,
    ].filter((x): x is HTMLElement => x !== null));
  };
  const refreshAll = (profiles: Profile[]) => {
    refresh(profiles);
    void topbar('compte');
  };
  refresh(state.profils ?? []);
  root.replaceChildren(
    h('h1', {}, 'Mon espace'),
    zone,
    h('div', { style: 'height: 22px' }),
    accountCard(state),
  );
}

let dernierEtat: AccountState | null = null;
// Depuis la barre, « Créer mon compte » ou « Se connecter » sur cette même page : on remet la bonne carte devant.
window.addEventListener('hashchange', () => {
  if (dernierEtat && !dernierEtat.connecte) renderGuest(dernierEtat.googleClientId);
});

function render(state: AccountState | null, refreshBar = true): void {
  dernierEtat = state;
  if (!state) {
    root.replaceChildren(
      h('h1', {}, 'Mon espace'),
      h('section', { class: 'carte' }, h('h2', {}, 'Serveur indisponible'), h('p', {}, 'Mon espace n’est pas joignable pour le moment (ou ce site fonctionne sans serveur). On peut toujours jouer en invité : les résultats restent sur cet appareil.')),
    );
    return;
  }
  if (state.connecte) renderAccount(state);
  else renderGuest(state.googleClientId);
  if (refreshBar) void topbar('compte');
}

void (async () => {
  render(await topbar('compte'), false);
})();
