/**
 * Fin de partie : le résultat est envoyé au serveur pour le profil actif. Sans réseau (ou session terminée), il
 * attend dans une file et repart au prochain passage, une fois reconnecté.
 *
 * Jouer est libre ; sans compte, la partie est anonyme : rien n'est enregistré ni mémorisé (03/11/2026). L'ancien historique invité (`calcoolos.historique`) reste dans le navigateur, sans être ni lu ni
 * effacé.
 */
import { api, accountState } from './api';
import { activePlayer } from './player';
import { nouvelId, partieTerminee } from './suivi';
import type { Mesures } from './releve';

export type GameId = 'cubes' | 'meteores' | 'dragon' | 'fusee' | 'neon' | 'multirail';

/**
 * Résultat d'une partie, commun à tous les jeux. Les champs facultatifs (variante, mesures) sont arrivés
 * avec le chantier 3 (29/10/2026) : les parties plus anciennes ne les ont pas, et on ne les invente pas.
 */
export interface GameResult {
  jeu: GameId;
  niveau: string;
  mode: string;
  score: number;
  gagne: boolean;
  etoiles: number;
  /** Durée en secondes. */
  duree: number;
  /** Part de réponses justes, de 0 à 1. */
  precision: number;
  /** Par opération : [réussis, ratés]. */
  ops: Record<string, [number, number]>;
  details: Record<string, number>;
  /** Ce qui sépare les classements d'un même jeu, niveau et mode (Neon Flight : la série de tables ;
   *  MULTIRAIL : Voyage Zen ou série de tables). */
  variante?: string;
  /** Indicateurs mathématiques communs (src/platform/releve.ts). */
  mesures?: Mesures;
}

export interface StoredResult extends GameResult {
  /** Fin de la partie (ISO). */
  date: string;
  verifie?: boolean;
  /** Identifiant unique de la partie (le serveur ne l'enregistre qu'une fois). */
  cle?: string;
  /** Début de la partie (ISO). */
  debut?: string;
  /** Temps de jeu actif en secondes : pauses, onglet caché et inactivité exclus. */
  actif?: number;
}

export type ReportOutcome =
  | { kind: 'sans-compte' }
  | { kind: 'serveur'; pseudo: string; record: boolean; verifie: boolean }
  | { kind: 'attente'; pseudo: string; reconnexion?: boolean }
  | { kind: 'refuse'; pseudo: string; message: string };

const QUEUE_KEY = 'calcoolos.envois';
const LAST_KEY = 'calcoolos.derniere-partie';

function read<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage plein ou indisponible */
  }
}

/** Jeu, niveau et mode de la dernière partie jouée sur cet appareil (invité ou profil). */
export function lastGame(): { jeu: string; niveau: string; mode: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as { jeu?: unknown; niveau?: unknown; mode?: unknown } | null;
    return v && typeof v.jeu === 'string' && typeof v.niveau === 'string' && typeof v.mode === 'string' ? { jeu: v.jeu, niveau: v.niveau, mode: v.mode } : null;
  } catch {
    return null;
  }
}

/** Arrondit et borne les valeurs avant envoi (le serveur vérifie de toute façon). */
export function cleanResult(r: GameResult): GameResult {
  const int = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
  const ops: Record<string, [number, number]> = {};
  for (const [op, [ok, ko]] of Object.entries(r.ops)) if (ok + ko > 0) ops[op] = [int(ok), int(ko)];
  const details: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.details)) details[k] = int(v);
  const out: GameResult = {
    ...r,
    score: int(r.score),
    etoiles: Math.min(3, int(r.etoiles)),
    duree: Math.max(1, Math.min(7200, int(r.duree))),
    precision: Math.round(Math.min(1, Math.max(0, r.precision)) * 1000) / 1000,
    ops,
    details,
  };
  if (r.mesures) {
    const m = r.mesures;
    const calculs = int(m.calculs);
    const justes = Math.min(calculs, int(m.justes));
    const faits: Record<string, [number, number, number, number]> = {};
    for (const [k, f] of Object.entries(m.faits ?? {})) if (/^\d{1,2}×\d{1,2}$/.test(k)) faits[k] = [int(f[0]), int(f[1]), int(f[2]), int(f[3])];
    out.mesures = {
      calculs,
      justes,
      fausses: calculs - justes,
      serie: Math.min(justes, int(m.serie)),
      ...(m.tempsMoyen !== undefined && justes > 0 ? { tempsMoyen: int(m.tempsMoyen), tempsMedian: int(m.tempsMedian ?? m.tempsMoyen) } : {}),
      ...(Object.keys(faits).length > 0 ? { faits } : {}),
    };
  }
  return out;
}

