import '../i18n/page';
import '@fontsource-variable/bricolage-grotesque';
import '../styles/accueil.css';
import '../styles/plateforme.css';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { topbar } from '../platform/topbar';
import { api, type Profile } from '../platform/api';
import { activePlayer } from '../platform/player';
import { localHistory, type GameId, type StoredResult } from '../platform/results';
import { GAME_NAMES, GAME_PAGES, OP_NAMES, TIER_NAMES, VARIANT_NAMES, formatDuration, modeName, summarize, type Summary } from '../platform/stats';
import {
  aReviser, bilan, contextes, essais, evolution, faits, frequentation, maitrise, parTable, partiesManquantes, pointsForts, precisionDe,
  serieDe, synthese, tempsMoyenFait, type Bilan, type Contexte, type FaitBilan, type Indicateur, type Maitrise, type Totaux,
} from '../platform/progres';
import { AVATAR_INVITE, avatarImg } from '../platform/avatars';
import { h } from '../platform/dom';
import { t } from '../i18n/traduire';
import { locale } from '../i18n/langue';
import { demarrerSuivi } from '../platform/suivi';

demarrerSuivi('tableau');

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, AriaComponent, CanvasRenderer]);

const root = document.querySelector<HTMLElement>('#contenu')!;
const INK = '#f6ecd8';
const MUTED = '#9fc9c2';
const charts: echarts.ECharts[] = [];
window.addEventListener('resize', () => charts.forEach((c) => c.resize()));
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const dateFmt = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' });
const dateTimeFmt = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function chart(el: HTMLElement, option: echarts.EChartsCoreOption): void {
  const c = echarts.init(el, undefined, { renderer: 'canvas' });
  c.setOption({ animation: !reduced, textStyle: { fontFamily: '"Bricolage Grotesque Variable", system-ui, sans-serif', color: INK }, aria: { enabled: true }, ...option });
  charts.push(c);
}

const COULEURS: Record<GameId, string> = { cubes: '#5fd3bc', meteores: '#8fb8ff', dragon: '#f0745e', fusee: '#ffc94a', neon: '#ff7ae0' };
const JEUX = Object.keys(GAME_NAMES) as GameId[];
const nombre = new Intl.NumberFormat(locale());
const sec = (ms: number) => `${(ms / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} s`;
const pct = (x: number) => `${Math.round(x * 100)} %`;
const axe = { axisLabel: { color: MUTED }, nameTextStyle: { color: MUTED }, splitLine: { lineStyle: { color: 'rgba(246,236,216,0.1)' } } };

/** Nom d'un contexte de jeu comparable : « Explorateur · Arcade · Tables 2 à 5 ». */
const nomContexte = (c: { jeu: GameId; niveau: string; mode: string; variante: string }) =>
  [TIER_NAMES[c.niveau] ?? c.niveau, modeName(c.jeu, c.mode), VARIANT_NAMES[c.variante]].filter(Boolean).join(' · ');

function chiffres(b: Bilan, parties = b.parties, secondes = b.secondes): HTMLElement {
  const box = (n: string, label: string, aide?: string) => h('div', { class: 'chiffre', ...(aide ? { title: aide } : {}) }, h('strong', {}, n), label);
  return h('div', { class: 'chiffres' },
    box(nombre.format(parties), parties > 1 ? 'parties jouées' : 'partie jouée'),
    box(formatDuration(secondes), 'de jeu', 'Temps de jeu actif : les pauses et les moments où l’écran était caché ne comptent pas.'),
    box(nombre.format(b.justes), b.justes > 1 ? 'calculs justes' : 'calcul juste'),
    box(b.precision === null ? '–' : pct(b.precision), 'de réussite'),
    box(b.tempsMedian === null ? '–' : sec(b.tempsMedian), 'par réponse', 'Temps typique d’une bonne réponse (médiane).'),
    box(b.serie ? String(b.serie) : '–', 'meilleure série'),
  );
}

function syntheseCarte(results: StoredResult[]): HTMLElement {
  const messages = synthese(results);
  const icone = { bravo: '🌟', info: '💡', conseil: '🎯' } as const;
  return h('section', { class: 'carte synthese' }, h('h2', {}, 'En ce moment'),
    messages.length
      ? h('ul', {}, ...messages.map((m) => h('li', { class: m.ton }, h('span', { 'aria-hidden': 'true' }, icone[m.ton]), m.texte)))
      : h('p', {}, 'Joue quelques parties : ici apparaîtront tes progrès, expliqués avec tes vrais résultats.'));
}

