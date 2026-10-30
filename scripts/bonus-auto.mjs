/**
 * Bonus volants de « Panique au phare ! » dans Chromium, avec captures.
 * Usage : node scripts/bonus-auto.mjs [urlDeBase] [dossier]
 *  1. engins forcés : réponse au clavier (Super Poussée), au doigt sur le pavé (Gel), Méga-tir,
 *     échec (deux erreurs), emplacements pleins, bonus inutilisable ;
 *  2. partie naturelle (tablette) jusqu'à la victoire en répondant aux engins qui passent.
 * Vérifie aussi l'absence d'erreur de console.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    return createRequire(import.meta.url)('playwright');
  }
}
const { chromium } = await loadPlaywright();

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'CAPTURES';
mkdirSync(out, { recursive: true });
const problems = [];
const checks = [];
const check = (ok, what) => {
  checks.push(`${ok ? 'OK ' : 'ÉCHEC'} ${what}`);
  if (!ok) problems.push(what);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 900 }, hasTouch: true });
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`console ${m.type()} : ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`erreur : ${e.message}`));

const shot = async (name) => {
  await page.screenshot({ path: `${out}/bonus-${name}.png` });
  console.log('capture :', `${out}/bonus-${name}.png`);
};
const S = (fn, arg) => page.evaluate(fn, arg);
const bonus = () => S(() => window.__siege.bonus());
/** Coordonnées de la page pour un point de la scène (1280 × 720). */
const toPage = async (p) => {
  const r = await page.locator('canvas').boundingBox();
  return { x: r.x + (p.x * r.width) / 1280, y: r.y + (p.y * r.height) / 720 };
};
const tap = async (p) => {
  const q = await toPage(p);
  await page.touchscreen.tap(q.x, q.y);
};
const enemyReady = () =>
  page.waitForFunction(() => {
    const s = window.__siege.session();
    return s && s.enemyHp > 0 && !window.__siege.busy() && window.__siege.enemyWalking();
  }, null, { timeout: 30000 });
const killEnemy = async () => {
  await enemyReady();
  await S(() => window.__siege.solve());
  await S(() => window.__siege.validate());
  await page.waitForFunction(() => !window.__siege.busy(), null, { timeout: 15000 });
};
const waitFlightGone = () => page.waitForFunction(() => window.__siege.bonus().flight === null, null, { timeout: 15000 });
/** Attend que le bonus soit arrivé dans sa niche (l'icône vole d'abord jusqu'à elle). */
const waitSlot = (i) =>
  page.waitForFunction((k) => {
    const b = window.__siege.bonus();
    return b.slots[k] !== null && !b.arriving.includes(k);
  }, i, { timeout: 15000 });
const keyCode = (d) => `Digit${d}`;
function finish() {
  console.log('\n' + checks.join('\n'));
  if (problems.length) {
    console.log('\nProblèmes relevés :');
    for (const p of problems) console.log(' -', p);
    process.exitCode = 1;
  } else console.log('\nTout est bon, aucune erreur de console.');
}

// --- 1. Engins forcés -------------------------------------------------------------------------
await page.goto(`${base}/jeu/cubes-de-siege.html?niveau=explorateur&graine=18`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__siege !== undefined, null, { timeout: 15000 });
await page.waitForTimeout(800);
await S(() => window.__siege.start('tranquille'));
await enemyReady();
await page.waitForTimeout(500);

// a) Soucoupe, Super Poussée, réponse au clavier.
check(await S(() => window.__siege.forceBonus('poussee')), 'un engin peut passer');
await page.waitForTimeout(900);
await shot('1-soucoupe');
let b = await bonus();
check(b.keypad, 'le pavé du bonus apparaît');
check(await S(() => window.__siege.enemyWalking()), 'le monstre continue d’avancer pendant le passage');
const sel0 = await S(() => window.__siege.session().round.selected.length);
const ans = String(b.flight.expr.answer);
await page.keyboard.press(keyCode(ans[0]));
await page.waitForTimeout(150);
if (ans.length > 1) await shot('1b-saisie');
for (const d of ans.slice(1)) await page.keyboard.press(keyCode(d));
check((await S(() => window.__siege.session().round.selected.length)) === sel0, 'taper le bonus ne touche pas aux cubes');
await page.waitForTimeout(250);
await shot('2-attrape');
await page.waitForTimeout(700);
await shot('3-paquet-tombe');
await page.waitForTimeout(900);
await shot('4-paquet-ouvert');
await waitSlot(0);
await page.waitForTimeout(300);
await shot('5-niche');
check((await bonus()).slots[0] === 'poussee', 'la Super Poussée est rangée dans la niche B');

