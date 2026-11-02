/**
 * Vérifie l'écran « La 3D ne démarre pas » de MULTIRAIL et Neon Flight, avec la 3D vraiment coupée dans Chromium.
 * Aucune erreur non gérée ne doit rester dans la page.
 *
 * Usage : npm run dev, puis node scripts/sans3d-e2e.mjs (BASE=https://calculos.zfx.fr pour le site en ligne)
 */
import { createRequire } from 'node:module';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--disable-3d-apis'] });
let echecs = 0;

async function verifier(nom, chemin, { langue = 'fr-FR', titre = 'La 3D ne démarre pas', largeur = 1280, avant } = {}) {
  const ctx = await browser.newContext({ locale: langue, viewport: { width: largeur, height: 720 } });
  const page = await ctx.newPage();
  if (avant) await page.addInitScript(avant);
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto(BASE + chemin);
  await page.waitForSelector('.sans3d', { timeout: 30000 });
  await page.waitForFunction((t) => document.querySelector('.sans3d h1')?.textContent?.includes(t), titre);
  const debordement = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const lien = await page.locator('.sans3d a').getAttribute('href');
  const ok = !erreurs.length && !debordement && lien === '../';
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${nom}`, ok ? '' : { erreurs, debordement, lien });
  if (!ok) echecs++;
  await ctx.close();
}

await verifier('MULTIRAIL sans WebGL', '/jeu/multirail.html');
await verifier('MULTIRAIL téléphone', '/jeu/multirail.html', { largeur: 360 });
await verifier('MULTIRAIL anglais', '/jeu/multirail.html', { langue: 'en-US', titre: '3D won’t start' });
await verifier('MULTIRAIL allemand', '/jeu/multirail.html', { langue: 'de-DE', titre: '3D startet' });
await verifier('Neon Flight sans WebGL', '/jeu/neon-flight.html');
// Le navigateur annonce WebGL 2, puis refuse le contexte du moteur (cas de Three.js chez Philippe).
await verifier('MULTIRAIL, refus au moteur', '/jeu/multirail.html', {
  avant: () => {
    const reel = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, options) {
      return type === 'webgl2' && !options ? { getExtension: () => null } : reel.call(this, type, options);
    };
  },
});

await browser.close();
if (echecs) process.exit(1);
