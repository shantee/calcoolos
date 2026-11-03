import { describe, expect, it } from 'vitest';
import {
  CALCULS_AVANT_PLATEAU,
  EXEMPLES,
  GRILLE,
  OPERATIONS,
  PART_PLATEAU,
  TirageCalculs,
  tempsDeReflexion,
  tirerCalcul,
  type Calcul,
  type Palier,
} from '../src/core/calculs';
import { NIVEAUX, type TierId } from '../src/core/difficulty';
import { createRng } from '../src/core/rng';
import { EXEMPLES_PAR_JEU } from '../src/platform/niveau';
import { lire } from './outils-calculs';

const PALIERS: Palier[] = [1, 2, 3];
/** Plus grand nombre affiché, par niveau (CP : nombres jusqu'à 100). */
const NOMBRE_MAX: Record<TierId, number> = { cp: 100, ce1: 999, ce2: 999, cm1: 999, cm2: 999, aventurier: 999 };

function verifier(c: Calcul, niveau: TierId): void {
  const l = lire(c.text);
  expect(l.valeur, c.text).toBe(c.answer);
  expect(c.answer, c.text).toBeGreaterThanOrEqual(1);
  expect(c.answer, c.text).toBeLessThanOrEqual(999);
  for (const op of l.operations) expect(OPERATIONS[niveau], `${niveau} : ${c.text}`).toContain(op);
  for (const n of l.nombres) expect(n, `${niveau} : ${c.text}`).toBeLessThanOrEqual(NOMBRE_MAX[niveau]);
  expect(l.operations.length, c.text).toBe(c.ops);
}

describe('grille commune : 20 000 calculs par niveau et par palier', () => {
  for (const niveau of NIVEAUX) {
    it(`${niveau} : calculs justes, entiers de 1 à 999, opérations du niveau, toutes les familles présentes`, () => {
      const rng = createRng(niveau.length * 101 + 7);
      const familles = new Set<string>();
      const textes = new Set<string>();
      for (const palier of PALIERS) {
        for (let k = 0; k < 20_000; k++) {
          const c = tirerCalcul(niveau, palier, rng);
          expect(c.famille).not.toBe('secours');
          expect(c.palier).toBe(palier);
          verifier(c, niveau);
          familles.add(c.famille);
          textes.add(c.text);
        }
      }
      expect([...familles].sort()).toEqual(GRILLE[niveau].map((f) => f.nom).sort());
      // L'exemple montré dans la fenêtre de choix est un vrai calcul du niveau.
      expect(textes.has(EXEMPLES[niveau]), EXEMPLES[niveau]).toBe(true);
      expect(textes.has(EXEMPLES_PAR_JEU.calcul[niveau].exemple), EXEMPLES_PAR_JEU.calcul[niveau].exemple).toBe(true);
    });
  }

  it('CP : additions et soustractions seulement ; CE1 : pas encore de division', () => {
    const rng = createRng(3);
    for (let k = 0; k < 5000; k++) {
      for (const p of PALIERS) {
        expect(lire(tirerCalcul('cp', p, rng).text).operations.every((o) => o === '+' || o === '−')).toBe(true);
        expect(lire(tirerCalcul('ce1', p, rng).text).operations).not.toContain('÷');
      }
    }
  });

  it('chaque niveau pose ses quatre opérations dès le CE2, et un calcul en plusieurs étapes dès le CM1', () => {
    const rng = createRng(5);
    for (const niveau of ['ce2', 'cm1', 'cm2', 'aventurier'] as TierId[]) {
      const vues = new Set<string>();
      let etapes = 0;
      for (let k = 0; k < 6000; k++) {
        const c = tirerCalcul(niveau, PALIERS[k % 3], rng);
        for (const o of lire(c.text).operations) vues.add(o);
        if (c.ops > 1) etapes++;
      }
      expect([...vues].sort()).toEqual(['+', '×', '÷', '−'].sort());
      if (niveau !== 'ce2') expect(etapes).toBeGreaterThan(0);
    }
  });

  it('la difficulté croît d’un niveau à l’autre (effort moyen aux paliers 2 et 3)', () => {
    for (const palier of [2, 3] as Palier[]) {
      const m = NIVEAUX.map((n) => {
        const rng = createRng(9);
        let s = 0;
        for (let k = 0; k < 4000; k++) s += tirerCalcul(n, palier, rng).effort;
        return s / 4000;
      });
      for (let i = 1; i < m.length; i++) expect(m[i], `palier ${palier} : ${NIVEAUX[i]} après ${NIVEAUX[i - 1]}`).toBeGreaterThan(m[i - 1]);
    }
  });

  it('un calcul refusé (réponse déjà à l’écran) n’est pas reposé', () => {
    const rng = createRng(13);
    for (let k = 0; k < 2000; k++) expect(tirerCalcul('ce2', 1, rng, (c) => c.answer % 2 === 0).answer % 2).toBe(1);
  });
});

