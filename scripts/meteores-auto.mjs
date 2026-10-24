/**
 * Joue une partie de « Pluie de météores » dans Chromium et prend des captures.
 * Usage : node scripts/meteores-auto.mjs [urlDeBase] [dossier] [gagner|perdre] [niveau]
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
const plan = process.argv[4] ?? 'gagner';
const niveau = process.argv[5] ?? 'stratege';
mkdirSync(out, { recursive: true });
const problems = [];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`console ${m.type()} : ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`erreur : ${e.message}`));
page.on('requestfailed', (r) => problems.push(`échec de chargement : ${r.url()}`));
const shot = async (name) => {
  await page.screenshot({ path: `${out}/meteores-${name}.png` });
  console.log('capture :', `${out}/meteores-${name}.png`);
};

await page.goto(`${base}/jeu/pluie-de-meteores.html?niveau=${niveau}&graine=4&accelere=${plan === 'perdre' ? 8 : 3}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__meteores !== undefined, null, { timeout: 15000 });
await page.waitForTimeout(800);
await shot('1-intro');
await page.evaluate(() => window.__meteores.start('defi'));
if (plan === 'gagner') {
  // Les habitants du décor, appelés tout de suite pour la capture.
  await page.evaluate(() => {
    window.__meteores.spawnWhale();
    window.__meteores.spawnDuck();
  });
}
const t0 = Date.now();
const taken = new Set();
while (Date.now() - t0 < 240000) {
  const st = await page.evaluate(() => {
    const s = window.__meteores.session();
    const alive = s.alive.map((m) => ({ kind: m.kind, p: m.p, a: m.expr.answer }));
    return { phase: s.phase, ending: window.__meteores.ending(), overlay: window.__meteores.overlay(), alive, wave: s.wave };
  });
  if (st.overlay && (st.phase !== 'play' || st.ending)) break;
  if (st.ending) {
    if (!taken.has('fin')) {
      taken.add('fin');
      await page.waitForTimeout(plan === 'perdre' ? 2600 : 1500);
      await shot(plan === 'perdre' ? '6-defaite' : '6-victoire');
    }
    await page.waitForTimeout(200);
    continue;
  }
  if (st.alive.length >= 3 && !taken.has('pluie')) {
    taken.add('pluie');
    await shot('2-pluie');
  }
  if (plan === 'gagner') {
    const target = st.alive.sort((a, b) => b.p - a.p)[0];
    if (target && target.p > 0.25) {
      if (target.kind === 'boss' && !taken.has('boss')) {
        taken.add('boss');
        await shot('5-boss');
      }
      if (!taken.has('erreur') && st.wave >= 1) {
        // Une erreur volontaire.
        taken.add('erreur');
        const bad = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].find((d) => !st.alive.some((m) => String(m.a).startsWith(d)));
        await page.evaluate((d) => window.__meteores.type(d), bad);
        await page.waitForTimeout(120);
        await shot('4-erreur');
      }
      const ans = String(target.a);
      if (!taken.has('verrou') && ans.length > 1 && target.kind !== 'boss') {
        // Premier chiffre seul : le viseur verrouille la cible, qui prend peur.
        taken.add('verrou');
        await page.evaluate((d) => window.__meteores.type(d), ans[0]);
        await page.waitForTimeout(250);
        await shot('2b-verrou');
        await page.evaluate((rest) => window.__meteores.type(rest), ans.slice(1));
      } else await page.evaluate((a) => window.__meteores.type(String(a)), target.a);
      if (!taken.has('feu') && (await page.evaluate(() => window.__meteores.session().combo)) >= 8) {
        taken.add('feu');
        await page.waitForTimeout(250);
        await shot('3c-en-feu');
      }
      if (!taken.has('pause') && st.wave >= 2) {
        taken.add('pause');
        await page.evaluate(() => window.__meteores.pause());
        await page.waitForTimeout(300);
        await shot('4b-pause');
        await page.evaluate(() => window.__meteores.resume());
      }
      if (!taken.has('tir')) {
        taken.add('tir');
        await page.waitForTimeout(170);
        await shot('3-tir');
      }
      if (target.kind === 'dore' && !taken.has('dore')) {
        taken.add('dore');
        await page.waitForTimeout(300);
        await shot('3b-onde-de-choc');
      }
    }
  }
  await page.waitForTimeout(80);
}
await page.waitForFunction(() => window.__meteores.overlay(), null, { timeout: 20000 });
await page.waitForTimeout(1800);
await shot(plan === 'perdre' ? '7-fin-defaite' : '7-fin');
const summary = await page.evaluate(() => {
  const s = window.__meteores.session();
  return { phase: s.phase, score: s.score, tirs: s.stats.hits, erreurs: s.stats.errors, impacts: s.stats.impacts };
});
console.log('partie :', JSON.stringify(summary), `en ${Math.round((Date.now() - t0) / 1000)} s`);
await browser.close();
if (problems.length) {
  console.log('Problèmes relevés :');
  for (const p of problems) console.log(' -', p);
  process.exitCode = 1;
} else console.log('Aucune erreur de console ni de chargement.');
