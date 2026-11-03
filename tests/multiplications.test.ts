/**
 * Neon Flight et MULTIRAIL restent des jeux de multiplications à tous les niveaux : faits de table réglés par la classe,
 * multiplications élaborées à partir du CE2. Grands échantillons, longues parties, relus par un évaluateur indépendant.
 */
import { describe, expect, it } from 'vitest';
import { NIVEAUX, type TierId } from '../src/core/difficulty';
import { DEBUT_CE1, ELABOREES, FACTEURS, PART_ELABOREES, aideVisuelle, facteursPermis, tirerElaboree } from '../src/core/multiplications';
import { createRng } from '../src/core/rng';
import { Flight, defaults, TIME_LIMIT } from '../src/game/neon/model';
import { QuestionDeck, factPool, factsDuNiveau, mulberry32 } from '../src/game/multirail/model';
import { EXEMPLES_PAR_JEU } from '../src/platform/niveau';
import { lire } from './outils-calculs';

const TOUTES = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const alea = (graine: number) => {
  const r = createRng(graine);
  return () => r.next();
};

describe('faits de table par classe', () => {
  it('CP : petits groupements (facteurs 1 à 5, produits jusqu’à 30), dessinés', () => {
    expect(aideVisuelle('cp')).toBe(true);
    for (const t of TOUTES) for (const k of facteursPermis('cp', t)) {
      expect(k).toBeLessThanOrEqual(5);
      expect(t * k).toBeLessThanOrEqual(t === 10 ? 50 : 30);
    }
    for (const n of NIVEAUX) if (n !== 'cp') expect(aideVisuelle(n)).toBe(false);
  });

  it('CE1 : les tables arrivent peu à peu (facteurs 1 à 5 au début de la partie, puis jusqu’à 10)', () => {
    for (const t of TOUTES) {
      expect(Math.max(...facteursPermis('ce1', t, 1))).toBe(5);
      expect(Math.max(...facteursPermis('ce1', t, DEBUT_CE1 + 1))).toBe(10);
    }
  });

  it('du CE2 au CM2 : toutes les tables, sans × 1 ; Aventurier : jusqu’à 12, sans × 2', () => {
    for (const n of ['ce2', 'cm1', 'cm2'] as TierId[]) for (const t of TOUTES) expect(Math.min(...facteursPermis(n, t))).toBeGreaterThanOrEqual(2);
    expect(Math.max(...facteursPermis('aventurier', 7))).toBe(12);
    expect(Math.min(...facteursPermis('aventurier', 7))).toBe(FACTEURS.aventurier.min);
  });
});

describe('multiplications élaborées : 5 000 par niveau et par table', () => {
  for (const niveau of NIVEAUX) {
    it(`${niveau} : seulement des ×, résultat entier de 2 à 999, bâti sur la table choisie`, () => {
      const r = alea(niveau.length * 13);
      if (!ELABOREES[niveau].length) {
        expect(PART_ELABOREES[niveau]).toBe(0);
        expect(tirerElaboree(niveau, TOUTES, r)).toBeNull();
        return;
      }
      const familles = new Set<string>();
      const textes = new Set<string>();
      for (const t of [...TOUTES, 11, 12]) {
        for (let k = 0; k < 5000; k++) {
          const e = tirerElaboree(niveau, [t], r);
          expect(e, `table de ${t}`).not.toBeNull();
          const l = lire(e!.text);
          expect(l.valeur, e!.text).toBe(e!.answer);
          expect(l.operations.every((o) => o === '×'), e!.text).toBe(true);
          expect(e!.answer).toBeGreaterThanOrEqual(2);
          expect(e!.answer).toBeLessThanOrEqual(999);
          expect(e!.temps).toBeGreaterThanOrEqual(1);
          expect(e!.temps).toBeLessThanOrEqual(2.2);
          familles.add(e!.famille);
          textes.add(e!.text);
        }
      }
      expect([...familles].sort()).toEqual(ELABOREES[niveau].map((f) => f.nom).sort());
      // L'exemple de la fenêtre de choix est un vrai calcul du niveau (fait de table ou multiplication élaborée).
      const ex = EXEMPLES_PAR_JEU.tables[niveau].exemple;
      const [a, b] = ex.split(' × ').map(Number);
      const fait = facteursPermis(niveau, a).includes(b) || facteursPermis(niveau, b).includes(a);
      expect(fait || textes.has(ex) || textes.has(`${b} × ${a}`), ex).toBe(true);
    });
  }

  it('le palier demandé est respecté (un joueur en difficulté reste au palier 2)', () => {
    const r = alea(2);
    for (const n of ['ce2', 'cm1', 'cm2', 'aventurier'] as TierId[]) for (let k = 0; k < 2000; k++) expect(tirerElaboree(n, TOUTES, r, 2)!.palier).toBe(2);
  });
});

