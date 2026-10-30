/**
 * Calcoolos Analytics, de bout en bout dans Chromium : vraies parties dans les quatre jeux (invité,
 * puis profil connecté), abandon, pause, puis lecture de l'API d'administration.
 *
 * Usage : node scripts/analytics-e2e.mjs [urlDuSite] [urlAdmin]
 *   urlDuSite : Vite (npm run dev, API PHP lancée avec ADMIN_TOKEN_SHA256) — défaut http://localhost:5173
 *   urlAdmin  : module d'administration (banc ou tool.zfx.fr) — défaut http://127.0.0.1:8099
 * Écrit le résumé des clés de parties dans CAPTURES/analytics-e2e.json (comparé ensuite à la base).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
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
const admin = process.argv[3] ?? 'http://127.0.0.1:8099';
mkdirSync('CAPTURES', { recursive: true });

let ok = 0;
let ko = 0;
const verifier = (cond, quoi) => {
  if (cond) ok++;
  else ko++;
  console.log(`${cond ? '  ✔' : '  ✘'} ${quoi}`);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 800 } });
// Les navigateurs pilotés ne sont pas comptés, sauf avec ce drapeau (tests de la mesure).
await ctx.addInitScript(() => localStorage.setItem('calcoolos.suivi-test', '1'));
const page = await ctx.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
const envois = [];
page.on('request', (r) => {
  if (r.url().includes('/api/suivi')) envois.push(JSON.parse(r.postData() || '{}'));
});

const JEUX = [
  { id: 'cubes', page: 'cubes-de-siege.html', hook: '__siege', params: '&accelere=6' },
  { id: 'meteores', page: 'pluie-de-meteores.html', hook: '__meteores', params: '&accelere=8' },
  { id: 'dragon', page: 'dragon-gourmand.html', hook: '__dragon', params: '&accelere=6' },
  { id: 'fusee', page: 'decollage.html', hook: '__fusee', params: '' },
];

/** Bouge la souris (le joueur est là) jusqu'à la fin de la partie ou la limite. */
async function jouerJusquALaFin(hook, limite = 240000, pauseMs = 0) {
  const t0 = Date.now();
  let x = 300;
  let pause = pauseMs > 0;
  while (Date.now() - t0 < limite) {
    x = x === 300 ? 900 : 300;
    await page.mouse.move(x, 420, { steps: 3 });
    if (hook === '__fusee') await page.evaluate(() => window.__fusee.wrong());
    if (pause && Date.now() - t0 > 4000) {
      await page.evaluate((h) => window[h].pause(), hook);
      await page.waitForTimeout(pauseMs); // en pause : la souris bouge mais le temps de jeu ne compte pas
      await page.evaluate((h) => window[h].resume(), hook);
      pause = false;
    }
    const fini = await page.evaluate((h) => window[h].overlay(), hook);
    if (fini && Date.now() - t0 > 3000) return Date.now() - t0;
    await page.waitForTimeout(1500);
  }
  return null;
}

const resume = {};
console.log('• Invité : accueil, choix du niveau');
await page.goto(`${base}/`, { waitUntil: 'load', timeout: 90000 });
await page.click('input[value="explorateur"]');
await page.waitForTimeout(800);
verifier(envois.some((e) => e.ev?.some((x) => x.type === 'page')) && envois.some((e) => e.ev?.some((x) => x.type === 'niveau')), 'visite et choix du niveau envoyés');
const visiteur = envois[0]?.v;
verifier(/^[A-Za-z0-9_-]{22}$/.test(visiteur ?? ''), 'identifiant de visiteur aléatoire');
verifier(!(await ctx.cookies()).length, 'aucun cookie pour un invité');

