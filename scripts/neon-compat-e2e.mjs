/**
 * Compatibilité de Neon Flight : joue une courte partie dans des navigateurs simulés et sur chaque repli.
 * Les simulations reprennent ce que Brave 1.93 fait réellement (nom du GPU remplacé par « Brave », fausse extension
 * dans la liste WebGL, WebGPU actif aux informations vidées). Cela ne remplace pas un essai sur un vrai Brave Android.
 *
 * Usage : npm run build && npx vite preview, puis node scripts/neon-compat-e2e.mjs
 * (BASE=https://calculos.zfx.fr pour le site en ligne, NAV=firefox ou NAV=webkit pour un autre moteur, sans les simulations)
 */
import { createRequire } from 'node:module';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173';
const NAV = process.env.NAV ?? 'chromium';
const pw = createRequire(process.env.NODE_PATH ? `${process.env.NODE_PATH}/` : import.meta.url)('playwright');
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const TABLETTE = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, userAgent: UA_ANDROID };
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan'];
const browser = await pw[NAV].launch(NAV === 'chromium' ? { args } : { firefoxUserPrefs: NAV === 'firefox' ? { 'webgl.force-enabled': true } : undefined });
let echecs = 0;

/** Retient les types de contexte demandés : aucun canvas de jeu ne doit passer par WebGPU. */
const espion = () => {
  window.__contextes = [];
  const reel = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, options) {
    if (type !== '2d') window.__contextes.push(type);
    return reel.call(this, type, options);
  };
};
/** Brave 1.93 : voir https://brave.com/privacy-updates/38-webgl-webgpu-fingerprinting-protections */
const brave = () => {
  Object.defineProperty(Navigator.prototype, 'brave', { get: () => ({ isBrave: async () => true }) });
  for (const Gl of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const liste = Gl.prototype.getSupportedExtensions;
    Gl.prototype.getSupportedExtensions = function () {
      return [...(liste.call(this) ?? []), 'WEBGL_fausse_extension'];
    };
    const param = Gl.prototype.getParameter;
    Gl.prototype.getParameter = function (p) {
      return p === 37445 || p === 37446 ? 'Brave' : param.call(this, p);
    };
  }
  if (globalThis.GPUAdapter)
    Object.defineProperty(GPUAdapter.prototype, 'info', { get: () => ({ vendor: '', architecture: '', device: '', description: '' }) });
};
const refuser = (test) => `(() => {
  const reel = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, options) {
    return (${test})(type, options ?? {}) ? null : reel.call(this, type, options);
  };
})()`;

async function ouvrir(chemin, { contexte = {}, init = [], route } = {}) {
  const ctx = await browser.newContext({ locale: 'fr-FR', ...(NAV === 'chromium' ? contexte : {}) });
  const page = await ctx.newPage();
  await page.addInitScript(espion);
  for (const s of init) await page.addInitScript(s);
  if (route) await page.route(...route);
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto(BASE + chemin);
  return { ctx, page, erreurs };
}

const pret = (page) => page.waitForFunction(() => window.__neon?.ready?.() || document.querySelector('.sans3d'), null, { timeout: 90000 });

/** Une partie courte : bonnes et mauvaises réponses, score, fin de partie. */
async function jouer(page) {
  await page.evaluate(() => window.__neon.start('training'));
  let reponses = 0;
  for (let i = 0; i < 40 && reponses < 3; i++) {
    await page.waitForTimeout(350);
    if (await page.evaluate(() => window.__neon.answer())) reponses++;
  }
  const etat = await page.evaluate(() => window.__neon.state());
  await page.evaluate(() => window.__neon.finish());
  const fin = await page.waitForFunction(() => window.__neon.state().state === 'gameover' || window.__neon.outcome(), null, { timeout: 15000 }).then(() => true, () => false);
  return { reponses, etat, fin };
}

function bilan(nom, ok, details) {
  console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${nom}`, ok ? (details?.note ?? '') : details);
  if (!ok) echecs++;
}

async function partie(nom, chemin, options, attendu) {
  const { ctx, page, erreurs } = await ouvrir(chemin, options);
  await pret(page);
  const sans3d = await page.locator('.sans3d').count();
  const moteur = sans3d ? null : await page.evaluate(() => window.__neon.moteur());
  const jeu = sans3d ? null : await jouer(page);
  const contextes = await page.evaluate(() => window.__contextes);
  const ok =
    !sans3d && jeu.reponses === 3 && jeu.etat.correct === 3 && jeu.fin && !erreurs.length &&
    !contextes.includes('webgpu') && moteur.webgl === attendu.webgl && moteur.effets === attendu.effets;
  bilan(nom, ok, { note: `WebGL ${moteur?.webgl}, effets ${moteur?.effets}, ${moteur?.gl}`, sans3d, moteur, jeu, erreurs, contextes });
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/compat-${nom.replace(/\W+/g, '-')}.png` });
  await ctx.close();
}

