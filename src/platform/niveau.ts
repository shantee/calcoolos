/**
 * Niveau de difficulté choisi sur l'accueil et transmis aux jeux (?niveau=…).
 *
 * Règle : le niveau du profil actif l'emporte ; sinon le dernier niveau choisi sur cet appareil ; sinon rien,
 * et l'accueil demande de choisir avant la première partie (pas de niveau imposé en silence à un nouveau venu).
 */
import { TIERS, type TierId } from '../core/difficulty';

const CLE = 'calcoolos.niveau';

export const NIVEAUX: TierId[] = ['eveil', 'explorateur', 'stratege', 'maitre'];

export const estNiveau = (v: unknown): v is TierId => typeof v === 'string' && (NIVEAUX as string[]).includes(v);

/**
 * Ce que chaque niveau propose (d'après src/core/expressions.ts et difficulty.ts). Les niveaux se lisent à la
 * difficulté des calculs, jamais à l'âge : couleur, nombre de piments et nom se complètent. Les identifiants
 * (eveil…) restent ceux des profils et des résultats enregistrés.
 */
export const NIVEAU_INFOS: Record<TierId, { nom: string; public: string; exemple: string; detail: string; piments: number }> = {
  eveil: { nom: TIERS.eveil.label, public: TIERS.eveil.public, exemple: '8 + 5', detail: 'Additions et soustractions jusqu’à 20.', piments: 1 },
  explorateur: { nom: TIERS.explorateur.label, public: TIERS.explorateur.public, exemple: '27 + 15', detail: 'Additions et soustractions jusqu’à 50, tables de 2, 5 et 10.', piments: 2 },
  stratege: { nom: TIERS.stratege.label, public: TIERS.stratege.public, exemple: '7 × 8', detail: 'Calculs jusqu’à 100, toutes les tables, divisions.', piments: 3 },
  maitre: { nom: TIERS.maitre.label, public: TIERS.maitre.public, exemple: '84 ÷ 7', detail: 'Calculs jusqu’à 200, tables jusqu’à 12, divisions, moins de temps.', piments: 4 },
};

const PIMENT =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.6 7.2c2.6.3 4.6 2.6 4 5.6-.9 4.5-6.6 8.2-14.4 8.2-1 0-1.4-1.2-.5-1.6 4.4-1.9 6.4-5.3 7.2-9.2.5-2.2 1.900-3.200 3.700-3z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.500 7c0-2 .9-3.400 2.800-4"/></svg>';

/** Rangée de piments d'un niveau (dessin constant, décoratif : le nom du niveau l'accompagne toujours). */
export function pimentsHtml(id: TierId): string {
  return PIMENT.repeat(NIVEAU_INFOS[id].piments);
}

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
