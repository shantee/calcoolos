import { describe, expect, it } from 'vitest';
import { BANDES, ExplosifDeck, PALIER_MAX, PLATEAU, TEMPS_MAX, TEMPS_MIN, TEMPS_ZEN, TEXTE_MAX, charge, niveauDuVoyage, poidsDuPalier, tempsAccorde, type CalculExplosif } from '../src/game/multirail/explosif';
import { QuestionDeck, Run, TIER_SPEED, mulberry32 } from '../src/game/multirail/model';
import type { Expr } from '../src/game/multirail/zen';

const TOUTES = [2, 3, 4, 5, 6, 7, 8, 9, 10];
/** une région se traverse en neuf calculs environ */
const CALCULS_PAR_REGION = 9;

/**
 * Relit le texte affiché, sans rien savoir du générateur : c'est lui qui dit si le calcul est juste. Refuse tout ce qui
 * sort des règles : étape négative ou au-delà de 500, division avec reste, × ou ÷ mêlé à autre chose sans parenthèses.
 */
function relire(texte: string): { valeur: number; etapes: number[]; nombres: number[]; ops: string[] } {
  const jetons = texte.match(/\d+|[()+−×÷]/g) ?? [];
  expect(jetons.join('').length).toBe(texte.replace(/\s/g, '').length);
  let i = 0;
  const etapes: number[] = [];
  const nombres: number[] = [];
  const ops: string[] = [];
  const terme = (): number => {
    const j = jetons[i++];
    if (j === '(') {
      const v = suite();
      expect(jetons[i++], texte).toBe(')');
      return v;
    }
    expect(j, texte).toMatch(/^\d+$/);
    nombres.push(Number(j));
    return Number(j);
  };
  const suite = (): number => {
    let v = terme();
    const vus = new Set<string>();
    while (i < jetons.length && jetons[i] !== ')') {
      const op = jetons[i++];
      const b = terme();
      vus.add(op);
      ops.push(op);
      if (op === '+') v += b;
      else if (op === '−') v -= b;
      else if (op === '×') v *= b;
      else {
        expect(v % b, `division exacte dans ${texte}`).toBe(0);
        v /= b;
      }
      etapes.push(v);
    }
    if (vus.has('×') || vus.has('÷')) expect(vus.size, `parenthèses dans ${texte}`).toBe(1);
    return v;
  };
  const valeur = suite();
  expect(i).toBe(jetons.length);
  return { valeur, etapes, nombres, ops };
}

/** une longue partie : la région avance, le joueur réussit ou se trompe selon `juste` */
function voyage(graine: number, n: number, juste: (k: number, rng: () => number) => boolean = () => true, tables = TOUTES): CalculExplosif[] {
  const rng = mulberry32(graine);
  const deck = new ExplosifDeck(mulberry32(graine + 7000), tables);
  return Array.from({ length: n }, (_, k) => {
    const c = deck.next(Math.floor(k / CALCULS_PAR_REGION));
    deck.record(juste(k, rng), k % 3 === 0);
    return c;
  });
}

const moyenne = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const forme = (t: string): string => t.replace(/\d+/g, 'n');
const SIMPLE = /^\d+ [×÷] \d+$/;

describe('MULTIRAIL : les Tables à bord restent des tables à tous les niveaux', () => {
  it("l'Aventurier en Entraînement garde les tables simples (sans × 1 ni × 2)", () => {
    const deck = new QuestionDeck(TOUTES, mulberry32(3), {}, 3, 'aventurier');
    const faits = Array.from({ length: 200 }, () => deck.next(0));
    expect(faits.every((f) => f.a >= 3 && f.b >= 3 && f.a * f.b <= 144)).toBe(true);
  });

  it('le CP garde ses petites multiplications', () => {
    const deck = new QuestionDeck([2, 3, 4, 5], mulberry32(3), {}, 6, 'cp');
    const faits = Array.from({ length: 200 }, () => deck.next(0));
    expect(faits.every((f) => f.a * f.b <= 30)).toBe(true);
    expect(faits.some((f) => f.a * f.b <= 12)).toBe(true);
  });
});

