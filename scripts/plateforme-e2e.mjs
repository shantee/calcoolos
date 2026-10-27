/**
 * Parcours complet de la plateforme dans Chromium, avec la vraie API PHP :
 * invité → partie gardée sur l'appareil → espace famille → profils → partie
 * enregistrée sur le serveur → tableau de bord → classements → isolation
 * entre deux familles → export → déconnexion.
 *
 * Prérequis : `npm run api` (PHP, base de développement) et `npm run dev`.
 * Usage : node scripts/plateforme-e2e.mjs [urlDeBase] [dossierCaptures]
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
const check = (cond, what) => {
  checks.push(what);
  if (!cond) problems.push(`ÉCHEC : ${what}`);
  console.log(cond ? '  ok' : '  ÉCHEC', '-', what);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const watch = (page) => {
  // Les refus de l'API (4xx) font partie des tests ; on signale les vrais problèmes :
  // fichier manquant, erreur serveur, erreur JavaScript.
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) problems.push(`console : ${m.text()}`);
  });
  page.on('response', (r) => {
    const api = r.url().includes('/api/');
    if (r.status() >= 500 || (!api && r.status() >= 400)) problems.push(`HTTP ${r.status()} : ${r.url()}`);
  });
  page.on('requestfailed', (r) => problems.push(`échec de chargement : ${r.url()}`));
  page.on('pageerror', (e) => problems.push(`erreur : ${e.message}`));
};
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
watch(page);
const shot = async (name, full = false) => {
  await page.screenshot({ path: `${out}/plateforme-${name}.png`, fullPage: full });
  console.log('capture :', `${out}/plateforme-${name}.png`);
};

/** Joue une partie du dragon jusqu'à la victoire en nourrissant le dragon ; attend `minSeconds` avant le dernier objectif. */
async function winDragon(minSeconds) {
  await page.waitForFunction(() => window.__dragon !== undefined, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__dragon.start('tranquille'));
  const t0 = Date.now();
  for (let guard = 0; guard < 300; guard++) {
    const st = await page.evaluate(() => {
      const s = window.__dragon.session();
      return { phase: s.phase, goals: s.stats.goals, total: s.totalGoals, belly: s.belly.length };
    });
    if (st.phase !== 'play') break;
    if (st.goals === st.total - 1 && st.belly === 0 && Date.now() - t0 < minSeconds * 1000) {
      await page.waitForTimeout(minSeconds * 1000 - (Date.now() - t0) + 300);
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
  await page.waitForFunction(() => window.__dragon.overlay() && window.__dragon.session().phase === 'won', null, { timeout: 20000 });
  await page.waitForTimeout(2500);
}

// --- 1. Invité ------------------------------------------------------------------------------------
console.log('• Invité');
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('.joueur');
check((await page.textContent('.joueur'))?.includes('Invité'), 'accueil : joueur invité');
await shot('1-accueil-invite', true);
await page.goto(`${base}/jeu/dragon-gourmand.html?niveau=eveil&graine=5`, { waitUntil: 'networkidle' });
await winDragon(0);
await shot('2-fin-invite');
const localCount = await page.evaluate(() => JSON.parse(localStorage.getItem('calcoolos.historique') ?? '[]').length);
check(localCount === 1, 'partie d’invité gardée dans le navigateur');
check((await ctx.cookies()).length === 0, 'aucun cookie pour un invité');
await page.goto(`${base}/tableau.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('.chiffre');
check((await page.textContent('.chiffres'))?.includes('1'), 'tableau de bord invité : 1 partie');
await shot('3-progres-invite', true);

// --- 2. Espace famille ------------------------------------------------------------------------------
console.log('• Espace famille');
const email = `parent-${Date.now()}@exemple.fr`;
await page.goto(`${base}/compte.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#t-signup');
await shot('4-compte-connexion', true);
const signup = page.locator('section[aria-labelledby="t-signup"] form');
await signup.locator('input[name="email"]').fill(email);
await signup.locator('input[name="motDePasse"]').fill('court');
await signup.locator('button[type="submit"]').click();
await page.waitForSelector('section[aria-labelledby="t-signup"] .message.erreur');
check((await signup.textContent())?.includes('10 caractères'), 'erreur affichée sous le mot de passe trop court');
await signup.locator('input[name="motDePasse"]').fill('un-mot-de-passe-solide');
await signup.locator('input[name="adulte"]').check();
await signup.locator('button[type="submit"]').click();
await page.waitForSelector('h1:text-is("Espace famille")');
const cookies = await ctx.cookies();
const session = cookies.find((c) => c.name === 'calcoolos_session');
check(!!session && session.httpOnly && session.sameSite === 'Lax', 'cookie de session HttpOnly + SameSite=Lax après connexion');

const addProfile = async (pseudo, avatar, niveau) => {
  const form = page.locator('section[aria-labelledby="t-new"] form');
  await form.locator('input[name="pseudo"]').fill(pseudo);
  await form.locator('select[name="niveau"]').selectOption(niveau);
  await form.locator(`input[value="${avatar}"]`).check({ force: true });
  await form.locator('button[type="submit"]').click();
  await page.waitForSelector(`h3:text-is("${pseudo}")`);
};
await addProfile('Lina', 'dragon', 'explorateur');
await addProfile('Noé', 'robot', 'eveil');
const linaCard = page.locator('article.profil', { has: page.locator('h3:text-is("Lina")') });
check((await linaCard.locator('input[type="checkbox"]').count()) === 0, 'plus de case « classements publics » sur le profil');
const nouveau = page.locator('form', { has: page.locator('button:text-is("Ajouter le profil")') });
await nouveau.locator('button.pseudo-aide').click();
const idee = await nouveau.locator('input[name="pseudo"]').inputValue();
check(/^[\p{L}\p{N} _-]{2,20}$/u.test(idee), `« Aide-moi à trouver un pseudo » : ${idee}`);
await nouveau.locator('input[name="pseudo"]').fill('');
await shot('5-espace-famille', true);

// --- 3. Qui joue ? --------------------------------------------------------------------------------
console.log('• Qui joue ?');
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#qui-joue button');
check((await page.textContent('.joueur'))?.includes('Lina'), 'le premier profil devient le joueur actif');
await page.locator('#qui-joue button', { hasText: 'Noé' }).click();
await page.waitForTimeout(300);
check((await page.inputValue('input[name="niveau"]:checked')) === 'eveil', 'choisir Noé règle le niveau sur Éveil');
await page.locator('#qui-joue button', { hasText: 'Lina' }).click();
await page.waitForTimeout(300);
check((await page.inputValue('input[name="niveau"]:checked')) === 'explorateur', 'choisir Lina règle le niveau sur Explorateur');
await shot('6-accueil-lina', true);

// --- 4. Partie enregistrée ------------------------------------------------------------------------
console.log('• Partie de Lina (≈ 45 s, pour être vraisemblable)');
await page.locator('a.jouer[data-jeu][href*="dragon"]').click();
await page.waitForLoadState('networkidle');
await winDragon(42);
await shot('7-fin-lina');
const saved = await page.evaluate(async () => {
  const st = await (await fetch('../api/etat')).json();
  const lina = st.profils.find((p) => p.pseudo === 'Lina');
  const r = await (await fetch(`../api/profils/${lina.id}/resultats`)).json();
  return { id: lina.id, results: r.resultats };
});
check(saved.results.length === 1 && saved.results[0].jeu === 'dragon' && saved.results[0].gagne, 'résultat de Lina enregistré sur le serveur');
check(saved.results[0].verifie === true, 'résultat jugé vraisemblable (vérifié)');
check(Object.keys(saved.results[0].ops).length > 0, 'opérations enregistrées');

await page.goto(`${base}/tableau.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('.chiffre');
await page.waitForTimeout(1500);
check((await page.textContent('#tableau-corps'))?.includes('enregistrés sur le serveur'), 'tableau de bord de Lina (serveur)');
await shot('8-progres-lina', true);

await page.goto(`${base}/classements.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#choix-mode');
await page.selectOption('#choix-mode', 'tranquille');
await page.waitForSelector('text=Classement public');
await page.waitForTimeout(500);
const board = await page.textContent('#contenu');
check(/Classement public[\s\S]*Lina[\s\S]*Dans la famille/.test(board), 'Lina au classement public sous son pseudo, et dans la famille');
await shot('9-classements', true);

// --- 5. Une autre famille ne voit rien ------------------------------------------------------------
console.log('• Isolation');
const ctx2 = await browser.newContext({ locale: 'fr-FR' });
const other = await ctx2.newPage();
watch(other);
await other.goto(`${base}/compte.html`, { waitUntil: 'networkidle' });
await other.waitForSelector('#t-signup');
const s2 = other.locator('section[aria-labelledby="t-signup"] form');
await s2.locator('input[name="email"]').fill(`autre-${Date.now()}@exemple.fr`);
await s2.locator('input[name="motDePasse"]').fill('encore-un-mot-de-passe');
await s2.locator('input[name="adulte"]').check();
await s2.locator('button[type="submit"]').click();
await other.waitForSelector('h1:text-is("Espace famille")');
const status = await other.evaluate(async (id) => (await fetch(`api/profils/${id}/resultats`)).status, saved.id);
check(status === 404, `une autre famille ne lit pas les résultats de Lina (HTTP ${status})`);
const exp = await other.evaluate(async () => (await fetch('api/export')).text());
check(!exp.includes('Lina'), 'l’export d’une autre famille ne contient pas Lina');
const pub = await other.evaluate(async () => (await fetch('api/classements?jeu=dragon&niveau=explorateur&mode=tranquille')).text());
check(pub.includes('"Lina"') && !pub.includes('@'), 'le classement public montre le pseudo, jamais l’e-mail');
await ctx2.close();

// --- 6. Export et déconnexion ---------------------------------------------------------------------
console.log('• Export et déconnexion');
const mine = await page.evaluate(async () => (await fetch('api/export')).json());
check(mine.compte.email === email && mine.profils.length === 2 && mine.profils[0].resultats.length === 1, 'export complet de la famille');
await page.goto(`${base}/compte.html`, { waitUntil: 'networkidle' });
await page.locator('#contenu button', { hasText: 'Se déconnecter' }).click();
await page.waitForSelector('#t-login');
check((await page.textContent('.joueur'))?.includes('Invité'), 'après déconnexion : retour en invité');

await browser.close();
console.log(`\n${checks.length - problems.filter((p) => p.startsWith('ÉCHEC')).length}/${checks.length} vérifications réussies`);
if (problems.length) {
  console.log('PROBLÈMES :');
  for (const p of problems) console.log(' -', p);
  process.exitCode = 1;
} else {
  console.log('aucune erreur de console');
}
