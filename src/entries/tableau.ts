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
import { localHistory, type StoredResult } from '../platform/results';
import { GAME_NAMES, MODE_NAMES, OP_NAMES, TIER_NAMES, formatDuration, summarize, type Summary } from '../platform/stats';
import { AVATAR_INVITE, avatarImg } from '../platform/avatars';
import { h } from '../platform/dom';
import { t } from '../i18n/traduire';
import { locale } from '../i18n/langue';

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

function kpis(s: Summary): HTMLElement {
  const box = (n: string, label: string) => h('div', { class: 'chiffre' }, h('strong', {}, n), label);
  return h('div', { class: 'chiffres' },
    box(String(s.games), s.games > 1 ? 'parties jouées' : 'partie jouée'),
    box(String(s.wins), s.wins > 1 ? 'victoires' : 'victoire'),
    box(`${s.stars} ★`, 'étoiles gagnées'),
    box(formatDuration(s.seconds), 'de jeu'),
  );
}

function daysChart(s: Summary): HTMLElement {
  const el = h('div', { class: 'graphe', role: 'img', 'aria-label': 'Parties jouées et calculs justes par jour' });
  const section = h('section', { class: 'carte' }, h('h2', {}, 'Ces 30 derniers jours'), el);
  if (s.days.length === 0) {
    el.replaceWith(h('p', {}, 'Pas encore de partie ce mois-ci.'));
    return section;
  }
  requestAnimationFrame(() => chart(el, {
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: INK }, top: 0 },
    grid: { left: 40, right: 44, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: s.days.map((d) => dateFmt.format(new Date(`${d.day}T12:00:00Z`))), axisLabel: { color: MUTED } },
    yAxis: [
      { type: 'value', name: t('parties'), minInterval: 1, axisLabel: { color: MUTED }, nameTextStyle: { color: MUTED }, splitLine: { lineStyle: { color: 'rgba(246,236,216,0.1)' } } },
      { type: 'value', name: t('% justes'), min: 0, max: 100, axisLabel: { color: MUTED }, nameTextStyle: { color: MUTED }, splitLine: { show: false } },
    ],
    series: [
      { name: t('Parties'), type: 'bar', data: s.days.map((d) => d.games), itemStyle: { color: '#5fd3bc', borderRadius: [6, 6, 0, 0] } },
      { name: t('Calculs justes (%)'), type: 'line', yAxisIndex: 1, smooth: true, data: s.days.map((d) => Math.round(d.precision * 100)), itemStyle: { color: '#ffc94a' }, lineStyle: { width: 4 }, symbolSize: 9 },
    ],
  }));
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
      h('td', {}, GAME_NAMES[r.jeu] ?? r.jeu), h('td', {}, TIER_NAMES[r.niveau] ?? r.niveau), h('td', {}, MODE_NAMES[r.mode] ?? r.mode),
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
    h('thead', {}, h('tr', {}, h('th', {}, 'Quand'), h('th', {}, 'Jeu'), h('th', {}, 'Résultat'), h('th', { class: 'nombre' }, 'Score'), h('th', { class: 'nombre' }, 'Justes'))),
    h('tbody', {}, ...s.recent.map((r) => h('tr', {},
      h('td', {}, dateTimeFmt.format(new Date(r.date))),
      h('td', {}, `${GAME_NAMES[r.jeu] ?? r.jeu} · ${TIER_NAMES[r.niveau] ?? r.niveau}`),
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

function renderDashboard(title: string, results: StoredResult[], note: string): void {
  charts.splice(0).forEach((c) => c.dispose());
  const s = summarize(results);
  const body = document.querySelector('#tableau-corps')!;
  body.replaceChildren(
    h('h2', { class: 'sr-only' }, title),
    h('p', { class: 'discret' }, note),
    kpis(s),
    h('div', { class: 'grille' }, daysChart(s), opsChart(s)),
    h('div', { style: 'height: 22px' }),
    h('div', { class: 'grille' }, recordsTable(s), badges(s)),
    h('div', { style: 'height: 22px' }),
    recentList(s),
  );
}

async function showProfile(p: Profile): Promise<void> {
  const r = await api.get<{ resultats: StoredResult[] }>(`/profils/${p.id}/resultats`).catch(() => null);
  if (r?.status !== 200) {
    document.querySelector('#tableau-corps')!.replaceChildren(h('p', { class: 'message erreur' }, r?.data.erreur ?? 'Le serveur ne répond pas.'));
    return;
  }
  renderDashboard(p.pseudo, r.data.resultats, `Progrès de ${p.pseudo}, enregistrés sur le serveur (visibles seulement dans votre espace famille).`);
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
