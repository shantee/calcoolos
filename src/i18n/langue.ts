/**
 * Langue de l'interface. Le français est la langue de référence : tout le code est écrit en français et les
 * autres langues sont des traductions posées par-dessus (voir traduire.ts), qui peuvent avoir du retard.
 *
 * Choix : celui du visiteur (drapeaux de la barre du haut, retenu dans le navigateur), sinon la langue du
 * navigateur (français, allemand ou anglais), sinon l'anglais.
 */
export type Langue = 'fr' | 'en' | 'de';

export const LANGUES: Langue[] = ['en', 'de', 'fr'];

const CLE = 'calcoolos.langue';
const LOCALES: Record<Langue, string> = { fr: 'fr-FR', en: 'en-GB', de: 'de-DE' };

function estLangue(v: unknown): v is Langue {
  return v === 'fr' || v === 'en' || v === 'de';
}

/** Première langue connue parmi les préférences du navigateur (« de-AT » → allemand). */
export function langueDuNavigateur(prefs: readonly string[] = navigator.languages ?? [navigator.language]): Langue {
  for (const p of prefs) {
    const code = p.toLowerCase().slice(0, 2);
    if (estLangue(code)) return code;
  }
  return 'en';
}

let courante: Langue | null = null;

export function langue(): Langue {
  if (courante) return courante;
  let choisie: string | null = null;
  try {
    choisie = localStorage.getItem(CLE);
  } catch {
    /* stockage indisponible */
  }
  courante = estLangue(choisie) ? choisie : typeof navigator === 'undefined' ? 'fr' : langueDuNavigateur();
  return courante;
}

/** Retient le choix du visiteur et recharge la page pour tout réafficher dans la nouvelle langue. */
export function choisirLangue(l: Langue): void {
  try {
    localStorage.setItem(CLE, l);
  } catch {
    /* sans stockage, le choix ne vaut que pour cette page */
  }
  if (l === langue()) return;
  courante = l;
  window.location.reload();
}

/** Code de langue pour Intl (dates, nombres). */
export function locale(): string {
  return LOCALES[langue()];
}