/** Minutes de jeu par jour et par jeu (barres empilées), sur 30 jours. */
function frequenceChart(results: StoredResult[]): HTMLElement {
  const f = frequentation(results);
  const el = h('div', { class: 'graphe', role: 'img', 'aria-label': 'Minutes de jeu par jour, ces 30 derniers jours' });
  const section = h('section', { class: 'carte' }, h('h2', {}, 'Ces 30 derniers jours'), el);
  const jeux = JEUX.filter((j) => f.parJeu[j]);
  if (jeux.length === 0) {
    el.replaceWith(h('p', {}, 'Pas encore de partie ce mois-ci.'));
    return section;
  }
  requestAnimationFrame(() => chart(el, {
    tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => `${v} min` },
    legend: { textStyle: { color: INK }, top: 0, type: 'scroll' },
    grid: { left: 40, right: 16, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: f.jours.map((d) => dateFmt.format(new Date(`${d}T12:00:00`))), axisLabel: { color: MUTED } },
    yAxis: { type: 'value', name: 'min', ...axe },
    series: jeux.map((j) => ({ name: t(GAME_NAMES[j]), type: 'bar', stack: 'temps', data: f.parJeu[j], itemStyle: { color: COULEURS[j] } })),
  }));
  return section;
}

/** Évolution d'un contexte comparable : réussite et rapidité, puis score, partie après partie. */
function evolutionCartes(c: Contexte): HTMLElement[] {
  const ps = c.parties.slice(-30);
  const x = ps.map((r) => dateFmt.format(new Date(r.date)));
  const verdict = (i: Indicateur, nom: string): HTMLElement => {
    const e = evolution(c.parties, i);
    if (!e) {
      const n = partiesManquantes(c.parties, i);
      return h('li', {}, n > 0 ? `${nom} : encore ${n} partie${n > 1 ? 's' : ''} pour comparer.` : `${nom} : pas mesuré dans ces parties.`);
    }
    const f = i === 'precision' ? pct : i === 'rapidite' ? sec : (v: number) => `${nombre.format(Math.round(v))} pts`;
    const mot = e.sens === 'mieux' ? (i === 'rapidite' ? 'plus rapide' : 'en progrès') : e.sens === 'moins-bien' ? 'un peu moins bien' : 'stable';
    return h('li', { class: e.sens }, `${nom} : ${mot} — ${f(e.apres)} sur tes ${e.n} dernières parties, ${f(e.avant)} sur tes ${e.n} premières.`);
  };
  const el1 = h('div', { class: 'graphe', role: 'img', 'aria-label': 'Réussite et temps de réponse, partie après partie' });
  const el2 = h('div', { class: 'graphe', role: 'img', 'aria-label': 'Score et meilleure série, partie après partie' });
  const tempsOk = ps.some((r) => r.mesures?.tempsMedian !== undefined);
  requestAnimationFrame(() => {
    chart(el1, {
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { color: INK }, top: 0 },
      grid: { left: 44, right: 50, top: 62, bottom: 30 },
      xAxis: { type: 'category', data: x, axisLabel: { color: MUTED } },
      yAxis: [
        { type: 'value', name: t('% justes'), min: 0, max: 100, ...axe },
        { type: 'value', name: t('s par réponse'), min: 0, ...axe, splitLine: { show: false } },
      ],
      series: [
        { name: t('Calculs justes (%)'), type: 'line', smooth: true, data: ps.map((r) => { const p = precisionDe(r); return p === null ? null : Math.round(p * 100); }), itemStyle: { color: '#7fb069' }, lineStyle: { width: 4 }, symbolSize: 8 },
        ...(tempsOk ? [{ name: t('Temps de réponse (s)'), type: 'line', yAxisIndex: 1, smooth: true, connectNulls: true, data: ps.map((r) => (r.mesures?.tempsMedian === undefined ? null : Math.round(r.mesures.tempsMedian / 100) / 10)), itemStyle: { color: '#8fb8ff' }, lineStyle: { width: 3, type: 'dashed' }, symbolSize: 7 }] : []),
      ],
    });
    chart(el2, {
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { color: INK }, top: 0 },
      grid: { left: 56, right: 40, top: 62, bottom: 30 },
      xAxis: { type: 'category', data: x, axisLabel: { color: MUTED } },
      yAxis: [{ type: 'value', name: t('score'), ...axe, axisLabel: { color: MUTED, formatter: (v: number) => nombre.format(v) } }, { type: 'value', name: t('série'), minInterval: 1, ...axe, splitLine: { show: false } }],
      series: [
        { name: t('Score'), type: 'bar', data: ps.map((r) => r.score), itemStyle: { color: COULEURS[c.jeu], borderRadius: [6, 6, 0, 0] } },
        { name: t('Meilleure série'), type: 'line', yAxisIndex: 1, data: ps.map((r) => serieDe(r)), itemStyle: { color: '#ffc94a' }, symbolSize: 7 },
      ],
    });
  });
  return [
    h('section', { class: 'carte' }, h('h2', {}, 'Justesse et rapidité'), el1,
      tempsOk ? h('p', { class: 'discret' }, 'Pointillés : temps typique d’une bonne réponse. Plus la ligne descend, plus tu es rapide.') : '',
      h('ul', { class: 'verdicts' }, verdict('precision', 'Réussite'), verdict('rapidite', 'Rapidité'))),
    h('section', { class: 'carte' }, h('h2', {}, 'Score et séries'), el2,
      h('ul', { class: 'verdicts' }, verdict('score', 'Score'))),
  ];
}

