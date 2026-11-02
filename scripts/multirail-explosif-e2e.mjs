/**
 * MULTIRAIL à Explosif, dans un vrai navigateur : calculs relevés sur un long voyage, chrono, erreurs, temps écoulé,
 * Entraînement et Voyage Zen, puis plaque lisible sur téléphone. Chaque calcul est relu par un analyseur indépendant.
 *
 * Prérequis : `npm run build` puis `npm run preview` (l'API n'est pas nécessaire).
 * Usage : node scripts/multirail-explosif-e2e.mjs [urlDeBase] (CALCULS=40 pour le nombre de calculs du long voyage)
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
const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const objectif = Number(process.env.CALCULS ?? 40);
const dossier = process.env.CAPTURES ?? 'CAPTURES/multirail';
const options = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
if (process.env.CHROME) options.executablePath = process.env.CHROME;
const problemes = [];
let total = 0;
const check = (ok, quoi) => {
  total++;
  if (!ok) problemes.push(quoi);
  console.log(ok ? '  ok' : '  ÉCHEC', '-', quoi);
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const moyenne = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const ISOLE = /^\d+ [×÷] \d+$/;

/** Relit un calcul affiché ; null s'il sort des règles (négatif, plus de 500, reste, × sans parenthèses) */
function relire(texte) {
  const jetons = texte.match(/\d+|[()+−×÷]/g) ?? [];
  let i = 0;
  let valide = true;
  const garde = (v) => {
    if (!Number.isInteger(v) || v < 0 || v > 500) valide = false;
    return v;
  };
  const terme = () => {
    const j = jetons[i++];
    if (j !== '(') return garde(Number(j));
    const v = suite();
    i++;
    return v;
  };
  const suite = () => {
    let v = terme();
    const vus = new Set();
    while (i < jetons.length && jetons[i] !== ')') {
      const op = jetons[i++];
      const b = terme();
      vus.add(op);
      v = garde(op === '+' ? v + b : op === '−' ? v - b : op === '×' ? v * b : v / b);
    }
    if ((vus.has('×') || vus.has('÷')) && vus.size > 1) valide = false;
    return v;
  };
  const v = suite();
  return valide ? v : null;
}

const browser = await chromium.launch(options);
const erreurs = [];
async function ouvrir(niveau, { largeur = 1280, hauteur = 720, jeu, mode, vite = 4, tactile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: largeur, height: hauteur }, locale: 'fr-FR', hasTouch: tactile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) erreurs.push(m.text());
  });
  await page.goto(`${base}/jeu/multirail.html?niveau=${niveau}&test&vite=${vite}&graine=42`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__multirail !== undefined, undefined, { timeout: 60000 });
  await pause(800);
  if (jeu) await page.locator('.title .games button', { hasText: jeu }).click();
  if (mode) await page.locator('.title .modes button', { hasText: mode }).click();
  return { ctx, page };
}

const question = (page) => page.evaluate(() => window.__multirail.question);
async function attendreQuestion(page, autre, ms = 60000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const q = await question(page);
    if (q && q.text !== autre) return q;
    await pause(60);
  }
  return null;
}

