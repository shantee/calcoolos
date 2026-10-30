/**
 * Progrès d'un joueur, calculés à partir de son historique (logique pure, testée).
 *
 * Règles d'honnêteté :
 * - on ne compare que des parties COMPARABLES : même jeu, même niveau, même mode et même variante
 *   (Neon Flight : même série de tables) ;
 * - on compare des MÉDIANES (début contre fin), jamais une partie seule : une partie exceptionnelle,
 *   bonne ou mauvaise, ne fait pas l'analyse ;
 * - un indicateur absent d'une partie (temps de réponse avant le 29/10/2026, par exemple) n'est pas
 *   deviné : la partie est simplement laissée de côté pour cet indicateur ;
 * - pas assez de parties : pas de verdict, on dit combien il en manque.
 */
import type { GameId, StoredResult } from './results';
import { mediane } from './releve';
import { GAME_NAMES } from './stats';

/** Totaux renvoyés par le serveur pour un profil (au-delà de l'historique détaillé). */
export interface Totaux {
  parties: number;
  duree: number;
  actif: number;
  mesurees: number;
  premiere: string;
}

/** Temps de jeu d'une partie : temps actif s'il a été mesuré, sinon la durée de la partie. */
export const tempsJoue = (r: StoredResult): number => r.actif ?? r.duree;

/** Justes et ratés : mesures communes si présentes, sinon les réussites par opération (déjà enregistrées). */
export function reponses(r: StoredResult): { justes: number; fausses: number } | null {
  if (r.mesures) return { justes: r.mesures.justes, fausses: r.mesures.fausses };
  let justes = 0;
  let fausses = 0;
  for (const [ok, ko] of Object.values(r.ops ?? {})) {
    justes += ok;
    fausses += ko;
  }
  return justes + fausses > 0 ? { justes, fausses } : null;
}

export const precisionDe = (r: StoredResult): number | null => {
  const x = reponses(r);
  return x ? x.justes / (x.justes + x.fausses) : null;
};

/** Meilleure série : mesure commune, sinon le détail propre au jeu. */
export const serieDe = (r: StoredResult): number | null => r.mesures?.serie ?? (typeof r.details?.serie === 'number' ? r.details.serie : null);

export interface Bilan {
  parties: number;
  secondes: number;
  dureeMoyenne: number;
  calculs: number;
  justes: number;
  fausses: number;
  precision: number | null;
  /** Temps de réponse typique (médiane des médianes par partie), en ms ; null sans mesure. */
  tempsMedian: number | null;
  /** Temps moyen d'une bonne réponse (pondéré par le nombre de bonnes réponses), en ms. */
  tempsMoyen: number | null;
  serie: number;
  meilleurScore: number;
  /** Parties qui ont des temps de réponse mesurés. */
  chronometrees: number;
}

export function bilan(results: readonly StoredResult[]): Bilan {
  let secondes = 0;
  let justes = 0;
  let fausses = 0;
  let serie = 0;
  let meilleurScore = 0;
  let somme = 0;
  let poids = 0;
  const medianes: number[] = [];
  for (const r of results) {
    secondes += tempsJoue(r);
    const x = reponses(r);
    if (x) {
      justes += x.justes;
      fausses += x.fausses;
    }
    serie = Math.max(serie, serieDe(r) ?? 0);
    meilleurScore = Math.max(meilleurScore, r.score);
    const m = r.mesures;
    if (m?.tempsMedian !== undefined && m.tempsMoyen !== undefined && m.justes > 0) {
      medianes.push(m.tempsMedian);
      somme += m.tempsMoyen * m.justes;
      poids += m.justes;
    }
  }
  const calculs = justes + fausses;
  return {
    parties: results.length,
    secondes,
    dureeMoyenne: results.length ? Math.round(secondes / results.length) : 0,
    calculs,
    justes,
    fausses,
    precision: calculs ? justes / calculs : null,
    tempsMedian: medianes.length ? Math.round(mediane(medianes)) : null,
    tempsMoyen: poids ? Math.round(somme / poids) : null,
    serie,
    meilleurScore,
    chronometrees: medianes.length,
  };
}

// --- Contextes comparables ---------------------------------------------------------------------

export interface Contexte {
  cle: string;
  jeu: GameId;
  niveau: string;
  mode: string;
  variante: string;
  /** Parties de ce contexte, de la plus ancienne à la plus récente. */
  parties: StoredResult[];
}