describe('progression dans une partie', () => {
  for (const niveau of NIVEAUX) {
    it(`${niveau} : une longue partie (600 calculs) monte vers un plateau sans dépasser le niveau`, () => {
      const t = new TirageCalculs(niveau, createRng(niveau.length * 17));
      const paliers: Palier[] = [];
      const textes: string[] = [];
      for (let k = 0; k < 600; k++) {
        const c = t.suivant();
        verifier(c, niveau);
        t.resultat(true);
        paliers.push(c.palier);
        textes.push(c.text);
      }
      // On entre doucement : pas de découverte (palier 3) dans les premiers calculs.
      expect(paliers.slice(0, 4)).not.toContain(3);
      // Après un calcul de découverte, on souffle.
      for (let k = 1; k < paliers.length; k++) if (paliers[k - 1] === 3) expect(paliers[k]).not.toBe(3);
      // Pas deux fois le même calcul parmi les six derniers.
      for (let k = 0; k < textes.length; k++) expect(textes.slice(Math.max(0, k - 6), k)).not.toContain(textes[k]);
      // Le plateau tient : la fin de partie n'est pas plus dure que son milieu.
      const part3 = (xs: Palier[]) => xs.filter((p) => p === 3).length / xs.length;
      const milieu = part3(paliers.slice(CALCULS_AVANT_PLATEAU, 300));
      const fin = part3(paliers.slice(300));
      expect(Math.abs(fin - milieu)).toBeLessThan(0.08);
      expect(fin).toBeLessThanOrEqual(PART_PLATEAU[3] + 0.05);
      expect(fin).toBeGreaterThan(0.08);
    });
  }

  it('après des erreurs, le tirage recule (moins de calculs de découverte)', () => {
    const compte = (juste: (k: number) => boolean) => {
      const t = new TirageCalculs('cm1', createRng(21));
      let n3 = 0;
      for (let k = 0; k < 800; k++) {
        if (t.suivant().palier === 3 && k > CALCULS_AVANT_PLATEAU) n3++;
        t.resultat(juste(k));
      }
      return n3;
    };
    expect(compte((k) => k % 2 === 0)).toBeLessThan(compte(() => true) * 0.6);
  });

  it('temps de réflexion : plus large pour les petits et pour les calculs longs, toujours raisonnable', () => {
    const rng = createRng(4);
    for (const niveau of NIVEAUX) {
      for (let k = 0; k < 3000; k++) {
        const c = tirerCalcul(niveau, PALIERS[k % 3], rng);
        const s = tempsDeReflexion(c, niveau);
        expect(s).toBeGreaterThanOrEqual(3);
        expect(s).toBeLessThanOrEqual(20);
      }
    }
    const simple = tirerCalcul('cp', 1, createRng(1));
    expect(tempsDeReflexion(simple, 'cp')).toBeGreaterThan(tempsDeReflexion({ ...simple }, 'aventurier'));
  });
});
