/**
 * Traduction à partir du texte français : t('Rejouer') → « Play again » en anglais.
 *
 * Les dictionnaires (en.ts, de.ts) ont pour clés les textes français tels qu'ils sont écrits dans le code. Un
 * texte absent du dictionnaire reste en français : changer un texte français ne casse rien, il apparaîtra
 * simplement en français dans les autres langues tant qu'on ne l'a pas retraduit.
 *
 * Une clé contenant {} ou {*} est un modèle : « Vague {} / {} » traduit « Vague 2 / 4 ». {} ne prend qu'un
 * morceau sans lettres (nombre, étoiles) ; {*} prend n'importe quel texte, lui-même traduit à son tour
 * (« Niveau {*} » + « Explorateur »). Sans cette distinction, « {} sur {} » avalerait n'importe quelle phrase
 * contenant « sur ». Dans la traduction, {} reprend les morceaux dans l'ordre, {1}, {2}… permettent de les déplacer.
 */
import { langue, type Langue } from './langue';
import { EN } from './en';
import { DE } from './de';

export type Dictionnaire = Record<string, string>;

const DICTIONNAIRES: Record<Exclude<Langue, 'fr'>, Dictionnaire> = { en: EN, de: DE };

interface Modele {
  re: RegExp;
  trad: string;
}

function compiler(dico: Dictionnaire): Modele[] {
  return Object.keys(dico)
    .filter((k) => /\{\*?\}/.test(k))
    // Le modèle le plus précis (le plus de texte fixe) passe en premier.
    .sort((a, b) => b.replace(/\{\*?\}/g, '').length - a.replace(/\{\*?\}/g, '').length)
    .map((k) => ({
      re: new RegExp(
        `^${k
          .split(/(\{\*?\})/)
          .map((p) => (p === '{}' ? '([^\\p{L}]+?)' : p === '{*}' ? '(.+?)' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
          .join('')}$`,
        'su',
      ),
      trad: dico[k],
    }));
}

const modeles = new Map<Dictionnaire, Modele[]>();
const cache = new Map<string, string>();
/** Textes restés en français (pour repérer les oublis : window.__tradManquantes dans la console). */
export const manquantes = new Set<string>();

function remplir(trad: string, morceaux: string[]): string {
  let i = 0;
  return trad.replace(/\{(\d*)\}/g, (_m, n: string) => morceaux[n ? Number(n) - 1 : i++] ?? '');
}

function chercher(s: string, dico: Dictionnaire, profondeur: number): string | null {
  const direct = dico[s];
  if (direct !== undefined) return direct;
  if (!/\p{L}/u.test(s)) return s; // nombres, symboles : rien à traduire
  if (profondeur > 3) return null;
  let liste = modeles.get(dico);
  if (!liste) modeles.set(dico, (liste = compiler(dico)));
  for (const m of liste) {
    const r = m.re.exec(s);
    if (r) return remplir(m.trad, r.slice(1).map((x) => traduireDans(x, dico, profondeur + 1)));
  }
  // Textes composés : ligne par ligne, puis morceaux séparés par « · » ou par trois espaces.
  for (const sep of ['\n', ' · ', '   ']) {
    if (s.includes(sep)) {
      const parts = s.split(sep).map((p) => chercher(p, dico, profondeur + 1));
      if (parts.some((p, i) => p !== null && p !== s.split(sep)[i])) return parts.map((p, i) => p ?? s.split(sep)[i]).join(sep);
    }
  }
  return null;
}

function traduireDans(s: string, dico: Dictionnaire, profondeur = 0): string {
  // Les espaces autour du texte sont gardés tels quels.
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
  if (!m[2]) return s;
  const trouve = chercher(m[2], dico, profondeur);
  if (trouve === null) {
    if (profondeur === 0) manquantes.add(m[2]);
    return s;
  }
  return m[1] + trouve + m[3];
}

/** Traduit un texte français dans la langue de l'interface (le renvoie tel quel en français). */
export function t(fr: string): string {
  const l = langue();
  if (l === 'fr') return fr;
  let r = cache.get(fr);
  if (r === undefined) {
    r = traduireDans(fr, DICTIONNAIRES[l]);
    if (cache.size > 2000) cache.clear();
    cache.set(fr, r);
  }
  return r;
}

if (typeof window !== 'undefined') (window as unknown as { __tradManquantes: Set<string> }).__tradManquantes = manquantes;
