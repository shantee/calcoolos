/**
 * Sélecteur de langue, tout à droite de la barre : le drapeau de la langue en cours ouvre un menu déroulant
 * (Royaume-Uni, Allemagne, France).
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
  groupe.translate = false;

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'langue-courante';
  bouton.title = NOMS[langue()];
  bouton.setAttribute('aria-label', `Language · Sprache · Langue : ${NOMS[langue()]}`);
  bouton.setAttribute('aria-expanded', 'false');
  bouton.setAttribute('aria-haspopup', 'true');
  // Dessin constant écrit ci-dessus (aucune donnée extérieure).
  bouton.innerHTML = `${SVG[langue()]}<span class="langue-fleche" aria-hidden="true">▾</span>`;

  const menu = document.createElement('div');
  menu.className = 'langues-menu';
  menu.hidden = true;
  for (const l of LANGUES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.lang = l;
    b.setAttribute('aria-pressed', String(l === langue()));
    b.innerHTML = `${SVG[l]}<span>${NOMS[l]}</span>`;
    b.addEventListener('click', () => {
      ouvrir(false);
      choisirLangue(l);
    });
    menu.append(b);
  }

  function ouvrir(oui: boolean): void {
    menu.hidden = !oui;
    bouton.setAttribute('aria-expanded', String(oui));
  }

  bouton.addEventListener('click', () => ouvrir(menu.hidden));
  // Un clic ailleurs ou Échap referme le menu.
  document.addEventListener('click', (e) => {
    if (!groupe.contains(e.target as Node)) ouvrir(false);
  });
  groupe.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      ouvrir(false);
      bouton.focus();
    }
  });

  groupe.append(bouton, menu);
  return groupe;
}
