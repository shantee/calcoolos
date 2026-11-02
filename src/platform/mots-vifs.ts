/**
 * Les mots de l'accroche : « Ici, tu joues. », puis explores, voyages… Chaque lettre arrive sur un rouleau de
 * compteur, précédée d'un chiffre : le calcul devient l'aventure. Après deux tours, la phrase se repose sur
 * « joues ». Rien ne tourne hors de l'écran, onglet caché ou sous le pointeur.
 * Animations réduites (système ou ?calme) : la phrase reste telle quelle, écrite dans la page.
 */
import { calme } from './logo';

const MOTS = ['joues', 'explores', 'voyages', 'réfléchis', 'progresses', 'apprends', 'découvres'];
const TOURS = 2;
const TENUE_MS = 3400;
const NOUVEL_ESSAI_MS = 500;
const SORTIE_MS = 1000;
/** Inclinaisons des lettres du logo (logo.ts) : la même ligne de base qui sautille. */
const PENTES = [-3, 2, -2, 3, 0, 0, -2, 2, -3, 2, -2];

function couche(mot: string, arrive: boolean): HTMLElement {
  const racine = document.createElement('span');
  racine.className = arrive ? 'mot-couche entre' : 'mot-couche';
  [...`${mot}.`].forEach((lettre, i) => {
    const boite = document.createElement('span');
    boite.className = 'mot-lettre';
    boite.style.setProperty('--pente', `${PENTES[i] * 0.6}deg`);
    const rouleau = document.createElement('span');
    rouleau.className = 'mot-rouleau';
    rouleau.style.setProperty('--i', String(i));
    const chiffre = document.createElement('span');
    chiffre.className = 'mot-chiffre';
    chiffre.textContent = String(1 + Math.floor(Math.random() * 9));
    rouleau.append(chiffre, lettre);
    boite.append(rouleau);
    racine.append(boite);
  });
  return racine;
}

export function motsVifs(phrase: HTMLElement | null): void {
  const mot = phrase?.querySelector<HTMLElement>('.mot');
  if (!phrase || !mot || calme()) return;

  let visible = false;
  let survol = false;
  let rang = 0;
  // Le mot écrit dans la page devient un mot en lettres séparées, seul capable de sortir en roulant.
  let actuelle = couche(MOTS[0], false);
  mot.querySelector('.mot-couche')?.replaceWith(actuelle);

  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(phrase);
  phrase.addEventListener('pointerenter', () => (survol = true));
  phrase.addEventListener('pointerleave', () => (survol = false));

  const changer = (): void => {
    if (calme()) return;
    if (document.hidden || !visible || survol) {
      window.setTimeout(changer, NOUVEL_ESSAI_MS);
      return;
    }
    rang++;
    const sortante = actuelle;
    sortante.className = 'mot-couche sort';
    window.setTimeout(() => sortante.remove(), SORTIE_MS);
    actuelle = couche(MOTS[rang % MOTS.length], true);
    mot.append(actuelle);
    if (rang < TOURS * MOTS.length) window.setTimeout(changer, TENUE_MS);
  };
  window.setTimeout(changer, TENUE_MS);
}
