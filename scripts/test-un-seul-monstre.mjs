/**
 * Test de non-régression : jamais deux monstres à l'écran.
 * Mode Défi, monstres accélérés ; on tire au moment où le monstre arrive au phare
 * (situation qui créait autrefois un second monstre). Usage : node scripts/test-un-seul-monstre.mjs [urlDeBase]
 */
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
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ locale: 'fr-FR', viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/jeu/cubes-de-siege.html?graine=5&accelere=5`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__siege !== undefined);
await page.evaluate(() => window.__siege.start('defi'));
let maxSeen = 0;
let shotsNearTower = 0;
const t0 = Date.now();
while (Date.now() - t0 < 60000) {
  const st = await page.evaluate(() => ({
    n: window.__siege.monstres(),
    x: window.__siege.enemyX(),
    busy: window.__siege.busy(),
    phase: window.__siege.session()?.phase,
    over: window.__siege.overlay(),
  }));
  maxSeen = Math.max(maxSeen, st.n);
  if (st.over || st.phase !== 'play') break;
  // Tir déclenché juste avant l'arrivée au phare (x = 640).
  if (!st.busy && st.x !== null && st.x < 700) {
    await page.evaluate(() => {
      window.__siege.solve();
      window.__siege.validate();
    });
    shotsNearTower++;
  }
  await page.waitForTimeout(40);
}
await browser.close();
console.log(`tirs près du phare : ${shotsNearTower}, monstres simultanés au maximum : ${maxSeen}`);
if (maxSeen > 1 || errors.length) {
  console.log('ÉCHEC', errors);
  process.exitCode = 1;
} else console.log('OK : jamais plus d’un monstre à l’écran.');
