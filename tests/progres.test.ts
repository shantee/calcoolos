import { describe, expect, it } from 'vitest';
import type { StoredResult } from '../src/platform/results';
import type { Fait } from '../src/platform/releve';
import {
  aReviser, bilan, contextes, evolution, faits, frequentation, maitrise, parTable, partiesManquantes, pointsForts,
  progresTables, semaine, synthese,
} from '../src/platform/progres';

const jour = (j: number, h = 10) => new Date(Date.UTC(2026, 9, j, h)).toISOString();

/** Une partie de Neon Flight mesurée. */
function partie(j: number, o: { justes?: number; fausses?: number; median?: number; score?: number; faits?: Record<string, Fait>; jeu?: StoredResult['jeu']; niveau?: string; variante?: string; actif?: number } = {}): StoredResult {
  const justes = o.justes ?? 18;
  const fausses = o.fausses ?? 2;
  return {
    jeu: o.jeu ?? 'neon', niveau: o.niveau ?? 'explorateur', mode: 'defi', variante: o.variante ?? 'petites',
    score: o.score ?? 1000, gagne: true, etoiles: 1, duree: 120, actif: o.actif ?? 100, precision: justes / (justes + fausses),
    ops: { '×': [justes, fausses] }, details: {}, date: jour(j),
    mesures: { calculs: justes + fausses, justes, fausses, tempsMoyen: o.median ?? 3000, tempsMedian: o.median ?? 3000, serie: 7, ...(o.faits ? { faits: o.faits } : {}) },
  };
}

/** Une ancienne partie, enregistrée avant les mesures communes. */
const ancienne = (j: number): StoredResult => ({
  jeu: 'dragon', niveau: 'explorateur', mode: 'defi', score: 500, gagne: false, etoiles: 0, duree: 90, precision: 0.5,
  ops: { '+': [5, 5] }, details: {}, date: jour(j),
});

describe('bilan', () => {
  it('additionne justes, ratés, temps actif et garde la meilleure série', () => {
    const b = bilan([partie(1), partie(2, { justes: 10, fausses: 10, median: 5000 })]);
    expect(b.parties).toBe(2);
    expect(b.secondes).toBe(200);
    expect(b.justes).toBe(28);
    expect(b.fausses).toBe(12);
    expect(b.precision).toBeCloseTo(0.7);
    expect(b.tempsMedian).toBe(4000);
    expect(b.tempsMoyen).toBe(Math.round((3000 * 18 + 5000 * 10) / 28));
    expect(b.serie).toBe(7);
  });

  it('n’invente rien pour les anciennes parties : réussites par opération, durée, pas de temps de réponse', () => {
    const b = bilan([ancienne(1)]);
    expect(b.justes).toBe(5);
    expect(b.secondes).toBe(90);
    expect(b.tempsMedian).toBeNull();
    expect(b.chronometrees).toBe(0);
  });
});

describe('évolution sur des parties comparables', () => {
  it('sépare les contextes (jeu, niveau, mode, variante)', () => {
    const cs = contextes([partie(1), partie(2), partie(3, { variante: 'grandes' }), partie(4, { niveau: 'maitre' })]);
    expect(cs.map((c) => c.parties.length)).toEqual([2, 1, 1]);
  });

  it('voit un progrès de rapidité avec 6 parties, pas avant', () => {
    const p = [5000, 5200, 4800, 3000, 3100, 2900].map((m, i) => partie(i + 1, { median: m }));
    expect(evolution(p.slice(0, 5), 'rapidite')).toBeNull();
    expect(partiesManquantes(p.slice(0, 5), 'rapidite')).toBe(1);
    const e = evolution(p, 'rapidite')!;
    expect(e.sens).toBe('mieux');
    expect(e.avant).toBe(5000);
    expect(e.apres).toBe(3000);
  });

  it('une seule partie exceptionnelle ne fait pas un progrès', () => {
    const p = [5000, 5000, 5000, 5000, 5000, 900].map((m, i) => partie(i + 1, { median: m }));
    expect(evolution(p, 'rapidite')!.sens).toBe('stable');
  });

  it('ignore les parties sans mesure pour la rapidité', () => {
    expect(evolution([ancienne(1), ancienne(2), ancienne(3), ancienne(4), ancienne(5), ancienne(6)], 'rapidite')).toBeNull();
  });
});

