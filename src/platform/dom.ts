/**
 * Petit utilitaire de construction du DOM. Les textes passent toujours par
 * textContent : aucune donnée saisie (pseudo…) n'est interprétée comme du HTML.
 */
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | number | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/** Affiche les erreurs renvoyées par l'API sous chaque champ, et le message général. */
export function showErrors(form: HTMLFormElement, message: HTMLElement, reply: { erreur?: string; champs?: Record<string, string> }): void {
  for (const e of form.querySelectorAll('.erreur-champ')) e.textContent = '';
  for (const [name, text] of Object.entries(reply.champs ?? {})) {
    const slot = form.querySelector(`[data-erreur="${name}"]`);
    if (slot) slot.textContent = text;
  }
  message.className = 'message erreur';
  message.textContent = reply.erreur ?? 'Une erreur est survenue.';
}

export function field(label: string, input: HTMLElement, name: string, help?: string): HTMLLabelElement {
  return h('label', { class: 'champ' }, label, input, help ? h('small', { class: 'discret' }, help) : null, h('span', { class: 'erreur-champ', 'data-erreur': name, 'aria-live': 'polite' }));
}
