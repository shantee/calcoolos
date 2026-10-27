import '../i18n/page';
import { t } from '../i18n/traduire';
import '@fontsource-variable/bricolage-grotesque';
import '../styles/accueil.css';
import '../styles/plateforme.css';
import { topbar } from '../platform/topbar';
import { api, apiUrl, type AccountState, type Profile } from '../platform/api';
import { AVATARS, avatarImg } from '../platform/avatars';
import { activePlayer, setActivePlayer } from '../platform/player';
import { TIER_NAMES } from '../platform/stats';
import { field, h, showErrors } from '../platform/dom';
import { boutonGoogle, oublierGoogle } from '../platform/google';
import { pseudoAuHasard } from '../platform/pseudos';

const root = document.querySelector<HTMLElement>('#contenu')!;

function tierSelect(name: string, value = 'explorateur'): HTMLSelectElement {
  const s = h('select', { name });
  const publics: Record<string, string> = { eveil: '7-8 ans', explorateur: '9-10 ans', stratege: '11-12 ans', maitre: 'ados et adultes' };
  for (const [id, label] of Object.entries(TIER_NAMES)) s.append(h('option', { value: id, selected: id === value }, `${label} · ${publics[id]}`));
  return s;
}

function avatarPicker(name: string, value = 'dragon'): HTMLFieldSetElement {
  const fs = h('fieldset', { class: 'avatars-choix' }, h('legend', {}, 'Avatar'));
  for (const [id, a] of Object.entries(AVATARS)) {
    const input = h('input', { type: 'radio', name, value: id, checked: id === value, 'aria-label': a.label });
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
    field('Pseudo', input, 'pseudo', 'Un surnom suffit : pas de nom de famille. Il apparaît dans les classements publics.'),
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
      'Première fois ? Le compte est créé aussitôt : vous confirmez être un adulte responsable et avoir lu la ',
      h('a', { href: 'confidentialite.html' }, 'page de confidentialité'), '. Calcoolos ne reçoit de Google que votre adresse e-mail.'),
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

/** Jeton reçu de Google (espace parents, non connecté) : connexion, ou création du compte. */
async function connexionGoogle(jeton: string): Promise<void> {
  messagesGoogle(t('Connexion…'), '');
  const r = await api.post<AccountState>('/google', { credential: jeton, adulte: true }).catch(() => null);
  if (r?.status === 200 || r?.status === 201) {
    if (window.location.hash) history.replaceState(null, '', window.location.pathname);
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
    if (r?.status === 200) return void render(r.data);
    showErrors(login, msgLogin, r?.data ?? { erreur: 'Le serveur ne répond pas.' });
  });

  const msgSignup = h('p', { class: 'message', role: 'status' });
  const signup = h('form', { class: 'formulaire', novalidate: true },
    field('Adresse e-mail', h('input', { type: 'email', name: 'email', autocomplete: 'email', required: true }), 'email'),
    field('Mot de passe', h('input', { type: 'password', name: 'motDePasse', autocomplete: 'new-password', minlength: 10, required: true }), 'motDePasse', '10 caractères au moins.'),
    h('label', { class: 'case' }, h('input', { type: 'checkbox', name: 'adulte', required: true }),
      h('span', {}, 'Je suis un adulte responsable (parent, tuteur ou enseignant) et j’ai lu la ', h('a', { href: 'confidentialite.html' }, 'page de confidentialité'), '.')),
    h('span', { class: 'erreur-champ', 'data-erreur': 'adulte' }),
    msgSignup,
    h('div', { class: 'actions' }, h('button', { class: 'bouton', type: 'submit' }, 'Créer l’espace famille')),
  );
  signup.addEventListener('submit', async (e) => {
    e.preventDefault();
    busy(signup, true);
    const data = new FormData(signup);
    const r = await api.post<AccountState>('/inscription', { email: data.get('email'), motDePasse: data.get('motDePasse'), adulte: data.get('adulte') === 'on' }).catch(() => null);
    busy(signup, false);
    if (r?.status === 201) return void render(r.data);
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
      h('p', { class: 'discret' }, 'Gratuit. Le compte est ouvert par un adulte ; chaque enfant y aura son profil.'),
      googleClientId ? blocGoogle(googleClientId) : null,
      signup),
  };
  const voulu = window.location.hash === '#inscription' ? 'inscription' : window.location.hash === '#connexion' ? 'connexion' : null;
  root.replaceChildren(
    h('h1', {}, 'Espace parents'),
    h('p', { class: 'chapeau' }, googleClientId
      ? 'Un compte pour la famille garde les progrès de chaque enfant sur tous vos appareils. Un clic avec Google, ou une adresse e-mail et un mot de passe ; les enfants n’ont qu’un pseudo. Sans compte, on peut toujours jouer en invité.'
      : 'Un compte pour la famille garde les progrès de chaque enfant sur tous vos appareils. On ne demande qu’une adresse e-mail et un mot de passe ; les enfants n’ont qu’un pseudo. Sans compte, on peut toujours jouer en invité.'),
    h('div', { class: 'grille' }, ...(voulu === 'inscription' ? [cartes.inscription, cartes.connexion] : [cartes.connexion, cartes.inscription])),
  );
  if (voulu) {
    cartes[voulu].classList.add('carte-voulue');
    cartes[voulu].querySelector<HTMLInputElement>('form input')?.focus({ preventScroll: true });
    cartes[voulu].scrollIntoView({ block: 'center' });
  }
}