const MAITRISE: Record<Maitrise, string> = { maitrise: 'maîtrisé', acquis: 'acquis', 'en-cours': 'en cours', 'a-revoir': 'à revoir', inconnu: 'pas encore vu' };

/** Grille des tables 2 à 12 : une case par multiplication, couleur selon la maîtrise. */
function tablesCarte(results: StoredResult[]): HTMLElement {
  const fs = faits(results);
  const section = h('section', { class: 'carte tables-carte' }, h('h2', {}, 'Mes tables de multiplication'));
  if (fs.size === 0) {
    section.append(h('p', {}, 'La grille se remplit quand tu fais des multiplications (Neon Flight, et les niveaux qui en proposent dans les autres jeux).'));
    return section;
  }
  const N = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const cell = (a: number, b: number) => {
    const f = fs.get(a <= b ? `${a}×${b}` : `${b}×${a}`);
    const m = maitrise(f);
    const tmp = f && tempsMoyenFait(f);
    const info = f ? `${a} × ${b} = ${a * b} : ${MAITRISE[m]}, ${f.justes} juste${f.justes > 1 ? 's' : ''} sur ${essais(f)}${tmp ? `, ${sec(tmp)}` : ''}` : `${a} × ${b} : ${MAITRISE[m]}`;
    return h('td', { class: `m-${m}`, title: info, 'aria-label': info }, f ? String(a * b) : '');
  };
  const table = h('table', { class: 'grille-tables' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, '×'), ...N.map((n) => h('th', { scope: 'col' }, String(n))))),
    h('tbody', {}, ...N.map((a) => h('tr', {}, h('th', { scope: 'row' }, String(a)), ...N.map((b) => cell(a, b))))),
  );
  const legende = h('ul', { class: 'legende-tables' }, ...(['maitrise', 'acquis', 'en-cours', 'a-revoir', 'inconnu'] as Maitrise[]).map((m) => h('li', {}, h('span', { class: `m-${m}`, 'aria-hidden': 'true' }), MAITRISE[m])));
  const lignes = parTable(fs).filter((l) => l.justes + l.rates > 0);
  const parTables = h('ul', { class: 'par-table' }, ...lignes.map((l) => {
    const r = l.justes / (l.justes + l.rates);
    return h('li', {}, h('b', {}, `Table de ${l.table}`), h('span', { class: 'jauge', style: `--r: ${Math.round(r * 100)}%`, 'aria-hidden': 'true' }), `${pct(r)}${l.temps ? ` · ${sec(l.temps)}` : ''}`);
  }));
  const forts = pointsForts(fs, 5);
  const revoir = aReviser(fs, 5);
  const liste = (titre: string, xs: FaitBilan[], vide: string) => h('div', {}, h('h3', {}, titre),
    xs.length ? h('p', { class: 'faits' }, ...xs.map((f) => h('span', {}, `${f.a} × ${f.b} = ${f.a * f.b}`))) : h('p', { class: 'discret' }, vide));
  section.append(
    h('p', { class: 'discret' }, 'Une case par multiplication (7 × 8 et 8 × 7 sont la même). Une multiplication est maîtrisée quand tu la réussis au moins 9 fois sur 10 (sur 3 essais ou plus), en 3 secondes ou moins.'),
    h('div', { class: 'defile' }, table), legende,
    h('div', { class: 'grille forces' }, liste('Points forts', forts, 'Pas encore de multiplication maîtrisée : ça viendra !'), liste('À réviser', revoir, 'Rien à réviser en particulier.')),
    h('h3', {}, 'Par table'), parTables,
  );
  return section;
}

