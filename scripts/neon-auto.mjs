/**
 * Neon Flight : partie jouée automatiquement + captures, erreurs de console relevées.
 * Usage : node scripts/neon-auto.mjs [urlDeBase] [dossier] [niveau] [largeurxhauteur]
 * (Playwright de la machine : NODE_PATH=…/node_modules). Rendu WebGL logiciel (SwiftShader).
 */
import { createRequire } from 'node:module';

const { chromium } = createRequire(process.env.NODE_PATH ? `${process.env.NODE_PATH}/` : import.meta.url)('playwright');

const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const out = process.argv[3] ?? 'CAPTURES/neon';
const niveau = process.argv[4] ?? 'explorateur';
const [w, hgt] = (process.argv[5] ?? '1280x800').split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: hgt }, locale: 'fr-FR', hasTouch: w < 900, isMobile: w < 900 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const shot = async (name) => {
  await page.screenshot({ path: `${out}/neon-${name}-${w}x${hgt}.png` });
  console.log('capture :', `${out}/neon-${name}-${w}x${hgt}.png`);
};
await page.goto(`${base}/jeu/neon-flight.html?niveau=${niveau}`);
await page.waitForFunction(() => window.__neon?.ready(), null, { timeout: 60000 });
await page.waitForTimeout(1500);
await shot('titre');
await page.evaluate(() => window.__neon.start('arcade'));
let n = 0;
for (let i = 0; i < 26; i++) {
  await page.waitForTimeout(700);
  const ok = await page.evaluate((k) => (k % 7 === 6 ? window.__neon.wrong() : window.__neon.answer()), i);
  if (ok) n++;
  if (i === 12) await shot('vol');
}
console.log('réponses données :', n, JSON.stringify(await page.evaluate(() => window.__neon.state())));
await page.evaluate(() => window.__neon.finish());
await page.waitForFunction(() => !/Enregistrement/.test(window.__neon.outcome() ?? ''), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);
await shot('fin');
console.log('enregistrement :', await page.evaluate(() => window.__neon.outcome()));
console.log('historique invité :', await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('calcoolos.historique') ?? '[]')[0] ?? null).slice(0, 600)));
console.log(errors.length ? `ERREURS (${errors.length}) :\n${errors.join('\n')}` : 'aucune erreur de console');
await browser.close();
