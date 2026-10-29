// Calcoolos Analytics — interface (JavaScript natif, graphiques ECharts chargés par la page).
// Toutes les données viennent de /calcoolos/api/… (relais du portail, session obligatoire).

const JEUX = {
  cubes: { nom: 'Cubes de siège', court: 'Cubes', couleur: '#3987e5', ico: '🧊' },
  dragon: { nom: 'Le Dragon gourmand', court: 'Dragon', couleur: '#d95926', ico: '🐉' },
  meteores: { nom: 'Pluie de météores', court: 'Météores', couleur: '#199e70', ico: '☄️' },
  fusee: { nom: 'Décollage !', court: 'Décollage', couleur: '#c98500', ico: '🚀' },
  neon: { nom: 'Neon Flight', court: 'Neon', couleur: '#d64fc0', ico: '🛸' },
  multirail: { nom: 'MULTIRAIL', court: 'Multirail', couleur: '#2fa597', ico: '🚂' },
};
const ORDRE = ['cubes', 'dragon', 'meteores', 'fusee', 'neon', 'multirail'];
const NIVEAUX = { eveil: 'Éveil', explorateur: 'Explorateur', stratege: 'Stratège', maitre: 'Maître' };
const COUL_NIVEAUX = { eveil: '#7fb3f2', explorateur: '#5fd39a', stratege: '#f2b84b', maitre: '#e87ba4' };
const MODES = { tranquille: 'Tranquille', defi: 'Défi' };
const APPAREILS = { ordinateur: 'Ordinateur', tablette: 'Tablette', telephone: 'Téléphone' };
const PAGES = { accueil: 'Accueil', compte: 'Espace parents', tableau: 'Mes progrès', classements: 'Classements', confidentialite: 'Confidentialité', cubes: 'Cubes de siège', meteores: 'Pluie de météores', dragon: 'Le Dragon gourmand', fusee: 'Décollage !', neon: 'Neon Flight', multirail: 'MULTIRAIL', autre: 'Autre page' };
const T = { texte: '#e8ecf4', texte2: '#b6c0d6', muet: '#8592ae', ligne: 'rgba(232,236,244,.09)', fond: '#1f2a44', accent: '#ffe14d', bleu: '#3987e5' };

const etat = { vue: 'ensemble', periode: '30', debut: '', fin: '', resume: null, joueurs: null, filtres: { jeu: '', qui: '', profil: '' }, entonnoir: 'tous', tri: { col: 'derniereActivite', sens: 'desc' }, recherche: '' };
const graphes = [];
const $ = (s, r = document) => r.querySelector(s);

// ------------------------------------------------------------------------------- outils
function h(tag, attrs = {}, ...enfants) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [p, x] of Object.entries(v)) el.style.setProperty(p.startsWith('--') ? p : p.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), x);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const e of enfants.flat()) if (e !== null && e !== undefined && e !== false) el.append(e instanceof Node ? e : String(e));
  return el;
}
const nf = new Intl.NumberFormat('fr-FR');
const nombre = (n) => (n === null || n === undefined ? '—' : nf.format(Math.round(n)));
const pct = (x, dec = 0) => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(dec).replace('.', ',')} %`);
function duree(s, court = false) {
  if (s === null || s === undefined) return '—';
  s = Math.round(s);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const hh = Math.floor(s / 3600);
  const mm = Math.round((s - hh * 3600) / 60);
  return court ? `${hh} h${mm ? String(mm).padStart(2, '0') : ''}` : `${hh} h ${String(mm).padStart(2, '0')}`;
}
const dateLocale = (iso, opts) => (iso ? new Date(iso).toLocaleString('fr-FR', opts) : '—');
const jourCourt = (iso) => dateLocale(iso, { day: 'numeric', month: 'short', year: 'numeric' });
const heure = (iso) => dateLocale(iso, { hour: '2-digit', minute: '2-digit' });
function quand(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const auj = new Date();
  const hier = new Date(Date.now() - 86400000);
  const meme = (a, b) => a.toDateString() === b.toDateString();
  if (meme(d, auj)) return `aujourd’hui à ${heure(iso).replace(':', ' h ')}`;
  if (meme(d, hier)) return `hier à ${heure(iso).replace(':', ' h ')}`;
  return `${dateLocale(iso, { day: 'numeric', month: 'short' })} à ${heure(iso).replace(':', ' h ')}`;
}
function ilYa(iso) {
  if (!iso) return 'jamais';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'il y a moins de 2 min';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const avatarUrl = (id) => `/assets/calcoolos/avatars/${encodeURIComponent(id || 'astronaute')}.webp`;
const avatar = (id, grand = false) => h('img', { class: grand ? 'avatar grand' : 'avatar', src: avatarUrl(id), alt: '', loading: 'lazy', width: grand ? 72 : 34, height: grand ? 72 : 34 });
const pastilleJeu = (jeu, court = false) => h('span', { class: `jeu-pastille c-${jeu}` }, JEUX[jeu] ? (court ? JEUX[jeu].court : JEUX[jeu].nom) : jeu);

async function api(quoi, params = {}) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined));
  const r = await fetch(`/calcoolos/api/${quoi}${q.toString() ? `?${q}` : ''}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (r.status === 401 || r.redirected) {
    window.location.href = `/connexion?r=${encodeURIComponent('/calcoolos/')}`;
    throw new Error('Session expirée');
  }
  let data;
  try {
    data = await r.json();
  } catch {
    throw new Error(`Réponse illisible (${r.status})`);
  }
  if (!r.ok) throw new Error(data.erreur || `Erreur ${r.status}`);
  return data;
}

// ------------------------------------------------------------------------------- période
function calculerPeriode() {
  const auj = new Date();
  const moins = (n) => ymd(new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - n));
  switch (etat.periode) {
    case 'aujourdhui': return [ymd(auj), ymd(auj)];
    case 'hier': return [moins(1), moins(1)];
    case '7': return [moins(6), ymd(auj)];
    case '30': return [moins(29), ymd(auj)];
    case '90': return [moins(89), ymd(auj)];
    default: return [etat.debut, etat.fin];
  }
}
function libellePeriode() {
  const [d, f] = calculerPeriode();
  const fmt = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  return d === f ? fmt(d) : `du ${fmt(d)} au ${fmt(f)}`;
}
function initPeriode() {
  const boutons = [...document.querySelectorAll('#periode > button')];
  const du = $('#du');
  const au = $('#au');
  const synchro = () => {
    const [d, f] = calculerPeriode();
    du.value = d;
    au.value = f;
    for (const b of boutons) b.setAttribute('aria-pressed', String(b.dataset.p === etat.periode));
    $('.plage').classList.toggle('active', etat.periode === 'perso');
  };
  for (const b of boutons) {
    b.addEventListener('click', () => {
      etat.periode = b.dataset.p;
      synchro();
      recharger();
    });
  }
  const perso = () => {
    if (!du.value || !au.value) return;
    etat.periode = 'perso';
    [etat.debut, etat.fin] = du.value <= au.value ? [du.value, au.value] : [au.value, du.value];
    synchro();
    recharger();
  };
  du.addEventListener('change', perso);
  au.addEventListener('change', perso);
  synchro();
}

// ------------------------------------------------------------------------------- graphiques
function graphe(cls = 'graphe') {
  const el = h('div', { class: cls, role: 'img' });
  return el;
}
const axeCommun = {
  axisLine: { lineStyle: { color: T.ligne } },
  axisTick: { show: false },
  axisLabel: { color: T.muet, fontFamily: 'Barlow', fontSize: 12 },
  splitLine: { lineStyle: { color: T.ligne } },
};
const infobulle = {
  backgroundColor: '#0f1830', borderColor: 'rgba(255,255,255,.12)', textStyle: { color: T.texte, fontFamily: 'Barlow', fontSize: 13 },
  extraCssText: 'border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.5)',
};
function dessiner(el, option, label) {
  if (!window.echarts) {
    el.replaceChildren(h('p', { class: 'vide' }, 'Graphiques indisponibles (bibliothèque non chargée).'));
    return null;
  }
  if (label) el.setAttribute('aria-label', label);
  const g = window.echarts.init(el, null, { renderer: 'canvas' });
  g.setOption({ textStyle: { fontFamily: 'Barlow' }, animationDuration: 500, ...option });
  graphes.push(g);
  return g;
}
const jourAxe = (j) => {
  const d = new Date(`${j}T12:00:00`);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};
