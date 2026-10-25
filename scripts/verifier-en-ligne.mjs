/**
 * Vérification du site en ligne, à lancer après une publication (complète plateforme-e2e.mjs) :
 * - les quatre jeux démarrent sur ordinateur, tablette et téléphone (tactile), sans erreur ;
 * - l'accueil ne déborde pas en largeur ;
 * - un compte retrouve sa progression depuis un autre appareil après reconnexion
 *   (partie gagnée, résultats, tableau de bord avec graphiques, classements) ;
 * - le compte de test est ensuite supprimé (profils et résultats partent avec lui).
 *
 * Usage : node scripts/verifier-en-ligne.mjs [urlDeBase] [dossierCaptures]
 *   (Playwright de la machine, par exemple NODE_PATH=… ; voir AGENTS.md)
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
const base = (process.argv[2] ?? 'https://calculos.zfx.fr').replace(/\/$/, '');
const out = process.argv[3] ?? 'CAPTURES/en-ligne';
mkdirSync(out, { recursive: true });

const problems = [];
const checks = [];
const check = (cond, what) => {
  checks.push(what);
  if (!cond) problems.push(`ÉCHEC : ${what}`);
  console.log(cond ? '  ok' : '  ÉCHEC', '-', what);
};
const watch = (page, label) => {
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) problems.push(`${label} console : ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 500 || (!r.url().includes('/api/') && r.status() >= 400)) problems.push(`${label} HTTP ${r.status()} : ${r.url()}`);
  });
  page.on('pageerror', (e) => problems.push(`${label} erreur : ${e.message}`));
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const devices = [
  { name: 'ordinateur', viewport: { width: 1366, height: 800 } },
  { name: 'tablette', viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'telephone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
];
const games = [
  ['cubes-de-siege', '__siege'],
  ['pluie-de-meteores', '__meteores'],
  ['dragon-gourmand', '__dragon'],
  ['decollage', '__fusee'],
];

// --- 1. Accueil et jeux sur trois appareils -------------------------------------------------------
for (const d of devices) {
  console.log(`• ${d.name}`);
  const ctx = await browser.newContext(d);
  const page = await ctx.newPage();
  watch(page, d.name);
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  check(widths[0] <= widths[1], `${d.name} : accueil sans débordement horizontal (${widths.join(' / ')})`);
  await page.screenshot({ path: `${out}/${d.name}-accueil.png` });
  for (const [file, hook] of games) {
    await page.goto(`${base}/jeu/${file}.html?niveau=explorateur`, { waitUntil: 'networkidle' });
    await page.waitForFunction((h) => window[h] !== undefined, hook, { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.evaluate((h) => window[h].start('tranquille'), hook);
    await page.waitForTimeout(2500);
    const canvas = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const r = c?.getBoundingClientRect();
      return r ? { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth } : null;
    });
    check(!!canvas && canvas.w > 200 && canvas.w <= canvas.vw + 1, `${d.name} : ${file} démarre (${canvas ? `${canvas.w}×${canvas.h}` : 'pas de canvas'})`);
    await page.screenshot({ path: `${out}/${d.name}-${file}.png` });
  }
  await ctx.close();
}

// --- 2. Compte : partie sur un appareil, progression retrouvée sur un autre -----------------------
console.log('• Compte et reconnexion');
const email = `verif-${Date.now()}@exemple.fr`;
const password = 'verification-en-ligne';
const pc = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await pc.newPage();
watch(page, 'compte');
await page.goto(`${base}/compte.html`, { waitUntil: 'networkidle' });
const signup = page.locator('section[aria-labelledby="t-signup"] form');
await signup.locator('input[name="email"]').fill(email);
await signup.locator('input[name="motDePasse"]').fill(password);
await signup.locator('input[name="adulte"]').check();
await signup.locator('button[type="submit"]').click();
await page.waitForSelector('h1:text-is("Espace famille")');
const form = page.locator('section[aria-labelledby="t-new"] form');
await form.locator('input[name="pseudo"]').fill('Testeur');
await form.locator('select[name="niveau"]').selectOption('explorateur');
await form.locator('input[value="dragon"]').check({ force: true });
await form.locator('button[type="submit"]').click();
await page.waitForSelector('h3:text-is("Testeur")');
check(true, 'compte familial et profil créés');

// Comme un joueur : accueil → « Qui joue ? » → Jouer. Partie gagnée au Dragon gourmand (≈ 45 s,
// pour être jugée vraisemblable).
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.locator('#qui-joue button', { hasText: 'Testeur' }).click();
await page.waitForTimeout(300);
await page.locator('a.jouer[data-jeu][href*="dragon"]').click();
await page.waitForLoadState('networkidle');
await page.waitForFunction(() => window.__dragon !== undefined, null, { timeout: 20000 });
await page.waitForTimeout(600);
await page.evaluate(() => window.__dragon.start('tranquille'));
const t0 = Date.now();
for (let guard = 0; guard < 300; guard++) {
  const st = await page.evaluate(() => {
    const s = window.__dragon.session();
    return { phase: s.phase, goals: s.stats.goals, total: s.totalGoals, belly: s.belly.length };
  });
  if (st.phase !== 'play') break;
  if (st.goals === st.total - 1 && st.belly === 0 && Date.now() - t0 < 42000) {
    await page.waitForTimeout(42000 - (Date.now() - t0) + 300);
  }
  await page.evaluate(() => {
    const s = window.__dragon.session();
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
    if (best) window.__dragon.feed(best[0].id);
  });
  await page.waitForTimeout(90);
}
// Le résultat part à l'affichage de l'écran de fin : l'attendre avant de quitter la page.
await page.waitForFunction(() => window.__dragon.overlay() && window.__dragon.session().phase === 'won', null, { timeout: 20000 });
await page.waitForTimeout(2500);
check(true, 'partie gagnée au Dragon gourmand');
await page.goto(`${base}/compte.html`, { waitUntil: 'networkidle' });
await page.locator('button', { hasText: 'Se déconnecter' }).click();
await page.waitForSelector('#t-login');
check((await pc.cookies()).every((c) => c.name !== 'calcoolos_session' || c.value === ''), 'déconnexion');
await pc.close();

// Autre appareil (téléphone) : connexion, progression retrouvée.
const phone = await browser.newContext(devices[2]);
const p2 = await phone.newPage();
watch(p2, 'reconnexion');
await p2.goto(`${base}/compte.html`, { waitUntil: 'networkidle' });
const login = p2.locator('section[aria-labelledby="t-login"] form');
await login.locator('input[name="email"]').fill(email);
await login.locator('input[name="motDePasse"]').fill(password);
await login.locator('button[type="submit"]').click();
await p2.waitForSelector('h1:text-is("Espace famille")');
const cookie = (await phone.cookies()).find((c) => c.name === 'calcoolos_session');
check(!!cookie && cookie.secure && cookie.httpOnly && cookie.sameSite === 'Lax', 'cookie de session Secure + HttpOnly + SameSite=Lax');
const back = await p2.evaluate(async () => {
  const st = await (await fetch('api/etat')).json();
  const t = st.profils.find((p) => p.pseudo === 'Testeur');
  const r = t ? await (await fetch(`api/profils/${t.id}/resultats`)).json() : { resultats: [] };
  return { profil: !!t, n: r.resultats.length, jeu: r.resultats[0]?.jeu, verifie: r.resultats[0]?.verifie };
});
check(back.profil && back.n === 1 && back.jeu === 'dragon', 'après reconnexion sur un autre appareil : profil et partie retrouvés');
check(back.verifie === true, 'partie jugée vraisemblable (comptera dans les classements)');
await p2.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await p2.waitForSelector('#qui-joue button');
check((await p2.textContent('#qui-joue'))?.includes('Testeur'), '« Qui joue ? » propose le profil');
await p2.screenshot({ path: `${out}/telephone-qui-joue.png` });
await p2.goto(`${base}/tableau.html`, { waitUntil: 'networkidle' });
await p2.waitForSelector('.chiffre');
await p2.waitForTimeout(1500);
const charts = await p2.evaluate(() => document.querySelectorAll('#tableau-corps canvas, #tableau-corps svg').length);
check((await p2.textContent('#tableau-corps'))?.includes('enregistrés sur le serveur') && charts > 0, `tableau de bord du serveur avec graphiques (${charts})`);
await p2.screenshot({ path: `${out}/telephone-progres.png`, fullPage: true });
await p2.goto(`${base}/classements.html`, { waitUntil: 'networkidle' });
await p2.waitForSelector('#choix-mode');
await p2.screenshot({ path: `${out}/telephone-classements.png`, fullPage: true });

// Nettoyage : suppression du compte de test (cascade sur profils et résultats).
const del = await p2.evaluate(async (pw) => {
  const st = await (await fetch('api/etat')).json();
  const r = await fetch('api/supprimer-compte', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Calcoolos': '1', 'X-CSRF-Token': st.csrf ?? '' },
    body: JSON.stringify({ motDePasse: pw }),
  });
  return { status: r.status, after: await (await fetch('api/etat')).json() };
}, password);
check(del.status === 200 && del.after.connecte === false, 'compte de test supprimé');
await phone.close();

await browser.close();
console.log(`\n${checks.length - problems.filter((p) => p.startsWith('ÉCHEC')).length}/${checks.length} vérifications réussies`);
if (problems.length) {
  console.log('PROBLÈMES :');
  for (const p of problems) console.log(' -', p);
  process.exitCode = 1;
} else {
  console.log('aucune erreur de console');
}
