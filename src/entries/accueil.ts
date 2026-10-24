import '@fontsource-variable/bricolage-grotesque';
import '../styles/accueil.css';

// Le niveau choisi est transmis au jeu (?niveau=…) et retenu localement.
const KEY = 'calcoolos.niveau';
const select = document.querySelector<HTMLSelectElement>('#niveau');
const links = document.querySelectorAll<HTMLAnchorElement>('a[data-jeu]');

function apply(): void {
  if (!select) return;
  for (const a of links) {
    const url = new URL(a.getAttribute('href') ?? '', window.location.href);
    url.searchParams.set('niveau', select.value);
    a.href = url.toString();
  }
}

if (select) {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && [...select.options].some((o) => o.value === saved)) select.value = saved;
  } catch {
    /* stockage indisponible */
  }
  select.addEventListener('change', () => {
    try {
      localStorage.setItem(KEY, select.value);
    } catch {
      /* ignoré */
    }
    apply();
  });
  apply();
}