function legende() {
  return { top: 0, right: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: T.texte2, fontSize: 12.5 } };
}
/** Pas d'axe rond pour des durées en secondes (10 s, 1 min, 15 min, 1 h…), 5 graduations au plus. */
function pasDuree(max) {
  const pas = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400];
  return pas.find((p) => max / p <= 5) ?? 86400 * Math.ceil(max / 86400 / 5);
}
/** Réglage d'un axe de durée : pas rond et sommet sur un multiple du pas. */
const axeDuree = (max) => {
  const interval = pasDuree(max);
  return { interval, max: Math.ceil(max / interval) * interval };
};
function courbes(el, jours, series, unite = '', label = '') {
  const maxS = unite === 's' ? Math.max(1, ...jours.map((_, i) => series.reduce((t, x) => t + (Number(x.data[i]?.value ?? x.data[i]) || 0), 0))) : 0;
  return dessiner(el, {
    grid: { left: 44, right: 14, top: 34, bottom: 28 },
    tooltip: { ...infobulle, trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: 'rgba(255,255,255,.25)' } },
      valueFormatter: (v) => (unite === 's' ? duree(v) : nombre(v)) },
    legend: series.length > 1 ? legende() : undefined,
    xAxis: { type: 'category', data: jours.map(jourAxe), boundaryGap: series.some((s) => s.type === 'bar'), ...axeCommun, splitLine: { show: false } },
    yAxis: { type: 'value', ...(unite === 's' ? axeDuree(maxS) : { minInterval: 1 }), ...axeCommun, axisLabel: { ...axeCommun.axisLabel, formatter: (v) => (unite === 's' ? duree(v, true) : nombre(v)) } },
    series,
  }, label);
}
function serieLigne(nom, data, couleur, aire = false) {
  return { name: nom, type: 'line', data, smooth: 0.25, symbol: 'circle', symbolSize: 7, showSymbol: data.length <= 31, lineStyle: { width: 2, color: couleur },
    itemStyle: { color: couleur, borderColor: T.fond, borderWidth: 2 },
    areaStyle: aire ? { color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${couleur}55` }, { offset: 1, color: `${couleur}00` }]) } : undefined };
}
function serieBarres(nom, data, couleur, pile) {
  return { name: nom, type: 'bar', stack: pile, data, barMaxWidth: 26, itemStyle: { color: couleur, borderRadius: pile ? 0 : [4, 4, 0, 0], borderColor: T.fond, borderWidth: pile ? 1 : 0 },
    emphasis: { focus: 'series' } };
}

// ------------------------------------------------------------------------------- cartes
function carte({ etiquette, ico, valeur, unite, detail, teinte, vedette }) {
  return h('div', { class: `carte-stat${vedette ? ' vedette' : ''}`, style: teinte ? { '--teinte': teinte } : undefined },
    h('div', { class: 'etiquette' }, ico ? h('i', { 'aria-hidden': 'true' }, ico) : null, etiquette),
    h('div', { class: 'valeur' }, valeur, unite ? h('small', {}, unite) : null),
    detail ? h('div', { class: 'detail' }, detail) : null);
}
function titre(texte, petit) {
  return h('h2', { class: 'titre' }, texte, petit ? h('small', {}, petit) : null);
}
function panneau(titreP, aide, ...enfants) {
  return h('section', { class: 'panneau' }, titreP ? h('h3', {}, titreP) : null, aide ? h('p', { class: 'aide' }, aide) : null, ...enfants);
}
function noteSuivi(r) {
  if (!r.debutSuivi) {
    return h('p', { class: 'note' }, 'Aucune visite mesurée pour l’instant : la mesure détaillée commence dès la prochaine visite du site. Les parties terminées des profils connectés (historique) sont déjà comptées.');
  }
  const debut = new Date(r.debutSuivi);
  const [d] = calculerPeriode();
  if (new Date(`${d}T00:00:00`) < debut) {
    return h('p', { class: 'note' }, `Mesure détaillée depuis le ${debut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à ${heure(r.debutSuivi)}. Avant cette date, seules les parties terminées des profils connectés sont connues (avec la durée annoncée par le jeu) : ni visites, ni invités, ni parties abandonnées.`);
  }
  return null;
}

// ------------------------------------------------------------------------------- vue d'ensemble
function vueEnsemble(r) {
  const c = r.chiffres;
  const jeux = r.jeux.liste;
  const prefere = r.jeux.prefere;
  const out = [noteSuivi(r), titre('Vue d’ensemble', libellePeriode())];
  out.push(h('div', { class: 'grille g-cartes' },
    h('div', { class: 'carte-stat vedette', style: { '--teinte': 'rgba(255,225,77,.16)' } },
      h('div', { class: 'etiquette' }, h('i', { 'aria-hidden': 'true' }, '👀'), 'Visiteurs distincts'),
      h('div', { class: 'trio' },
        h('div', {}, h('b', {}, nombre(c.visiteursAujourdhui)), h('span', {}, 'aujourd’hui')),
        h('div', {}, h('b', {}, nombre(c.visiteurs7j)), h('span', {}, '7 jours')),
        h('div', {}, h('b', {}, nombre(c.visiteurs30j)), h('span', {}, '30 jours'))),
      h('div', { class: 'detail' }, 'Estimation : un navigateur = un visiteur.')),
    carte({ etiquette: 'Joueurs actifs maintenant', ico: '🟢', valeur: nombre(r.direct.enLigne), detail: h('span', {}, h('b', {}, nombre(r.direct.enJeu)), ' en pleine partie'), teinte: 'rgba(95,211,154,.14)' }),
    carte({ etiquette: 'Sessions', ico: '🧭', valeur: nombre(c.sessions), detail: h('span', {}, h('b', {}, nombre(c.visiteurs)), ' visiteurs sur la période') }),
    carte({ etiquette: 'Durée moyenne d’une session', ico: '⏱️', valeur: duree(c.sessionMoyenne), detail: h('span', {}, 'médiane ', h('b', {}, duree(c.sessionMediane)), ' · temps actif') }),
    carte({ etiquette: 'Parties commencées', ico: '🎮', valeur: nombre(c.partiesCommencees), detail: h('span', {}, h('b', {}, nombre(c.partiesAbandonnees)), ' abandonnées'), teinte: 'rgba(57,135,229,.16)' }),
    carte({ etiquette: 'Parties terminées', ico: '🏁', valeur: nombre(c.partiesTerminees), detail: c.partiesTermineesHistorique ? h('span', {}, 'dont ', h('b', {}, nombre(c.partiesTermineesHistorique)), ' d’avant la mesure') : 'jusqu’à l’écran de fin' }),
    carte({ etiquette: 'Temps total de jeu', ico: '⌛', valeur: duree(c.tempsJeu, true), detail: h('span', {}, 'partie moyenne ', h('b', {}, duree(c.partieMoyenne))), teinte: 'rgba(201,133,0,.16)' }),
    carte({ etiquette: 'Comptes familiaux', ico: '👨‍👩‍👧', valeur: nombre(c.comptes), detail: h('span', {}, h('b', {}, `+${nombre(c.nouveauxComptes)}`), ' sur la période · ', h('b', {}, nombre(c.profils)), ' profils') }),
    carte({ etiquette: 'Jeu préféré (estimation)', ico: '🏆', valeur: prefere ? JEUX[prefere].court : '—', detail: prefere ? h('span', {}, 'indice ', h('b', {}, `${jeux.find((j) => j.jeu === prefere).preference}/100`), ' · voir Jeux') : 'pas encore de parties', teinte: 'rgba(255,225,77,.16)' }),
  ));

  const s = r.series;
  const g1 = graphe('graphe haut');
  const g2 = graphe('graphe');
  const g3 = graphe('graphe');
  out.push(h('div', { class: 'grille', style: { marginTop: '14px' } },
    panneau('Fréquentation', 'Visiteurs distincts et sessions par jour (heure de Paris).', g1)));
  out.push(h('div', { class: 'grille g-2', style: { marginTop: '14px' } },
    panneau('Temps de jeu par jour', 'Temps actif cumulé, par jeu.', g2),
    panneau('Parties par jour', 'Parties commencées (mesurées) ou terminées (historique), par jeu.', g3)));
  requestAnimationFrame(() => {
    courbes(g1, s.jours, [serieLigne('Visiteurs', s.visiteurs, T.accent, true), serieLigne('Sessions', s.sessions, T.bleu)], '', 'Courbe des visiteurs et des sessions par jour');
    courbes(g2, s.jours, ORDRE.map((j) => serieBarres(JEUX[j].nom, s.parJeu[j].temps, JEUX[j].couleur, 'temps')), 's', 'Temps de jeu par jour et par jeu');
    courbes(g3, s.jours, ORDRE.map((j) => serieBarres(JEUX[j].nom, s.parJeu[j].parties, JEUX[j].couleur, 'parties')), '', 'Parties par jour et par jeu');
  });

  out.push(titre('Les quatre jeux en un coup d’œil'));
  const g4 = graphe('graphe bas');
  const g5 = graphe('graphe bas');
  out.push(h('div', { class: 'grille g-2' },
    panneau('Temps total par jeu', null, g4),
    panneau('Parties par jeu', 'Terminées, abandonnées, en cours.', g5)));
  requestAnimationFrame(() => {
    barresJeux(g4, jeux, (j) => j.temps, 's');
    dessiner(g5, {
      grid: { left: 92, right: 20, top: 30, bottom: 20 },
      legend: legende(),
      tooltip: { ...infobulle, trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', minInterval: 1, ...axeCommun },
      yAxis: { type: 'category', data: ORDRE.map((j) => JEUX[j].court), inverse: true, ...axeCommun, axisLabel: { ...axeCommun.axisLabel, color: T.texte2, fontSize: 13 } },
      series: [
        { name: 'Terminées', type: 'bar', stack: 't', data: ORDRE.map((j) => jeux.find((x) => x.jeu === j).terminees), itemStyle: { color: '#5fd39a', borderColor: T.fond, borderWidth: 1 }, barMaxWidth: 22 },
        { name: 'Abandonnées', type: 'bar', stack: 't', data: ORDRE.map((j) => jeux.find((x) => x.jeu === j).abandons), itemStyle: { color: '#ff7b7b', borderColor: T.fond, borderWidth: 1 }, barMaxWidth: 22 },
        { name: 'En cours', type: 'bar', stack: 't', data: ORDRE.map((j) => jeux.find((x) => x.jeu === j).enCours), itemStyle: { color: '#8592ae', borderColor: T.fond, borderWidth: 1 }, barMaxWidth: 22 },
      ],
    }, 'Parties par jeu et par issue');
  });
  return out;
}

function barresJeux(el, jeux, val, unite = '') {
  const data = ORDRE.map((j) => jeux.find((x) => x.jeu === j));
  // unite : 's' durée, 'x' nombre décimal (parties par joueur), sinon nombre entier
  const f = (v, court) => (unite === 's' ? duree(v, court) : unite === 'x' ? String(Math.round(v * 10) / 10).replace('.', ',') : nombre(v));
  return dessiner(el, {
    grid: { left: 92, right: 70, top: 10, bottom: 20 },
    tooltip: { ...infobulle, trigger: 'item', formatter: (p) => `${p.name}<br><b>${f(p.value)}</b>` },
    xAxis: { type: 'value', ...(unite === 's' ? axeDuree(Math.max(1, ...data.map(val))) : { minInterval: unite === 'x' ? 0 : 1 }), ...axeCommun, axisLabel: { ...axeCommun.axisLabel, formatter: (v) => f(v, true) } },
    yAxis: { type: 'category', data: data.map((j) => JEUX[j.jeu].court), inverse: true, ...axeCommun, axisLabel: { ...axeCommun.axisLabel, color: T.texte2, fontSize: 13 } },
    series: [{ type: 'bar', barMaxWidth: 24, data: data.map((j) => ({ value: val(j), itemStyle: { color: JEUX[j.jeu].couleur, borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', color: T.texte2, formatter: (p) => f(p.value, true) } }],
  }, 'Comparaison des quatre jeux');
}

// ------------------------------------------------------------------------------- jeux
function vueJeux(r) {
  const jeux = r.jeux.liste;
  const out = [noteSuivi(r), titre('Quel est le jeu préféré ?', libellePeriode())];
  out.push(h('p', { class: 'sous-titre' }, 'Lancer beaucoup de parties ne veut pas dire aimer un jeu : l’indice combine le temps réellement joué (30 %), le nombre de joueurs (20 %), la rejouabilité — parties par joueur (20 %), la part de joueurs qui y reviennent un autre jour (20 %) et la part de parties menées jusqu’au bout (10 %). Chaque signal est comparé au meilleur des quatre jeux.'));
  const classes = [...jeux].sort((a, b) => b.preference - a.preference);
  const g = r.jeux.prefere ? jeux.find((j) => j.jeu === r.jeux.prefere) : null;
  const fiab = { bonne: 'données suffisantes', moyenne: 'peu de données : à confirmer', faible: 'très peu de données : simple tendance' }[r.jeux.fiabilite];
  out.push(h('div', { class: 'podium' },
    h('div', { class: 'gagnant' },
      h('span', { class: 'sur' }, 'Jeu préféré sur la période'),
      h('span', { class: 'nom' }, g ? `${JEUX[g.jeu].ico} ${JEUX[g.jeu].nom}` : 'Pas encore de parties'),
      g ? h('p', {}, `${duree(g.temps)} de jeu, ${nombre(g.joueurs)} joueur${g.joueurs > 1 ? 's' : ''}, ${String(g.rejouabilite ?? '—').replace('.', ',')} partie(s) par joueur, ${pct(g.tauxRetour)} de joueurs revenus.`) : null,
      g ? h('span', { class: 'fiabilite' }, fiab) : null),
    panneau('Indice de préférence', null, h('div', { class: 'signaux' }, classes.map((j) => h('div', { class: 'signal-ligne' },
      pastilleJeu(j.jeu),
      h('div', { class: 'barre-fond' }, h('div', { class: 'barre-plein', style: { width: `${j.preference}%`, '--c': JEUX[j.jeu].couleur } })),
      h('span', { class: 'num' }, j.preference)))))));

  out.push(titre('Comparaison'));
  const gT = graphe('graphe bas');
  const gJ = graphe('graphe bas');
  const gR = graphe('graphe bas');
  const gM = graphe('graphe bas');
  out.push(h('div', { class: 'grille g-2' },
    panneau('Temps total joué', 'Temps actif (hors pauses, onglet caché, inactivité).', gT),
    panneau('Joueurs distincts', 'Profils et navigateurs invités.', gJ),
    panneau('Rejouabilité', 'Parties par joueur.', gR),
    panneau('Durée médiane d’une partie', 'La moitié des parties dure moins, l’autre moitié plus.', gM)));
  requestAnimationFrame(() => {
    barresJeux(gT, jeux, (j) => j.temps, 's');
    barresJeux(gJ, jeux, (j) => j.joueurs);
    barresJeux(gR, jeux, (j) => j.rejouabilite ?? 0, 'x');
    barresJeux(gM, jeux, (j) => j.mediane ?? 0, 's');
  });

  out.push(titre('Fiche de chaque jeu'));
  out.push(h('div', { class: 'grille g-4' }, ORDRE.map((id) => {
    const j = jeux.find((x) => x.jeu === id);
    const total = Object.values(j.niveaux).reduce((a, b) => a + b, 0);
    const spark = graphe('graphe');
    spark.style.height = '70px';
    requestAnimationFrame(() => dessiner(spark, {
      grid: { left: 0, right: 0, top: 6, bottom: 0 },
      tooltip: { ...infobulle, trigger: 'axis', valueFormatter: (v) => `${nombre(v)} partie(s)` },
      xAxis: { type: 'category', show: false, data: r.series.jours.map(jourAxe) },
      yAxis: { type: 'value', show: false, minInterval: 1 },
      series: [serieLigne('Parties', r.series.parJeu[id].parties, JEUX[id].couleur, true)],
    }, `Parties par jour de ${JEUX[id].nom}`));
    return h('section', { class: `panneau carte-jeu c-${id}` },
      h('h3', {}, h('span', {}, `${JEUX[id].ico} ${JEUX[id].nom}`), h('span', { class: 'badge' }, `${j.preference}/100`)),
      h('div', { class: 'mini-stats' },
        h('div', {}, h('b', {}, nombre(j.joueurs)), h('span', {}, 'joueurs')),
        h('div', {}, h('b', {}, duree(j.temps, true)), h('span', {}, 'temps total')),
        h('div', {}, h('b', {}, nombre(j.commencees)), h('span', {}, 'commencées')),
        h('div', {}, h('b', {}, nombre(j.terminees)), h('span', {}, `terminées${j.termineesHistorique ? ` (dont ${j.termineesHistorique} hist.)` : ''}`)),
        h('div', {}, h('b', {}, duree(j.moyenne)), h('span', {}, 'partie moyenne')),
        h('div', {}, h('b', {}, duree(j.mediane)), h('span', {}, 'partie médiane')),
        h('div', {}, h('b', {}, pct(j.tauxTerminees)), h('span', {}, 'menées au bout')),
        h('div', {}, h('b', {}, pct(j.tauxAbandon)), h('span', {}, 'abandonnées')),
        h('div', {}, h('b', {}, pct(j.tauxVictoire)), h('span', {}, 'victoires (finies)')),
        h('div', {}, h('b', {}, pct(j.tauxRetour)), h('span', {}, 'joueurs revenus'))),
      h('div', { class: 'aide' }, 'Niveaux joués'),
      h('div', { class: 'repartition', role: 'img', 'aria-label': Object.entries(j.niveaux).map(([n, v]) => `${NIVEAUX[n]} ${v}`).join(', ') },
        Object.entries(j.niveaux).filter(([, v]) => v > 0).map(([n, v]) => h('span', { class: `n-${n}`, style: { width: `${(v / total) * 100}%` }, title: `${NIVEAUX[n]} : ${v}` }))),
      h('div', { class: 'legende-niveaux' }, Object.entries(j.niveaux).map(([n, v]) => h('span', {}, h('span', { class: `puce n-${n}` }), `${NIVEAUX[n]} ${v}`))),
      h('div', { class: 'aide', style: { marginTop: '10px' } }, 'Parties par jour'), spark);
  })));

  out.push(titre('Difficulté', 'Éveil, Explorateur, Stratège, Maître'));
  const gD = graphe('graphe');
  out.push(h('div', { class: 'grille g-2' },
    panneau('Parties par niveau et par jeu', null, gD),
    panneau('Réussite et abandons par niveau', 'Un fort taux d’abandon à un niveau peut révéler un problème d’équilibrage.', tableauDifficulte(r.difficulte))));
  requestAnimationFrame(() => dessiner(gD, {
    grid: { left: 92, right: 20, top: 30, bottom: 20 },
    legend: legende(),
    tooltip: { ...infobulle, trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', minInterval: 1, ...axeCommun },
    yAxis: { type: 'category', inverse: true, data: r.difficulte.map((d) => NIVEAUX[d.niveau]), ...axeCommun, axisLabel: { ...axeCommun.axisLabel, color: T.texte2, fontSize: 13 } },
    series: ORDRE.map((j) => ({ name: JEUX[j].court, type: 'bar', stack: 'n', barMaxWidth: 24, data: r.difficulte.map((d) => d.parJeu[j]), itemStyle: { color: JEUX[j].couleur, borderColor: T.fond, borderWidth: 1 } })),
  }, 'Parties par niveau de difficulté'));

  out.push(titre('Quand joue-t-on ?', 'heure de Paris'));
  const gH = graphe('graphe');
  out.push(panneau('Parties par jour de la semaine et par heure', null, gH));
  requestAnimationFrame(() => carteChaleur(gH, r.heures.parties));
  return out;
}

function tableauDifficulte(diff) {
  return h('div', { class: 'tableau-defile' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Niveau'), h('th', { class: 'n' }, 'Parties'), h('th', { class: 'n' }, 'Au bout'), h('th', { class: 'n' }, 'Abandons'), h('th', { class: 'n' }, 'Victoires'), h('th', { class: 'n' }, 'Durée moy.'))),
    h('tbody', {}, diff.map((d) => h('tr', {},
      h('td', {}, h('span', { class: `puce n-${d.niveau}` }), NIVEAUX[d.niveau]),
      h('td', { class: 'n' }, nombre(d.parties)), h('td', { class: 'n' }, pct(d.tauxTerminees)), h('td', { class: 'n' }, pct(d.tauxAbandon)),
      h('td', { class: 'n' }, pct(d.tauxVictoire)), h('td', { class: 'n' }, duree(d.moyenne)))))));
}

function carteChaleur(el, cases) {
  const max = Math.max(1, ...cases.map((c) => c[2]));
  dessiner(el, {
    grid: { left: 44, right: 14, top: 10, bottom: 74 },
    tooltip: { ...infobulle, formatter: (p) => `${['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][p.value[1]]}, ${p.value[0]} h<br><b>${nombre(p.value[2])} partie(s)</b>` },
    xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => `${i} h`), ...axeCommun, splitArea: { show: false } },
    yAxis: { type: 'category', data: ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'], inverse: true, ...axeCommun },
    visualMap: { min: 0, max, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 140, itemWidth: 10, textStyle: { color: T.muet },
      inRange: { color: ['#26355a', '#2f5d9e', '#3987e5', '#8fc0ff', '#ffe14d'] } },
    series: [{ type: 'heatmap', data: cases, itemStyle: { borderColor: T.fond, borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: '#fff' } } }],
  }, 'Carte de chaleur des parties par jour et par heure');
}

// ------------------------------------------------------------------------------- visiteurs
function vueVisiteurs(r) {
  const v = r.invites;
  const f = r.fidelite;
  const out = [noteSuivi(r), titre('Visiteurs sans compte', libellePeriode())];
  out.push(h('p', { class: 'sous-titre' }, 'Visites sans espace famille connecté (et visites qui se terminent par la création d’un compte). Un visiteur est un navigateur reconnu par un numéro aléatoire : une même personne sur deux appareils compte deux fois, et vider les données du navigateur crée un nouveau visiteur.'));
  out.push(h('div', { class: 'grille g-cartes' },
    carte({ etiquette: 'Sessions d’invités', ico: '🧭', valeur: nombre(v.sessions), detail: h('span', {}, h('b', {}, nombre(v.visiteurs)), ' visiteurs distincts') }),
    carte({ etiquette: 'Temps passé sur le site', ico: '⏱️', valeur: duree(v.dureeMoyenne), detail: h('span', {}, 'par session, médiane ', h('b', {}, duree(v.dureeMediane))) }),
    carte({ etiquette: 'Lancent un jeu', ico: '🎮', valeur: pct(v.tauxLancement), detail: h('span', {}, h('b', {}, nombre(v.parties)), ' parties d’invités'), teinte: 'rgba(57,135,229,.16)' }),
    carte({ etiquette: 'Temps de jeu par session', ico: '⌛', valeur: duree(v.tempsParSession), detail: 'temps actif en partie' }),
    carte({ etiquette: 'Reviennent un autre jour', ico: '🔁', valeur: pct(v.tauxRetour), detail: h('span', {}, h('b', {}, nombre(v.revenus)), ' visiteurs (depuis le début de la mesure)') }),
    carte({ etiquette: 'Créent un compte', ico: '✨', valeur: pct(v.tauxInscription), detail: h('span', {}, h('b', {}, nombre(v.inscrits)), ' visiteur(s)'), teinte: 'rgba(255,225,77,.16)' }),
  ));

  out.push(titre('Parcours des visiteurs', 'entonnoir de conversion'));
  const zone = h('div');
  const dessinerEntonnoir = () => {
    const etapes = r.entonnoir[etat.entonnoir];
    const noms = { visite: 'Arrivée sur le site', niveau: 'Niveau choisi', lancee: 'Jeu lancé', terminee: 'Partie terminée', inscription: 'Compte créé' };
    const base = etapes[0].n || 1;
    zone.replaceChildren(h('div', { class: 'entonnoir' }, etapes.map((e, i) => h('div', { class: 'etape' },
      h('span', {}, noms[e.etape]),
      h('div', { class: 'barre-fond' }, h('div', { class: 'barre-plein', style: { width: `${Math.max(e.n ? 2 : 0, (e.n / base) * 100)}%` } })),
      h('span', { class: 'chiffre' }, h('b', {}, nombre(e.n)), h('span', {}, i === 0 ? 'sessions' : `${pct(e.n / base)}${i > 0 && etapes[i - 1].n ? ` · ${pct(e.n / etapes[i - 1].n)} de l’étape préc.` : ''}`))))));
  };
  const bascule = h('div', { class: 'bascule', role: 'group', 'aria-label': 'Sessions comptées' },
    ...[['tous', 'Toutes les sessions'], ['invites', 'Invités']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(etat.entonnoir === k), onclick: (e) => {
      etat.entonnoir = k;
      for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
      dessinerEntonnoir();
    } }, l)));
  dessinerEntonnoir();
  out.push(h('section', { class: 'panneau' }, h('div', { class: 'entete-panneau' }, h('div', {}, h('h3', {}, 'De la visite au compte'), h('p', { class: 'aide' }, 'Chaque barre : sessions qui ont atteint l’étape. « Niveau choisi » inclut les visites qui lancent directement un jeu.')), bascule), zone));

  const gJ = graphe('graphe bas');
  const gN = graphe('graphe bas');
  const gH = graphe('graphe bas');
  const gA = graphe('graphe bas');
  out.push(titre('Ce que font les invités'));
  out.push(h('div', { class: 'grille g-2' },
    panneau('Jeux choisis', 'Parties lancées par des invités.', gJ),
    panneau('Niveaux choisis', null, gN),
    panneau('Heures d’arrivée', 'Toutes les sessions, heure de Paris.', gH),
    panneau('Appareils utilisés', 'Toutes les sessions (déduit de l’écran : doigt ou souris, petite ou grande largeur).', gA)));
  requestAnimationFrame(() => {
    barresJeux(gJ, ORDRE.map((j) => ({ jeu: j, n: v.jeux[j] || 0 })), (x) => x.n);
    dessiner(gN, {
      grid: { left: 92, right: 40, top: 10, bottom: 20 },
      tooltip: { ...infobulle, trigger: 'item' },
      xAxis: { type: 'value', minInterval: 1, ...axeCommun },
      yAxis: { type: 'category', inverse: true, data: Object.keys(NIVEAUX).map((n) => NIVEAUX[n]), ...axeCommun, axisLabel: { ...axeCommun.axisLabel, color: T.texte2, fontSize: 13 } },
      series: [{ type: 'bar', barMaxWidth: 22, data: Object.keys(NIVEAUX).map((n) => ({ value: v.niveaux[n] || 0, itemStyle: { color: COUL_NIVEAUX[n], borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: 'right', color: T.texte2 } }],
    }, 'Niveaux choisis par les invités');
    dessiner(gH, {
      grid: { left: 36, right: 10, top: 10, bottom: 24 },
      tooltip: { ...infobulle, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (x) => `${nombre(x)} session(s)` },
      xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => `${i} h`), ...axeCommun, splitLine: { show: false } },
      yAxis: { type: 'value', minInterval: 1, ...axeCommun },
      series: [{ type: 'bar', data: r.heures.arrivees, barMaxWidth: 18, itemStyle: { color: T.bleu, borderRadius: [4, 4, 0, 0] } }],
    }, 'Arrivées par heure');
    dessiner(gA, {
      grid: { left: 92, right: 50, top: 10, bottom: 20 },
      tooltip: { ...infobulle, trigger: 'item', formatter: (p) => `${p.name}<br><b>${nombre(p.value)} session(s)</b>` },
      xAxis: { type: 'value', minInterval: 1, ...axeCommun },
      yAxis: { type: 'category', inverse: true, data: r.appareils.map((a) => APPAREILS[a.appareil]), ...axeCommun, axisLabel: { ...axeCommun.axisLabel, color: T.texte2, fontSize: 13 } },
      series: [{ type: 'bar', barMaxWidth: 22, data: r.appareils.map((a, i) => ({ value: a.sessions, itemStyle: { color: ['#3987e5', '#5fd39a', '#f2b84b'][i], borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: 'right', color: T.texte2 } }],
    }, 'Sessions par appareil');
  });

  out.push(titre('Fidélisation', 'joueurs dont la première partie tombe dans la période'));
  out.push(h('div', { class: 'grille g-cartes' },
    carte({ etiquette: 'Nouveaux joueurs', ico: '🌱', valeur: nombre(f.nouveaux), detail: 'profils et invités ayant joué' }),
    carte({ etiquette: 'Reviennent le lendemain', ico: '📅', valeur: pct(f.tauxJ1), detail: h('span', {}, h('b', {}, `${nombre(f.revenusJ1)} / ${nombre(f.eligiblesJ1)}`), ' (lendemain déjà passé)') }),
    carte({ etiquette: 'Reviennent sous 7 jours', ico: '🗓️', valeur: pct(f.tauxJ7), detail: h('span', {}, h('b', {}, `${nombre(f.revenusJ7)} / ${nombre(f.eligiblesJ7)}`), ' (7 jours écoulés)') }),
    carte({ etiquette: 'Jouent plusieurs jours', ico: '🔁', valeur: pct(f.tauxPlusieursJours), detail: h('span', {}, h('b', {}, nombre(f.plusieursJours)), ' joueurs') }),
    carte({ etiquette: 'Essaient plusieurs jeux', ico: '🎲', valeur: pct(f.tauxPlusieursJeux), detail: h('span', {}, h('b', {}, nombre(f.plusieursJeux)), ' joueurs') }),
    carte({ etiquette: 'Visiteurs revenus', ico: '👋', valeur: nombre(f.visiteursRevenus), detail: h('span', {}, 'sur ', h('b', {}, nombre(f.nouveauxVisiteurs)), ' nouveaux visiteurs') }),
  ));

  const entrees = Object.entries(v.entrees || {}).sort((a, b) => b[1] - a[1]);
  out.push(titre('Pages d’arrivée'));
  out.push(entrees.length ? h('div', { class: 'tableau-defile' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Page'), h('th', { class: 'n' }, 'Sessions d’invités'))),
    h('tbody', {}, entrees.map(([p, n]) => h('tr', {}, h('td', {}, PAGES[p] || p), h('td', { class: 'n' }, nombre(n))))))) : h('p', { class: 'vide' }, 'Pas encore de visite mesurée sur cette période.'));
  out.push(definitions());
  return out;
}

function definitions() {
  return h('section', { class: 'panneau', style: { marginTop: '22px' } }, h('h3', {}, 'Comment lire ces chiffres'),
    h('div', { class: 'definitions', style: { marginTop: '10px' } },
      h('div', {}, h('b', {}, 'Visiteur'), 'Un navigateur, reconnu par un numéro tiré au hasard et gardé dans son stockage local (aucun cookie). C’est une estimation des personnes.'),
      h('div', {}, h('b', {}, 'Session'), 'Une période de visite. Une nouvelle commence après 30 minutes sans activité. Sa durée est le temps actif.'),
      h('div', {}, h('b', {}, 'Partie'), 'Du bouton Tranquille / Défi jusqu’à l’écran de fin (terminée) ou au départ du jeu (abandonnée). Sans nouvelles pendant 10 minutes : abandonnée.'),
      h('div', {}, h('b', {}, 'Temps actif'), 'Une seconde compte si la page est visible, que le joueur a agi dans la dernière minute et que le jeu n’est pas en pause. Un onglet oublié ne compte pas.'),
      h('div', {}, h('b', {}, 'Historique'), 'Avant la mesure, seules les parties terminées des profils connectés existent, avec la durée annoncée par le jeu (pauses comprises).'),
      h('div', {}, h('b', {}, 'Actif maintenant'), 'Navigateur qui a donné signe de vie depuis moins de 2 minutes (page ouverte et utilisée).')));
}

// ------------------------------------------------------------------------------- joueurs
async function vueJoueurs() {
  const d = etat.joueurs ?? (etat.joueurs = await api('joueurs'));
  const out = [titre('Joueurs', 'profils des espaces famille')];
  out.push(h('p', { class: 'sous-titre' }, 'Totaux depuis le début (toutes périodes). Chaque profil enfant a ses propres statistiques ; les comptes familiaux sont listés à part. Aucune adresse e-mail n’est affichée.'));
  const recherche = h('input', { type: 'search', placeholder: 'Chercher un pseudo…', value: etat.recherche, 'aria-label': 'Chercher un pseudo' });
  const corps = h('tbody');
  const cols = [
    ['pseudo', 'Joueur'], ['compte', 'Compte', 'n'], ['creeLe', 'Créé le'], ['derniereActivite', 'Dernière activité'], ['parties', 'Parties', 'n'],
    ['temps', 'Temps de jeu', 'n'], ['jours', 'Jours joués', 'n'], ['favori', 'Jeu favori'], ['niveauHabituel', 'Niveau habituel'], ['repartition', 'Temps par jeu'],
  ];
  const tete = h('tr', {}, cols.map(([k, l, c]) => h('th', { class: c || '' }, k === 'repartition' ? l : h('button', { type: 'button', 'data-col': k, onclick: () => {
    etat.tri = { col: k, sens: etat.tri.col === k && etat.tri.sens === 'desc' ? 'asc' : 'desc' };
    remplir();
  } }, l))));
  const remplir = () => {
    for (const b of tete.querySelectorAll('button')) b.dataset.tri = b.dataset.col === etat.tri.col ? etat.tri.sens : '';
    const q = etat.recherche.trim().toLowerCase();
    const liste = d.profils.filter((p) => !q || p.pseudo.toLowerCase().includes(q));
    const { col, sens } = etat.tri;
    liste.sort((a, b) => {
      const x = a[col] ?? '';
      const y = b[col] ?? '';
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr');
      return sens === 'asc' ? c : -c;
    });
    corps.replaceChildren(...(liste.length ? liste.map((p) => h('tr', { class: 'cliquable', tabindex: '0', onclick: () => ouvrirFiche(p.id), onkeydown: (e) => e.key === 'Enter' && ouvrirFiche(p.id) },
      h('td', {}, h('span', { class: 'joueur-cel' }, avatar(p.avatar), h('b', {}, p.pseudo))),
      h('td', { class: 'n' }, `n° ${p.compte}`),
      h('td', {}, jourCourt(p.creeLe)),
      h('td', {}, quand(p.derniereActivite)),
      h('td', { class: 'n' }, nombre(p.parties)),
      h('td', { class: 'n' }, duree(p.temps)),
      h('td', { class: 'n' }, nombre(p.jours)),
      h('td', {}, p.favori ? pastilleJeu(p.favori, true) : '—'),
      h('td', {}, p.niveauHabituel ? NIVEAUX[p.niveauHabituel] : '—'),
      h('td', {}, miniBarres(p.parJeu)))) : [h('tr', {}, h('td', { colspan: cols.length, class: 'vide' }, 'Aucun profil.'))]));
  };
  recherche.addEventListener('input', () => {
    etat.recherche = recherche.value;
    remplir();
  });
  remplir();
  out.push(h('div', { class: 'outils' }, recherche, h('span', { class: 'aide' }, `${d.profils.length} profil(s) · cliquer une ligne pour ouvrir la fiche`)));
  out.push(h('div', { class: 'tableau-defile' }, h('table', {}, h('thead', {}, tete), corps)));

  out.push(titre('Comptes familiaux', `${d.comptes.length} compte(s)`));
  out.push(h('div', { class: 'tableau-defile' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Compte'), h('th', {}, 'Créé le'), h('th', {}, 'Dernière connexion'), h('th', {}, 'Dernière visite'), h('th', {}, 'Connexion'), h('th', { class: 'n' }, 'Parties'), h('th', { class: 'n' }, 'Temps'), h('th', {}, 'Profils'))),
    h('tbody', {}, d.comptes.length ? d.comptes.map((c) => h('tr', {},
      h('td', {}, h('b', {}, `Compte n° ${c.id}`)), h('td', {}, jourCourt(c.creeLe)), h('td', {}, quand(c.derniereConnexion)), h('td', {}, quand(c.derniereVisite)),
      h('td', {}, c.google ? 'Google + mot de passe possible' : 'Mot de passe'), h('td', { class: 'n' }, nombre(c.parties)), h('td', { class: 'n' }, duree(c.temps)),
      h('td', {}, c.profils.length ? h('div', { class: 'famille' }, c.profils.map((id) => {
        const p = d.profils.find((x) => x.id === id);
        return h('button', { type: 'button', class: 'chip', onclick: () => ouvrirFiche(id) }, h('img', { src: avatarUrl(p.avatar), alt: '' }), p.pseudo);
      })) : h('span', { class: 'aide' }, 'aucun profil')))) : h('tr', {}, h('td', { colspan: 8, class: 'vide' }, 'Aucun compte.'))))));

  out.push(titre('Invités', `${nombre(d.nbInvites)} navigateur(s) ayant joué, 100 plus récents`));
  out.push(h('p', { class: 'sous-titre' }, 'Joueurs sans compte, désignés par un code court tiré de leur numéro aléatoire (impossible de remonter à une personne).'));
  out.push(d.invites.length ? h('div', { class: 'tableau-defile' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Invité'), h('th', {}, 'Dernière activité'), h('th', { class: 'n' }, 'Parties'), h('th', { class: 'n' }, 'Temps'), h('th', { class: 'n' }, 'Jours'), h('th', {}, 'Jeu favori'), h('th', {}, 'Niveau habituel'), h('th', {}, 'Temps par jeu'))),
    h('tbody', {}, d.invites.map((p) => h('tr', {}, h('td', {}, p.id), h('td', {}, quand(p.derniereActivite)), h('td', { class: 'n' }, nombre(p.parties)), h('td', { class: 'n' }, duree(p.temps)),
      h('td', { class: 'n' }, nombre(p.jours)), h('td', {}, p.favori ? pastilleJeu(p.favori, true) : '—'), h('td', {}, p.niveauHabituel ? NIVEAUX[p.niveauHabituel] : '—'), h('td', {}, miniBarres(p.parJeu))))))) : h('p', { class: 'vide' }, 'Aucune partie d’invité mesurée pour l’instant.'));
  return out;
}

function miniBarres(parJeu) {
  const total = ORDRE.reduce((a, j) => a + (parJeu[j]?.temps || 0), 0);
  if (!total) return h('span', { class: 'aide' }, '—');
  return h('div', { class: 'mini-barres', role: 'img', 'aria-label': ORDRE.map((j) => `${JEUX[j].court} ${duree(parJeu[j].temps)}`).join(', '), title: ORDRE.map((j) => `${JEUX[j].court} : ${duree(parJeu[j].temps)}`).join('\n') },
    ORDRE.filter((j) => parJeu[j].temps > 0).map((j) => h('span', { style: { width: `${(parJeu[j].temps / total) * 100}%`, background: JEUX[j].couleur } })));
}

// ------------------------------------------------------------------------------- fiche joueur
let ficheGraphes = [];
async function ouvrirFiche(id) {
  const fiche = $('#fiche');
  const fond = $('#fiche-fond');
  fiche.replaceChildren(h('p', { class: 'chargement' }, 'Chargement de la fiche…'));
  fiche.hidden = false;
  fond.hidden = false;
  let p;
  try {
    p = await api('joueur', { id });
  } catch (e) {
    fiche.replaceChildren(h('button', { class: 'fermer', type: 'button', onclick: fermerFiche, 'aria-label': 'Fermer' }, '×'), h('p', { class: 'erreur-globale' }, e.message));
    return;
  }
  const maxT = Math.max(1, ...ORDRE.map((j) => p.parJeu[j].temps));
  const gA = graphe('graphe bas');
  const gH = graphe('graphe bas');
  gH.style.height = '170px';
  fiche.replaceChildren(
    h('div', { class: 'fiche-tete' }, avatar(p.avatar, true),
      h('div', {}, h('h2', { id: 'fiche-titre' }, `Profil : ${p.pseudo}`),
        h('p', {}, `Compte familial n° ${p.compte.id} · profil créé le ${jourCourt(p.creeLe)} · niveau du profil : ${NIVEAUX[p.niveauProfil] || p.niveauProfil}`)),
      h('button', { class: 'fermer', type: 'button', onclick: fermerFiche, 'aria-label': 'Fermer la fiche' }, '×')),
    h('div', { class: 'grille g-cartes' },
      carte({ etiquette: 'Dernière activité', ico: '🕒', valeur: h('span', { style: { fontSize: '22px' } }, quand(p.derniereActivite)) }),
      carte({ etiquette: 'Temps total de jeu', ico: '⌛', valeur: duree(p.temps, true), detail: h('span', {}, h('b', {}, nombre(p.parties)), ' parties') }),
      carte({ etiquette: 'Jeu favori', ico: '🏆', valeur: p.favori ? JEUX[p.favori].court : '—', detail: 'celui où il passe le plus de temps' }),
      carte({ etiquette: 'Niveau habituel', ico: '🎯', valeur: p.niveauHabituel ? NIVEAUX[p.niveauHabituel] : '—', detail: h('span', {}, h('b', {}, nombre(p.jours)), ' jour(s) de jeu') })),
    titre('Temps par jeu'),
    h('div', { class: 'panneau' }, h('div', { class: 'temps-jeux' }, ORDRE.map((j) => h('div', { class: 'temps-jeu' },
      pastilleJeu(j), h('div', { class: 'barre-fond' }, h('div', { class: 'barre-plein', style: { width: `${(p.parJeu[j].temps / maxT) * 100}%`, '--c': JEUX[j].couleur } })),
      h('span', { class: 'num' }, `${duree(p.parJeu[j].temps)}`))))),
    titre('Activité des 8 dernières semaines'), h('div', { class: 'panneau' }, gA),
    titre('Heures de jeu'), h('div', { class: 'panneau' }, gH),
    titre('Meilleurs scores', 'vérifiés'),
    h('div', { class: 'records' }, ORDRE.map((j) => {
      const rc = p.records[j];
      return h('div', { class: `record c-${j}` }, JEUX[j].nom, rc ? h('b', {}, nombre(rc.score)) : h('b', {}, '—'), rc ? `${NIVEAUX[rc.niveau]} · ${MODES[rc.mode]} · ${jourCourt(rc.date)}` : 'pas encore de record');
    })),
    p.compte.autresProfils.length ? h('div', {}, titre('Même famille', 'statistiques séparées'), h('div', { class: 'famille' }, p.compte.autresProfils.map((x) => h('button', { type: 'button', class: 'chip', onclick: () => ouvrirFiche(x.id) }, h('img', { src: avatarUrl(x.avatar), alt: '' }), x.pseudo)))) : null,
    titre('Dernières parties'),
    listeParties(p.dernieres),
  );
  for (const g of ficheGraphes) g.dispose();
  ficheGraphes = [];
  requestAnimationFrame(() => {
    const g1 = courbes(gA, p.activite.jours, [serieBarres('Temps de jeu', p.activite.temps, T.accent)], 's', 'Temps de jeu par jour');
    const g2 = dessiner(gH, {
      grid: { left: 30, right: 8, top: 8, bottom: 24 },
      tooltip: { ...infobulle, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (x) => `${nombre(x)} partie(s)` },
      xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => `${i} h`), ...axeCommun, splitLine: { show: false } },
      yAxis: { type: 'value', minInterval: 1, ...axeCommun },
      series: [{ type: 'bar', data: p.heures, barMaxWidth: 14, itemStyle: { color: T.bleu, borderRadius: [3, 3, 0, 0] } }],
    }, 'Parties par heure');
    ficheGraphes = [g1, g2].filter(Boolean);
  });
  $('.fermer', fiche).focus();
}
function fermerFiche() {
  $('#fiche').hidden = true;
  $('#fiche-fond').hidden = true;
}
function listeParties(parties) {
  if (!parties.length) return h('p', { class: 'vide' }, 'Aucune partie.');
  return h('ul', { class: 'evenements' }, parties.map((x) => h('li', { class: `evenement c-${x.jeu}`, style: { '--c': JEUX[x.jeu]?.couleur } },
    h('span', { class: 'heure' }, dateLocale(x.debut, { day: '2-digit', month: '2-digit' })),
    h('span', { class: 'ico', 'aria-hidden': 'true' }, JEUX[x.jeu]?.ico),
    h('span', { class: 'texte' }, h('b', {}, JEUX[x.jeu]?.nom), ` · ${NIVEAUX[x.niveau]} · ${MODES[x.mode]}`, issue(x)),
    h('span', { class: 'meta' }, `${heure(x.debut)} · ${duree(x.actif)}${x.score !== null ? ` · ${nombre(x.score)} pts` : ''}`))));
}
function issue(x) {
  if (x.etat === 'en_cours') return h('span', { class: 'badge' }, 'en cours');
  if (x.etat === 'abandon') return h('span', { class: 'badge ko' }, 'abandonnée');
  return h('span', { class: `badge ${x.gagne ? 'ok' : ''}` }, x.gagne ? 'gagnée' : 'perdue', x.source === 'historique' ? ' · historique' : '');
}

// ------------------------------------------------------------------------------- historique
async function vueHistorique() {
  const [debut, fin] = calculerPeriode();
  const joueurs = etat.joueurs ?? (etat.joueurs = await api('joueurs'));
  const d = await api('historique', { debut, fin, ...etat.filtres });
  const out = [titre('Historique', libellePeriode())];
  out.push(h('p', { class: 'sous-titre' }, 'Parties commencées, terminées ou abandonnées, comptes et profils créés, à l’heure locale. Seule l’utilisation des jeux est retracée : aucun clic, aucune touche.'));
  const choix = (cle, options, label) => {
    const s = h('select', { 'aria-label': label, onchange: () => {
      etat.filtres[cle] = s.value;
      afficher();
    } }, options.map(([v, l]) => h('option', { value: v, selected: etat.filtres[cle] === v }, l)));
    return s;
  };
  out.push(h('div', { class: 'outils' },
    choix('jeu', [['', 'Tous les jeux'], ...ORDRE.map((j) => [j, JEUX[j].nom])], 'Jeu'),
    choix('qui', [['', 'Tout le monde'], ['invites', 'Invités'], ['profils', 'Profils connectés']], 'Qui'),
    choix('profil', [['', 'Tous les joueurs'], ...joueurs.profils.map((p) => [String(p.id), p.pseudo])], 'Joueur'),
    h('span', { class: 'aide' }, d.total > d.evenements.length ? `${nombre(d.evenements.length)} plus récents sur ${nombre(d.total)}` : `${nombre(d.total)} événement(s)`)));
  if (!d.evenements.length) {
    out.push(h('p', { class: 'vide' }, 'Rien sur cette période avec ces filtres.'));
    return out;
  }
  let jourPrec = '';
  let liste = null;
  for (const e of d.evenements) {
    const j = new Date(e.quand).toDateString();
    if (j !== jourPrec) {
      jourPrec = j;
      out.push(h('div', { class: 'jour-historique' }, dateLocale(e.quand, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })));
      liste = h('ul', { class: 'evenements' });
      out.push(liste);
    }
    liste.append(ligneHistorique(e));
  }
  return out;
}
function quiEst(e) {
  if (e.pseudo) return h('button', { type: 'button', class: 'lien', onclick: () => ouvrirFiche(e.profil) }, e.pseudo);
  return h('span', {}, e.joueur || 'Un visiteur invité');
}
function ligneHistorique(e) {
  const c = JEUX[e.jeu]?.couleur;
  const li = (ico, texte, meta, couleur) => h('li', { class: 'evenement', style: { '--c': couleur || '#8592ae' } },
    h('span', { class: 'heure' }, heure(e.quand)), h('span', { class: 'ico', 'aria-hidden': 'true' }, ico), h('span', { class: 'texte' }, ...texte), h('span', { class: 'meta' }, meta || ''));
  const jeu = e.jeu ? [h('b', {}, JEUX[e.jeu].nom), ` (${NIVEAUX[e.niveau]}, ${MODES[e.mode]})`] : [];
  switch (e.type) {
    case 'debut': return li('▶️', [quiEst(e), ' commence ', ...jeu], e.etat === 'en_cours' ? 'en cours' : '', c);
    case 'fin': return li('🏁', [quiEst(e), ' termine ', ...jeu, issue(e)], `${duree(e.actif)}${e.score !== null ? ` · ${nombre(e.score)} pts` : ''}`, c);
    case 'abandon': return li('⏹️', [quiEst(e), ' quitte ', ...jeu, ' avant la fin'], duree(e.actif), c);
    case 'compte': return li('✨', [h('b', {}, `Compte familial n° ${e.compte}`), ' créé'], '', '#ffe14d');
    case 'profil': return li('🧒', ['Nouveau profil ', quiEst(e), ` (compte n° ${e.compte})`], '', '#ffe14d');
    default: return li('•', [e.type], '');
  }
}