describe('Aventurier, Voyage Zen (calcul mental combiné) : chaque calcul est valide', () => {
  it('100 longues parties : entiers, divisions exactes, parenthèses, rien au-delà de 500', () => {
    let vus = 0;
    for (let g = 1; g <= 100; g++) {
      const joueur = (_: number, r: () => number) => r() > 0.2;
      for (const c of voyage(g, 200, joueur)) {
        const { valeur, etapes, nombres } = relire(c.text);
        expect(valeur, c.text).toBe(c.answer);
        expect(valeur).toBeGreaterThanOrEqual(2);
        for (const v of [...etapes, ...nombres]) {
          expect(Number.isInteger(v) && v >= 0 && v <= 500, c.text).toBe(true);
        }
        expect(nombres, c.text).not.toContain(0);
        expect(c.text.length).toBeLessThanOrEqual(TEXTE_MAX);
        expect(String(c.answer).length).toBeLessThanOrEqual(3);
        vus++;
      }
    }
    expect(vus).toBe(20000);
  });

  it('des tables choisies à la main sont respectées dans les produits, même [2]', () => {
    for (const tables of [[7, 8], [6], [2], [10], [1]]) {
      for (const c of voyage(11, 120, () => true, tables)) {
        const { valeur } = relire(c.text);
        expect(valeur).toBe(c.answer);
        if (tables[0] >= 3 && tables[0] !== 10) {
          for (const m of c.text.matchAll(/(\d+) × (\d+)/g)) {
            const [a, b] = [Number(m[1]), Number(m[2])];
            const hors = a === 25 || b === 25 || a % 10 === 0 || b % 10 === 0 || a === b;
            if (!hors) expect(tables.includes(a) || tables.includes(b), c.text).toBe(true);
          }
        }
      }
    }
  });

  it('le palier correspond à une vraie bande d\'effort', () => {
    const tous = Array.from({ length: 40 }, (_, g) => voyage(g + 1, 200)).flat();
    const dehors = tous.filter((c) => c.effort < BANDES[c.tier][0] - 0.5 || c.effort > BANDES[c.tier][1] + 0.5);
    expect(dehors.length / tous.length).toBeLessThan(0.01);
    for (let p = 2; p <= PALIER_MAX; p++) {
      expect(moyenne(tous.filter((c) => c.tier === p).map((c) => c.effort))).toBeGreaterThan(moyenne(tous.filter((c) => c.tier === p - 1).map((c) => c.effort)));
    }
  });
});