export const cleContexte = (r: StoredResult): string => `${r.jeu}|${r.niveau}|${r.mode}|${r.variante ?? ''}`;

/** Contextes d'un jeu, le plus joué d'abord (à égalité, le plus récent). */
export function contextes(results: readonly StoredResult[], jeu?: GameId): Contexte[] {
  const map = new Map<string, Contexte>();
  for (const r of results) {
    if (jeu && r.jeu !== jeu) continue;
    const cle = cleContexte(r);
    let c = map.get(cle);
    if (!c) {
      c = { cle, jeu: r.jeu, niveau: r.niveau, mode: r.mode, variante: r.variante ?? '', parties: [] };
      map.set(cle, c);
    }
    c.parties.push(r);
  }
  const list = [...map.values()];
  for (const c of list) c.parties.sort((a, b) => a.date.localeCompare(b.date));
  const last = (c: Contexte) => c.parties[c.parties.length - 1].date;
  return list.sort((a, b) => b.parties.length - a.parties.length || last(b).localeCompare(last(a)));
}

export type Indicateur = 'precision' | 'rapidite' | 'score';

export interface Evolution {
  indicateur: Indicateur;
  /** Médianes du début et de la fin (précision 0..1, rapidité en ms, score en points). */
  avant: number;
  apres: number;
  /** Parties comparées de chaque côté. */
  n: number;
  /** Progrès net (au-delà des petites variations) ; recul net ; sinon stable. */
  sens: 'mieux' | 'moins-bien' | 'stable';
}

/** Parties nécessaires de chaque côté pour oser une comparaison. */
export const MIN_COMPARAISON = 3;

const valeur = (r: StoredResult, i: Indicateur): number | null =>
  i === 'precision' ? precisionDe(r) : i === 'rapidite' ? (r.mesures?.tempsMedian ?? null) : r.score;

/**
 * Début contre fin d'un contexte : médiane des k premières parties contre médiane des k dernières,
 * k = min(5, moitié des parties). Seuils : 5 points de précision, 10 % de rapidité ou de score.
 */
export function evolution(parties: readonly StoredResult[], indicateur: Indicateur): Evolution | null {
  const vals = parties.map((r) => valeur(r, indicateur)).filter((v): v is number => v !== null);
  const k = Math.min(5, Math.floor(vals.length / 2));
  if (k < MIN_COMPARAISON) return null;
  const avant = mediane(vals.slice(0, k));
  const apres = mediane(vals.slice(-k));
  let sens: Evolution['sens'] = 'stable';
  if (indicateur === 'precision') sens = apres - avant >= 0.05 ? 'mieux' : avant - apres >= 0.05 ? 'moins-bien' : 'stable';
  else if (indicateur === 'rapidite') sens = apres <= avant * 0.9 ? 'mieux' : apres >= avant * 1.1 ? 'moins-bien' : 'stable';
  else sens = apres >= avant * 1.1 && apres - avant >= 50 ? 'mieux' : apres <= avant * 0.9 ? 'moins-bien' : 'stable';
  return { indicateur, avant, apres, n: k, sens };
}

/** Parties encore nécessaires pour une première comparaison (0 si c'est possible). */
export function partiesManquantes(parties: readonly StoredResult[], indicateur: Indicateur): number {
  const n = parties.filter((r) => valeur(r, indicateur) !== null).length;
  return Math.max(0, 2 * MIN_COMPARAISON - n);
}

// --- Tables de multiplication ------------------------------------------------------------------

export interface FaitBilan {
  a: number;
  b: number;
  justes: number;
  rates: number;
  /** Temps total et nombre des bonnes réponses chronométrées. */
  ms: number;
  n: number;
}

export const essais = (f: FaitBilan): number => f.justes + f.rates;
export const reussite = (f: FaitBilan): number => (essais(f) ? f.justes / essais(f) : 0);
export const tempsMoyenFait = (f: FaitBilan): number | null => (f.n ? f.ms / f.n : null);

/** Tous les faits de multiplication relevés (toutes parties, tous jeux). */
export function faits(results: readonly StoredResult[]): Map<string, FaitBilan> {
  const out = new Map<string, FaitBilan>();
  for (const r of results) {
    for (const [cle, [ok, ko, ms, n]] of Object.entries(r.mesures?.faits ?? {})) {
      const m = /^(\d+)×(\d+)$/.exec(cle);
      if (!m) continue;
      let f = out.get(cle);
      if (!f) {
        f = { a: Number(m[1]), b: Number(m[2]), justes: 0, rates: 0, ms: 0, n: 0 };
        out.set(cle, f);
      }
      f.justes += ok;
      f.rates += ko;
      f.ms += ms;
      f.n += n;
    }
  }
  return out;
}

