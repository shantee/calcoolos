/**
 * Traduit la page HTML (textes, titre, attributs) dès son chargement, puis tout ce que le code y ajoute ensuite.
 * À importer en premier dans chaque point d'entrée. En français, ne fait rien.
 */
import { langue } from './langue';
import { t } from './traduire';

const ATTRIBUTS = ['alt', 'title', 'aria-label', 'placeholder'];
const IGNORES = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
/** Textes déjà traduits : quand l'observateur les voit revenir, il ne les retraduit pas. */
const traduits = new Set<string>();

function traduire(v: string): string {
  if (traduits.has(v)) return v;
  const r = t(v);
  traduits.add(r);
  return r;
}

function exclu(el: Element | null): boolean {
  return !!el && (IGNORES.has(el.tagName) || !!el.closest('[translate="no"]'));
}

function texte(n: Text): void {
  if (exclu(n.parentElement)) return;
  const v = n.data;
  // Les retours à la ligne du HTML comptent comme de simples espaces.
  const r = traduire(v.replace(/\s+/g, ' '));
  if (r !== v.replace(/\s+/g, ' ')) n.data = r;
}

function element(el: Element): void {
  if (exclu(el)) return;
  for (const a of ATTRIBUTS) {
    const v = el.getAttribute(a);
    if (v) {
      const r = traduire(v);
      if (r !== v) el.setAttribute(a, r);
    }
  }
}

function parcourir(racine: Node): void {
  if (racine.nodeType === Node.TEXT_NODE) return texte(racine as Text);
  if (racine.nodeType !== Node.ELEMENT_NODE) return;
  element(racine as Element);
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) texte(n as Text);
    else element(n as Element);
  }
}

if (langue() !== 'fr') {
  document.documentElement.lang = langue();
  document.title = t(document.title);
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', t(desc.getAttribute('content') ?? ''));
  parcourir(document.body);
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') texte(m.target as Text);
      else if (m.type === 'attributes') element(m.target as Element);
      else m.addedNodes.forEach(parcourir);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTS });
}