for (const j of JEUX) {
  console.log(`• Invité : ${j.id}`);
  const avant = envois.length;
  await page.goto(`${base}/jeu/${j.page}?niveau=explorateur&graine=7${j.params}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction((h) => window[h] !== undefined, j.hook, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate((h) => window[h].start('defi'), j.hook);
  const t0 = Date.now();
  const duree = await jouerJusquALaFin(j.hook, 300000, j.id === 'meteores' ? 15000 : 0);
  await page.waitForTimeout(1500);
  const miens = envois.slice(avant).flatMap((e) => e.ev ?? []);
  const debut = miens.find((x) => x.type === 'debut' && x.jeu === j.id);
  const fin = miens.find((x) => x.type === 'fin' && x.p === debut?.p);
  verifier(!!debut, `${j.id} : début de partie envoyé`);
  verifier(duree !== null && fin?.issue === 'terminee', `${j.id} : partie terminée (${Math.round((duree ?? 0) / 1000)} s) et fin envoyée`);
  const ecoule = (Date.now() - t0) / 1000;
  verifier(fin && fin.actif > 0 && fin.actif <= ecoule + 2, `${j.id} : temps actif ${fin?.actif} s ≤ temps écoulé ${Math.round(ecoule)} s`);
  if (j.id === 'meteores') verifier(fin && fin.actif <= ecoule - 12, `meteores : les 15 s de pause ne comptent pas (${fin?.actif} s actives / ${Math.round(ecoule)} s)`);
  resume[j.id] = { cle: debut?.p, actif: fin?.actif };
  await page.screenshot({ path: `CAPTURES/analytics-e2e-${j.id}-fin.png` });
}

console.log('• Invité : abandon (page quittée en pleine partie)');
await page.goto(`${base}/jeu/cubes-de-siege.html?niveau=maitre&graine=3`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__siege !== undefined);
await page.evaluate(() => window.__siege.start('tranquille'));
for (let i = 0; i < 4; i++) {
  await page.mouse.move(200 + i * 100, 300);
  await page.waitForTimeout(1000);
}
const avantAbandon = envois.length;
await page.goto(`${base}/`, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(800);
// sendBeacon n'est pas toujours visible par page.on('request') : on vérifiera aussi côté serveur.
resume.abandon = envois.slice(avantAbandon).flatMap((e) => e.ev ?? []).find((x) => x.type === 'fin')?.issue ?? 'beacon';

console.log('• Compte famille, profil, partie connectée');
const api = (path, body, csrf) => page.evaluate(async ([path, body, csrf]) => {
  const r = await fetch(`/api${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Calcoolos': '1', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}, [path, body, csrf]);
const email = `analytics-${Date.now()}@exemple.fr`;
let r = await api('/inscription', { email, motDePasse: 'mot-de-passe-de-test', adulte: true });
verifier(r.status === 201, 'inscription');
const csrf = r.data.csrf;
r = await api('/profils', { pseudo: 'SuperChat42', avatar: 'chat-lunettes', niveau: 'explorateur' }, csrf);
const profil = r.data.profils?.[0];
verifier(!!profil, 'profil créé');
await page.evaluate((p) => localStorage.setItem('calcoolos.joueur', JSON.stringify({ id: p.id, pseudo: p.pseudo, avatar: p.avatar, niveau: p.niveau })), profil);
const avantP = envois.length;
await page.goto(`${base}/jeu/decollage.html?niveau=explorateur&graine=5`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__fusee !== undefined);
await page.evaluate(() => window.__fusee.start('defi'));
const dP = await jouerJusquALaFin('__fusee');
await page.waitForTimeout(2500);
const evP = envois.slice(avantP);
verifier(evP.some((e) => e.profil === profil.id), 'envois rattachés au profil actif');
const finP = evP.flatMap((e) => e.ev ?? []).find((x) => x.type === 'fin');
verifier(dP !== null && finP?.issue === 'terminee', 'partie connectée terminée');
resume.connecte = { profil: profil.id, cle: finP?.p, actif: finP?.actif, email };
verifier(erreurs.length === 0, `aucune erreur JavaScript${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);

console.log('• Administration');
const lire = async (quoi, params = {}) => (await fetch(`${admin}/calcoolos/api/${quoi}?${new URLSearchParams(params)}`)).json();
const auj = new Date();
const ymd = `${auj.getFullYear()}-${String(auj.getMonth() + 1).padStart(2, '0')}-${String(auj.getDate()).padStart(2, '0')}`;
const res = await lire('resume', { debut: ymd, fin: ymd });
const parJeu = Object.fromEntries(res.jeux.liste.map((g) => [g.jeu, g]));
for (const j of JEUX) verifier(parJeu[j.id].commencees >= 1, `${j.id} : au moins une partie commencée dans les statistiques`);
verifier(parJeu.cubes.abandons >= 1, 'abandon compté (Panique au phare ! quitté en pleine partie)');
const fiche = await lire('joueur', { id: profil.id });
verifier(fiche.pseudo === 'SuperChat42' && fiche.parties === 1 && fiche.parJeu.fusee.temps === finP?.actif, `fiche joueur : 1 partie, ${fiche.parJeu?.fusee?.temps} s sur Décollage ! (résultat relié, pas compté deux fois)`);
verifier(res.chiffres.visiteursAujourdhui >= 1 && res.chiffres.sessions >= 1, 'visiteurs et sessions');
writeFileSync('CAPTURES/analytics-e2e.json', JSON.stringify({ visiteur, resume, chiffres: res.chiffres, jeux: parJeu }, null, 2));
console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} : ${ok} vérification(s) réussie(s), ${ko} échec(s)`);
await browser.close();
process.exit(ko === 0 ? 0 : 1);
