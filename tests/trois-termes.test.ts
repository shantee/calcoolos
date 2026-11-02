import { assert, test } from "vitest";
import type { TierId } from "../src/core/difficulty";
import { PART_TROIS_TERMES, poserTroisTermes, tirerTroisTermes } from "../src/core/trois-termes";

const NIVEAUX: TierId[] = ["explorateur", "stratege", "maitre"];

/** Recalcule l'énoncé : les produits d'abord, puis de gauche à droite. */
function calcule(texte: string): number {
  const m = texte.split(" ");
  assert.equal(m.length, 5, texte);
  const nombres = [+m[0], +m[2], +m[4]];
  const ops = [m[1], m[3]];
  for (let i = ops.indexOf("×"); i >= 0; i = ops.indexOf("×")) {
    nombres.splice(i, 2, nombres[i] * nombres[i + 1]);
    ops.splice(i, 1);
  }
  return nombres.slice(1).reduce((v, n, i) => (ops[i] === "+" ? v + n : v - n), nombres[0]);
}

test("le résultat annoncé est juste, positif, et tient au clavier", () => {
  for (const niveau of NIVEAUX) {
    for (let i = 0; i < 5000; i++) {
      const c = tirerTroisTermes(niveau, [3, 4, 6, 7, 8, 9, 12], Math.random);
      assert.equal(calcule(c.text), c.answer, c.text);
      assert.ok(c.answer >= 1 && c.answer <= 999, c.text);
      for (const n of c.text.split(" ").filter((m) => /\d/.test(m))) assert.ok(+n >= 1, c.text);
    }
  }
});

test("toutes les opérations sortent, seules et mélangées", () => {
  const vus = Array.from({ length: 5000 }, () => tirerTroisTermes("maitre", [7, 8, 9], Math.random).text);
  assert.ok(vus.some((t) => /^\d+ \+ \d+ \+ \d+$/.test(t)), "15 + 27 + 22");
  assert.ok(vus.some((t) => /^\d+ × \d+ \+ \d+$/.test(t)), "3 × 8 + 2");
  assert.ok(vus.some((t) => /^\d+ × \d+ − \d+$/.test(t)), "7 × 8 − 5");
  assert.ok(vus.some((t) => /^\d+ \+ \d+ − \d+$/.test(t)), "31 + 18 − 12");
  assert.ok(vus.some((t) => /^\d+ − \d+ × \d+$/.test(t)), "60 − 7 × 8");
  assert.ok(vus.some((t) => /^\d+ × \d+ × \d+$/.test(t)), "2 × 3 × 4");
});

test("les produits viennent des tables de la partie", () => {
  for (let i = 0; i < 2000; i++) {
    const t = tirerTroisTermes("maitre", [7], Math.random).text;
    const produit = t.match(/(\d+) × (\d+)(?! ×)/);
    if (produit && !/× \d+ ×/.test(t)) assert.equal(produit[1], "7", t);
  }
});

test("Relevé garde les formes simples", () => {
  for (let i = 0; i < 2000; i++) {
    const t = tirerTroisTermes("explorateur", [2, 3, 4, 5], Math.random).text;
    assert.ok(/^\d+ × \d+ [+−] \d+$|^\d+ \+ \d+ [+−] \d+$/.test(t), t);
  }
});

test("la part monte avec le niveau, jamais à Doux ni au tout début", () => {
  assert.equal(poserTroisTermes("eveil", 50, () => 0), false);
  assert.equal(poserTroisTermes("maitre", 2, () => 0), false);
  assert.equal(poserTroisTermes("maitre", 3, () => 0), true);
  assert.ok(PART_TROIS_TERMES.explorateur < PART_TROIS_TERMES.stratege);
  assert.ok(PART_TROIS_TERMES.stratege < PART_TROIS_TERMES.maitre);
});
