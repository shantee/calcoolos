/**
 * Comptes pour tous, avec la vraie API et de vraies parties de Neon Flight (jamais de réponses simulées) :
 * adulte seul, profil d'enfant ajouté, changement de joueur, séparation des statistiques, reconnexion sur un
 * autre appareil, compte familial complet (six enfants), classements sans e-mail. Comptes d'essai supprimés à la fin.
 * Prérequis : `npm run api` et `npm run dev`. Usage : node scripts/comptes-e2e.mjs [adresse]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = await (async () => {
  try {
    return await import('playwright');
  } catch {
    return createRequire(import.meta.url)('playwright');
  }
})();

const base = process.argv[2] ?? 'http://localhost:5173';
const out = 'CAPTURES/comptes-30-10';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ordinateur = { locale: 'fr-FR', viewport: { width: 1280, height: 860 } };
const tablette = { locale: 'fr-FR', viewport: { width: 834, height: 1112 }, hasTouch: true };
const telephone = { locale: 'fr-FR', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
let ok = 0;
let ko = 0;
const check = (c, m) => {
  console.log(`  ${c ? 'ok' : 'ÉCHEC'} - ${m}`);
  c ? ok++ : ko++;
};
const motDePasse = 'mot-de-passe-essai-42';
const erreurs = [];
const surveiller = (p) => p.on('pageerror', (e) => erreurs.push(e.message));

const call = (page, method, path, body) => page.evaluate(async ([method, path, body]) => {
  const headers = { Accept: 'application/json' };
  if (method === 'POST') {
    const etat = await (await fetch('/api/etat', { headers })).json();
    Object.assign(headers, { 'Content-Type': 'application/json', 'X-Calcoolos': '1', 'X-CSRF-Token': etat.csrf ?? '' });
  }
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}, [method, path, body]);

const inscrire = async (page, email) => {
  await page.goto(`${base}/compte.html#inscription`, { waitUntil: 'networkidle' });
  await page.fill('#inscription input[name="email"]', email);
  await page.fill('#inscription input[name="motDePasse"]', motDePasse);
  await page.check('#inscription input[name="adulte"]');
  await page.click('#inscription button[type="submit"]');
  await page.waitForSelector('#t-moi');
};

const connecter = async (page, email) => {
  await page.goto(`${base}/compte.html#connexion`, { waitUntil: 'networkidle' });
  await page.fill('#connexion input[name="email"]', email);
  await page.fill('#connexion input[name="motDePasse"]', motDePasse);
  await page.click('#connexion button[type="submit"]');
  await page.waitForSelector('.mon-espace');
};

const creerMonProfil = async (page, pseudo) => {
  await page.fill('.carte-mon-profil input[name="pseudo"]', pseudo);
  await page.click('.carte-mon-profil button[type="submit"]');
  await page.waitForURL('**/index.html');
  await page.waitForSelector('#univers:not([hidden])');
};

const ajouterEnfant = async (page, pseudo) => {
  await page.evaluate(() => { document.querySelector('#ajout-enfant').open = true; });
  const form = page.locator('section[aria-labelledby="t-new"] form');
  await form.locator('input[name="pseudo"]').fill(pseudo);
  await form.locator('button[type="submit"]').click();
  await page.waitForSelector(`article.profil h3:text-is("${pseudo}")`);
};

/** Une vraie partie d'Arcade de Neon Flight pour le joueur actif de la page. */
async function jouerNeon(page, essais) {
  await page.goto(`${base}/jeu/neon-flight.html`);
  await page.waitForFunction(() => window.__neon?.ready(), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__neon.start('arcade'));
  for (let i = 0; i < essais; i++) {
    await page.waitForTimeout(450);
    await page.evaluate((k) => (k % 4 === 3 ? window.__neon.wrong() : window.__neon.answer()), i);
  }
  await page.evaluate(() => window.__neon.finish());
  await page.waitForFunction(() => !/Enregistrement/.test(window.__neon.outcome() ?? ''), null, { timeout: 15000 }).catch(() => {});
  return page.evaluate(() => window.__neon.outcome());
}

const sansDebordement = async (page, nom) => {
  const [l, v] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  check(l <= v, `${nom} : pas de débordement (${l} / ${v})`);
};

