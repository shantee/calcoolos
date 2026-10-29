/** Neon Flight : logique du vol (tests repris du projet autonome, adaptés aux niveaux de Calcoolos). */
import { assert, test } from "vitest";
import { Flight, defaults, seriesOf, starsFor } from "../src/game/neon/model";
import { hitsRoof } from "../src/game/neon/collision";
function game() {
  const f = new Flight({ ...defaults, difficulty: "eveil", tables: [7] }, () => 0.1);
  f.start();
  return f;
}
test("multiplications justes, variété et table sélectionnée", () => {
  const f = game();
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    assert.equal(f.a, 7);
    assert.ok(f.b >= 2 && f.b <= 10, "jamais × 1");
    seen.add(f.b);
    assert.equal(f.answer(f.a * f.b), true);
    f.tick(1);
  }
  assert.ok(seen.size >= 6);
  assert.equal(f.correct, 100);
  assert.equal(f.total, 100);
  assert.ok(f.targetAltitude <= 155);
  assert.ok(f.limit >= 16 * 0.65);
});
test("une erreur : nouveau calcul tout de suite, correction affichée, retour plus tard", () => {
  const f = game(),
    b = f.b;
  assert.equal(f.answer(-1), false);
  assert.equal(f.targetAltitude, 85);
  assert.equal(f.correction, `7 × ${b} = ${7 * b}`);
  assert.ok(f.correctionTime > 0);
  assert.notEqual(f.b, b, "le calcul change immédiatement");
  assert.equal(f.cooldown, 0, "on peut répondre au nouveau calcul sans attendre");
  f.answer(f.a * f.b);
  f.tick(1);
  f.answer(f.a * f.b);
  f.tick(1);
  assert.equal(f.b, b, "l’opération manquée revient après deux autres");
});
test("délai expiré : une seule erreur et nouveau calcul", () => {
  const f = game(),
    b = f.b;
  f.tick(16);
  assert.equal(f.total, 1);
  assert.equal(f.correct, 0);
  assert.equal(f.result, "bad");
  assert.notEqual(f.b, b);
  assert.ok(f.remaining > 0);
  assert.equal(f.answer(f.a * f.b), true);
});
test("validation au-delà du délai ne peut être une réussite", () => {
  const f = game();
  f.remaining = 0;
  assert.equal(f.answer(f.a * f.b), false);
});
test("combos : multiplicateur ×2 à 3 réussites, ×3 à 6, plafonné à ×6", () => {
  const f = game();
  const mult: number[] = [];
  for (let i = 0; i < 18; i++) {
    f.tick(3);
    f.answer(f.a * f.b);
    mult.push(f.multiplier);
    if (i === 2) assert.equal(f.feedback, "COMBO ×2 !");
    f.tick(1);
  }
  assert.deepEqual(mult.slice(0, 7), [1, 1, 2, 2, 2, 3, 3]);
  assert.equal(f.multiplier, 6);
  assert.equal(f.longest, 18);
});
test("réponses éclair : bonus ×1,5 et mode arc-en-ciel après 3 éclairs", () => {
  const f = game();
  f.tick(1);
  f.answer(f.a * f.b);
  assert.equal(f.rating, "flash");
  assert.equal(f.gain, Math.round((100 + (100 * 15) / 16) * 1.5 / 10) * 10);
  for (let i = 0; i < 2; i++) {
    f.tick(1);
    f.tick(1);
    f.answer(f.a * f.b);
  }
  assert.equal(f.feedback, "MODE ARC-EN-CIEL !");
  assert.equal(f.boost, 6);
  const alt = f.targetAltitude;
  f.tick(1);
  f.tick(3);
  assert.equal(f.targetAltitude, alt, "pas de chute en mode arc-en-ciel");
  const before = f.score;
  f.answer(f.a * f.b);
  assert.ok(f.gain >= 2 * 3 * 100, "points doublés en mode arc-en-ciel");
  assert.equal(f.score, before + f.gain);
});
test("sans réponse, l’appareil descend progressivement", () => {
  const f = game();
  const heights: number[] = [];
  for (let i = 0; i < 13; i++) {
    f.tick(1);
    heights.push(f.altitude);
  }
  for (let i = 1; i < heights.length; i++) {
    assert.ok(heights[i] < heights[i - 1], "descente continue");
    assert.ok(heights[i - 1] - heights[i] < 3, "pas de chute brutale");
  }
  assert.ok(f.vario < 0);
  // 22 m perdus par question entière (16 s en Éveil) : 100 − 22 × 13 / 16 ≈ 82,1 m.
  assert.ok(f.targetAltitude < 83 && f.targetAltitude > 81);
});
test("pause et crash bloquent les réponses et le chronomètre", () => {
  const f = game();
  f.pause();
  f.tick(100);
  assert.equal(f.elapsed, 0);
  assert.equal(f.answer(f.a * f.b), false);
  f.pause();
  assert.equal(f.state, "playing");
  f.crash();
  assert.equal(f.state, "crashing");
  f.tick(10);
  assert.equal(f.total, 0);
  f.start();
  assert.equal(f.state, "playing");
  assert.equal(f.altitude, 100);
});
test("entraînement : temps long, altitude protégée et pas de crash", () => {
  const f = new Flight({ ...defaults, mode: "training" });
  f.start();
  for (let i = 0; i < 10; i++) {
    f.answer(-1);
    f.tick(1);
  }
  assert.equal(f.limit, 30);
  assert.equal(f.targetAltitude, 75);
  f.crash();
  assert.equal(f.state, "playing");
});
test("une réponse rapide rapporte plus et limite la descente", () => {
  const a = game(),
    b = game();
  b.tick(10);
  a.answer(a.a * a.b);
  b.answer(b.a * b.b);
  assert.ok(a.score > b.score);
  assert.ok(b.combo === 0 && b.result === "good", "réponse lente : juste mais pas de combo");
  assert.ok(a.targetAltitude > b.targetAltitude, "répondre vite limite la chute");
});
test("le voyage : forêt, pâturages, village, petite ville, grande ville, mégapole et ses zones", async () => {
  const { placeAt, dangerAltitude, ZONE_LENGTH, STAGES } = await import("../src/game/neon/stages");
  assert.equal(placeAt(0).stage.id, "forest");
  assert.deepEqual(STAGES.map((s) => s.id), ["forest", "fields", "village", "town", "city", "mega"]);
  for (let i = 1; i < STAGES.length; i++) assert.ok(STAGES[i].from > STAGES[i - 1].from && STAGES[i].roof >= STAGES[i - 1].roof - 2);
  const mega = STAGES[5].from;
  assert.equal(placeAt(mega).zone?.id, "ocean");
  assert.equal(placeAt(mega + ZONE_LENGTH).zone?.id, "jardin");
  assert.equal(placeAt(mega + 6 * ZONE_LENGTH).zone?.id, "ocean", "les zones bouclent");
  assert.notEqual(placeAt(mega).key, placeAt(mega + ZONE_LENGTH).key);
  assert.ok(dangerAltitude(0) < dangerAltitude(mega), "plus haut en ville");
});
test("combo : seulement les réponses en moins de 3,5 s ; une réponse lente le remet à zéro", () => {
  const f = game();
  for (let i = 0; i < 4; i++) {
    f.tick(3);
    f.answer(f.a * f.b);
    f.tick(1);
  }
  assert.equal(f.combo, 4);
  assert.equal(f.multiplier, 2);
  f.tick(4);
  assert.equal(f.answer(f.a * f.b), true);
  assert.equal(f.combo, 0);
  assert.equal(f.multiplier, 1);
  assert.equal(f.feedback, "Juste ! Plus vite pour le combo");
});
const roof = { z: 120, height: 54, depth: 38 };
test("collision : rien au-dessus du toit, contact au bord, image sautée", () => {
  assert.equal(hitsRoof(-100, -110, roof, 70), false);
  assert.equal(hitsRoof(-90, -94, roof, 55), true);
  assert.equal(hitsRoof(-90, -94, roof, 58), false);
  assert.equal(hitsRoof(0, -200, roof, 30), true);
});
test("séries de tables : classées seulement si elles sont exactement une série officielle", () => {
  assert.equal(seriesOf([5, 4, 3, 2]), "petites");
  assert.equal(seriesOf([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), "expert");
  assert.equal(seriesOf([7]), "perso");
  assert.equal(seriesOf([2, 3, 4]), "perso");
});
test("étoiles du voyage : village, grande ville, mégapole", () => {
  assert.deepEqual([0, 2599, 2600, 6600, 9400, 20000].map(starsFor), [0, 0, 1, 2, 3, 3]);
});
test("relevé : chaque réponse compte, avec son temps et son fait", () => {
  const f = game();
  f.tick(2);
  const a = f.a, b = f.b;
  f.answer(a * b);
  f.tick(1);
  f.answer(-1);
  f.remaining = 0.001;
  f.tick(0.01); // temps écoulé : compté faux, sans temps de réponse
  const m = f.releve.mesures();
  assert.equal(m.calculs, 3);
  assert.equal(m.justes, 1);
  assert.equal(m.fausses, 2);
  assert.equal(m.tempsMedian, 2000);
  const cle = a <= b ? `${a}×${b}` : `${b}×${a}`;
  assert.equal(m.faits![cle][0], 1);
  assert.equal(m.faits![cle][2], 2000);
  assert.equal(f.total, 3);
});