export type Maitrise = 'inconnu' | 'a-revoir' | 'en-cours' | 'acquis' | 'maitrise';

/** Seuil de rapidité d'un fait « maîtrisé » : la réponse vient de mémoire, en 3 s au plus. */
export const RAPIDE = 3000;

export function maitrise(f: FaitBilan | undefined): Maitrise {
  if (!f || essais(f) === 0) return 'inconnu';
  const r = reussite(f);
  if (r < 0.6) return 'a-revoir';
  if (r < 0.85 || essais(f) < 2) return 'en-cours';
  const t = tempsMoyenFait(f);
  return essais(f) >= 3 && r >= 0.9 && (t === null || t <= RAPIDE) ? 'maitrise' : 'acquis';
}

export interface LigneTable {
  table: number;
  justes: number;
  rates: number;
  /** Temps moyen d'une bonne réponse (ms), null sans mesure ; n : bonnes réponses chronométrées. */
  temps: number | null;
  n: number;
}

/** Bilan par table (la table de 7 regroupe tous les faits où 7 apparaît ; 7 × 7 une seule fois). */
export function parTable(fs: Map<string, FaitBilan>, tables: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]): LigneTable[] {
  return tables.map((t) => {
    let justes = 0;
    let rates = 0;
    let ms = 0;
    let n = 0;
    for (const f of fs.values()) {
      if (f.a !== t && f.b !== t) continue;
      justes += f.justes;
      rates += f.rates;
      ms += f.ms;
      n += f.n;
    }
    return { table: t, justes, rates, temps: n ? ms / n : null, n };
  });
}

/** Les faits à réviser en priorité : les moins réussis, puis les plus lents (2 essais au moins). */
export function aReviser(fs: Map<string, FaitBilan>, k = 6): FaitBilan[] {
  return [...fs.values()]
    .filter((f) => essais(f) >= 2 && (reussite(f) < 0.85 || (tempsMoyenFait(f) ?? 0) > RAPIDE * 1.5))
    .sort((x, y) => reussite(x) - reussite(y) || (tempsMoyenFait(y) ?? 0) - (tempsMoyenFait(x) ?? 0))
    .slice(0, k);
}

/** Points forts : faits maîtrisés, les plus rapides d'abord. */
export function pointsForts(fs: Map<string, FaitBilan>, k = 6): FaitBilan[] {
  return [...fs.values()]
    .filter((f) => maitrise(f) === 'maitrise' && f.a >= 2)
    .sort((x, y) => (tempsMoyenFait(x) ?? RAPIDE) - (tempsMoyenFait(y) ?? RAPIDE) || essais(y) - essais(x))
    .slice(0, k);
}

export interface ProgresTable {
  table: number;
  avant: { reussite: number; temps: number | null; essais: number };
  apres: { reussite: number; temps: number | null; essais: number };
  plusRapide: boolean;
  plusJuste: boolean;
}

/** Essais nécessaires de chaque côté pour juger une table. */
export const MIN_ESSAIS_TABLE = 8;

/**
 * Progrès par table : les parties où la table a été travaillée, dans l'ordre. Sans `depuis`, premiers
 * essais contre derniers essais (coupe au milieu, parties entières) ; avec `depuis`, les parties d'avant
 * cette date contre celles d'après (« cette semaine »). Au moins 8 essais de chaque côté.
 * Plus rapide : −15 % sur le temps moyen d'une bonne réponse ; plus juste : +8 points de réussite.
 */
