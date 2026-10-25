/**
 * Joue une partie de « Décollage ! » dans Chromium et prend des captures.
 * Le pilote automatique répond aux calculs et vise la plateforme suivante,
 * comme un joueur (flèches gauche/droite).
 * Usage : node scripts/fusee-auto.mjs [urlDeBase] [dossier] [gagner|perdre] [niveau]
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
const niveau = process.argv[5] ?? 'explorateur';
mkdirSync(out, { recursive: true });
const problems = [];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`console ${m.type()} : ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`erreur : ${e.message}`));
page.on('requestfailed', (r) => problems.push(`échec de chargement : ${r.url()}`));
const shot = async (name) => {
  await page.screenshot({ path: `${out}/fusee-${name}.png` });
  console.log('capture :', `${out}/fusee-${name}.png`);
};

await page.goto(`${base}/jeu/decollage.html?niveau=${niveau}&graine=12`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__fusee !== undefined, null, { timeout: 15000 });
await page.waitForTimeout(1200);
await shot('1-intro');
await page.evaluate((m) => window.__fusee.start(m), plan === 'perdre' ? 'defi' : 'tranquille');
await page.waitForTimeout(1500);
await shot('2-village');

/** Un pas de pilote : vise la prochaine plateforme, répond quand on est posé. */
const pilot = (answer) =>
  page.evaluate((answer) => {
    const f = window.__fusee;
    const s = f.session();
    if (!s || s.phase !== 'play' || f.rescuing()) return { phase: s?.phase, alt: s?.altitude ?? 0 };
    const safe = s.platforms.find((p) => p.id === s.safe);
    const target = s.platforms.filter((p) => !p.gone && p.y > safe.y).sort((a, b) => a.y - b.y)[0];
    const r = s.rocket;
    if (r.on === null && target) {
      const want = Math.max(-310, Math.min(310, (target.x - r.x) * 3));
      f.steer(Math.abs(want - r.vx) < 25 ? 0 : want > r.vx ? 1 : -1);
    } else f.steer(0);
    if (answer && r.on !== null && s.question && s.question.left < s.question.time - 0.4) f.answer();
    return { phase: s.phase, alt: s.altitude, zone: s.zone, falls: s.stats.falls };
  }, answer);

const shots = new Set();
if (plan === 'gagner') {
  const t0 = Date.now();
  let fellOnce = false;
  while (Date.now() - t0 < 400000) {
    const st = await pilot(true);
    if (st.phase !== 'play') break;
    for (const [z, name] of [[1, '3-nuages'], [2, '4-dirigeables'], [3, '5-espace'], [4, '6-bonbon']]) {
      if (st.zone >= z && !shots.has(name)) {
        shots.add(name);
        await page.waitForTimeout(1600);
        await shot(name);
      }
    }
    // Une chute volontaire dans la mer de nuages : la fusée saute puis on ne répond plus.
    if (st.zone === 1 && !fellOnce && st.alt > 2000) {
      fellOnce = true;
      await page.evaluate(() => window.__fusee.steer(-1));
      await page.evaluate(() => window.__fusee.answer());
      for (let i = 0; i < 60; i++) {
        await page.evaluate(() => window.__fusee.steer(-1));
        const r = await page.evaluate(() => window.__fusee.rescuing());
        if (r) break;
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(900);
      await shot('3b-sauvetage');
      await page.waitForFunction(() => !window.__fusee.rescuing(), null, { timeout: 10000 });
    }
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(2200);
  await shot('7-victoire');
  await page.waitForFunction(() => window.__fusee.overlay(), null, { timeout: 15000 });
  await page.waitForTimeout(1800);
  await shot('8-fin');
} else {
  // Défi : on monte un peu, puis on se laisse tomber dans le vide ; trois fois.
  for (let round = 0; round < 6; round++) {
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const st = await pilot(true);
      if (st.phase !== 'play' || st.alt > 700) break;
      await page.waitForTimeout(60);
    }
    if ((await page.evaluate(() => window.__fusee.session().phase)) !== 'play') break;
    await page.evaluate(() => window.__fusee.answer());
    for (let i = 0; i < 80; i++) {
      await page.evaluate((d) => window.__fusee.steer(d), round % 2 ? 1 : -1);
      if (await page.evaluate(() => window.__fusee.rescuing() || window.__fusee.session().phase !== 'play')) break;
      await page.waitForTimeout(100);
    }
    if (round === 0) {
      await page.waitForTimeout(700);
      await shot('8b-secours-defi');
    }
    await page.waitForFunction(() => !window.__fusee.rescuing(), null, { timeout: 10000 });
    await page.evaluate(() => window.__fusee.steer(0));
  }
  await page.waitForFunction(() => window.__fusee.overlay(), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot('9-fin-defaite');
}
const final = await page.evaluate(() => {
  const s = window.__fusee.session();
  return { phase: s.phase, score: s.score, best: Math.round(s.best), stats: s.stats };
});
console.log('fin :', JSON.stringify(final));
await browser.close();
if (problems.length) {
  console.log('PROBLÈMES :');
  for (const p of problems) console.log(' -', p);
  process.exitCode = 1;
} else {
  console.log('aucune erreur de console ni de chargement');
}