describe('tables de multiplication', () => {
  const fs = faits([
    partie(1, { faits: { '7×8': [1, 3, 4000, 1], '2×5': [5, 0, 5000, 5] } }),
    partie(2, { faits: { '7×8': [1, 0, 3000, 1], '7×7': [2, 0, 2000, 2] } }),
  ]);

  it('cumule les faits de plusieurs parties', () => {
    expect(fs.get('7×8')).toEqual({ a: 7, b: 8, justes: 2, rates: 3, ms: 7000, n: 2 });
  });

  it('classe la maîtrise', () => {
    expect(maitrise(undefined)).toBe('inconnu');
    expect(maitrise(fs.get('7×8'))).toBe('a-revoir');
    expect(maitrise(fs.get('2×5'))).toBe('maitrise');
    expect(maitrise(fs.get('7×7'))).toBe('acquis');
    expect(maitrise({ a: 3, b: 4, justes: 1, rates: 0, ms: 0, n: 0 })).toBe('en-cours');
  });

  it('bilan par table : 7 × 7 compté une fois', () => {
    const [sept] = parTable(fs, [7]);
    expect(sept.justes).toBe(4);
    expect(sept.rates).toBe(3);
    expect(sept.n).toBe(4);
  });

  it('à revoir et points forts', () => {
    expect(aReviser(fs).map((f) => `${f.a}×${f.b}`)).toEqual(['7×8']);
    expect(pointsForts(fs).map((f) => `${f.a}×${f.b}`)).toEqual(['2×5']);
  });

  it('progrès de la semaine sur la table de 7', () => {
    const lent = { '7×8': [4, 1, 20000, 4] as Fait, '6×7': [5, 0, 25000, 5] as Fait };
    const vite = { '7×8': [5, 0, 10000, 5] as Fait, '6×7': [5, 0, 10000, 5] as Fait };
    const rs = [partie(10, { faits: lent }), partie(20, { faits: vite })];
    const [p] = progresTables(rs, new Date(jour(15)));
    expect(p.table).toBe(7);
    expect(p.plusRapide).toBe(true);
    const m = synthese(rs, new Date(jour(21)));
    expect(m[0].texte).toMatch(/^Cette semaine, tu as amélioré ta rapidité sur la table de 7/);
  });
});

describe('fréquentation et synthèse', () => {
  it('minutes de jeu par jour et par jeu', () => {
    const f = frequentation([partie(28, { actif: 90 }), partie(28, { actif: 30 }), ancienne(28)], new Date(jour(29)), 7);
    expect(f.jours).toHaveLength(7);
    expect(f.parJeu.neon![5]).toBe(2);
    expect(f.parJeu.dragon![5]).toBe(1.5);
  });

  it('semaine', () => {
    expect(semaine([partie(28), partie(27), partie(10)], new Date(jour(29)))).toEqual({ parties: 2, secondes: 200, jours: 2 });
  });

  it('pas de verdict sans assez de parties, et on dit combien il en manque', () => {
    const m = synthese([partie(1), partie(2)], new Date(jour(3)));
    expect(m.some((x) => x.ton === 'bravo')).toBe(false);
    expect(m.at(-1)!.texte).toMatch(/^Encore 4 parties de Neon Flight/);
    expect(synthese([])).toEqual([]);
  });

  it('progrès justifié dans un jeu', () => {
    const p = [0.6, 0.6, 0.65, 0.9, 0.95, 0.9].map((x, i) => partie(i + 1, { justes: Math.round(x * 20), fausses: 20 - Math.round(x * 20) }));
    const m = synthese(p, new Date(jour(30)));
    expect(m.some((x) => x.texte.startsWith('Tu progresses à Neon Flight !'))).toBe(true);
  });
});