describe('Aventurier, Voyage Zen (calcul mental combiné) : de vrais calculs variés', () => {
  it('jamais de multiplication ou de division isolée', () => {
    for (let g = 1; g <= 100; g++) for (const c of voyage(g, 200)) expect(SIMPLE.test(c.text), c.text).toBe(false);
  });

  it('jamais de simple opération sur deux nombres ronds (240 − 50)', () => {
    for (let g = 1; g <= 100; g++) {
      for (const c of voyage(g, 200)) {
        const m = c.text.match(/^(\d+) [+−] (\d+)$/);
        if (m) expect(Number(m[1]) % 10 === 0 && Number(m[2]) % 10 === 0, c.text).toBe(false);
      }
    }
  });

  it('le dernier filet de sécurité reste un calcul combiné', () => {
    // tables réduites à [1] : le générateur a peu de choix, il doit quand même combiner
    for (const c of voyage(4, 200, () => true, [1])) expect(SIMPLE.test(c.text), c.text).toBe(false);
  });

  it('les calculs combinés sont la règle, ceux à une opération l\'exception', () => {
    const tous = Array.from({ length: 50 }, (_, g) => voyage(g + 1, 200)).flat();
    const seuls = tous.filter((c) => c.ops === 1).length / tous.length;
    expect(seuls).toBeLessThan(0.1);
    expect(seuls).toBeGreaterThan(0.01); // 88 + 77 fait partie du voyage
    expect(tous.filter((c) => c.ops >= 3).length / tous.length).toBeGreaterThan(0.15);
  });

  it('une partie mêle les quatre opérations et au moins 18 formes différentes', () => {
    for (let g = 1; g <= 30; g++) {
      const partie = voyage(g, 150);
      const ops = new Set(partie.flatMap((c) => relire(c.text).ops));
      expect([...ops].sort()).toEqual(['+', '×', '÷', '−'].sort());
      expect(new Set(partie.map((c) => forme(c.text))).size).toBeGreaterThanOrEqual(18);
    }
  });

  it('aucune forme ne domine, aucun calcul ne revient de sitôt', () => {
    const partie = voyage(9, 400);
    const compte = new Map<string, number>();
    for (const c of partie) compte.set(forme(c.text), (compte.get(forme(c.text)) ?? 0) + 1);
    expect(Math.max(...compte.values()) / partie.length).toBeLessThan(0.16);
    partie.forEach((c, k) => {
      const avant = partie.slice(Math.max(0, k - 40), k);
      expect(avant.map((x) => x.text), c.text).not.toContain(c.text);
      if (k) expect(new Set([forme(c.text), forme(partie[k - 1].text)]).size + (c.text === partie[k - 1].text ? -1 : 0)).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Aventurier, Voyage Zen (calcul mental combiné) : progression au fil du voyage', () => {
  const parties = Array.from({ length: 150 }, (_, g) => voyage(g + 1, 270));
  const region = (r: number): CalculExplosif[] => parties.flatMap((p) => p.slice(r * CALCULS_PAR_REGION, (r + 1) * CALCULS_PAR_REGION));

  it('le voyage commence accessible et sans sommet', () => {
    for (const p of parties) {
      expect(p[0].tier).toBeLessThanOrEqual(2);
      for (const c of p.slice(0, CALCULS_PAR_REGION)) expect(c.tier).toBeLessThanOrEqual(3);
    }
  });

  it("l'effort moyen monte de région en région jusqu'au plateau", () => {
    const efforts = [0, 1, 2, 3, 4].map((r) => moyenne(region(r).map((c) => c.effort)));
    for (let r = 1; r < efforts.length; r++) expect(efforts[r]).toBeGreaterThan(efforts[r - 1]);
    expect(efforts[4]).toBeGreaterThan(efforts[0] * 1.5);
  });

  it('la difficulté ne monte pas indéfiniment', () => {
    expect(Math.max(...Array.from({ length: 200 }, (_, r) => niveauDuVoyage(r)))).toBeLessThanOrEqual(PLATEAU + 0.3);
    const milieu = moyenne([4, 5, 6, 7, 8, 9].flatMap((r) => region(r).map((c) => c.effort)));
    const fin = moyenne([24, 25, 26, 27, 28, 29].flatMap((r) => region(r).map((c) => c.effort)));
    expect(Math.abs(fin - milieu) / milieu).toBeLessThan(0.04);
  });

  it('après un calcul compliqué, toujours quelque chose de plus modéré', () => {
    for (const p of parties) {
      p.forEach((c, k) => {
        if (!k) return;
        if (p[k - 1].tier >= 4) expect(c.tier).toBeLessThanOrEqual(p[k - 1].tier - 1);
        if (p[k - 1].tier === PALIER_MAX) expect(c.tier).toBeLessThanOrEqual(3);
      });
    }
  });

  it('il y a de vraies respirations, même très loin dans le voyage', () => {
    const loin = parties.flatMap((p) => p.slice(90));
    expect(loin.filter((c) => c.tier <= 2).length / loin.length).toBeGreaterThan(0.1);
    expect(loin.filter((c) => c.tier >= 4).length / loin.length).toBeGreaterThan(0.25);
    for (const p of parties) {
      for (let k = 90; k + 5 <= p.length; k++) expect(Math.min(...p.slice(k, k + 5).map((c) => c.tier))).toBeLessThanOrEqual(3);
    }
  });

  it('les variations restent naturelles : deux parties ne se ressemblent pas', () => {
    const a = parties[0].map((c) => c.tier).join('');
    const b = parties[1].map((c) => c.tier).join('');
    expect(a).not.toBe(b);
    expect(new Set(parties.map((p) => p.slice(0, 27).map((c) => c.tier).join(''))).size).toBeGreaterThan(100);
  });

  it('le plafond du Grand Pont est respecté', () => {
    const deck = new ExplosifDeck(mulberry32(2), TOUTES);
    for (let k = 0; k < 200; k++) {
      const c = deck.next(9, 3);
      expect(c.tier).toBeLessThanOrEqual(3);
      deck.record(true, true);
    }
  });
});

describe('Aventurier, Voyage Zen (calcul mental combiné) : temps selon la complexité', () => {
  const e = {
    petit: { op: '+', l: { op: '×', l: 3, r: 2 }, r: 12 },
    moyen: { op: '+', l: { op: '×', l: 7, r: 8 }, r: 23 },
    division: { op: '+', l: { op: '÷', l: 144, r: 12 }, r: 87 },
    grand: { op: '+', l: { op: '−', l: 250, r: { op: '×', l: 9, r: 8 } }, r: 17 },
  } satisfies Record<string, Expr>;

  it("l'effort suit la difficulté des exemples de référence", () => {
    expect(charge(e.petit)).toBeLessThan(charge(e.moyen));
    expect(charge(e.moyen)).toBeLessThan(charge(e.division));
    expect(charge(e.division)).toBeLessThan(charge(e.grand));
    expect(tempsAccorde(charge(e.grand))).toBeGreaterThan(tempsAccorde(charge(e.petit)) * 1.8);
  });

  it('un temps raisonnable pour chacun, dans les bornes', () => {
    for (const k of Object.values(e)) expect(tempsAccorde(charge(k))).toBeGreaterThanOrEqual(TEMPS_MIN);
    for (const c of voyage(3, 300)) {
      expect(c.think).toBeGreaterThanOrEqual(TEMPS_MIN);
      expect(c.think).toBeLessThanOrEqual(TEMPS_MAX);
      expect(c.think * 2 % 1).toBe(0);
    }
  });

  it('plus un calcul demande d\'effort, plus il reçoit de temps', () => {
    const tous = Array.from({ length: 30 }, (_, g) => voyage(g + 1, 200)).flat();
    const parPalier = [1, 2, 3, 4, 5].map((p) => moyenne(tous.filter((c) => c.tier === p).map((c) => c.think)));
    for (let p = 1; p < parPalier.length; p++) expect(parPalier[p]).toBeGreaterThan(parPalier[p - 1]);
    expect(parPalier[4]).toBeGreaterThan(parPalier[0] * 1.7);
  });

  it('le danger monte doucement, et le joueur en difficulté reçoit plus de temps', () => {
    expect(tempsAccorde(6, 5)).toBeLessThan(tempsAccorde(6, 0));
    expect(tempsAccorde(6, 5, -1.5)).toBeGreaterThan(tempsAccorde(6, 5));
  });

  it('le Voyage Zen laisse plus de temps à calcul égal', () => {
    const a = new ExplosifDeck(mulberry32(1), TOUTES).next(0);
    const b = new ExplosifDeck(mulberry32(1), TOUTES, TEMPS_ZEN).next(0);
    expect(b.text).toBe(a.text);
    expect(b.think).toBeCloseTo(a.think * TEMPS_ZEN, 0);
  });
});

describe('Aventurier, Voyage Zen (calcul mental combiné) : adaptation au joueur', () => {
  it('après deux erreurs, on souffle vraiment', () => {
    const deck = new ExplosifDeck(mulberry32(8), TOUTES);
    for (let k = 0; k < 40; k++) {
      deck.next(6);
      deck.record(true, true);
    }
    deck.record(false, false);
    deck.record(false, false);
    for (let k = 0; k < 6; k++) expect(deck.next(6).tier).toBeLessThanOrEqual(2);
  });

  it('un joueur qui peine reçoit des calculs plus simples sur tout le voyage', () => {
    const fort = Array.from({ length: 40 }, (_, g) => voyage(g + 1, 200)).flat();
    const peine = Array.from({ length: 40 }, (_, g) => voyage(g + 1, 200, (_k, r) => r() > 0.45)).flat();
    expect(moyenne(peine.map((c) => c.effort))).toBeLessThan(moyenne(fort.map((c) => c.effort)) * 0.85);
  });
});

describe('Aventurier, Voyage Zen (calcul mental combiné) : points et série', () => {
  const rapide = 8;
  it('une réponse juste dans le délai fait progresser la série, même après 3 s', () => {
    const run = new Run('aventure', TIER_SPEED.aventurier);
    expect(run.onCorrect(7, 14, 0, rapide, 1).fast).toBe(true);
    expect(run.combo).toBe(1);
    expect(run.onCorrect(9, 14, 0, rapide, 1).fast).toBe(false);
    expect(run.combo).toBe(0);
  });

  it('un palier élaboré rapporte plus', () => {
    const a = new Run('aventure', TIER_SPEED.aventurier).onCorrect(5, 10, 0, rapide, poidsDuPalier(1)).points;
    const b = new Run('aventure', TIER_SPEED.aventurier).onCorrect(5, 10, 0, rapide, poidsDuPalier(5)).points;
    expect(b).toBeGreaterThan(a);
  });

  it('les autres niveaux gardent leur barème', () => {
    const a = new Run('aventure', TIER_SPEED.ce2).onCorrect(3, 9, 0);
    expect(a.fast).toBe(true);
    expect(a.points).toBe(170);
  });

  it('le maximum par réponse reste sous la borne du serveur (3 000 points)', () => {
    expect(200 * 4 * 2 * poidsDuPalier(PALIER_MAX) + 800).toBeLessThanOrEqual(3000);
  });
});
