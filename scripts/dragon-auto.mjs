/**
 * Joue une partie du « Dragon gourmand » dans Chromium et prend des captures.
 * Le dragon vole vraiment vers les lanternes (comme avec la souris) pour les
 * premiers objectifs, puis la partie est accélérée en le nourrissant directement.
 * Usage : node scripts/dragon-auto.mjs [urlDeBase] [dossier] [gagner|perdre] [niveau]
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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`console ${m.type()} : ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`erreur : ${e.message}`));
page.on('requestfailed', (r) => problems.push(`échec de chargement : ${r.url()}`));
const shot = async (name) => {
  await page.screenshot({ path: `${out}/dragon-${name}.png` });
  console.log('capture :', `${out}/dragon-${name}.png`);
};

await page.goto(`${base}/jeu/dragon-gourmand.html?niveau=${niveau}&graine=11${plan === 'perdre' ? '&accelere=6' : ''}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__dragon !== undefined, null, { timeout: 15000 });
await page.waitForTimeout(1500);
await shot('1-intro');

/** Prochaine lanterne d'une solution minimale (recherche exhaustive dans la page). */
const nextOrb = () =>
  page.evaluate(() => {
    const s = window.__dragon.session();
    if (!s || s.phase !== 'play') return null;
    const op = s.goal.op;
    const got = op === '+' ? s.belly.reduce((a, b) => a + b, 0) : s.belly.reduce((a, b) => a * b, 1);
    const rest = op === '+' ? s.goal.target - got : s.goal.target / got;
    let best = null;
    const n = s.orbs.length;
    for (let mask = 1; mask < 1 << n; mask++) {
      const pick = s.orbs.filter((_, i) => mask & (1 << i));
      if (best && pick.length >= best.length) continue;
      const v = op === '+' ? pick.reduce((a, o) => a + o.value, 0) : pick.reduce((a, o) => a * o.value, 1);
      if (v === rest) best = pick;
    }
    if (!best) return null;
    const h = window.__dragon.head();
    best.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    return best[0];
  });

const state = () =>
  page.evaluate(() => {
    const s = window.__dragon.session();
    return { phase: s?.phase, goals: s?.stats.goals ?? 0, belly: s?.belly.length ?? 0, stage: s?.stage ?? 0, eaten: s?.stats.orbsEaten ?? 0, ending: window.__dragon.ending(), overlay: window.__dragon.overlay() };
  });

/** Vol réel vers la lanterne : renvoie vrai si elle a été avalée. */
async function flyTo(orb, timeout = 9000) {
  const before = (await state()).eaten;
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await page.evaluate(([x, y]) => window.__dragon.goto(x, y), [orb.x, orb.y]);
    await page.waitForTimeout(120);
    if ((await state()).eaten > before) return true;
  }
  return false;
}

const shotsTaken = new Set();
const once = async (name, cond) => {
  if (!shotsTaken.has(name) && cond) {
    shotsTaken.add(name);
    await shot(name);
  }
};

if (plan === 'gagner') {
  await page.evaluate(() => window.__dragon.start('tranquille'));
  await page.waitForTimeout(1600);
  await page.evaluate(() => window.__dragon.spawnBalloon());
  let flown = 0;
  let guard = 0;
  let overshootDone = false;
  while (guard++ < 400) {
    const st = await state();
    if (st.phase !== 'play' || st.ending) break;
    // Une indigestion volontaire au 3e objectif, pour la capture du hoquet.
    if (st.goals === 2 && !overshootDone) {
      overshootDone = true;
      for (let k = 0; k < 6; k++) {
        const big = await page.evaluate(() => [...window.__dragon.session().orbs].sort((a, b) => b.value - a.value)[0]);
        await page.evaluate((id) => window.__dragon.feed(id), big.id);
        await page.waitForTimeout(160);
        const s2 = await page.evaluate(() => window.__dragon.session().stats.overshoots);
        if (s2 > 0) break;
      }
      await page.waitForTimeout(450);
      await shot('5-hoquet');
      await page.waitForTimeout(1500);
      continue;
    }
    const orb = await nextOrb();
    if (!orb) {
      await page.waitForTimeout(200);
      continue;
    }
    if (flown < 5) {
      const ok = await flyTo(orb);
      flown++;
      const after = await state();
      await once('2-vol', after.belly >= 1);
      if (!ok) await page.evaluate((id) => window.__dragon.feed(id), orb.id);
    } else {
      await page.evaluate((id) => window.__dragon.feed(id), orb.id);
    }
    const after = await state();
    if (after.goals > st.goals) {
      await page.waitForTimeout(650);
      await once('3-feu', true);
      await page.waitForTimeout(900);
    } else {
      await page.waitForTimeout(140);
    }
    if (after.stage === 1 && !shotsTaken.has('6-nuit')) {
      await page.evaluate(() => {
        window.__dragon.spawnBat();
        window.__dragon.spawnBat();
        window.__dragon.spawnCake();
      });
      await page.waitForTimeout(2600);
      await shot('6-nuit');
      shotsTaken.add('6-nuit');
    }
    if (after.stage === 2 && !shotsTaken.has('7-orage')) {
      await page.waitForTimeout(3600);
      await shot('7-orage');
      shotsTaken.add('7-orage');
      await page.waitForTimeout(1400);
      await shot('7b-eclair');
    }
  }
  await page.waitForTimeout(2600);
  await shot('8-victoire');
  await page.waitForFunction(() => window.__dragon.overlay(), null, { timeout: 15000 });
  await page.waitForTimeout(1800);
  await shot('9-fin');
} else {
  await page.evaluate(() => window.__dragon.start('defi'));
  await page.waitForTimeout(1200);
  await shot('4-defi');
  await page.evaluate(() => window.__dragon.hurt());
  await page.waitForTimeout(500);
  await shot('4b-aie');
  await page.waitForFunction(() => window.__dragon.session().phase === 'lost', null, { timeout: 60000 });
  await page.waitForTimeout(2600);
  await shot('10-plouf');
  await page.waitForFunction(() => window.__dragon.overlay(), null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  await shot('11-fin-defaite');
}
const final = await page.evaluate(() => {
  const s = window.__dragon.session();
  return { phase: s.phase, score: s.score, stats: s.stats };
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