// --- 1. Le long voyage ------------------------------------------------------------------------------------------
console.log('• Explosif en Aventure : long voyage');
{
  const { ctx, page } = await ouvrir('maitre');
  const titre = await page.locator('.title').innerText();
  check(/Calculs mêlés/.test(titre) && /le vrai calcul mental/i.test(titre), "l'écran titre annonce le calcul mental");
  await page.screenshot({ path: `${dossier}/explosif-titre.png` });
  await page.evaluate(() => window.__multirail.start());
  const vus = [];
  let dernier = null;
  let capture = 0;
  const finBoucle = Date.now() + 8 * 60000;
  while (vus.length < objectif && Date.now() < finBoucle) {
    const etat = await page.evaluate(() => ({ state: window.__multirail.state, run: window.__multirail.run }));
    if (etat.state !== 'playing') {
      if (etat.state === 'paused') await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      if (etat.state !== 'paused') break;
    }
    const q = await attendreQuestion(page, dernier, 20000);
    if (!q) break;
    dernier = q.text;
    vus.push(q);
    if (vus.length === 3 || vus.length === 20) await page.screenshot({ path: `${dossier}/explosif-partie-${++capture}.png` });
    // on répond juste, à un moment qui dépend de la complexité : le train doit avoir ralenti pour nous
    const vitesses = [];
    const seuil = q.think * (0.55 + Math.random() * 0.2);
    for (;;) {
      const c = await page.evaluate(() => {
        const m = window.__multirail;
        return { q: m.question, v: m.v };
      });
      if (!c.q || c.q.text !== q.text) break;
      vitesses.push(c.v);
      if (c.q.left <= q.think - seuil) {
        await page.evaluate(() => window.__multirail.answer(true));
        break;
      }
      await pause(50);
    }
    q.vitesse = moyenne(vitesses);
  }
  const fin = await page.evaluate(() => window.__multirail.run);
  console.log(`  ${vus.length} calculs, ${fin.correct} justes, ${fin.timeouts} temps écoulés, ${fin.wagons} wagons, score ${fin.score}`);
  for (const [k, q] of vus.entries()) console.log(`  ${String(k + 1).padStart(3)} région ${q.region} P${q.tier} ${String(q.think).padStart(4)} s  ${q.text} = ${q.answer}`);
  check(vus.length >= Math.min(objectif, 12), `voyage assez long (${vus.length} calculs)`);
  check(vus.every((q) => relire(q.text) === q.answer), 'chaque calcul affiché est juste et respecte les règles');
  check(vus.every((q) => !ISOLE.test(q.text)), 'aucune multiplication ni division isolée');
  check(new Set(vus.map((q) => q.text.replace(/\d+/g, 'n'))).size >= Math.min(8, vus.length / 2), 'calculs variés');
  check(fin.timeouts === 0, 'une réponse donnée dans le temps ne coûte jamais un wagon');
  const paliers = vus.map((q) => q.tier);
  check(paliers[0] <= 2, 'le voyage commence accessible');
  paliers.forEach((p, k) => {
    if (k && paliers[k - 1] >= 4 && p >= paliers[k - 1]) check(false, `respiration manquante au calcul ${k + 1}`);
  });
  const courts = vus.filter((q) => q.tier <= 2);
  const longs = vus.filter((q) => q.tier >= 3);
  if (courts.length && longs.length) {
    check(moyenne(longs.map((q) => q.think)) > moyenne(courts.map((q) => q.think)), `plus de temps pour les calculs élaborés (${moyenne(courts.map((q) => q.think)).toFixed(1)} s → ${moyenne(longs.map((q) => q.think)).toFixed(1)} s)`);
    const vc = moyenne(courts.map((q) => q.vitesse));
    const vl = moyenne(longs.map((q) => q.vitesse));
    console.log(`  allure du train : ${vc.toFixed(1)} m/s sur les calculs simples, ${vl.toFixed(1)} m/s sur les élaborés`);
  }
  check(vus.some((q) => q.region >= 1), 'le relevé va au-delà de la première région');
  await ctx.close();
}

// --- 2. Erreurs et temps écoulé ---------------------------------------------------------------------------------
console.log('• Erreurs et temps écoulé');
{
  const { ctx, page } = await ouvrir('maitre');
  await page.evaluate(() => window.__multirail.start());
  const q1 = await attendreQuestion(page);
  await page.evaluate(() => window.__multirail.answer(false));
  const q2 = await attendreQuestion(page, q1.text, 8000);
  check(q2 && q2.cracks === 1, 'une erreur : nouveau calcul pour la même brèche, une fissure');
  check(q2 && q2.tier <= q1.tier, `le calcul suivant n'est pas plus dur (P${q1.tier} → P${q2?.tier})`);
  check((await page.locator('.correction').innerText()).includes(`= ${q1.answer}`), 'la bonne réponse est montrée après coup');
  check((await page.locator('.cracks i').count()) > 0, 'les fissures restent visibles sur la plaque');
  const avant = (await page.evaluate(() => window.__multirail.run)).wagons;
  // on laisse filer le temps
  let dernier = q2;
  const fin = Date.now() + 120000;
  for (;;) {
    const c = await page.evaluate(() => ({ q: window.__multirail.question, run: window.__multirail.run }));
    if (c.run.timeouts > 0 || Date.now() > fin) {
      check(c.run.timeouts === 1 && c.run.wagons === avant - 1, 'temps écoulé : un wagon devient pont');
      check(dernier && dernier.left <= 0.6, `pas de wagon perdu avant la fin du temps (il restait ${dernier?.left} s)`);
      break;
    }
    if (c.q) dernier = c.q;
    await pause(40);
  }
  await ctx.close();
}

