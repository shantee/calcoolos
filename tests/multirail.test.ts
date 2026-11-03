import { describe, expect, it } from 'vitest';
import { QuestionDeck, SERIES, factDifficulty, factPool, factsDuNiveau, mulberry32, seriesOf, starsFor, tablesDuNiveau, TIER_SPEED, type Fact } from '../src/game/multirail/model';
import type { TierId } from '../src/core/difficulty';
import { ZenDeck, ZEN_LEVELS } from '../src/game/multirail/zen';
import { OPERATIONS } from '../src/core/calculs';
import { lire } from './outils-calculs';
import { NIVEAUX } from '../src/platform/niveau';

describe('MULTIRAIL dans Calcoolos', () => {
  it('chaque niveau de Calcoolos a sa vitesse et son niveau Zen', () => {
    for (const n of NIVEAUX) {
      expect(TIER_SPEED[n]).toBeTruthy();
      expect(ZEN_LEVELS[n]).toBeTruthy();
    }
  });

  it('séries de tables classées, tables au choix hors classement', () => {
    expect(seriesOf([2, 3, 4, 5])).toBe('petites');
    expect(seriesOf([1, 2, 3, 4, 5])).toBe('petites');
    expect(seriesOf([6, 7, 8, 9])).toBe('grandes');
    expect(seriesOf([2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe('toutes');
    expect(seriesOf([7, 8])).toBe('perso');
  });

  it('étoiles selon les régions traversées', () => {
    expect(starsFor(1)).toBe(0);
    expect(starsFor(2)).toBe(1);
    expect(starsFor(7)).toBe(3);
  });

  it('Voyage Zen du CP au CM2 : les calculs de la grille commune, justes, ≤ 999, avec un temps généreux', () => {
    for (const n of NIVEAUX.filter((x) => x !== 'aventurier')) {
      const deck = new ZenDeck(n, mulberry32(11));
      for (let k = 0; k < 1500; k++) {
        const p = deck.next();
        expect(lire(p.text).valeur, p.text).toBe(p.answer);
        for (const op of lire(p.text).operations) expect(OPERATIONS[n]).toContain(op);
        expect(Number.isInteger(p.answer) && p.answer >= 1 && p.answer <= 999).toBe(true);
        expect(p.think).toBeGreaterThanOrEqual(6);
        expect(p.think).toBeLessThanOrEqual(30);
        expect(p.tier).toBeGreaterThanOrEqual(1);
        expect(p.tier).toBeLessThanOrEqual(5);
        if (p.fait) expect(p.fait.a).toBeGreaterThan(0);
        deck.record(true, false);
      }
    }
  });
});

describe('difficulté des calculs selon le niveau', () => {
  const pose = (niveau: TierId, tables: number[], n = 200): Fact[] => {
    const deck = new QuestionDeck(tables, mulberry32(7), {}, 3, niveau);
    return Array.from({ length: n }, () => deck.next(0));
  };
  const toutes = [2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('Aventurier : jamais de 2 × 2, ni de × 1, × 2 ou × 10, dès le premier calcul, mais des × 5 pour respirer', () => {
    const explosif = pose('aventurier', toutes);
    for (const f of explosif) for (const n of [f.a, f.b]) expect([1, 2, 10]).not.toContain(n);
    expect(factsDuNiveau(toutes.flatMap((t) => factPool([t])), 'aventurier').some((f) => f.a === 5 || f.b === 5)).toBe(true);
  });

  it('Explosif commence par des calculs plus durs que Doux', () => {
    const moyenne = (faits: Fact[]) => faits.reduce((t, f) => t + factDifficulty(f.a, f.b), 0) / faits.length;
    expect(moyenne(pose('aventurier', toutes, 10))).toBeGreaterThan(moyenne(pose('cp', toutes, 10)) + 0.2);
  });

  it('dès le CE2, plus de × 1 ; au CP il peut en rester', () => {
    expect(pose('ce2', toutes).some((f) => f.a === 1 || f.b === 1)).toBe(false);
    expect(pose('cp', toutes).some((f) => f.a === 1 || f.b === 1)).toBe(true);
  });

  it('des tables choisies à la main restent respectées, même en Aventurier', () => {
    const faits = pose('aventurier', [2], 40);
    expect(faits.every((f) => f.a === 2 || f.b === 2)).toBe(true);
    expect(faits.some((f) => f.a === 1 || f.b === 1)).toBe(false);
    expect(factsDuNiveau(factPool([1]), 'aventurier').length).toBeGreaterThan(0);
  });

  it('chaque niveau garde ses tables : le CP ne laisse pas ses tables à l’Aventurier', () => {
    expect(tablesDuNiveau({ cp: [2, 3] }, 'aventurier')).toEqual([...SERIES.toutes.tables]);
    expect(tablesDuNiveau({ aventurier: [7, 8] }, 'aventurier')).toEqual([7, 8]);
    expect(tablesDuNiveau(undefined, 'cp')).toEqual([...SERIES.petites.tables]);
  });
});

it('un fait raté passe avant les calculs à trois nombres', () => {
  const deck = new QuestionDeck([7], () => 0.5, {}, 3, 'aventurier');
  expect(deck.reposePrevue).toBe(false);
  deck.scheduleRetry({ a: 7, b: 8 });
  expect(deck.reposePrevue).toBe(true);
  for (let i = 0; i < 4; i++) deck.next(0);
  expect(deck.reposePrevue).toBe(false);
});