// ------------------------------------------------------------------------------- santé
async function vueSante() {
  const s = await api('sante');
  const out = [titre('Santé de la collecte', 'les chiffres sont-ils fiables ?')];
  const age = s.derniereVisite ? (Date.now() - new Date(s.derniereVisite).getTime()) / 3600000 : null;
  const refusAuj = s.journal[0]?.refuses ?? 0;
  const recusAuj = s.journal[0]?.recus ?? 0;
  const g = graphe('graphe bas');
  out.push(h('div', { class: 'grille g-3' },
    panneau('API de suivi', 'Testée à l’instant par cette page.', h('p', { class: 'etat ok' }, 'Répond normalement'),
      h('p', { class: 'aide' }, 'L’état du service est vérifié directement, indépendamment des dernières données reçues.')),
    panneau('Dernière donnée reçue', 'Une absence de visites n’est pas une panne : le site peut simplement être calme.',
      h('p', { class: `etat ${age === null ? 'attention' : 'ok'}` }, s.derniereVisite ? ilYa(s.derniereVisite) : 'aucune pour l’instant'),
      h('p', { class: 'aide' }, s.dernierePartie ? `Dernière partie : ${quand(s.dernierePartie)}` : 'Aucune partie mesurée.')),
    panneau('Envois refusés aujourd’hui', 'Données mal formées, trop nombreuses ou d’origine étrangère.',
      h('p', { class: `etat ${refusAuj === 0 ? 'ok' : refusAuj > recusAuj * 0.1 ? 'ko' : 'attention'}` }, `${nombre(refusAuj)} refusé(s) / ${nombre(recusAuj)} reçu(s)`),
      s.journal[0]?.dernierRefus ? h('p', { class: 'aide' }, `Dernier motif : ${s.journal[0].dernierRefus}`) : null)));
  out.push(h('div', { class: 'grille g-2', style: { marginTop: '14px' } },
    panneau('Envois des 14 derniers jours', null, g),
    panneau('Données', null, h('dl', { class: 'liste' },
      h('dt', {}, 'Début de la mesure'), h('dd', {}, s.debutSuivi ? quand(s.debutSuivi) : 'pas encore'),
      h('dt', {}, 'Conservation du détail'), h('dd', {}, `${nombre(s.conservationJours)} jours (puis totaux par jour)`),
      h('dt', {}, 'Visites détaillées'), h('dd', {}, nombre(s.lignes.visites)),
      h('dt', {}, 'Parties mesurées'), h('dd', {}, `${nombre(s.lignes.parties)} (dont ${nombre(s.enCours)} en cours)`),
      h('dt', {}, 'Résultats des profils'), h('dd', {}, nombre(s.lignes.resultats)),
      h('dt', {}, 'Jours résumés'), h('dd', {}, nombre(s.lignes.bilans)),
      h('dt', {}, 'Comptes / profils'), h('dd', {}, `${nombre(s.lignes.comptes)} / ${nombre(s.lignes.profils)}`),
      h('dt', {}, 'Version du schéma'), h('dd', {}, s.schema),
      h('dt', {}, 'Vérifié à'), h('dd', {}, quand(s.maintenant))))));
  const jours = [...s.journal].reverse();
  requestAnimationFrame(() => dessiner(g, {
    grid: { left: 40, right: 10, top: 30, bottom: 24 },
    legend: legende(),
    tooltip: { ...infobulle, trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: jours.map((j) => jourAxe(j.jour)), ...axeCommun, splitLine: { show: false } },
    yAxis: { type: 'value', minInterval: 1, ...axeCommun },
    series: [serieBarres('Reçus', jours.map((j) => j.recus), '#5fd39a', 'e'), serieBarres('Refusés', jours.map((j) => j.refuses), '#ff7b7b', 'e')],
  }, 'Envois reçus et refusés par jour'));
  out.push(definitions());
  return out;
}