export function progresTables(results: readonly StoredResult[], depuis?: Date): ProgresTable[] {
  const chrono = [...results].filter((r) => r.mesures?.faits).sort((a, b) => a.date.localeCompare(b.date));
  const out: ProgresTable[] = [];
  for (let t = 2; t <= 12; t++) {
    const parPartie = chrono
      .map((r) => {
        const [l] = parTable(faits([r]), [t]);
        return { date: r.date, justes: l.justes, rates: l.rates, ms: (l.temps ?? 0) * l.n, n: l.n };
      })
      .filter((x) => x.justes + x.rates > 0);
    const total = parPartie.reduce((a, x) => a + x.justes + x.rates, 0);
    let i = 0;
    if (depuis) {
      const d = depuis.toISOString();
      while (i < parPartie.length && parPartie[i].date < d) i++;
    } else {
      let cumul = 0;
      while (i < parPartie.length && cumul + parPartie[i].justes + parPartie[i].rates <= total / 2) cumul += parPartie[i].justes + parPartie[i++].rates;
    }
    const somme = (xs: typeof parPartie) => {
      const j = xs.reduce((a, x) => a + x.justes, 0);
      const e = xs.reduce((a, x) => a + x.justes + x.rates, 0);
      const ms = xs.reduce((a, x) => a + x.ms, 0);
      const n = xs.reduce((a, x) => a + x.n, 0);
      return { reussite: e ? j / e : 0, temps: n >= 3 ? ms / n : null, essais: e };
    };
    const avant = somme(parPartie.slice(0, i));
    const apres = somme(parPartie.slice(i));
    if (avant.essais < MIN_ESSAIS_TABLE || apres.essais < MIN_ESSAIS_TABLE) continue;
    out.push({
      table: t,
      avant,
      apres,
      plusRapide: avant.temps !== null && apres.temps !== null && apres.temps <= avant.temps * 0.85,
      plusJuste: apres.reussite - avant.reussite >= 0.08,
    });
  }
  return out;
}

// --- Fréquentation -----------------------------------------------------------------------------