// --- 3. Les tables restent là où on les apprend ---------------------------------------------------------------------
async function releve(page, nb) {
  const vus = [];
  let dernier = null;
  const fin = Date.now() + 60000;
  while (vus.length < nb && Date.now() < fin) {
    const q = await attendreQuestion(page, dernier, 15000);
    if (!q) break;
    dernier = q.text;
    vus.push(q);
    await page.evaluate(() => window.__multirail.answer(true));
  }
  return vus;
}

console.log('• Entraînement en Explosif : les tables seules');
{
  const { ctx, page } = await ouvrir('maitre', { mode: 'Entraînement' });
  check(/Les tables seules/.test(await page.locator('.title').innerText()), "l'écran titre le dit");
  await page.evaluate(() => window.__multirail.start());
  const vus = await releve(page, 6);
  console.log(`  ${vus.map((q) => q.text).join(' ; ')}`);
  check(vus.length >= 3 && vus.every((q) => /^\d+ × \d+$/.test(q.text)), 'que des tables');
  await ctx.close();
}

console.log('• Doux en Aventure : les tables de toujours');
{
  const { ctx, page } = await ouvrir('eveil');
  await page.evaluate(() => window.__multirail.start());
  const vus = await releve(page, 5);
  console.log(`  ${vus.map((q) => q.text).join(' ; ')}`);
  check(vus.length >= 3 && vus.every((q) => /^\d+ × \d+$/.test(q.text)), 'que des tables');
  await ctx.close();
}

console.log('• Voyage Zen en Explosif');
{
  const { ctx, page } = await ouvrir('maitre', { jeu: 'Voyage Zen' });
  await page.evaluate(() => window.__multirail.start());
  const vus = await releve(page, 6);
  console.log(`  ${vus.map((q) => `${q.text} (${q.think} s)`).join(' ; ')}`);
  check(vus.length >= 3 && vus.every((q) => !ISOLE.test(q.text) && relire(q.text) === q.answer), 'du calcul mental, valide');
  check(vus.every((q) => q.think >= 7.5), 'plus de temps qu\'en Aventure');
  await ctx.close();
}

// --- 4. Lisibilité de la plaque ---------------------------------------------------------------------------------
console.log('• Plaque lisible avec le calcul le plus long');
for (const [nom, largeur, hauteur] of [['telephone', 360, 740], ['telephone-paysage', 740, 360], ['tablette', 820, 1180], ['ordinateur', 1280, 720]]) {
  const { ctx, page } = await ouvrir('maitre', { largeur, hauteur, vite: 1, tactile: largeur < 900 });
  await page.evaluate(() => window.__multirail.start());
  await attendreQuestion(page);
  const m = await page.evaluate(() => {
    const expr = document.querySelector('.qexpr');
    const plate = document.querySelector('.plate');
    expr.textContent = '430 − (12 × 6) − (9 × 8)';
    plate.dataset.len = 'xl';
    const r = plate.getBoundingClientRect();
    const eq = document.querySelector('.eq').getBoundingClientRect();
    return { g: r.left, d: r.right, l: innerWidth, police: parseFloat(getComputedStyle(document.querySelector('.eq')).fontSize), debord: eq.width > r.width };
  });
  check(m.g >= 0 && m.d <= m.l && !m.debord, `${nom} : la plaque tient dans l'écran (${Math.round(m.d - m.g)} px sur ${m.l}, police ${m.police} px)`);
  check(m.police >= 18, `${nom} : le calcul reste lisible`);
  await page.screenshot({ path: `${dossier}/explosif-plaque-${nom}.png` });
  await ctx.close();
}

await browser.close();
check(erreurs.length === 0, `aucune erreur de console (${erreurs.slice(0, 3).join(' | ') || 'aucune'})`);
console.log(`\n${total - problemes.length}/${total} vérifications réussies`);
if (problemes.length) {
  console.log(problemes.join('\n'));
  process.exit(1);
}
