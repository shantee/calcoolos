/**
 * Dialogue avec l'API PHP (/api/…). Si l'API ne répond pas (site statique,
 * hors ligne), tout continue en mode invité.
 */
export interface Profile {
  id: number;
  pseudo: string;
  avatar: string;
  niveau: string;
  classementPublic: boolean;
  nomPublic: string;
}

export interface AccountState {
  connecte: boolean;
  email?: string;
  csrf?: string;
  profils?: Profile[];
  /** Le compte a-t-il un mot de passe ? (non s'il a été créé avec Google) */
  motDePasse?: boolean;
  /** Un compte Google est-il associé ? */
  google?: boolean;
  /** Identifiant client Google (public) : présent seulement si « Continuer avec Google » est configuré. */
  googleClientId?: string;
}

export interface ApiReply<T = Record<string, unknown>> {
  status: number;
  data: T & { erreur?: string; champs?: Record<string, string> };
}

let csrf = '';

/** Racine du site (le site peut vivre dans un sous-dossier ; les jeux sont dans /jeu/). */
export function siteRoot(): string {
  return window.location.pathname.replace(/(jeu\/)?[^/]*$/, '');
}

export function apiUrl(path: string): string {
  return `${siteRoot()}api${path}`;
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiReply<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    headers['X-Calcoolos'] = '1';
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  const res = await fetch(apiUrl(path), { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
  let data: ApiReply<T>['data'];
  try {
    data = (await res.json()) as ApiReply<T>['data'];
  } catch {
    data = { erreur: 'Le serveur ne répond pas correctement.' } as ApiReply<T>['data'];
  }
  const token = (data as { csrf?: unknown }).csrf;
  if (typeof token === 'string') csrf = token;
  return { status: res.status, data };
}

export const api = {
  get: <T = Record<string, unknown>>(path: string) => call<T>('GET', path),
  post: <T = Record<string, unknown>>(path: string, body: unknown = {}) => call<T>('POST', path, body),
};

/** État du compte ; null si l'API est injoignable (mode invité seulement). */
export async function accountState(): Promise<AccountState | null> {
  try {
    const r = await api.get<AccountState>('/etat');
    if (r.status !== 200) return null;
    return r.data;
  } catch {
    return null;
  }
}
