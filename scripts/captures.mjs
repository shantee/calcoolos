/**
 * Captures réelles des prototypes dans Chromium (Playwright).
 * Usage : node scripts/captures.mjs [urlDeBase] [dossierDeSortie]
 * Le serveur (npm run dev ou npm run preview) doit tourner.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright n'est pas une dépendance du projet : on prend celui de la machine
// (installation globale ou NODE_PATH), pour ne pas télécharger un navigateur de plus.
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
const only = process.env.CAPTURE_ONLY; // ex. "a" pour une seule variante
mkdirSync(out, { recursive: true });

const sizes = [
  { name: 'bureau', width: 1440, height: 900 },
  { name: 'tablette', width: 1024, height: 768 },
];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];

async function shoot(page, file) {
  await page.screenshot({ path: `${out}/${file}.png` });
  console.log('capture :', `${out}/${file}.png`);
}

// Page d'accueil.
for (const size of sizes) {
  if (only) break;
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  page.on('pageerror', (e) => problems.push(`[accueil/${size.name}] erreur : ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`[accueil/${size.name}] échec de chargement : ${r.url()}`));
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await shoot(page, `accueil-${size.name}`);
  await page.close();
}

for (const v of ['a', 'b']) {
  if (only && only !== v) continue;
  for (const size of sizes) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${v}/${size.name}] console ${m.type()} : ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`[${v}/${size.name}] erreur : ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`[${v}/${size.name}] échec de chargement : ${r.url()}`));
    await page.goto(`${base}/prototypes/${v}.html?graine=18`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__siege !== undefined, null, { timeout: 15000 });
    await page.waitForTimeout(2500);
    await shoot(page, `proto-${v}-${size.name}-1-depart`);
    if (size.name !== 'bureau') {
      await page.close();
      continue;
    }
    // Sélection de la solution optimale (comme le ferait un joueur).
    await page.evaluate(() => window.__siege.solve());
    await page.waitForTimeout(400);
    await shoot(page, `proto-${v}-${size.name}-2-selection`);
    await page.evaluate(() => window.__siege.validate());
    await page.waitForTimeout(470);
    await shoot(page, `proto-${v}-${size.name}-3-tir`);
    await page.waitForTimeout(260);
    await shoot(page, `proto-${v}-${size.name}-4-impact`);
    await page.waitForFunction(() => !window.__siege.busy(), null, { timeout: 10000 });
    // Une erreur volontaire pour voir le retour bienveillant.
    await page.evaluate(() => {
      const r = window.__siege.round;
      const order = r.cubes.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
      let sum = 0;
      for (const [val, i] of order) {
        if (sum + val < r.target) {
          window.__siege.select(i);
          sum += val;
        }
        if (r.selected.length >= 2) break;
      }
      window.__siege.validate();
    });
    await page.waitForTimeout(300);
    await shoot(page, `proto-${v}-${size.name}-5-erreur`);
    await page.close();
  }
}

await browser.close();
if (problems.length) {
  console.log('\nProblèmes relevés :');
  for (const p of problems) console.log(' -', p);
  process.exitCode = 1;
} else {
  console.log('\nAucune erreur de console ni de chargement.');
}
