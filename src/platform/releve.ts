/**
 * Relevé des réponses d'une partie, commun à tous les jeux (logique pure, testée).
 *
 * Chaque jeu appelle `reponse()` à chaque calcul jugé (juste, faux ou temps écoulé), avec le temps mis
 * pour répondre quand il a un sens. En fin de partie, `mesures()` donne les indicateurs mathématiques
 * communs envoyés avec le résultat : calculs, justes, fausses, temps moyen et médian des bonnes réponses,
 * meilleure série, et pour les multiplications un petit bilan par fait (« 7×8 ») qui nourrit la grille
 * de maîtrise des tables. Rien d'autre : ni les réponses tapées, ni l'heure de chaque calcul.
 */

/** Indicateurs communs d'une partie (tous entiers ; temps en millisecondes). */
export interface Mesures {
  calculs: number;
  justes: number;
  fausses: number;
  /** Temps moyen et médian des bonnes réponses (absents si aucune n'a été chronométrée). */
  tempsMoyen?: number;
  tempsMedian?: number;
  serie: number;
  /** Multiplications : par fait « a×b » (a ≤ b), [justes, ratés, temps total des justes chronométrées (ms), justes chronométrées]. */
  faits?: Record<string, Fait>;
}

export type Fait = [number, number, number, number];

/** Bornes du relevé : un temps au-delà de 60 s n'est pas un temps de réponse (pause oubliée, onglet…). */
const TEMPS_MAX = 60_000;
const FAITS_MAX = 144;

/** Clé d'un fait de multiplication, dans l'ordre croissant (7 × 8 et 8 × 7 sont le même fait). */
export function cleFait(a: number, b: number): string | null {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 20 || b > 20) return null;
  return a <= b ? `${a}×${b}` : `${b}×${a}`;
}

/** Médiane (liste non vide). */
export function mediane(v: readonly number[]): number {
  const s = [...v].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export class Releve {
  private calculs = 0;
  private justes = 0;
  private serieCourante = 0;
  private meilleure = 0;
  private temps: number[] = [];
  private faits = new Map<string, Fait>();

  /**
   * Un calcul jugé. `ms` : temps de réponse (omis si le jeu ne peut pas le mesurer, ou pour un temps
   * écoulé). `fait` : opérandes d'une multiplication (ou d'une division, rattachée à sa multiplication).
   */
  reponse(juste: boolean, ms?: number, fait?: { op: string; a: number; b: number }): void {
    this.calculs++;
    const t = ms !== undefined && Number.isFinite(ms) && ms > 0 && ms <= TEMPS_MAX ? Math.round(ms) : undefined;
    if (juste) {
      this.justes++;
      this.serieCourante++;
      this.meilleure = Math.max(this.meilleure, this.serieCourante);
      if (t !== undefined) this.temps.push(t);
    } else {
      this.serieCourante = 0;
    }
    if (!fait) return;
    // a ÷ b = q revient à connaître b × q.
    const cle = fait.op === '×' ? cleFait(fait.a, fait.b) : fait.op === '÷' && fait.b > 0 ? cleFait(fait.b, fait.a / fait.b) : null;
    if (!cle) return;
    let f = this.faits.get(cle);
    if (!f) {
      if (this.faits.size >= FAITS_MAX) return;
      f = [0, 0, 0, 0];
      this.faits.set(cle, f);
    }
    if (juste) {
      f[0]++;
      if (t !== undefined) {
        f[2] += t;
        f[3]++;
      }
    } else {
      f[1]++;
    }
  }

  get nombre(): number {
    return this.calculs;
  }

  mesures(): Mesures {
    const m: Mesures = { calculs: this.calculs, justes: this.justes, fausses: this.calculs - this.justes, serie: this.meilleure };
    if (this.temps.length > 0) {
      m.tempsMoyen = Math.round(this.temps.reduce((a, b) => a + b, 0) / this.temps.length);
      m.tempsMedian = Math.round(mediane(this.temps));
    }
    if (this.faits.size > 0) m.faits = Object.fromEntries(this.faits);
    return m;
  }
}