// --- 1. Adulte seul ------------------------------------------------------------------------------
console.log('• Adulte seul');
const solo = `solo-${Date.now()}@exemple.fr`;
const ctx = await browser.newContext(ordinateur);
const page = await ctx.newPage();
surveiller(page);
await inscrire(page, solo);
await page.screenshot({ path: `${out}/1-bienvenue-ordinateur.png` });
check(!(await page.textContent('body')).match(/espace famille|espace parents/i), 'aucune mention « espace famille » après l’inscription');
await creerMonProfil(page, 'Solo Max');
check((await page.textContent('.joueur'))?.includes('Solo Max'), 'la barre montre le bon joueur');
check((await page.textContent('#univers'))?.includes('Salut Solo Max'), 'accueil personnel avec le pseudo');
check(await page.locator('#qui-joue-zone').isHidden(), 'un seul profil : pas de « Qui joue ? »');
check((await page.locator('#univers .ton-bravo, #univers .ton-conseil').count()) === 0 && (await page.textContent('.univers-conseils'))?.includes('Joue quelques parties'), 'sans partie : aucun conseil inventé');
await page.click('.joueur');
check(await page.locator('#panneau-joueur .panneau-titre', { hasText: 'Qui joue' }).count() === 0, 'panneau de la barre sans choix inutile');
await page.keyboard.press('Escape');

console.log('• Vraies parties et accueil réel');
const o1 = await jouerNeon(page, 16);
check(/enregistr|record/i.test(o1 ?? ''), `partie 1 : « ${o1} »`);
const o2 = await jouerNeon(page, 16);
check(/enregistr|record/i.test(o2 ?? ''), `partie 2 : « ${o2} »`);
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('.univers-reprise');
const etat = (await call(page, 'GET', '/etat')).data;
const moi = etat.profils[0];
check(moi.personnel === true, 'API : profil personnel');
const res = (await call(page, 'GET', `/profils/${moi.id}/resultats`)).data.resultats;
check(res.length === 2 && res.every((r) => r.jeu === 'neon'), 'deux parties enregistrées sur le serveur');
const record = Math.max(...res.map((r) => r.score));
const reprise = await page.textContent('.univers-reprise');
check(reprise.includes('Neon Flight') && reprise.includes(`Meilleur score : ${record}`), `Reprendre : Neon Flight, record réel ${record}`);
await page.waitForFunction(() => document.querySelector('.univers-reprise')?.href.includes('niveau='));
check((await page.getAttribute('.univers-reprise', 'href')).includes('neon-flight'), 'Reprendre ouvre le bon jeu');
const faits = {};
for (const r of res) {
  for (const [k, [j, f]] of Object.entries(r.mesures?.faits ?? {})) {
    faits[k] = [(faits[k]?.[0] ?? 0) + j, (faits[k]?.[1] ?? 0) + f];
  }
}
const conseils = await page.locator('.univers-conseils li').allTextContents();
console.log(`    conseils : ${JSON.stringify(conseils)}`);
for (const c of conseils) {
  const m = /Attention, (\d+) × (\d+) .*réussi (\d+) fois sur (\d+)/.exec(c);
  if (m) {
    const [j, f] = faits[`${m[1]}×${m[2]}`] ?? [-1, -1];
    check(j === Number(m[3]) && j + f === Number(m[4]), `conseil « ${m[1]} × ${m[2]} » conforme au serveur (${j} sur ${j + f})`);
  }
  check(!/table de/.test(c), 'pas de progrès sur une table annoncé après deux parties');
}
await page.screenshot({ path: `${out}/2-accueil-reel-ordinateur.png` });