/** Minutes de jeu par jour et par jeu sur les `jours` derniers jours (jour local du navigateur). */
export function frequentation(results: readonly StoredResult[], now = new Date(), jours = 30): { jours: string[]; parJeu: Partial<Record<GameId, number[]>> } {
  const cle = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const liste: string[] = [];
  for (let i = jours - 1; i >= 0; i--) liste.push(cle(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  const index = new Map(liste.map((j, i) => [j, i]));
  const parJeu: Partial<Record<GameId, number[]>> = {};
  for (const r of results) {
    const i = index.get(cle(new Date(r.date)));
    if (i === undefined) continue;
    const l = (parJeu[r.jeu] ??= liste.map(() => 0));
    l[i] += tempsJoue(r) / 60;
  }
  for (const l of Object.values(parJeu)) l.forEach((v, i) => (l[i] = Math.round(v * 10) / 10));
  return { jours: liste, parJeu };
}

/** Parties et temps de jeu des 7 derniers jours. */
export function semaine(results: readonly StoredResult[], now = new Date()): { parties: number; secondes: number; jours: number } {
  const depuis = now.getTime() - 7 * 86400000;
  const r7 = results.filter((r) => new Date(r.date).getTime() >= depuis);
  return { parties: r7.length, secondes: r7.reduce((a, r) => a + tempsJoue(r), 0), jours: new Set(r7.map((r) => r.date.slice(0, 10))).size };
}

// --- Synthèse ----------------------------------------------------------------------------------

export interface Message {
  ton: 'bravo' | 'info' | 'conseil';
  texte: string;
}

const secondes = (ms: number) => `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`;
const pourcent = (x: number) => `${Math.round(x * 100)} %`;

/**
 * Quelques phrases motivantes, chacune justifiée par des chiffres réels (jamais de progrès inventé).
 * Ordre : progrès de la semaine sur une table, progrès dans un jeu, régularité, faits à revoir, ce qui manque.
 */
export function synthese(results: readonly StoredResult[], now = new Date()): Message[] {
  const out: Message[] = [];
  if (results.length === 0) return out;

  // 1. Tables : cette semaine contre avant, sinon depuis les débuts.
  const semaineDerniere = new Date(now.getTime() - 7 * 86400000);
  const tablesSemaine = progresTables(results, semaineDerniere);
  const tables = tablesSemaine.length ? tablesSemaine : progresTables(results);
  const quand = tablesSemaine.length ? 'Cette semaine, tu' : 'Depuis tes premières parties, tu';
  const rapides = tables.filter((p) => p.plusRapide).sort((a, b) => b.avant.temps! / b.apres.temps! - a.avant.temps! / a.apres.temps!);
  const justes = tables.filter((p) => p.plusJuste && !p.plusRapide).sort((a, b) => b.apres.reussite - b.avant.reussite - (a.apres.reussite - a.avant.reussite));
  if (rapides[0]) {
    const p = rapides[0];
    out.push({ ton: 'bravo', texte: `${quand} as amélioré ta rapidité sur la table de ${p.table} : ${secondes(p.apres.temps!)} par réponse au lieu de ${secondes(p.avant.temps!)} !` });
  }
  if (justes[0]) {
    const p = justes[0];
    out.push({ ton: 'bravo', texte: `${quand} réussis mieux la table de ${p.table} : ${pourcent(p.apres.reussite)} de bonnes réponses au lieu de ${pourcent(p.avant.reussite)}.` });
  }

  // 2. Jeux : médianes du début contre la fin, dans le contexte le plus joué de chaque jeu.
  const vus = new Set<string>();
  for (const c of contextes(results)) {
    if (vus.has(c.jeu)) continue;
    vus.add(c.jeu);
    const prec = evolution(c.parties, 'precision');
    const vite = evolution(c.parties, 'rapidite');
    const score = evolution(c.parties, 'score');
    const nom = GAME_NAMES[c.jeu];
    if (vite?.sens === 'mieux') out.push({ ton: 'bravo', texte: `Tu progresses à ${nom} ! Tu réponds en ${secondes(vite.apres)} sur tes ${vite.n} dernières parties, contre ${secondes(vite.avant)} au début.` });
    else if (prec?.sens === 'mieux') out.push({ ton: 'bravo', texte: `Tu progresses à ${nom} ! ${pourcent(prec.apres)} de calculs justes sur tes ${prec.n} dernières parties, contre ${pourcent(prec.avant)} au début.` });
    else if (score?.sens === 'mieux') out.push({ ton: 'bravo', texte: `Tu progresses à ${nom} ! Ton score typique est passé de ${Math.round(score.avant)} à ${Math.round(score.apres)} points.` });
    else if (prec && vite && prec.sens === 'stable' && vite.sens === 'stable' && prec.apres >= 0.9) out.push({ ton: 'info', texte: `À ${nom}, tes résultats sont solides : ${pourcent(prec.apres)} de calculs justes. Et si tu essayais le niveau au-dessus ?` });
  }

  // 3. Régularité de la semaine.
  const s = semaine(results, now);
  if (s.jours >= 3) out.push({ ton: 'bravo', texte: `Bravo pour ta régularité : tu as joué ${s.jours} jours cette semaine.` });

  // 4. Faits à revoir.
  const revoir = aReviser(faits(results), 3);
  if (revoir.length) out.push({ ton: 'conseil', texte: `À réviser : ${revoir.map((f) => `${f.a} × ${f.b}`).join(', ')}. Ce sont tes multiplications les plus difficiles en ce moment.` });

  // 5. Rien à comparer encore.
  if (!out.some((m) => m.ton === 'bravo')) {
    const [c] = contextes(results);
    const manque = partiesManquantes(c.parties, 'precision');
    if (manque > 0) out.push({ ton: 'info', texte: `Encore ${manque} partie${manque > 1 ? 's' : ''} de ${GAME_NAMES[c.jeu]} au même niveau et on pourra voir tes progrès.` });
  }
  // Trois bonnes nouvelles au plus : au-delà, on ne les lit plus.
  let bravos = 0;
  return out.filter((m) => m.ton !== 'bravo' || ++bravos <= 3);
}

/**
 * Deux à trois conseils courts pour l'accueil, seulement à partir de chiffres réels :
 * une table en progrès, un fait qui résiste, sinon ce qui manque encore pour juger.
 */
export function conseilsAccueil(results: readonly StoredResult[], now = new Date()): Message[] {
  const out: Message[] = [];
  const tables = progresTables(results).filter((p) => p.plusRapide || p.plusJuste);
  const meilleure = [...tables].sort((a, b) => b.apres.reussite - b.avant.reussite - (a.apres.reussite - a.avant.reussite))[0];
  if (meilleure) out.push({ ton: 'bravo', texte: `Tu progresses sur la table de ${meilleure.table} !` });
  const [fait] = aReviser(faits(results), 1);
  if (fait) out.push({ ton: 'conseil', texte: `Attention, ${fait.a} × ${fait.b} te pose encore quelques difficultés (réussi ${fait.justes} fois sur ${essais(fait)}).` });
  for (const m of synthese(results, now)) {
    if (out.length < 3 && !m.texte.startsWith('À réviser') && !m.texte.includes('table de')) out.push(m);
  }
  return out;
}
