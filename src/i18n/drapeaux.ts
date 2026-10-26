/**
 * Sélecteur de langue : trois petits drapeaux (Royaume-Uni, Allemagne, France), tout à droite de la barre.
 * Les drapeaux sont dessinés en SVG (aucun fichier image) ; les noms des langues restent dans leur langue.
 */
import { LANGUES, choisirLangue, langue, type Langue } from './langue';

const NOMS: Record<Langue, string> = { en: 'English', de: 'Deutsch', fr: 'Français' };

// Dessins au format 3:2 ; le drapeau britannique est recadré sur les côtés.
const SVG: Record<Langue, string> = {
  en:
    '<svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
    '<clipPath id="uk-diag"><path d="M30,15h30v15zv15H0zH0V0zV0h30z"/></clipPath>' +
    '<path d="M0,0v30h60V0z" fill="#012169"/>' +
    '<path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/>' +
    '<path d="M0,0L60,30M60,0L0,30" clip-path="url(#uk-diag)" stroke="#C8102E" stroke-width="4"/>' +
    '<path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/>' +
    '<path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></svg>',
  de:
    '<svg viewBox="0 0 3 2" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="M0,0h3v2H0z" fill="#FFCE00"/><path d="M0,0h3v1.333H0z" fill="#DD0000"/><path d="M0,0h3v.667H0z" fill="#000"/></svg>',
  fr:
    '<svg viewBox="0 0 3 2" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="M0,0h3v2H0z" fill="#EF4135"/><path d="M0,0h2v2H0z" fill="#fff"/><path d="M0,0h1v2H0z" fill="#0055A4"/></svg>',
};

export function selecteurLangue(): HTMLElement {
  const groupe = document.createElement('div');
  groupe.className = 'langues';
  groupe.setAttribute('role', 'group');
  groupe.setAttribute('aria-label', 'Language · Sprache · Langue');
  groupe.translate = false;
  for (const l of LANGUES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.lang = l;
    b.title = NOMS[l];
    b.setAttribute('aria-label', NOMS[l]);
    b.setAttribute('aria-pressed', String(l === langue()));
    // Dessin constant écrit ci-dessus (aucune donnée extérieure).
    b.innerHTML = SVG[l];
    b.addEventListener('click', () => choisirLangue(l));
    groupe.append(b);
  }
  return groupe;
}