const COMPLET = { webgl: 2, effets: true };
const LEGER = { webgl: 2, effets: false };
const CHEMIN = '/jeu/neon-flight.html';

await partie(`${NAV} ordinateur`, CHEMIN, {}, COMPLET);
if (NAV === 'chromium') {
  await partie('tablette Android', CHEMIN, { contexte: TABLETTE }, COMPLET);
  await partie('Brave 1.93 ordinateur (simulé)', CHEMIN, { init: [brave] }, COMPLET);
  await partie('Brave 1.93 tablette Android (simulé)', CHEMIN, { contexte: TABLETTE, init: [brave] }, COMPLET);
  await partie('sans WebGPU (Firefox Android simulé)', CHEMIN, { contexte: TABLETTE, init: [() => Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined })] }, COMPLET);
  await partie('repli : options du profil complet refusées', CHEMIN, { init: [refuser('(t, o) => o.preserveDrawingBuffer === true')] }, LEGER);
  // Contexte WebGL 2 refusé : Babylon passe de lui-même en WebGL 1, avec les effets.
  await partie('WebGL 2 refusé', CHEMIN, { init: [refuser("(t) => t.includes('webgl2')")] }, { webgl: 1, effets: true });
  // Contexte WebGL 2 accordé mais inutilisable : les deux premiers profils tombent, le troisième force WebGL 1.
  await partie('repli : WebGL 2 inutilisable', CHEMIN, { init: [() => { WebGL2RenderingContext.prototype.getParameter = () => { throw new Error('WebGL 2 cassé'); }; }] }, { webgl: 1, effets: false });

  // Échec après la création du contexte : le profil suivant doit repartir sur un canvas neuf.
  // (Babylon réessaie lui-même un téléchargement raté : 3 fois, d'où les 4 refus.)
  let refus = 0;
  await partie('repli : échec en cours de construction', CHEMIN, { route: ['**/*.glb', (r) => (refus++ < 4 ? r.abort() : r.continue())] }, LEGER);

  // Contexte perdu en plein vol : pause, puis rendu rétabli.
  {
    const { ctx, page, erreurs } = await ouvrir(`${CHEMIN}?niveau=explorateur`);
    await pret(page);
    await page.evaluate(() => {
      const gl = document.querySelector('#world').getContext('webgl2');
      window.__perte = gl.getExtension('WEBGL_lose_context');
      window.__neon.start('training');
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__perte.loseContext());
    await page.waitForTimeout(600);
    const pause = (await page.evaluate(() => window.__neon.state())).state;
    await page.evaluate(() => window.__perte.restoreContext());
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.__neon.pause());
    await page.waitForTimeout(1500);
    const avant = await page.evaluate(() => window.__neon.state());
    await page.waitForTimeout(1200);
    const apres = await page.evaluate(() => window.__neon.state());
    const sans3d = await page.locator('.sans3d').count();
    const ok = pause === 'paused' && avant.state === 'playing' && apres.distance > avant.distance && !sans3d && !erreurs.length;
    bilan('contexte perdu puis restauré', ok, { pause, avant, apres, sans3d, erreurs });
    if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/compat-contexte-restaure.png` });
    await ctx.close();
  }

  // Rapport ?diag, jeu démarré puis écran d'échec.
  {
    const { ctx, page, erreurs } = await ouvrir(`${CHEMIN}?diag`, { contexte: TABLETTE, init: [brave] });
    await pret(page);
    await page.waitForFunction(() => /Démarrage/.test(document.querySelector('.diag3d textarea')?.value ?? ''), null, { timeout: 15000 });
    const texte = await page.locator('.diag3d textarea').inputValue();
    const ok = /Brave : oui/.test(texte) && /WebGL 2 : OK/.test(texte) && /WebGPU : /.test(texte) && /Profil complet : démarré/.test(texte) && !erreurs.length;
    bilan('rapport ?diag', ok, { texte, erreurs });
    if (process.env.CAPTURES) console.log(texte);
    await ctx.close();
  }
  {
    const { ctx, page, erreurs } = await ouvrir(CHEMIN, { init: [refuser("(t) => t.includes('webgl')")] });
    await page.waitForSelector('.sans3d', { timeout: 60000 });
    await page.getByRole('button', { name: 'Détails techniques' }).click();
    await page.waitForFunction(() => /Démarrage/.test(document.querySelector('.diag3d textarea')?.value ?? ''), null, { timeout: 15000 });
    const texte = await page.locator('.diag3d textarea').inputValue();
    const ok = /Profil complet : échec/.test(texte) && /Profil WebGL 1 : échec/.test(texte) && !erreurs.length;
    bilan('rapport sur écran d’échec', ok, { texte, erreurs });
    await ctx.close();
  }
}

await browser.close();
console.log(echecs ? `${echecs} échec(s)` : 'Tout est bon');
process.exit(echecs ? 1 : 0);