// --- Connecté -----------------------------------------------------------------------------------
function profileCard(p: Profile, refresh: (profiles: Profile[]) => void): HTMLElement {
  const msg = h('p', { class: 'message', role: 'status' });
  const playing = activePlayer()?.id === p.id;
  const play = h('button', { class: 'bouton petit', type: 'button' }, playing ? 'Joue en ce moment' : 'Jouer avec ce profil');
  play.addEventListener('click', () => {
    setActivePlayer(p);
    window.location.href = 'index.html';
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
    h('div', { class: 'profil-tete' }, avatarImg(p.avatar, 64, ''), h('div', {}, h('h3', {}, p.pseudo), h('span', { class: 'discret' }, TIER_NAMES[p.niveau] ?? p.niveau))),
    h('div', { class: 'actions' }, play, h('a', { class: 'bouton petit secondaire', href: `tableau.html?profil=${p.id}` }, 'Voir ses progrès')),
    h('details', {}, h('summary', {}, 'Modifier'), edit),
    h('div', { class: 'actions' }, del),
    msg,
  );
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
  return h('section', { class: 'carte', 'aria-labelledby': 't-new' }, h('h2', { id: 't-new' }, 'Nouveau profil de joueur'), form);
}

/** Connexion avec Google depuis l'espace famille : associer (ou dissocier) un compte Google. */
function blocGoogleCompte(state: AccountState): HTMLElement | null {
  if (state.google) {
    if (!state.motDePasse) {
      return h('div', { class: 'google-compte' }, h('p', {}, 'Ce compte a été créé avec Google : connectez-vous avec « Continuer avec Google ».'));
    }
    const msg = h('p', { class: 'message', role: 'status' });
    const form = h('form', { class: 'formulaire', novalidate: true },
      h('p', {}, 'Vous pourrez toujours vous connecter avec votre adresse e-mail et votre mot de passe.'),
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
      h('p', {}, h('span', { class: 'google-pastille', 'aria-hidden': 'true' }, 'G'), 'Compte Google associé : un clic sur « Continuer avec Google » suffit pour vous connecter.'),
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
    h('p', {}, 'Associez votre compte Google : la prochaine fois, un clic suffira, sans mot de passe. Vos profils et leurs résultats restent les mêmes.'),
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
      ? field('Recopiez l’adresse du compte pour confirmer', h('input', { type: 'email', name: 'confirmation', autocomplete: 'off' }), 'confirmation')
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
    h('h2', { id: 't-account' }, 'Le compte'),
    h('p', {}, 'Connecté avec ', h('b', {}, email), '.'),
    h('div', { class: 'actions' }, logout, h('a', { class: 'bouton secondaire', href: apiUrl('/export'), download: 'calcoolos-mes-donnees.json' }, 'Télécharger nos données')),
    blocGoogleCompte(state),
    state.motDePasse === false ? null : h('details', {}, h('summary', {}, 'Changer le mot de passe'), pw),
    h('details', {}, h('summary', {}, 'Supprimer le compte'), del),
  );
}

function renderAccount(state: AccountState): void {
  const grid = h('div', { class: 'grille' });
  const refresh = (profiles: Profile[]) => {
    grid.replaceChildren(...profiles.map((p) => profileCard(p, refreshAll)));
    if (profiles.length < 6) grid.append(newProfileCard(refreshAll));
  };
  const refreshAll = (profiles: Profile[]) => {
    refresh(profiles);
    void topbar('compte');
  };
  refresh(state.profils ?? []);
  root.replaceChildren(
    h('h1', {}, 'Espace famille'),
    h('p', { class: 'chapeau' }, 'Chaque enfant a son profil : un pseudo, un avatar, un niveau. Ses meilleurs scores apparaissent dans les classements publics sous son pseudo ; le reste de ses résultats n’est visible que dans cet espace.'),
    grid,
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
      h('h1', {}, 'Espace parents'),
      h('section', { class: 'carte' }, h('h2', {}, 'Serveur indisponible'), h('p', {}, 'L’espace famille n’est pas joignable pour le moment (ou ce site fonctionne sans serveur). On peut toujours jouer en invité : les résultats restent sur cet appareil.')),
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
