/**
 * Niveau de difficulté choisi sur l'accueil et transmis aux jeux (?niveau=…).
 *
 * Règle : le niveau du profil actif l'emporte ; sinon le dernier niveau choisi sur cet appareil ; sinon rien,
 * et l'accueil demande de choisir avant la première partie (pas de niveau imposé en silence à un nouveau venu).
 */
import type { TierId } from '../core/difficulty';

const CLE = 'calcoolos.niveau';

export const NIVEAUX: TierId[] = ['eveil', 'explorateur', 'stratege', 'maitre'];

export const estNiveau = (v: unknown): v is TierId => typeof v === 'string' && (NIVEAUX as string[]).includes(v);

/** Ce que chaque niveau propose, en une ligne (d'après src/core/expressions.ts et difficulty.ts). */
export const NIVEAU_INFOS: Record<TierId, { nom: string; public: string; exemple: string; detail: string; avatar: string }> = {
  eveil: { nom: 'Éveil', public: '7-8 ans', exemple: '8 + 5', detail: 'Additions et soustractions jusqu’à 20.', avatar: 'axolotl' },
  explorateur: { nom: 'Explorateur', public: '9-10 ans', exemple: '27 + 15', detail: 'Calculs jusqu’à 50, tables de 2, 5 et 10.', avatar: 'chat-aviateur' },
  stratege: { nom: 'Stratège', public: '11-12 ans', exemple: '7 × 8', detail: 'Calculs jusqu’à 100, toutes les tables, divisions.', avatar: 'robot' },
  maitre: { nom: 'Maître', public: 'ados et adultes', exemple: '84 ÷ 7', detail: 'Calculs jusqu’à 200, tables jusqu’à 12, plus rapide.', avatar: 'sorcier' },
};

export function niveauRetenu(): TierId | null {
  try {
    const v = localStorage.getItem(CLE);
    return estNiveau(v) ? v : null;
  } catch {
    return null;
  }
}

export function retenirNiveau(v: TierId): void {
  try {
    localStorage.setItem(CLE, v);
  } catch {
    /* stockage indisponible : le niveau vaut pour cette page seulement */
  }
}

/**
 * Niveau de départ de l'accueil. `confirme` est faux pour un nouveau venu : il n'a encore rien choisi.
 * Logique pure (testée).
 */
export function niveauDepart(profil: string | null | undefined, retenu: string | null): { niveau: TierId | null; confirme: boolean } {
  if (estNiveau(profil)) return { niveau: profil, confirme: true };
  if (estNiveau(retenu)) return { niveau: retenu, confirme: true };
  return { niveau: null, confirme: false };
}
