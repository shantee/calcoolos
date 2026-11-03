/**
 * Niveau scolaire choisi au lancement d'un jeu et transmis aux jeux (?niveau=cp…).
 *
 * Règle : le niveau du profil actif l'emporte ; sinon le dernier niveau choisi sur cet appareil ; sinon rien, et
 * l'accueil demande de choisir (pas de niveau imposé en silence). Un ancien niveau à piments (eveil…, avant le
 * 03/11/2026) n'est pas un niveau valable : il ne se traduit pas en classe, le joueur choisit de nouveau.
 */
import { NIVEAUX as LISTE, TIERS, estNiveauScolaire, type TierId } from '../core/difficulty';

const CLE = 'calcoolos.niveau';

export const NIVEAUX: TierId[] = [...LISTE];

export const estNiveau = estNiveauScolaire;

/** Phrase affichée près du choix du niveau. */
export const PHRASE_NIVEAUX = 'Les niveaux correspondent approximativement aux apprentissages de chaque classe. Tu peux changer à tout moment.';

/** Comment le niveau se lit dans un jeu : chaque jeu garde sa mécanique, l'exemple change avec lui. */
export type FamilleDeJeu = 'calcul' | 'cubes' | 'dragon' | 'tables';

/** Famille d'un jeu d'après l'adresse de sa page. */
export function familleDuJeu(href: string): FamilleDeJeu {
  if (/neon-flight|multirail/.test(href)) return 'tables';
  if (/cubes-de-siege/.test(href)) return 'cubes';
  if (/dragon-gourmand/.test(href)) return 'dragon';
  return 'calcul';
}

interface Fiche {
  nom: string;
  /** Ce qu'on y travaille, en quelques mots (fiches de profils, classements). */
  public: string;
  /** Pastille courte du sélecteur. */
  sigle: string;
  /** Nom complet, pour les parents (« Cours élémentaire 1 »). */
  long: string;
}

export const NIVEAU_INFOS: Record<TierId, Fiche> = {
  cp: { nom: 'CP', sigle: 'CP', long: 'Cours préparatoire', public: TIERS.cp.public },
  ce1: { nom: 'CE1', sigle: 'CE1', long: 'Cours élémentaire 1', public: TIERS.ce1.public },
  ce2: { nom: 'CE2', sigle: 'CE2', long: 'Cours élémentaire 2', public: TIERS.ce2.public },
  cm1: { nom: 'CM1', sigle: 'CM1', long: 'Cours moyen 1', public: TIERS.cm1.public },
  cm2: { nom: 'CM2', sigle: 'CM2', long: 'Cours moyen 2', public: TIERS.cm2.public },
  aventurier: { nom: 'Aventurier', sigle: '★', long: 'Aventurier · pour aller plus loin', public: TIERS.aventurier.public },
};

/**
 * Exemple représentatif et description, par niveau et par famille de jeu (doc/NIVEAUX_SCOLAIRES.md). Les exemples
 * sont de vrais calculs du niveau, vérifiés par les tests.
 */
export const EXEMPLES_PAR_JEU: Record<FamilleDeJeu, Record<TierId, { exemple: string; detail: string }>> = {
  calcul: {
    cp: { exemple: '8 + 5', detail: 'Additions et soustractions jusqu’à 100.' },
    ce1: { exemple: '47 + 28', detail: 'Nombres jusqu’à 1 000, premières tables.' },
    ce2: { exemple: '8 × 7', detail: 'Toutes les tables, premières divisions.' },
    cm1: { exemple: '5 × 36', detail: 'Grands nombres, × 5, × 25, distributivité.' },
    cm2: { exemple: '50 × 14', detail: '× 50, ÷ 4, ÷ 8, calculs en plusieurs étapes.' },
    aventurier: { exemple: '13 × 14', detail: 'Grands facteurs et calculs enchaînés.' },
  },
  cubes: {
    cp: { exemple: '13 = 6 + 7', detail: 'Cibles jusqu’à 18, deux cubes.' },
    ce1: { exemple: '34 = 15 + 19', detail: 'Cibles jusqu’à 40, deux ou trois cubes.' },
    ce2: { exemple: '52 = 27 + 25', detail: 'Cibles jusqu’à 60, nombres à deux chiffres.' },
    cm1: { exemple: '87 = 39 + 48', detail: 'Cibles jusqu’à 100, retenues.' },
    cm2: { exemple: '134 = 45 + 52 + 37', detail: 'Cibles jusqu’à 160, jusqu’à quatre cubes.' },
    aventurier: { exemple: '213 = 87 + 69 + 57', detail: 'Grandes cibles, trois ou quatre cubes.' },
  },
  dragon: {
    cp: { exemple: '12 = 7 + 5', detail: 'Petites lanternes, sommes jusqu’à 15.' },
    ce1: { exemple: '31 = 17 + 14', detail: 'Sommes jusqu’à 35, deux ou trois lanternes.' },
    ce2: { exemple: '42 = 6 × 7', detail: 'Sommes jusqu’à 50, quelques produits des tables.' },
    cm1: { exemple: '76 = 28 + 19 + 29', detail: 'Sommes jusqu’à 90, produits des tables.' },
    cm2: { exemple: '108 = 9 × 12', detail: 'Grandes sommes et grands produits.' },
    aventurier: { exemple: '180 = 12 × 15', detail: 'Sommes et produits pour têtes bien faites.' },
  },
  tables: {
    cp: { exemple: '3 × 2', detail: 'Petits groupements, dessinés pour compter.' },
    ce1: { exemple: '4 × 6', detail: 'Les tables, une à une.' },
    ce2: { exemple: '7 × 40', detail: 'Toutes les tables, × 10, × 100, 7 × 13.' },
    cm1: { exemple: '25 × 8', detail: '× 25, × 5, × centaines, 6 × 34.' },
    cm2: { exemple: '8 × 47', detail: '× 25, × 50, dizaines × dizaines.' },
    aventurier: { exemple: '13 × 14', detail: 'Facteurs 11 à 19, 25, 50 et 99.' },
  },
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
 * Niveau de départ de l'accueil. `confirme` est faux pour un nouveau venu (ou un profil resté sur un ancien niveau à
 * piments) : il n'a encore rien choisi. Logique pure (testée).
 */
export function niveauDepart(profil: string | null | undefined, retenu: string | null): { niveau: TierId | null; confirme: boolean } {
  if (estNiveau(profil)) return { niveau: profil, confirme: true };
  if (estNiveau(retenu)) return { niveau: retenu, confirme: true };
  return { niveau: null, confirme: false };
}