function opsChart(s: Summary): HTMLElement {
  const el = h('div', { class: 'graphe', role: 'img', 'aria-label': 'Réussite par type d’opération' });
  const section = h('section', { class: 'carte' }, h('h2', {}, 'Opérations entraînées'), el);
  if (s.ops.length === 0) {
    el.replaceWith(h('p', {}, 'Les opérations apparaîtront après la première partie.'));
    return section;
  }
  const list = h('ul', { class: 'sr-only' }, ...s.ops.map((o) => h('li', {}, `${OP_NAMES[o.op]} : ${o.ok} réussies sur ${o.ok + o.ko}`)));
  section.append(list);
  requestAnimationFrame(() => chart(el, {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: unknown) => `${v} %` },
    grid: { left: 130, right: 56, top: 10, bottom: 30 },
    xAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: MUTED, formatter: '{value} %' }, splitLine: { lineStyle: { color: 'rgba(246,236,216,0.1)' } } },
    yAxis: { type: 'category', data: s.ops.map((o) => `${t(OP_NAMES[o.op])} (${o.ok + o.ko})`), axisLabel: { color: INK, fontWeight: 700 } },
    series: [{
      type: 'bar',
      data: s.ops.map((o) => ({ value: Math.round(o.rate * 100), itemStyle: { color: o.rate >= 0.85 ? '#7fb069' : o.rate >= 0.6 ? '#ffc94a' : '#f0745e', borderRadius: [0, 8, 8, 0] } })),
      label: { show: true, position: 'right', color: INK, formatter: '{c} %' },
      barWidth: 26,
    }],
  }));
  return section;
}

