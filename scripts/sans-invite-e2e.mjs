/**
 * Plus de mode invité (03/11/2026), de bout en bout avec la vraie API :
 * - visiteur : accueil épuré (pas d'espace joueur ni de tableau de bord, même avec un ancien historique invité,
 *   qui reste dans le navigateur), « Créer mon compte » et « Se connecter » visibles ;
 * - « Jouer » d'un visiteur : fenêtre compte requis → inscription → profil → retour à l'accueil sur ce jeu, fenêtre
 *   du niveau ouverte → partie ;
 * - les six jeux ouverts directement par leur adresse : connexion puis retour au jeu (avec niveau) ou au choix du
 *   niveau (sans niveau) ; aucune boucle, le jeu démarre ;
 * - compte à plusieurs profils sans joueur choisi : Mon espace → choix → « Reprendre mon jeu » ;
 * - captures ordinateur, tablette, téléphone. Compte d'essai supprimé à la fin.
 * Prérequis : API (8080) et `vite preview` (4173). Usage : node scripts/sans-invite-e2e.mjs [adresse]
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

const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const out = 'CAPTURES/sans-invite-03-11';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ordinateur = { locale: 'fr-FR', viewport: { width: 1280, height: 860 } };
const tablette = { locale: 'fr-FR', viewport: { width: 834, height: 1112 }, hasTouch: true };
const telephone = { locale: 'fr-FR', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
let ok = 0;
let ko = 0;
const check = (c, m) => {
  console.log(`  ${c ? 'ok' : 'ÉCHEC'} - ${m}`);
  c ? ok++ : ko++;
};
const erreurs = [];
const surveiller = (p) => p.on('pageerror', (e) => erreurs.push(`${p.url()} : ${e.message}`));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const motDePasse = 'mot-de-passe-essai-42';
const email = `sans-invite-${Date.now()}@calcoolos.invalid`;

const JEUX = [
  { slug: 'decollage', nom: 'Décollage !', crochet: '__fusee' },
  { slug: 'pluie-de-meteores', nom: 'Pluie de météores', crochet: '__meteores' },
  { slug: 'cubes-de-siege', nom: 'Panique au phare !', crochet: '__siege' },
  { slug: 'dragon-gourmand', nom: 'Le Dragon gourmand', crochet: '__dragon' },
  { slug: 'neon-flight', nom: 'Neon Flight', crochet: '__neon' },
  { slug: 'multirail', nom: 'MULTIRAIL', crochet: '__multirail' },
];
// MULTIRAIL n'expose ses crochets qu'avec ?test : sa toile 3D suffit à dire qu'il a démarré.
const demarre = (page, jeu, timeout = 90000) => page.waitForFunction(
  ([c, slug]) => window[c] !== undefined || (slug === 'multirail' && document.querySelector('canvas') !== null), [jeu.crochet, jeu.slug], { timeout });

const call = (page, method, path, body) => page.evaluate(async ([method, path, body]) => {
  const headers = { Accept: 'application/json' };
  if (method === 'POST') {
    const etat = await (await fetch('/api/etat', { headers })).json();
    Object.assign(headers, { 'Content-Type': 'application/json', 'X-Calcoolos': '1', 'X-CSRF-Token': etat.csrf ?? '' });
  }
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}, [method, path, body]);

const seConnecterIci = async (page) => {
  await page.waitForSelector('#connexion input[name="email"]');
  await page.fill('#connexion input[name="email"]', email);
  await page.fill('#connexion input[name="motDePasse"]', motDePasse);
  await page.click('#connexion button[type="submit"]');
};

// --- 1. Visiteur : accueil épuré ---------------------------------------------------------------------
console.log('• Visiteur : accueil');
const ctx = await browser.newContext(ordinateur);
const page = await ctx.newPage();
surveiller(page);
// Un ancien invité : historique, dernière partie et favoris laissés par l'ancienne version.
await page.goto(`${base}/confidentialite.html`);
const ancien = JSON.stringify([{ jeu: 'dragon', niveau: 'ce2', mode: 'defi', score: 420, gagne: true, etoiles: 3, duree: 90, precision: 0.9, ops: {}, details: {}, date: new Date().toISOString() }]);
await page.evaluate((h) => {
  localStorage.setItem('calcoolos.historique', h);
  localStorage.setItem('calcoolos.derniere-partie', JSON.stringify({ jeu: 'dragon', niveau: 'ce2', mode: 'defi' }));
  localStorage.setItem('calcoolos.accueil.invite.favoris', JSON.stringify(['dragon']));
}, ancien);
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#barre .bouton-compte');
check(await page.locator('#barre .joueur').count() === 0, 'barre : plus de bouton « Invité / sans compte »');
check(await page.locator('#barre .bouton-compte', { hasText: 'Créer mon compte' }).isVisible(), 'barre : « Créer mon compte » visible');
check(await page.locator('#barre .lien-compte', { hasText: 'Se connecter' }).isVisible(), 'barre : « Se connecter » visible');
check(await page.locator('#univers').isHidden(), 'pas de tableau de bord personnel (même avec un ancien historique invité)');
check(!(await page.textContent('body')).includes('Content de te revoir'), 'pas de « Content de te revoir »');
check(!(await page.textContent('body')).includes('Afficher le manège des jeux'), 'pas d’option « Afficher le manège des jeux »');
check(!/invité/i.test(await page.textContent('main')), 'plus aucune mention « invité » sur l’accueil');
check(await page.locator('#jeux').isVisible(), 'le manège des six jeux est là');
check(await page.locator('#accueil-visiteur .bouton-creer').isVisible() && await page.locator('#accueil-visiteur .bouton-connexion').isVisible(), 'sous le logo : « Créer mon compte » et « Se connecter »');
check(await page.evaluate((h) => localStorage.getItem('calcoolos.historique') === h, ancien), 'ancien historique invité ni lu ni effacé');
await page.screenshot({ path: `${out}/ordinateur-accueil-visiteur.png` });

// --- 2. « Jouer » d'un visiteur → inscription → retour au choix du niveau → partie ------------------------
console.log('• Visiteur : Jouer → compte → niveau → partie');
await page.locator('.manege-noms button', { hasText: 'Décollage !' }).click();
await page.locator('.vitrine-texte.devant h2', { hasText: 'Décollage !' }).waitFor();
await page.click('.vitrine-texte.devant a.jouer');
await page.waitForSelector('#compte-requis[open]');
check(await page.locator('#choix-niveau[open]').count() === 0, 'la fenêtre du niveau ne s’ouvre pas sans compte');
check((await page.textContent('#compte-requis-jeu'))?.includes('Décollage'), 'fenêtre compte requis : nom du jeu');
const lienInscription = await page.getAttribute('#compte-requis-inscription', 'href');
check(lienInscription?.includes('retour=index.html%3Fjouer%3Ddecollage') && lienInscription.endsWith('#inscription'), `lien d’inscription avec retour (${lienInscription})`);
await page.screenshot({ path: `${out}/ordinateur-compte-requis.png` });
await page.click('#compte-requis-inscription');
await page.waitForSelector('#inscription.carte-voulue');
check((await page.textContent('.chapeau'))?.includes('tu reviendras aussitôt à ton jeu'), 'Mon espace annonce le retour au jeu');
await page.fill('#inscription input[name="email"]', email);
await page.fill('#inscription input[name="motDePasse"]', motDePasse);
await page.check('#inscription input[name="adulte"]');
await page.click('#inscription button[type="submit"]');
await page.waitForSelector('#t-moi');
await page.fill('.carte-mon-profil input[name="pseudo"]', 'Capitaine');
await Promise.all([page.waitForURL(/index\.html/), page.click('.carte-mon-profil button[type="submit"]')]);
await page.waitForSelector('#choix-niveau[open]');
check((await page.textContent('#choix-niveau-jeu'))?.includes('Décollage'), 'retour à l’accueil : fenêtre du niveau ouverte pour Décollage !');
check(!new URL(page.url()).searchParams.has('jouer'), 'le paramètre « jouer » est retiré de l’adresse');
check(await page.locator('#barre .joueur-nom').textContent() === 'Capitaine', 'barre : le nouveau profil joue');
await Promise.all([page.waitForURL(/jeu\/decollage\.html\?niveau=ce1/), page.click('.choix-niveau-option[data-niveau="ce1"]')]);
await page.waitForFunction(() => window.__fusee !== undefined, null, { timeout: 60000 });
check(true, 'Décollage ! démarre au CE1');
// Une vraie fin de partie : le résultat part au serveur pour le profil.
await page.evaluate(() => window.__fusee.start('tranquille'));
await pause(800);
const profils = (await call(page, 'GET', '/etat')).data.profils;
check(profils?.length === 1, 'compte créé avec un profil');

// --- 3. Les six jeux par leur adresse, déconnecté ----------------------------------------------------------
for (const jeu of JEUX) {
  console.log(`• Adresse directe : ${jeu.nom}`);
  await call(page, 'POST', '/deconnexion', {});
  await page.goto(`${base}/jeu/${jeu.slug}.html?niveau=cm1`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/compte\.html/, { timeout: 15000 });
  const u = new URL(page.url());
  check(u.searchParams.get('retour') === `jeu/${jeu.slug}.html?niveau=cm1` && u.hash === '#connexion', `sans compte → connexion (retour ${u.searchParams.get('retour')})`);
  check(await page.evaluate((c) => window[c] === undefined && !document.querySelector('canvas'), jeu.crochet), 'le jeu n’a pas démarré');
  await seConnecterIci(page);
  await page.waitForURL(new RegExp(`jeu/${jeu.slug}\\.html\\?niveau=cm1`), { timeout: 15000 });
  await demarre(page, jeu);
  check(true, 'après connexion : retour au jeu, au niveau demandé, et il démarre');
  // Sans niveau dans l'adresse : on repasse par le choix du niveau.
  await call(page, 'POST', '/deconnexion', {});
  await page.goto(`${base}/jeu/${jeu.slug}.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/compte\.html/, { timeout: 15000 });
  await seConnecterIci(page);
  await page.waitForURL(/index\.html/, { timeout: 15000 });
  await page.waitForSelector('#choix-niveau[open]');
  check((await page.textContent('#choix-niveau-jeu'))?.trim() === jeu.nom, `sans niveau : accueil, fenêtre du niveau pour ${jeu.nom}`);
  check((await page.textContent('.vitrine-texte.devant h2'))?.trim() === jeu.nom, 'le manège est placé sur ce jeu');
  await Promise.all([page.waitForURL(new RegExp(`jeu/${jeu.slug}\\.html\\?niveau=cp`)), page.click('.choix-niveau-option[data-niveau="cp"]')]);
  await demarre(page, jeu);
  check(true, 'puis la partie démarre au CP');
}

// --- 4. Connecté : rien ne bloque, accueil personnel gardé ------------------------------------------------
console.log('• Connecté');
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.click('.vitrine-texte.devant a.jouer');
await page.waitForSelector('#choix-niveau[open]');
check(await page.locator('#compte-requis[open]').count() === 0, 'connecté : « Jouer » ouvre directement le choix du niveau');
await page.keyboard.press('Escape');
check(await page.locator('#accueil-visiteur').isHidden(), 'connecté : pas de boutons d’inscription sous le logo');
await page.waitForSelector('#univers:not([hidden])', { timeout: 10000 }).catch(() => null);
check(await page.locator('#univers').isVisible(), 'connecté : l’accueil personnel est gardé');
check(await page.locator('#panneau-joueur button', { hasText: 'Invité' }).count() === 0, 'panneau joueur : plus de choix « Invité »');

// --- 5. Plusieurs profils, personne de choisi ---------------------------------------------------------------
console.log('• Compte à plusieurs profils');
const ajout = await call(page, 'POST', '/profils', { pseudo: 'Mousse', niveau: 'cp', avatar: 'astronaute' });
check(ajout.status === 201, 'profil d’enfant ajouté');
await call(page, 'POST', `/profils/${profils[0].id}/personnel`, { personnel: false });
await page.evaluate(() => localStorage.removeItem('calcoolos.joueur'));
await page.goto(`${base}/jeu/dragon-gourmand.html?niveau=ce2`, { waitUntil: 'domcontentloaded' });
await page.waitForURL(/compte\.html\?retour=/, { timeout: 15000 });
check(!page.url().includes('#'), 'personne de choisi : Mon espace (pas la connexion)');
await page.waitForSelector('.bandeau-joueur');
await page.locator('.bandeau-choix button', { hasText: 'Mousse' }).click();
await page.waitForSelector('.bandeau-joueur a.bouton', { hasText: 'Reprendre mon jeu' });
await Promise.all([page.waitForURL(/jeu\/dragon-gourmand\.html\?niveau=ce2/), page.click('.bandeau-joueur a.bouton')]);
await page.waitForFunction(() => window.__dragon !== undefined, null, { timeout: 60000 });
check(await page.evaluate(() => JSON.parse(localStorage.getItem('calcoolos.joueur')).pseudo) === 'Mousse', 'Mousse joue au Dragon gourmand, sans boucle');

// --- 6. Progrès et classements d'un visiteur ---------------------------------------------------------------
console.log('• Visiteur : progrès, classements');
const ctxV = await browser.newContext(ordinateur);
const v = await ctxV.newPage();
surveiller(v);
await v.goto(`${base}/tableau.html`, { waitUntil: 'networkidle' });
await v.waitForSelector('.invite-classements');
check(!(await v.textContent('main')).includes('Invité'), 'Mes progrès : invitation à créer un compte, plus de tableau invité');
await v.goto(`${base}/classements.html`, { waitUntil: 'networkidle' });
await v.waitForSelector('.invite-classements');
check(!/mode invité/i.test(await v.textContent('main')), 'Classements : plus de mention du mode invité');
check(await v.locator('.podium li.invite').count() === 0, 'Classements : plus de lignes en pointillés');

// --- 7. Formats -----------------------------------------------------------------------------------------
console.log('• Formats');
for (const [nom, opts] of [['tablette', tablette], ['telephone', telephone]]) {
  const c = await browser.newContext(opts);
  const p = await c.newPage();
  surveiller(p);
  await p.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#barre .bouton-compte');
  const large = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(large, `${nom} : pas de défilement horizontal`);
  check(await p.locator('#accueil-visiteur .bouton-creer').isVisible(), `${nom} : « Créer mon compte » visible`);
  await p.screenshot({ path: `${out}/${nom}-accueil-visiteur.png` });
  const jouer = p.locator('.vitrine-texte.devant a.jouer');
  await jouer.scrollIntoViewIfNeeded();
  await jouer.click();
  await p.waitForSelector('#compte-requis[open]');
  const boite = await p.locator('#compte-requis').boundingBox();
  check(boite && boite.x >= 0 && boite.x + boite.width <= opts.viewport.width + 1, `${nom} : fenêtre compte requis dans l’écran`);
  await p.screenshot({ path: `${out}/${nom}-compte-requis.png` });
  await c.close();
}

// --- Nettoyage -----------------------------------------------------------------------------------------
const suppr = await call(page, 'POST', '/supprimer-compte', { motDePasse });
check(suppr.status === 200, `compte d’essai supprimé (${suppr.status})`);
check(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
await browser.close();
console.log(`\n${ok}/${ok + ko} vérifications réussies`);
process.exit(ko ? 1 : 0);