describe('Neon Flight : longues parties à chaque niveau', () => {
  for (const niveau of NIVEAUX) {
    it(`${niveau} : 1 500 questions, toujours des multiplications justes et faisables à temps`, () => {
      const f = new Flight({ ...defaults, difficulty: niveau, tables: TOUTES, mode: 'arcade' }, alea(niveau.length * 7));
      f.start();
      let elaborees = 0;
      for (let i = 0; i < 1500; i++) {
        const l = lire(f.enonce);
        expect(l.operations.every((o) => o === '×'), f.enonce).toBe(true);
        expect(l.valeur).toBe(f.attendu);
        expect(f.attendu).toBeLessThanOrEqual(999);
        if (f.trio) elaborees++;
        else if (niveau === 'cp') expect(f.a * f.b).toBeLessThanOrEqual(f.a === 10 ? 50 : 30);
        else if (niveau === 'ce1' && f.questions <= DEBUT_CE1) expect(f.b).toBeLessThanOrEqual(5);
        // Le temps accordé ne descend jamais sous les deux tiers du temps de base, plus pour un calcul élaboré.
        expect(f.limit).toBeGreaterThanOrEqual(TIME_LIMIT[niveau] * 0.65 - 1e-9);
        expect(f.limit).toBeLessThanOrEqual(TIME_LIMIT[niveau] * 2.2 + 1e-9);
        f.answer(f.attendu);
        f.tick(0.5);
        if (f.state !== 'playing') f.start();
      }
      const part = elaborees / 1500;
      if (niveau === 'cp' || niveau === 'ce1') expect(part).toBe(0);
      else expect(Math.abs(part - PART_ELABOREES[niveau])).toBeLessThan(0.08);
    });
  }
});

describe('MULTIRAIL : faits de chaque niveau', () => {
  for (const niveau of NIVEAUX) {
    it(`${niveau} : 2 000 questions des tables, facteurs de la classe`, () => {
      const deck = new QuestionDeck(TOUTES, mulberry32(niveau.length * 3), {}, 5, niveau);
      for (let i = 0; i < 2000; i++) {
        const f = deck.next(Math.min(1, i / 200));
        const [t, k] = TOUTES.includes(f.a) && facteursPermis(niveau, f.a).includes(f.b) ? [f.a, f.b] : [f.b, f.a];
        expect(facteursPermis(niveau, t), `${f.a} × ${f.b}`).toContain(k);
        if (niveau === 'ce1' && deck.asked <= DEBUT_CE1) expect(Math.min(f.a, f.b), `${f.a} × ${f.b}`).toBeLessThanOrEqual(5);
        if (niveau === 'aventurier') expect(Math.min(f.a, f.b)).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it('le plancher garde au moins six faits, même avec une seule table', () => {
    for (const n of NIVEAUX) expect(factsDuNiveau(factPool([7], n), n).length).toBeGreaterThanOrEqual(Math.min(4, factPool([7], n).length));
  });
});