function recordsTable(s: Summary): HTMLElement {
  const section = h('section', { class: 'carte' }, h('h2', {}, 'Records'));
  if (s.records.length === 0) {
    section.append(h('p', {}, 'Aucun record pour l’instant : à toi de jouer !'));
    return section;
  }
  const table = h('table', { class: 'tableau' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Jeu'), h('th', {}, 'Niveau'), h('th', {}, 'Mode'), h('th', { class: 'nombre' }, 'Score'), h('th', { class: 'nombre' }, 'Étoiles'))),
    h('tbody', {}, ...s.records.map((r) => h('tr', {},
      h('td', {}, GAME_NAMES[r.jeu] ?? r.jeu), h('td', {}, TIER_NAMES[r.niveau] ?? r.niveau), h('td', {}, [modeName(r.jeu, r.mode), VARIANT_NAMES[r.variante]].filter(Boolean).join(' · ')),
      h('td', { class: 'nombre' }, String(r.score)), h('td', { class: 'nombre' }, '★'.repeat(r.etoiles) + '☆'.repeat(3 - r.etoiles)),
    ))),
  );
  section.append(h('div', { class: 'defile' }, table));
  return section;
}

function recentList(s: Summary): HTMLElement {
  const section = h('section', { class: 'carte' }, h('h2', {}, 'Dernières parties'));
  if (s.recent.length === 0) return section;
  const table = h('table', { class: 'tableau' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Quand'), h('th', {}, 'Jeu'), h('th', { class: 'nombre' }, 'Durée'), h('th', {}, 'Résultat'), h('th', { class: 'nombre' }, 'Score'), h('th', { class: 'nombre' }, 'Justes'))),
    h('tbody', {}, ...s.recent.map((r) => h('tr', {},
      h('td', {}, dateTimeFmt.format(new Date(r.date))),
      h('td', {}, `${GAME_NAMES[r.jeu] ?? r.jeu} · ${TIER_NAMES[r.niveau] ?? r.niveau}`),
      h('td', { class: 'nombre' }, formatDuration(r.actif ?? r.duree)),
      h('td', {}, r.gagne ? `Gagné ${'★'.repeat(r.etoiles)}` : 'Perdu'),
      h('td', { class: 'nombre' }, String(r.score) + (r.verifie === false && 'verifie' in r ? ' *' : '')),
      h('td', { class: 'nombre' }, `${Math.round(r.precision * 100)} %`),
    ))),
  );
  section.append(h('div', { class: 'defile' }, table));
  if (s.recent.some((r) => r.verifie === false)) section.append(h('p', { class: 'discret' }, '* Score inhabituel : gardé dans l’historique, mais pas compté dans les classements.'));
  return section;
}

function badges(s: Summary): HTMLElement {
  const n = s.badges.filter((b) => b.earned).length;
  return h('section', { class: 'carte' }, h('h2', {}, `Succès (${n} sur ${s.badges.length})`),
    h('ul', { class: 'badges' }, ...s.badges.map((b) => h('li', { class: b.earned ? 'gagne' : '' }, h('b', {}, b.earned ? `★ ${b.name}` : b.name), h('small', {}, b.hint)))));
}

let vue: GameId | 'tous' = 'tous';

function renderDashboard(title: string, results: StoredResult[], note: string, totaux?: Partial<Record<GameId, Totaux>>): void {
  const body = document.querySelector('#tableau-corps')!;
  const tot = Object.values(totaux ?? {});
  // Le serveur détaille les 500 dernières parties ; les totaux comptent toutes les autres.
  const tronque = tot.reduce((a, x) => a + x.parties, 0) > results.length;
  const parJeu = (j: GameId) => results.filter((r) => r.jeu === j);
  const choix = h('div', { class: 'choix-jeu', role: 'group', 'aria-label': 'Choisir un jeu' });
  const vueEl = h('div', { class: 'vue-jeu' });
  const montrer = (v: GameId | 'tous') => {
    vue = v;
    charts.splice(0).forEach((c) => c.dispose());
    for (const b of choix.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.jeu === v));
    vueEl.replaceChildren(...(v === 'tous' ? vueTous(results) : vueJeu(v, parJeu(v), totaux?.[v])));
  };
  for (const v of ['tous', ...JEUX] as const) {
    const n = v === 'tous' ? results.length : (totaux?.[v]?.parties ?? parJeu(v).length);
    const b = h('button', { type: 'button', 'data-jeu': v, ...(v === 'tous' ? {} : { style: `--jeu: ${COULEURS[v]}` }) },
      v === 'tous' ? 'Tous les jeux' : GAME_NAMES[v], h('small', {}, n ? `${nombre.format(n)} partie${n > 1 ? 's' : ''}` : 'pas encore joué'));
    b.addEventListener('click', () => montrer(v));
    choix.append(b);
  }
  const b = bilan(results);
  body.replaceChildren(
    h('h2', { class: 'sr-only' }, title),
    h('p', { class: 'discret' }, note),
    syntheseCarte(results),
    h('div', { style: 'height: 22px' }),
    chiffres(b, tronque ? tot.reduce((a, x) => a + x.parties, 0) : b.parties, tronque ? tot.reduce((a, x) => a + x.duree, 0) : b.secondes),
    tronque ? h('p', { class: 'discret' }, 'Le détail porte sur les 500 dernières parties.') : '',
    choix,
    vueEl,
  );
  montrer(vue === 'tous' || results.some((r) => r.jeu === vue) ? vue : 'tous');
}

function vueTous(results: StoredResult[]): HTMLElement[] {
  const s = summarize(results);
  const espace = () => h('div', { style: 'height: 22px' });
  return [
    h('div', { class: 'grille' }, frequenceChart(results), opsChart(s)),
    espace(), tablesCarte(results),
    espace(), h('div', { class: 'grille' }, recordsTable(s), badges(s)),
    espace(), recentList(s),
  ];
}

function vueJeu(jeu: GameId, results: StoredResult[], tot?: Totaux): HTMLElement[] {
  if (results.length === 0) {
    return [h('section', { class: 'carte' }, h('h2', {}, GAME_NAMES[jeu]), h('p', {}, 'Pas encore de partie à ce jeu.'), h('a', { class: 'bouton', href: `jeu/${GAME_PAGES[jeu]}` }, `Jouer à ${GAME_NAMES[jeu]}`))];
  }
  const b = bilan(results);
  const cs = contextes(results);
  const zone = h('div', { class: 'grille' });
  const select = h('select', { id: 'contexte', 'aria-label': 'Comparer les parties jouées' }, ...cs.map((c, i) => h('option', { value: String(i) }, `${nomContexte(c)} (${c.parties.length})`)));
  const montrer = (i: number) => {
    charts.splice(0).forEach((c) => c.dispose());
    zone.replaceChildren(...evolutionCartes(cs[i]));
  };
  select.addEventListener('change', () => montrer(Number(select.value)));
  montrer(0);
  const s = summarize(results);
  const espace = () => h('div', { style: 'height: 22px' });
  const premiere = tot?.premiere ?? [...results].sort((x, y) => x.date.localeCompare(y.date))[0].date;
  return [
    h('h2', { class: 'titre-vue', style: `--jeu: ${COULEURS[jeu]}` }, GAME_NAMES[jeu]),
    h('p', { class: 'discret' }, `Première partie le ${dateFmt.format(new Date(premiere))}. Meilleur score : ${nombre.format(b.meilleurScore)} · ${formatDuration(b.dureeMoyenne)} par partie en moyenne${b.tempsMoyen ? ` · ${sec(b.tempsMoyen)} en moyenne par bonne réponse` : ''}.`),
    chiffres(b, tot?.parties ?? b.parties, tot && tot.parties > results.length ? tot.duree : b.secondes),
    h('p', { class: 'comparer' }, h('label', { for: 'contexte' }, 'Comparer les parties jouées en '), select),
    h('p', { class: 'discret' }, 'On ne compare que des parties du même niveau et du même mode : début contre fin, avec la médiane de plusieurs parties (une partie ratée ou exceptionnelle ne change pas le verdict).'),
    zone,
    espace(), tablesCarte(results),
    espace(), h('div', { class: 'grille' }, recordsTable(s), recentList(s)),
  ];
}

async function showProfile(p: Profile): Promise<void> {
  const r = await api.get<{ resultats: StoredResult[]; totaux?: Partial<Record<GameId, Totaux>> }>(`/profils/${p.id}/resultats`).catch(() => null);
  if (r?.status !== 200) {
    document.querySelector('#tableau-corps')!.replaceChildren(h('p', { class: 'message erreur' }, r?.data.erreur ?? 'Le serveur ne répond pas.'));
    return;
  }
  renderDashboard(p.pseudo, r.data.resultats, `Progrès de ${p.pseudo}, enregistrés sur le serveur (visibles seulement dans votre espace famille).`, r.data.totaux);
}

function showGuest(): void {
  renderDashboard('Invité', localHistory(), 'Parties jouées en invité sur cet appareil (rien n’est envoyé sur Internet).');
}

void (async () => {
  const state = await topbar('progres');
  const profiles = state?.connecte ? state.profils ?? [] : [];
  const wanted = Number(new URLSearchParams(window.location.search).get('profil')) || activePlayer()?.id;
  const chooser = h('div', { class: 'qui-joue', role: 'group', 'aria-label': 'Choisir un joueur' });
  root.replaceChildren(h('h1', {}, 'Mes progrès'), chooser, h('div', { id: 'tableau-corps' }));
  const pick = (id: number | null) => {
    for (const b of chooser.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.id === String(id ?? 'invite')));
    const p = profiles.find((x) => x.id === id);
    if (p) void showProfile(p);
    else showGuest();
  };
  for (const p of profiles) {
    const b = h('button', { type: 'button', 'data-id': String(p.id) }, avatarImg(p.avatar, 56, ''), p.pseudo);
    b.addEventListener('click', () => pick(p.id));
    chooser.append(b);
  }
  const g = h('button', { type: 'button', 'data-id': 'invite' }, avatarImg(AVATAR_INVITE, 56, ''), 'Cet appareil (invité)');
  g.addEventListener('click', () => pick(null));
  chooser.append(g);
  pick(profiles.some((p) => p.id === wanted) ? wanted ?? null : profiles[0]?.id ?? null);
})();