// ------------------------------------------------------------------------------- direct
async function rafraichirDirect() {
  const el = $('#direct');
  try {
    const d = await api('direct');
    const parJeu = ORDRE.filter((j) => d.parJeu[j] > 0).map((j) => `${JEUX[j].court} ${d.parJeu[j]}`).join(' · ');
    $('#direct-texte').textContent = d.enLigne === 0 ? 'Personne en ligne' : `${d.enLigne} en ligne${d.enJeu ? ` · ${d.enJeu} en partie${parJeu ? ` (${parJeu})` : ''}` : ''}`;
    el.classList.toggle('vivant', d.enLigne > 0);
    el.title = 'Activité des 2 dernières minutes, mise à jour toutes les 20 secondes';
  } catch {
    $('#direct-texte').textContent = 'Direct indisponible';
    el.classList.remove('vivant');
  }
}

// ------------------------------------------------------------------------------- navigation
async function recharger() {
  const contenu = $('#contenu');
  for (const g of graphes.splice(0)) g.dispose();
  contenu.replaceChildren(h('p', { class: 'chargement' }, 'Chargement des statistiques…'));
  try {
    let blocs;
    if (['ensemble', 'jeux', 'visiteurs'].includes(etat.vue)) {
      const [debut, fin] = calculerPeriode();
      etat.resume = await api('resume', { debut, fin });
      blocs = { ensemble: vueEnsemble, jeux: vueJeux, visiteurs: vueVisiteurs }[etat.vue](etat.resume);
    } else if (etat.vue === 'joueurs') {
      etat.joueurs = null;
      blocs = await vueJoueurs();
    } else if (etat.vue === 'historique') {
      blocs = await vueHistorique();
    } else {
      blocs = await vueSante();
    }
    contenu.replaceChildren(...blocs.filter(Boolean), h('p', { class: 'pied' }, 'Calcoolos Analytics · mesure maison, sans cookie ni service extérieur · heures affichées en heure locale'));
  } catch (e) {
    contenu.replaceChildren(h('p', { class: 'erreur-globale' }, `Impossible de charger les statistiques : ${e.message}`));
  }
  document.body.dataset.vue = etat.vue;
  $('#periode').style.visibility = ['joueurs', 'sante'].includes(etat.vue) ? 'hidden' : '';
}
let afficher = recharger;

function initOnglets() {
  const boutons = [...document.querySelectorAll('#onglets button')];
  const choisir = (vue, pousser) => {
    etat.vue = vue;
    for (const b of boutons) {
      if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    if (pousser) history.replaceState(null, '', `#${vue}`);
    recharger();
  };
  for (const b of boutons) b.addEventListener('click', () => choisir(b.dataset.vue, true));
  const initiale = location.hash.slice(1);
  choisir(boutons.some((b) => b.dataset.vue === initiale) ? initiale : 'ensemble', false);
}

window.addEventListener('resize', () => {
  for (const g of [...graphes, ...ficheGraphes]) g.resize();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#fiche').hidden) fermerFiche();
});
$('#fiche-fond').addEventListener('click', fermerFiche);
afficher = recharger;
initPeriode();
initOnglets();
rafraichirDirect();
setInterval(() => document.visibilityState === 'visible' && rafraichirDirect(), 20000);
window.__calcoolosAnalytics = { etat, ouvrirFiche };
