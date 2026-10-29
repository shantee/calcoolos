/**
 * Neon Flight avec un compte : deux profils jouent, leurs résultats restent séparés, arrivent avec les
 * mesures communes, une seule fois (même partie renvoyée = ignorée), dans le bon classement (série de
 * tables) ; pages Classements et Mes progrès capturées. Le compte d'essai est supprimé à la fin.
 * Usage : node scripts/neon-compte-e2e.mjs [urlDeBase] [dossier]   (API et site servis sur urlDeBase)
 */
import { createRequire } from 'node:module';

const { chromium } = createRequire(process.env.NODE_PATH ? `${process.env.NODE_PATH}/` : import.meta.url)('playwright');

const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const out = process.argv[3] ?? 'CAPTURES/neon';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, locale: 'fr-FR' });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
let ok = 0;
let ko = 0;
const check = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  cond ? ok++ : ko++;
};

/** Appel de l'API depuis la page (mêmes en-têtes que le site). */
const call = (method, path, body) => page.evaluate(async ([method, path, body]) => {
  const headers = { Accept: 'application/json' };
  // Jeton CSRF : redemandé après chaque changement de page.
  if (method === 'POST' && !window.__csrf) window.__csrf = (await (await fetch('/api/etat', { headers: { Accept: 'application/json' } })).json()).csrf;
  if (method === 'POST') Object.assign(headers, { 'Content-Type': 'application/json', 'X-Calcoolos': '1', 'X-CSRF-Token': window.__csrf ?? '' });
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (data.csrf) window.__csrf = data.csrf;
  return { status: res.status, data };
}, [method, path, body]);

await page.goto(`${base}/`);
const email = `essai-neon-${Date.now()}@exemple.fr`;
let r = await call('POST', '/inscription', { email, motDePasse: 'motdepasse-essai-42', adulte: true });
check(r.status === 201 || r.status === 200, `inscription (${r.status})`);
await call('GET', '/etat');
for (const [pseudo, niveau] of [['Lina Neon', 'explorateur'], ['Noe Neon', 'maitre']]) {
  r = await call('POST', '/profils', { pseudo, avatar: 'astronaute', niveau });
  check(r.status === 201, `profil ${pseudo}`);
}
const profils = r.data.profils;