async function send(profile: number, r: StoredResult | GameResult, partie?: string | null): Promise<{ status: number; data: { verifie?: boolean; record?: boolean; erreur?: string } }> {
  // Le jeton CSRF vient de /etat (page de jeu fraîchement chargée).
  const state = await accountState();
  if (!state) throw new Error('hors ligne');
  if (!state.connecte) return { status: 401, data: { erreur: 'Session terminée : reconnecte-toi.' } };
  // « partie » : clé unique de la partie, pour que le serveur ne la compte qu'une fois (même renvoyée).
  const { cle, date: _date, ...rest } = r as StoredResult;
  const key = partie ?? cle;
  return api.post<{ verifie?: boolean; record?: boolean }>('/resultats', { ...rest, profil: profile, ...(key ? { partie: key } : {}) });
}

export async function reportResult(raw: GameResult): Promise<ReportOutcome> {
  const r = cleanResult(raw);
  try {
    // Dernier jeu mémorisé seulement pour un profil (partie anonyme : rien).
    if (activePlayer()) localStorage.setItem(LAST_KEY, JSON.stringify({ jeu: r.jeu, niveau: r.niveau, mode: r.mode }));
  } catch {
    /* stockage indisponible */
  }
  const fin = partieTerminee(r.gagne, r.score);
  const now = new Date();
  // Durée active : celle de l'horloge commune ; sans elle (jeu qui n'appelle pas partieCommence), rien.
  const stored: StoredResult = {
    ...r,
    date: now.toISOString(),
    cle: fin?.cle ?? nouvelId(),
    ...(fin ? { debut: fin.debut, actif: Math.min(r.duree, Math.max(0, fin.actif)) } : {}),
  };
  const player = activePlayer();
  if (!player) return { kind: 'sans-compte' };
  try {
    const reply = await send(player.id, stored);
    if (reply.status === 201) return { kind: 'serveur', pseudo: player.pseudo, record: !!reply.data.record, verifie: !!reply.data.verifie };
    // Session terminée : la partie attend la reconnexion (file d'attente) ; serveur en panne : idem.
    if (reply.status === 401) return mettreDeCote(player.id, stored, player.pseudo, true);
    if (reply.status >= 500) throw new Error('serveur indisponible');
    // Autre refus explicite (profil supprimé, résultat incohérent…) : la partie n'est pas enregistrée.
    return { kind: 'refuse', pseudo: player.pseudo, message: reply.data.erreur ?? 'Résultat refusé.' };
  } catch {
    return mettreDeCote(player.id, stored, player.pseudo, false);
  }
}

function mettreDeCote(profil: number, r: StoredResult, pseudo: string, reconnexion: boolean): ReportOutcome {
  const queue = read<{ profil: number; r: StoredResult; partie?: string | null }>(QUEUE_KEY);
  queue.push({ profil, r });
  write(QUEUE_KEY, queue.slice(-50));
  return { kind: 'attente', pseudo, reconnexion };
}

/** Renvoie les résultats en attente (appelé à l'accueil). */
export async function flushQueue(): Promise<number> {
  // Les anciennes entrées (avant le 29/10/2026) portent la clé à part, dans « partie ».
  const queue = read<{ profil: number; r: StoredResult; partie?: string | null }>(QUEUE_KEY);
  if (queue.length === 0) return 0;
  let sent = 0;
  const left: typeof queue = [];
  for (const [i, item] of queue.entries()) {
    try {
      const reply = await send(item.profil, item.r, item.partie);
      // Pas connecté : tout attend la prochaine connexion.
      if (reply.status === 401) {
        left.push(...queue.slice(i));
        break;
      }
      // 429 (débit) : on réessaiera ; les autres refus sont abandonnés.
      if (reply.status === 201 || (reply.status >= 400 && reply.status < 500 && reply.status !== 429)) sent++;
      else left.push(item);
    } catch {
      left.push(item);
    }
    // Le serveur limite le débit : un petit délai entre deux envois.
    await new Promise((res) => setTimeout(res, 50));
  }
  write(QUEUE_KEY, left);
  return sent;
}

/** Phrase courte à afficher sur l'écran de fin. */
export function outcomeText(o: ReportOutcome): string {
  switch (o.kind) {
    case 'sans-compte':
      return 'Partie libre : rien n’est enregistré. Crée un compte pour garder tes scores.';
    case 'serveur':
      return o.verifie ? `Résultat enregistré pour ${o.pseudo}${o.record ? ' : nouveau record !' : '.'}` : `Résultat enregistré pour ${o.pseudo} (non classé).`;
    case 'attente':
      return o.reconnexion
        ? `Session terminée : le résultat de ${o.pseudo} partira dès que tu te reconnectes.`
        : `Pas de réseau : le résultat de ${o.pseudo} partira plus tard.`;
    case 'refuse':
      return `${o.message} (partie non enregistrée)`;
  }
}
