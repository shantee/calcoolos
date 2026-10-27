/**
 * Fin de partie : le résultat est rangé dans l'historique local (invité) ou
 * envoyé au serveur pour le profil actif. Sans réseau, il attend dans une file
 * et repart au prochain passage.
 */
import { api, accountState } from './api';
import { activePlayer } from './player';

export type GameId = 'cubes' | 'meteores' | 'dragon' | 'fusee';

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
}

export interface StoredResult extends GameResult {
  date: string;
  verifie?: boolean;
}

export type ReportOutcome =
  | { kind: 'local' }
  | { kind: 'serveur'; pseudo: string; record: boolean; verifie: boolean }
  | { kind: 'attente'; pseudo: string }
  | { kind: 'refuse'; pseudo: string; message: string };

const HISTORY_KEY = 'calcoolos.historique';
const QUEUE_KEY = 'calcoolos.envois';
const LAST_KEY = 'calcoolos.derniere-partie';
const MAX_LOCAL = 300;

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

/** Historique de l'invité sur cet appareil (le plus récent d'abord). */
export function localHistory(): StoredResult[] {
  return read<StoredResult>(HISTORY_KEY);
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

export function clearLocalHistory(): void {
  write(HISTORY_KEY, []);
}

function addLocal(r: GameResult): void {
  const list = localHistory();
  list.unshift({ ...r, date: new Date().toISOString() });
  write(HISTORY_KEY, list.slice(0, MAX_LOCAL));
}

/** Arrondit et borne les valeurs avant envoi (le serveur vérifie de toute façon). */
export function cleanResult(r: GameResult): GameResult {
  const int = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
  const ops: Record<string, [number, number]> = {};
  for (const [op, [ok, ko]] of Object.entries(r.ops)) if (ok + ko > 0) ops[op] = [int(ok), int(ko)];
  const details: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.details)) details[k] = int(v);
  return {
    ...r,
    score: int(r.score),
    etoiles: Math.min(3, int(r.etoiles)),
    duree: Math.max(1, Math.min(7200, int(r.duree))),
    precision: Math.round(Math.min(1, Math.max(0, r.precision)) * 1000) / 1000,
    ops,
    details,
  };
}

async function send(profile: number, r: GameResult): Promise<{ status: number; data: { verifie?: boolean; record?: boolean; erreur?: string } }> {
  // Le jeton CSRF vient de /etat (page de jeu fraîchement chargée).
  const state = await accountState();
  if (!state) throw new Error('hors ligne');
  if (!state.connecte) return { status: 401, data: { erreur: 'Session terminée : reconnecte-toi.' } };
  return api.post<{ verifie?: boolean; record?: boolean }>('/resultats', { ...r, profil: profile });
}

export async function reportResult(raw: GameResult): Promise<ReportOutcome> {
  const r = cleanResult(raw);
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ jeu: r.jeu, niveau: r.niveau, mode: r.mode }));
  } catch {
    /* stockage indisponible */
  }
  const player = activePlayer();
  if (!player) {
    addLocal(r);
    return { kind: 'local' };
  }
  try {
    const reply = await send(player.id, r);
    if (reply.status === 201) return { kind: 'serveur', pseudo: player.pseudo, record: !!reply.data.record, verifie: !!reply.data.verifie };
    if (reply.status >= 500) throw new Error('serveur indisponible');
    // Refus explicite (session terminée, profil supprimé…) : on garde la partie sur l'appareil.
    addLocal(r);
    return { kind: 'refuse', pseudo: player.pseudo, message: reply.data.erreur ?? 'Résultat refusé.' };
  } catch {
    const queue = read<{ profil: number; r: GameResult }>(QUEUE_KEY);
    queue.push({ profil: player.id, r });
    write(QUEUE_KEY, queue.slice(-50));
    return { kind: 'attente', pseudo: player.pseudo };
  }
}

/** Renvoie les résultats en attente (appelé à l'accueil). */
export async function flushQueue(): Promise<number> {
  const queue = read<{ profil: number; r: GameResult }>(QUEUE_KEY);
  if (queue.length === 0) return 0;
  let sent = 0;
  const left: typeof queue = [];
  for (const item of queue) {
    try {
      const reply = await send(item.profil, item.r);
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
    case 'local':
      return 'Mode invité : score gardé ici, hors classement.';
    case 'serveur':
      return o.verifie ? `Résultat enregistré pour ${o.pseudo}${o.record ? ' : nouveau record !' : '.'}` : `Résultat enregistré pour ${o.pseudo} (non classé).`;
    case 'attente':
      return `Pas de réseau : le résultat de ${o.pseudo} partira plus tard.`;
    case 'refuse':
      return `${o.message} (gardé sur cet appareil)`;
  }
}