/** Une partie d'Arcade jouée par un profil (réponses justes, une fausse sur sept). */
async function jouer(p, essais) {
  await page.evaluate((p) => localStorage.setItem('calcoolos.joueur', JSON.stringify(p)), p);
  await page.goto(`${base}/jeu/neon-flight.html`);
  await page.waitForFunction(() => window.__neon?.ready(), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const pilote = await page.locator('#pilot').innerText();
  check(pilote.includes(p.pseudo), `le pilote affiché est ${p.pseudo}`);
  await page.evaluate(() => window.__neon.start('arcade'));
  for (let i = 0; i < essais; i++) {
    await page.waitForTimeout(650);
    await page.evaluate((k) => (k % 7 === 6 ? window.__neon.wrong() : window.__neon.answer()), i);
  }
  await page.evaluate(() => window.__neon.finish());
  await page.waitForFunction(() => !/Enregistrement/.test(window.__neon.outcome() ?? ''), null, { timeout: 15000 }).catch(() => {});
  return page.evaluate(() => window.__neon.outcome());
}

const lina = profils.find((p) => p.pseudo === 'Lina Neon');
const noe = profils.find((p) => p.pseudo === 'Noe Neon');
const o1 = await jouer(lina, 16);
check(/enregistr|record/i.test(o1 ?? ''), `résultat de Lina enregistré : « ${o1} »`);
await page.screenshot({ path: `${out}/neon-compte-fin.png` });
await jouer(lina, 10);
const o3 = await jouer(noe, 12);
check(/enregistr|record/i.test(o3 ?? ''), `résultat de Noé enregistré : « ${o3} »`);

const rl = await call('GET', `/profils/${lina.id}/resultats`);
const rn = await call('GET', `/profils/${noe.id}/resultats`);
const neonL = rl.data.resultats.filter((x) => x.jeu === 'neon');
const neonN = rn.data.resultats.filter((x) => x.jeu === 'neon');
check(neonL.length === 2 && neonN.length === 1, `profils séparés : Lina ${neonL.length} parties, Noé ${neonN.length}`);
const m = neonL[0]?.mesures;
check(!!m && m.calculs === m.justes + m.fausses && m.calculs > 0, `mesures communes : ${JSON.stringify(m && { calculs: m.calculs, justes: m.justes, fausses: m.fausses, tempsMedian: m.tempsMedian, serie: m.serie })}`);
check(!!m?.faits && Object.keys(m.faits).every((k) => /^\d+×\d+$/.test(k)), `faits de multiplication : ${Object.keys(m?.faits ?? {}).slice(0, 6).join(', ')}…`);
check(m?.tempsMedian > 0 && m.tempsMedian < 16000, `temps de réponse cohérent (${m?.tempsMedian} ms, chrono à 13 s en Explorateur)`);
check(neonL[0]?.actif > 0 && neonL[0].actif <= neonL[0].duree, `temps actif ${neonL[0]?.actif} s ≤ durée ${neonL[0]?.duree} s`);
check(neonL[0]?.variante === 'petites' && neonN[0]?.variante === 'expert', `séries : Lina ${neonL[0]?.variante}, Noé ${neonN[0]?.variante}`);
check(rl.data.totaux?.neon?.parties === 2, `totaux de Lina : ${JSON.stringify(rl.data.totaux?.neon)}`);

// Même partie envoyée deux fois (réseau qui renvoie) : enregistrée une seule fois.
const dernier = neonL[0];
r = await call('POST', '/resultats', { ...dernier, profil: lina.id, partie: dernier.cle, date: undefined, cle: undefined, verifie: undefined });
check(r.status === 201 && r.data.deja === true, `doublon ignoré (${r.status}, deja=${r.data.deja} ${r.data.erreur ?? ''})`);
const rl2 = await call('GET', `/profils/${lina.id}/resultats`);
check(rl2.data.resultats.filter((x) => x.jeu === 'neon').length === 2, 'toujours 2 parties pour Lina');

const cl = await call('GET', '/classements');
const tab = (niveau, variante) => cl.data.classements.find((b) => b.jeu === 'neon' && b.niveau === niveau && b.variante === variante);
check(tab('explorateur', 'petites')?.public.some((x) => x.nom === 'Lina Neon'), 'Lina dans Neon · Explorateur · Tables 2 à 5');
check(tab('maitre', 'expert')?.public.some((x) => x.nom === 'Noe Neon'), 'Noé dans Neon · Maître · Tables 2 à 12');
check(!tab('explorateur', 'expert')?.public.some((x) => x.nom === 'Lina Neon'), 'Lina absente des autres séries');
check(!cl.data.classements.some((b) => b.jeu === 'neon' && b.mode === 'tranquille'), 'pas de classement Entraînement');

await page.evaluate((p) => localStorage.setItem('calcoolos.joueur', JSON.stringify(p)), lina);
await page.goto(`${base}/classements.html#jeu-neon`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const onglets = await page.locator('#jeu-neon .onglets-mode [role="tab"]').allInnerTexts();
check(onglets.length === 4, `onglets Neon : ${onglets.map((x) => x.split('\n')[0]).join(' / ')}`);
check(await page.locator('#niveaux-neon-petites').isVisible(), 'série proposée d’office : Tables 2 à 5 (niveau de Lina)');
await page.locator('#jeu-neon').screenshot({ path: `${out}/classements-neon.png` });
await page.click('#onglet-neon-expert');
check(await page.locator('#niveaux-neon-expert').innerText().then((t) => t.includes('Noe Neon')), 'onglet Tables 2 à 12 : Noé');
check(await page.locator('#niveaux-defi-cubes, #niveaux-cubes-defi').isVisible(), 'les autres jeux gardent Défi / Tranquille');

await page.goto(`${base}/tableau.html?profil=${lina.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('.choix-jeu button[data-jeu="neon"]');
await page.waitForTimeout(1200);
const vue = await page.locator('.vue-jeu').innerText();
check(vue.includes('Neon Flight') && vue.includes('Mes tables de multiplication'), 'Mes progrès : vue Neon Flight avec la grille des tables');
check(/encore \d+ partie/.test(vue), 'deux parties seulement : pas de verdict, on dit combien il en manque');
await page.screenshot({ path: `${out}/progres-compte-neon.png`, fullPage: true });

r = await call('POST', '/supprimer-compte', { motDePasse: 'motdepasse-essai-42' });
check(r.status === 200, `compte d’essai supprimé (${r.status})`);
check(errors.length === 0, errors.length ? `erreurs de console :\n${errors.join('\n')}` : 'aucune erreur de console');
console.log(`\n${ok} vérifications réussies, ${ko} échouées`);
await browser.close();
process.exit(ko ? 1 : 0);