// Super Poussée trop tôt : refusée, gardée.
let x0 = await S(() => window.__siege.enemyX());
if (x0 > 1060) {
  await page.keyboard.press('KeyB');
  await page.waitForTimeout(200);
  check((await bonus()).slots[0] === 'poussee', 'Super Poussée gardée si le monstre est encore loin');
}
await page.waitForFunction(() => window.__siege.enemyX() < 820, null, { timeout: 40000 });
x0 = await S(() => window.__siege.enemyX());
await shot('6-avant-poussee');
await page.keyboard.press('KeyB');
await page.waitForTimeout(260);
await shot('7-paf');
await page.waitForTimeout(350);
await shot('8-envol');
await page.waitForFunction(() => !window.__siege.bonus().pushing, null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(0);
const x1 = await S(() => window.__siege.enemyX());
check(x1 - x0 > 250, `Super Poussée : le monstre recule de ${Math.round(x1 - x0)} px (${Math.round(x0)} → ${Math.round(x1)})`);
await shot('9-atterri');
await page.waitForTimeout(400);
check(await S(() => window.__siege.enemyWalking()), 'le monstre repart après la Super Poussée');

// b) Dirigeable, Gel, réponse au doigt sur le pavé.
await waitFlightGone();
await S(() => window.__siege.forceBonus('gel'));
await page.waitForTimeout(900);
await shot('10-dirigeable');
b = await bonus();
for (const d of String(b.flight.expr.answer)) {
  await tap(await S((k) => window.__siege.keyPos(k), d));
  await page.waitForTimeout(120);
}
check((await bonus()).caught === 2, 'réponse au doigt sur le pavé acceptée');
await waitSlot(0);
await page.waitForTimeout(400);
await tap(await S(() => window.__siege.slotPos(0)));
await page.waitForTimeout(700);
await shot('11-gel');
b = await bonus();
check(b.frozen, 'le Gel fige le monstre');
const xf = await S(() => window.__siege.enemyX());
await page.waitForTimeout(1500);
check(Math.abs((await S(() => window.__siege.enemyX())) - xf) < 1, 'le monstre gelé n’avance plus');
await page.keyboard.press('KeyB');
await page.waitForTimeout(100);
await page.waitForFunction(() => !window.__siege.bonus().frozen, null, { timeout: 8000 });
await page.waitForTimeout(150);
await shot('12-degel');

// c) Méga-tir.
await waitFlightGone();
await S(() => window.__siege.forceBonus('supertir'));
await page.waitForTimeout(600);
await S(() => window.__siege.answerBonus());
await waitSlot(0);
await page.waitForTimeout(300);
await page.keyboard.press('KeyB');
await page.waitForTimeout(900);
check((await bonus()).charged, 'le Méga-tir charge le prochain tir');
await shot('13-mega-charge');
await enemyReady();
const hp0 = await S(() => window.__siege.session().enemyHp);
await S(() => window.__siege.solve());
await S(() => window.__siege.validate());
await page.waitForTimeout(700);
await shot('14-mega-impact');
await page.waitForFunction(() => !window.__siege.busy(), null, { timeout: 15000 });
check(!(await bonus()).charged, 'le Méga-tir est consommé par le tir');
console.log('PV avant Méga-tir :', hp0);

// d) Échec : deux mauvaises réponses, l'engin repart, rien n'est perdu.
await waitFlightGone();
await S(() => window.__siege.forceBonus());
await page.waitForTimeout(600);
b = await bonus();
const good = String(b.flight.expr.answer);
const bad = good.slice(0, -1) + String((Number(good.at(-1)) + 1) % 10);
const hearts0 = await S(() => window.__siege.session().hearts);
for (const d of bad) await page.keyboard.press(keyCode(d));
await page.waitForTimeout(200);
await shot('15-erreur');
const caught0 = (await bonus()).caught;
for (const d of bad) await page.keyboard.press(keyCode(d));
check((await bonus()).flight?.state === 'escaped', 'deux erreurs : l’engin s’enfuit');
await page.waitForTimeout(500);
await shot('16-nananere');
check((await bonus()).caught === caught0, 'engin enfui : aucun bonus gagné');
check((await S(() => window.__siege.session().hearts)) === hearts0, 'aucune pénalité après un échec');

// e) Emplacements pleins : plus aucun engin.
for (const c of ['poussee', 'gel']) {
  await waitFlightGone();
  await S((k) => window.__siege.forceBonus(k), c);
  await page.waitForTimeout(500);
  await S(() => window.__siege.answerBonus());
  await page.waitForFunction(() => window.__siege.bonus().flight === null, null, { timeout: 15000 });
}
await page.waitForTimeout(1500);
b = await bonus();
check(b.slots[0] && b.slots[1], 'deux bonus rangés');
check(!(await S(() => window.__siege.forceBonus())), 'niches pleines : aucun nouvel engin');
await shot('17-niches-pleines');
await browser.close();

// SEUL1=1 : seulement les engins forcés (plus rapide).
if (process.env.SEUL1) {
  finish();
  process.exit();
}
// --- 2. Partie naturelle (tablette au doigt) --------------------------------------------------
const b2 = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx2 = await b2.newContext({ locale: 'fr-FR', viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const p2 = await ctx2.newPage();
p2.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`console ${m.type()} : ${m.text()}`);
});
p2.on('pageerror', (e) => problems.push(`erreur : ${e.message}`));
await p2.goto(`${base}/jeu/cubes-de-siege.html?niveau=explorateur&graine=31`, { waitUntil: 'networkidle' });
await p2.waitForFunction(() => window.__siege !== undefined, null, { timeout: 15000 });
await p2.evaluate(() => window.__siege.start('tranquille'));
const t0 = Date.now();
let seen = 0;
let used = 0;
for (;;) {
  await p2.waitForFunction(() => {
    const s = window.__siege.session();
    return window.__siege.overlay() || s.phase === 'won' || (s.enemyHp > 0 && !window.__siege.busy() && window.__siege.enemyWalking());
  }, null, { timeout: 40000 });
  const st = await p2.evaluate(() => ({ o: window.__siege.overlay(), ph: window.__siege.session().phase }));
  if (st.o || st.ph === 'won') break;
  // Un enfant met quelques secondes à trouver : laisse le temps aux engins de passer.
  const t = Date.now();
  while (Date.now() - t < 4200) {
    const f = await p2.evaluate(() => window.__siege.bonus().flight);
    if (f && f.state === 'flying') {
      seen++;
      if (seen === 1) await p2.screenshot({ path: `${out}/bonus-20-tablette-passage.png` });
      await p2.waitForTimeout(800);
      await p2.evaluate(() => window.__siege.answerBonus());
    }
    await p2.waitForTimeout(250);
  }
  const bs = await p2.evaluate(() => window.__siege.bonus());
  const i = bs.slots.findIndex((k) => k !== null);
  if (i >= 0 && !bs.pushing && !bs.frozen) {
    await p2.evaluate((k) => window.__siege.usePower(k), i);
    if ((await p2.evaluate(() => window.__siege.bonus())).slots[i] === null) used++;
    await p2.waitForTimeout(1800);
  }
  await p2.waitForFunction(() => !window.__siege.bonus().pushing, null, { timeout: 8000 });
  await p2.evaluate(() => {
    window.__siege.solve();
    window.__siege.validate();
  });
}
await p2.waitForFunction(() => window.__siege.overlay(), null, { timeout: 20000 });
await p2.waitForTimeout(900);
await p2.screenshot({ path: `${out}/bonus-21-tablette-fin.png` });
const fin = await p2.evaluate(() => ({ ...window.__siege.bonus(), phase: window.__siege.session().phase }));
check(fin.phase === 'won', 'partie naturelle gagnée');
check(seen >= 1 && seen <= 2 && fin.launched <= 2, `passages naturels : ${seen} engin(s) vus, ${fin.caught} attrapé(s), ${used} bonus utilisé(s)`);
console.log(`partie naturelle en ${Math.round((Date.now() - t0) / 1000)} s`);
await b2.close();

finish();
