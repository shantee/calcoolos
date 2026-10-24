/**
 * Joue une partie complète de « Cubes de siège » dans Chromium et prend des captures.
 * Usage : node scripts/partie-auto.mjs [urlDeBase] [dossier] [mode] [niveau]
 * Vérifie aussi l'absence d'erreur de console et de fichier manquant.
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
const mode = process.argv[4] ?? 'tranquille';
const niveau = process.argv[5] ?? 'explorateur';
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
  await page.screenshot({ path: `${out}/jeu-${name}.png` });
  console.log('capture :', `${out}/jeu-${name}.png`);
};

await page.goto(`${base}/jeu/cubes-de-siege.html?niveau=${niveau}&graine=18`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__siege !== undefined, null, { timeout: 15000 });
await page.waitForTimeout(1200);
await shot('1-intro');
await page.evaluate((m) => window.__siege.start(m), mode);

const ready = () =>
  page.waitForFunction(() => {
    const s = window.__siege.session();
    return window.__siege.overlay() || (s && s.enemyHp > 0 && !window.__siege.busy());
  }, null, { timeout: 30000 });

let shots = 0;
let firstMissDone = false;
const t0 = Date.now();
for (;;) {
  await ready();
  if (await page.evaluate(() => window.__siege.overlay())) break;
  // Laisse le monstre entrer avant la première capture.
  if (shots === 0) {
    await page.waitForTimeout(1600);
    await shot('2-vague');
  }
  if (!firstMissDone && shots === 1) {
    // Une erreur volontaire pour voir le retour sans indice.
    await page.evaluate(() => {
      const r = window.__siege.session().round;
      const sol = new Set(r.puzzle.solution);
      const idx = r.cubes.findIndex((_, i) => !sol.has(i));
      window.__siege.select(idx);
      window.__siege.validate();
    });
    await page.waitForTimeout(350);
    await shot('4-erreur');
    await page.keyboard.press('Escape');
    firstMissDone = true;
  }
  await page.evaluate(() => window.__siege.solve());
  if (shots === 0) {
    await page.waitForTimeout(300);
    await shot('3-selection');
  }
  await page.evaluate(() => window.__siege.validate());
  shots++;
  const kind = await page.evaluate(() => window.__siege.session().enemy?.kind);
  if (kind === 'carapacon' && !problems.includes('cap')) {
    await page.waitForTimeout(700);
    await shot('5-carapacon');
    problems.push('cap');
  }
  if (kind === 'roi' && !problems.includes('roi')) {
    await page.waitForTimeout(700);
    await shot('6-roi');
    problems.push('roi');
  }
}
await page.waitForTimeout(900);
await shot('7-fin');
const summary = await page.evaluate(() => {
  const s = window.__siege.session();
  return { phase: s.phase, score: s.score, vaincus: s.stats.defeated, tirs: s.stats.hits, parfaits: s.stats.perfects };
});
console.log('partie :', JSON.stringify(summary), `en ${Math.round((Date.now() - t0) / 1000)} s`);
await browser.close();
const real = problems.filter((p) => p !== 'cap' && p !== 'roi');
if (real.length) {
  console.log('\nProblèmes relevés :');
  for (const p of real) console.log(' -', p);
  process.exitCode = 1;
} else {
  console.log('Aucune erreur de console ni de chargement.');
}
