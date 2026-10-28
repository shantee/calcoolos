/**
 * Textes de la page Classements : date d'un record (courte dans la ligne, complète dans l'infobulle),
 * durée d'une partie, étoiles. Fonctions pures, testées (tests/classement-format.test.ts).
 */

/** Jour civil « AAAA-MM-JJ » d'une date dans le fuseau donné (celui du navigateur par défaut). */
function jour(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** « 14 h 32 », « 9 h 05 ». */
function heure(d: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${Number(v('hour'))} h ${v('minute')}`;
}

/** Date courte : « aujourd'hui à 14 h 32 », « hier à 9 h 05 », « 28 oct. à 14 h 32 », « 3 mars 2025 ». */
export function dateCourte(iso: string, now = new Date(), timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const j = jour(d, timeZone);
  if (j === jour(now, timeZone)) return `aujourd’hui à ${heure(d, timeZone)}`;
  if (j === jour(new Date(now.getTime() - 86_400_000), timeZone)) return `hier à ${heure(d, timeZone)}`;
  const memeAnnee = j.slice(0, 4) === jour(now, timeZone).slice(0, 4);
  const date = new Intl.DateTimeFormat('fr-FR', { timeZone, day: 'numeric', month: 'short', year: memeAnnee ? undefined : 'numeric' }).format(d);
  return memeAnnee ? `${date} à ${heure(d, timeZone)}` : date;
}

/** Date complète : « mardi 28 octobre 2026 à 14 h 32 ». */
export function dateLongue(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  return `${date} à ${heure(d, timeZone)}`;
}

/** « 45 s », « 3 min 12 s », « 12 min ». */
export function duree(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return s % 60 === 0 ? `${m} min` : `${m} min ${s % 60} s`;
}

/** Trois étoiles, pleines ou vides : « ★★☆ ». */
export function etoiles(n: number): string {
  const k = Math.max(0, Math.min(3, Math.round(n)));
  return '★'.repeat(k) + '☆'.repeat(3 - k);
}

/** Score avec espaces fines : « 12 400 ». */
export function score(n: number): string {
  return n.toLocaleString('fr-FR');
}
