/**
 * Plein écran et boutons de commande des quatre jeux, dans Chromium.
 * Usage : node scripts/plein-ecran-auto.mjs [urlDeBase] [dossier]
 * Vérifie : boutons placés dans le jeu, entrée en plein écran au lancement (clavier, souris,
 * doigt), sortie et retour par le bouton, pas de nouvelle demande après une sortie volontaire,
 * proportions gardées à chaque format, partie qui continue, retour à l'accueil.
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

const JEUX = [
  { id: 'cubes', page: 'cubes-de-siege', hook: '__siege' },
  { id: 'meteores', page: 'pluie-de-meteores', hook: '__meteores' },
  { id: 'dragon', page: 'dragon-gourmand', hook: '__dragon' },
  { id: 'fusee', page: 'decollage', hook: '__fusee' },
];
const FORMATS = [
  { nom: 'ordi', width: 1440, height: 900, touch: false },
  { nom: 'ipad-paysage', width: 1180, height: 820, touch: true },
  { nom: 'tablette-1024', width: 1024, height: 768, touch: true },
  { nom: 'ipad-pro', width: 1366, height: 1024, touch: true },
  { nom: 'tablette-portrait', width: 768, height: 1024, touch: true },
  { nom: 'telephone-paysage', width: 844, height: 390, touch: true },
];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

/** Mesures utiles : canvas, boutons, plein écran. */
const etat = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    const b = document.querySelector('.commandes-jeu')?.getBoundingClientRect();
    return {
      pe: !!document.fullscreenElement,
      canvas: { x: c.x, y: c.y, w: c.width, h: c.height },
      barre: b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null,
      nbBoutons: document.querySelectorAll('.commandes-jeu .cmd').length,
      vw: innerWidth,
      vh: innerHeight,
    };
  });

for (const f of FORMATS) {
  const ctx = await browser.newContext({ viewport: { width: f.width, height: f.height }, hasTouch: f.touch, isMobile: f.touch });
  for (const j of JEUX) {
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && problems.push(`${j.id}/${f.nom} console : ${m.text()}`));
    page.on('pageerror', (e) => problems.push(`${j.id}/${f.nom} erreur : ${e.message}`));
    await page.goto(`${base}/jeu/${j.page}.html?graine=7`, { waitUntil: 'networkidle' });
    await page.waitForFunction((h) => window[h] !== undefined, j.hook, { timeout: 15000 });
    await page.waitForTimeout(700);
    const e = await etat(page);
    const ratio = e.canvas.w / e.canvas.h;
    check(Math.abs(ratio - 16 / 9) < 0.01, `${j.id}/${f.nom} : proportions gardées (${ratio.toFixed(3)})`);
    check(e.canvas.x >= -0.5 && e.canvas.y >= -0.5 && e.canvas.x + e.canvas.w <= e.vw + 0.5 && e.canvas.y + e.canvas.h <= e.vh + 0.5, `${j.id}/${f.nom} : jeu entièrement visible`);
    check(e.barre && e.barre.x >= e.canvas.x && e.barre.y >= e.canvas.y && e.barre.x + e.barre.w <= e.canvas.x + e.canvas.w, `${j.id}/${f.nom} : boutons posés dans le jeu`);
    if (f.nom === 'ordi' || f.nom === 'ipad-paysage' || f.nom === 'telephone-paysage') await page.screenshot({ path: `${out}/pe-${j.id}-${f.nom}.png` });
    await page.close();
  }
  await ctx.close();
}

// Lancement : clavier (Entrée), puis bouton, Échap simulé, relance sans plein écran forcé.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  for (const j of JEUX) {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`${j.id} erreur : ${e.message}`));
    await page.goto(`${base}/jeu/${j.page}.html?graine=7`, { waitUntil: 'networkidle' });
    await page.waitForFunction((h) => window[h] !== undefined, j.hook, { timeout: 15000 });
    await page.evaluate(() => sessionStorage.clear());
    await page.waitForTimeout(600);
    await page.locator('canvas').focus().catch(() => {});
    await page.keyboard.press('Enter');
    await page.waitForTimeout(900);
    let e = await etat(page);
    check(e.pe, `${j.id} : plein écran en lançant la partie au clavier`);
    const avant = await page.evaluate((h) => JSON.stringify(window[h].session?.()?.phase ?? null), j.hook);
    // Sortie par le bouton : la partie continue.
    await page.click('.commandes-jeu button');
    await page.waitForTimeout(500);
    e = await etat(page);
    check(!e.pe, `${j.id} : bouton « quitter le plein écran »`);
    const apres = await page.evaluate((h) => JSON.stringify(window[h].session?.()?.phase ?? null), j.hook);
    check(avant === apres, `${j.id} : la partie continue après la sortie (${apres})`);
    check(Math.abs(e.canvas.w / e.canvas.h - 16 / 9) < 0.01, `${j.id} : proportions gardées après la sortie`);
    // Retour en plein écran par le bouton.
    await page.click('.commandes-jeu button');
    await page.waitForTimeout(500);
    check((await etat(page)).pe, `${j.id} : bouton « plein écran »`);
    if (j.id === 'cubes') await page.screenshot({ path: `${out}/pe-cubes-plein-ecran.png` });
    await page.evaluate(() => document.exitFullscreen());
    await page.waitForTimeout(400);
    // Après une sortie volontaire, une nouvelle partie ne réimpose pas le plein écran.
    await page.evaluate((h) => window[h].start('tranquille'), j.hook);
    await page.mouse.click(5, 5);
    await page.waitForTimeout(500);
    check(!(await etat(page)).pe, `${j.id} : pas de plein écran réimposé après une sortie`);
    await page.close();
  }
  await ctx.close();
}

// Au doigt sur tablette : toucher « Jouer » (Chrome ne reconnaît le geste qu'au lever du doigt).
{
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`${base}/jeu/cubes-de-siege.html?graine=7`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__siege !== undefined);
  await page.waitForTimeout(800);
  const pos = await page.evaluate(() => window.__siege.startButton?.() ?? null);
  if (pos) {
    const r = await page.locator('canvas').boundingBox();
    await page.touchscreen.tap(r.x + (pos.x * r.width) / 1280, r.y + (pos.y * r.height) / 720);
    await page.waitForTimeout(900);
    const e = await etat(page);
    check(e.pe, 'cubes/tablette : plein écran en touchant « Jouer »');
    check((await page.evaluate(() => window.__siege.session()?.phase)) === 'play', 'cubes/tablette : la partie a démarré');
    await page.screenshot({ path: `${out}/pe-cubes-tablette-partie.png` });
  } else check(false, 'cubes : position du bouton Jouer introuvable');
  // Retour à l'accueil.
  await page.click('.commandes-jeu a');
  await page.waitForLoadState('networkidle');
  check(/\/index\.html$|\/$/.test(new URL(page.url()).pathname), `retour à l’accueil (${new URL(page.url()).pathname})`);
  await ctx.close();
}

await browser.close();
console.log(checks.join('\n'));
if (problems.length) {
  console.log('\nProblèmes relevés :');
  for (const p of problems) console.log(' -', p);
  process.exitCode = 1;
} else console.log('\nTout est bon.');