console.log('• Ajout d’un enfant et changement de joueur');
await page.goto(`${base}/compte.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('.profil-chiffres');
check((await page.textContent('.profil-chiffres'))?.includes('2'), 'Mon profil : 2 parties');
check((await page.textContent('.profil-chiffres'))?.includes(String(record)), 'Mon profil : meilleur score réel');
check(await page.locator('.bandeau-choix').count() === 0, 'un seul profil : pas de choix de joueur');
check((await page.textContent('#ajout-enfant summary'))?.includes('Souhaites-tu aussi créer des profils'), 'proposition facultative pour les enfants');
await page.screenshot({ path: `${out}/3-mon-espace-ordinateur.png`, fullPage: true });
await ajouterEnfant(page, 'Mini');
check((await page.textContent('.joueur'))?.includes('Solo Max'), 'ajouter un enfant ne change pas qui joue');
await page.locator('.bandeau-choix button', { hasText: 'Mini' }).click();
await page.waitForTimeout(400);
check((await page.textContent('.bandeau-qui'))?.includes('Mini') && (await page.textContent('.joueur'))?.includes('Mini'), 'Mini joue : bandeau et barre d’accord');
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#univers:not([hidden])');
check((await page.textContent('#univers'))?.includes('Salut Mini') && await page.locator('.univers-reprise').count() === 0, 'accueil de Mini : pas de dernier jeu');
check((await page.textContent('.tuile-jeu:has-text("Neon Flight")'))?.includes('Pas encore joué'), 'scores de l’adulte absents de l’accueil de Mini');
await page.locator('#qui-joue button', { hasText: 'Solo Max' }).click();
await page.waitForSelector('.univers-reprise');
check((await page.textContent('#univers'))?.includes('Salut Solo Max'), 'retour au profil personnel sans recharger');
const mini = (await call(page, 'GET', '/etat')).data.profils.find((p) => p.pseudo === 'Mini');
check((await call(page, 'GET', `/profils/${mini.id}/resultats`)).data.resultats.length === 0, 'statistiques séparées sur le serveur');

console.log('• Déconnexion, reconnexion, autre appareil');
await call(page, 'POST', '/deconnexion');
await page.evaluate(() => localStorage.removeItem('calcoolos.joueur'));
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
check((await page.textContent('.joueur'))?.includes('Invité'), 'déconnecté : invité');
check(await page.locator('#univers').isHidden() || !(await page.textContent('#univers')).includes('Solo Max'), 'déconnecté : plus rien du joueur');
const ctxT = await browser.newContext(tablette);
const t = await ctxT.newPage();
surveiller(t);
await connecter(t, solo);
check((await t.textContent('.bandeau-qui'))?.includes('Solo Max'), 'tablette : le titulaire joue d’emblée');
await sansDebordement(t, 'tablette, Mon espace');
await t.screenshot({ path: `${out}/4-mon-espace-tablette.png` });
await t.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await t.waitForSelector('.univers-reprise');
check((await t.textContent('.univers-reprise'))?.includes(`Meilleur score : ${record}`), 'tablette : mêmes données réelles');
await sansDebordement(t, 'tablette, accueil');

// --- 2. Compte familial complet, sans profil personnel (comme un ancien compte) --------------------
console.log('• Ancien compte familial, six enfants');
const famille = `famille-${Date.now()}@exemple.fr`;
const ctxP = await browser.newContext(telephone);
const f = await ctxP.newPage();
surveiller(f);
await inscrire(f, famille);
for (let i = 1; i <= 6; i++) check((await call(f, 'POST', '/profils', { pseudo: `Enfant ${i}`, avatar: 'robot', niveau: 'eveil' })).status === 201, `enfant ${i}`);
await f.goto(`${base}/compte.html`, { waitUntil: 'networkidle' });
await f.waitForSelector('.carte-mon-profil');
check((await f.textContent('#t-moi'))?.includes('Toi aussi'), 'proposition de profil personnel');
check((await f.textContent('.bandeau-qui'))?.includes('Personne'), 'aucun enfant choisi à la place de l’adulte');
check(await f.locator('section[aria-labelledby="t-new"]').count() === 0, 'six enfants : plus d’ajout d’enfant');
await f.screenshot({ path: `${out}/5-famille-telephone.png` });
await creerMonProfil(f, 'Parent Joueur');
check((await f.textContent('.joueur'))?.includes('Parent Joueur'), 'six enfants : le parent joue quand même');
const profils = (await call(f, 'GET', '/etat')).data.profils;
check(profils.length === 7 && profils.filter((p) => p.personnel).length === 1 && profils[0].pseudo === 'Parent Joueur', 'sept profils dont un seul personnel');
await sansDebordement(f, 'téléphone, accueil');
await f.goto(`${base}/compte.html`, { waitUntil: 'networkidle' });
await f.waitForSelector('.bandeau-choix');
await sansDebordement(f, 'téléphone, Mon espace');
await f.screenshot({ path: `${out}/6-mon-espace-telephone.png`, fullPage: true });

console.log('• Classements et nettoyage');
const c = await call(page, 'GET', '/classements');
check(c.status === 200 && !JSON.stringify(c.data).includes('@'), 'classements publics sans aucune adresse e-mail');
check(JSON.stringify(c.data).includes('Solo Max'), 'le profil de l’adulte est classé sous son pseudo');
for (const [p, email] of [[t, solo], [f, famille]]) {
  check((await call(p, 'POST', '/supprimer-compte', { motDePasse })).status === 200, `compte d’essai supprimé (${email.split('-')[0]})`);
}
check(erreurs.length === 0, `aucune erreur de page ${erreurs.join(' | ')}`);
await browser.close();
console.log(`\n${ok}/${ok + ko} vérifications réussies`);
process.exit(ko ? 1 : 0);
