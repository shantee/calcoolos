/**
 * Captures de Calcoolos Analytics (chaque rubrique, une fiche joueur, ordinateur et tablette) et contrôle des
 * erreurs de console.
 *
 * Usage : node scripts/analytics-captures.mjs [urlAdmin] [dossier]
 *   Sur tool.zfx.fr, la connexion du portail est demandée : PORTAIL_UTILISATEUR et PORTAIL_MDP (environnement).
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
const admin = (process.argv[2] ?? 'http://127.0.0.1:8099').replace(/\/$/, '');
const dossier = process.argv[3] ?? 'CAPTURES/analytics';
mkdirSync(dossier, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let problemes = 0;
for (const [nom, vp] of [['ordinateur', { width: 1440, height: 900 }], ['tablette', { width: 820, height: 1180 }]]) {
  const ctx = await browser.newContext({ locale: 'fr-FR', viewport: vp, colorScheme: 'dark', timezoneId: 'Europe/Paris' });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto(`${admin}/calcoolos/`, { waitUntil: 'load' });
  if (page.url().includes('/connexion')) {
    if (!process.env.PORTAIL_MDP) throw new Error('Connexion du portail demandée : PORTAIL_UTILISATEUR / PORTAIL_MDP');
    await page.fill('input[name="identifiant"]', process.env.PORTAIL_UTILISATEUR ?? 'philippe');
    await page.fill('input[name="mot_de_passe"]', process.env.PORTAIL_MDP);
    await page.uncheck('input[name="rester"]'); // pas de jeton « rester connecté » pour une session de test
    await Promise.all([page.waitForNavigation(), page.click('button.entrer')]);
    if (!page.url().includes('/calcoolos')) await page.goto(`${admin}/calcoolos/`, { waitUntil: 'load' });
  }
  for (const vue of ['ensemble', 'jeux', 'visiteurs', 'joueurs', 'historique', 'sante']) {
    await page.click(`#onglets button[data-vue="${vue}"]`);
    await page.waitForFunction(() => !document.querySelector('#contenu .chargement'), null, { timeout: 30000 });
    await page.waitForTimeout(1200); // fin des animations des graphiques
    const erreur = await page.$('#contenu .erreur-globale');
    if (erreur) {
      problemes++;
      console.log(`  ✘ ${nom} ${vue} : ${await erreur.innerText()}`);
    }
    await page.screenshot({ path: `${dossier}/${nom}-${vue}.png`, fullPage: true, timeout: 90000 });
    if (vue === 'joueurs') {
      const ligne = await page.$('tbody tr.cliquable');
      if (ligne) {
        await ligne.click();
        await page.waitForSelector('#fiche .fiche-tete', { timeout: 15000 });
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${dossier}/${nom}-fiche-joueur.png` });
        await page.keyboard.press('Escape');
      }
    }
  }
  await page.click('#onglets button[data-vue="ensemble"]'); // la période est masquée sur « Santé »
  await page.click('#periode button[data-p="7"]');
  await page.waitForFunction(() => !document.querySelector('#contenu .chargement'));
  const pressed = await page.$eval('#periode button[data-p="7"]', (b) => b.getAttribute('aria-pressed'));
  if (pressed !== 'true') problemes++;
  console.log(`  ${erreurs.length ? '✘' : '✔'} ${nom} : ${erreurs.length ? erreurs.join(' | ') : 'aucune erreur de console'}`);
  problemes += erreurs.length;
  await ctx.close();
}
await browser.close();
console.log(problemes ? `${problemes} problème(s)` : `OK : captures dans ${dossier}`);
process.exit(problemes ? 1 : 0);
