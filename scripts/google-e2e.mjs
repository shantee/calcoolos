/**
 * « Continuer avec Google » dans Chromium, avec la vraie API PHP, SANS les serveurs de Google : le script
 * de Google (accounts.google.com/gsi/client) est remplacé par une imitation qui dessine un bouton et rend
 * des jetons signés par une clé de test. L'API vérifie ces jetons exactement comme ceux de Google (même
 * code), avec les clés publiques de test au lieu de celles de Google.
 * Ce test prouve notre côté (bouton, création, connexion, association, annulation, refus, panne de
 * Google) ; il ne prouve pas la configuration chez Google, qui se vérifie à la main en ligne.
 *
 * Prérequis :
 *   - l'API lancée avec GOOGLE_CLIENT_ID=123-test.apps.googleusercontent.com et
 *     GOOGLE_CERTS_FILE=<dépôt>/server/var/google-test-certs.json (fichier écrit par ce script) ;
 *   - npm run dev.
 * Usage : node scripts/google-e2e.mjs [urlDeBase] [dossierCaptures]
 * Crée deux comptes de test jetables puis les supprime.
 */
import { generateKeyPairSync, sign, randomBytes } from 'node:crypto';
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
const out = process.argv[3] ?? 'CAPTURES/google';
mkdirSync(out, { recursive: true });
const problems = [];
let total = 0;
const check = (cond, what) => {
  total++;
  if (!cond) problems.push(`ÉCHEC : ${what}`);
  console.log(cond ? '  ok' : '  ÉCHEC', '-', what);
};

// --- Une fausse « Google » : clé de test publiée dans le fichier de clés lu par l'API --------------------
const cle = generateKeyPairSync('rsa', { modulusLength: 2048 });
const autreCle = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = cle.publicKey.export({ format: 'jwk' });
writeFileSync(new URL('../server/var/google-test-certs.json', import.meta.url), JSON.stringify({ keys: [{ ...jwk, kid: 'cle-e2e', alg: 'RS256', use: 'sig' }] }));
const b64 = (x) => Buffer.from(x).toString('base64url');
let clientId = '';
function jeton({ sub, email }, privee = cle.privateKey) {
  const t = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: 'RS256', kid: 'cle-e2e', typ: 'JWT' }));
  const p = b64(JSON.stringify({ iss: 'https://accounts.google.com', aud: clientId, sub, email, email_verified: true, iat: t, exp: t + 3600 }));
  return `${h}.${p}.${sign('sha256', Buffer.from(`${h}.${p}`), privee).toString('base64url')}`;
}

// Imitation du script de Google : un bouton ; au clic, « choix du compte » piloté par le test.
const FAUX_GSI = `window.google = { accounts: { id: {
  initialize(o) { window.__gsi = o; },
  renderButton(el, opts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'faux-google';
    b.textContent = 'Continuer avec Google (simulé)';
    b.style.cssText = 'height:40px;border-radius:20px;background:#fff;color:#1f1f1f;border:1px solid #747775;font:500 14px Arial,sans-serif;width:' + opts.width + 'px';
    b.onclick = async () => {
      const j = await window.__choisirCompteGoogle();
      if (j) window.__gsi.callback({ credential: j, select_by: 'btn' });
    };
    el.replaceChildren(b);
  },
  disableAutoSelect() {},
} } };`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ordinateur = { viewport: { width: 1280, height: 900 }, locale: 'fr-FR' };
const tablette = { viewport: { width: 820, height: 1180 }, locale: 'fr-FR', isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const erreurs = [];
/** Choix de la prochaine « fenêtre Google » : un compte, null (fenêtre fermée) ou un jeton invalide. */
let prochain = null;

async function nouvellePage(options, google = 'faux') {
  const c = await browser.newContext(options);
  await c.route('https://accounts.google.com/**', (route) =>
    google === 'faux' ? route.fulfill({ contentType: 'text/javascript', body: FAUX_GSI }) : route.abort());
  await c.exposeFunction('__choisirCompteGoogle', () => (prochain === 'invalide' ? jeton({ sub: '1', email: 'x@gmail.com' }, autreCle.privateKey) : prochain ? jeton(prochain) : null));
  const p = await c.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message));
  return { c, p };
}
const etat = (p) => p.evaluate(async () => (await (await fetch('api/etat')).json()));
const auHasard = randomBytes(4).toString('hex');
const compteG = { sub: `e2e${auHasard}1`, email: `e2e-google-${auHasard}@exemple.fr` };
const classique = { email: `e2e-classique-${auHasard}@exemple.fr`, mdp: `mot-de-passe-${auHasard}` };
const subAssocie = `e2e${auHasard}2`;

// --- 1. Page de connexion : le bouton, l'annulation, un jeton refusé --------------------------------------
console.log('• Espace parents (invité)');
let { c, p } = await nouvellePage(ordinateur);
const requetesGoogleAccueil = [];
p.on('request', (r) => {
  if (r.url().includes('accounts.google.com') && p.url().includes('index.html')) requetesGoogleAccueil.push(r.url());
});
await p.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
check(requetesGoogleAccueil.length === 0, 'accueil : le script de Google n’est pas chargé (seulement dans l’espace parents)');
await p.goto(`${base}/compte.html#inscription`, { waitUntil: 'networkidle' });
clientId = (await etat(p)).googleClientId ?? '';
check(clientId !== '', `l’API annonce l’identifiant client Google (${clientId})`);
await p.waitForSelector('.faux-google');
check(await p.locator('#inscription .faux-google').isVisible() && await p.locator('#connexion .faux-google').isVisible(), 'bouton « Continuer avec Google » sur l’inscription et la connexion');
check((await p.textContent('#inscription .google-mention'))?.includes('adulte responsable'), 'mention « adulte responsable » près du bouton');
check(await p.locator('#inscription form input[name="email"]').isVisible() && await p.locator('#connexion form input[name="motDePasse"]').isVisible(), 'formulaires classiques toujours là');
check(await p.evaluate(() => document.activeElement?.closest('#inscription form') !== null), 'le curseur reste dans le formulaire d’inscription');
await p.screenshot({ path: `${out}/ordinateur-espace-parents.png` });

prochain = null;
await p.click('#connexion .faux-google');
await p.waitForTimeout(600);
check((await etat(p)).connecte === false && await p.locator('h1', { hasText: 'Espace parents' }).isVisible(), 'fenêtre Google fermée : on reste sur la page');
check(await p.locator('.google-bloc .message.erreur').count() === 0, 'fenêtre Google fermée : aucun message d’erreur');

prochain = 'invalide';
await p.click('#connexion .faux-google');
await p.waitForSelector('.google-bloc .message.erreur');
check((await p.textContent('#connexion .google-bloc .message'))?.includes('Connexion Google refusée'), 'jeton invalide : connexion refusée, message clair');
check((await etat(p)).connecte === false, 'jeton invalide : pas connecté');

// --- 2. Nouveau compte avec Google -------------------------------------------------------------------
console.log('• Nouveau compte avec Google');
prochain = compteG;
await p.click('#inscription .faux-google');
await p.waitForSelector('h1:has-text("Espace famille")');
let e = await etat(p);
check(e.connecte && e.email === compteG.email && e.google === true && e.motDePasse === false, 'compte créé et connecté, sans mot de passe');
check((await p.textContent('#contenu'))?.includes('créé avec Google'), 'espace famille : « compte créé avec Google »');
check(await p.locator('summary', { hasText: 'Changer le mot de passe' }).count() === 0, 'pas de « changer le mot de passe » pour un compte Google');
await p.waitForSelector('.joueur-profil, .barre .lien-compte:has-text("Espace famille"), .joueur');
check((await p.textContent('.joueur'))?.includes('choisis un profil'), 'barre : connecté (« choisis un profil »)');
await p.fill('form:has(button:has-text("Ajouter le profil")) input[name="pseudo"]', 'Gogo');
await p.click('button:has-text("Ajouter le profil")');
await p.waitForSelector('.profil h3:has-text("Gogo")');
check(true, 'profil « Gogo » créé sur le compte Google');
await p.screenshot({ path: `${out}/ordinateur-compte-google.png` });
await p.click('#contenu button:has-text("Se déconnecter")');
await p.waitForSelector('.faux-google');
check((await etat(p)).connecte === false, 'déconnexion');
prochain = compteG;
await p.click('#connexion .faux-google');
await p.waitForSelector('h1:has-text("Espace famille")');
check(await p.locator('.profil h3', { hasText: 'Gogo' }).isVisible(), 'reconnexion avec Google : profil retrouvé');
await c.close();

// --- 3. Compte classique existant, puis association ------------------------------------------------------
console.log('• Compte existant (e-mail + mot de passe) puis association');
({ c, p } = await nouvellePage(ordinateur));
await p.goto(`${base}/compte.html#inscription`, { waitUntil: 'networkidle' });
await p.fill('#inscription input[name="email"]', classique.email);
await p.fill('#inscription input[name="motDePasse"]', classique.mdp);
await p.check('#inscription input[name="adulte"]');
await p.click('#inscription button[type="submit"]');
await p.waitForSelector('h1:has-text("Espace famille")');
check(true, 'inscription classique toujours possible');
await p.fill('form:has(button:has-text("Ajouter le profil")) input[name="pseudo"]', 'Classe');
await p.click('button:has-text("Ajouter le profil")');
await p.waitForSelector('.profil h3:has-text("Classe")');
const profilClasse = (await etat(p)).profils[0];
// Un résultat de partie, pour vérifier qu'il survit à l'association.
const envoi = await p.evaluate(async (id) => {
  const csrf = (await (await fetch('api/etat')).json()).csrf;
  const r = await fetch('api/resultats', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Calcoolos': '1', 'X-CSRF-Token': csrf }, body: JSON.stringify({ profil: id, jeu: 'dragon', niveau: 'explorateur', mode: 'defi', score: 8000, gagne: true, etoiles: 2, duree: 240, precision: 0.9, ops: { '+': [17, 2] }, details: { objectifs: 17 } }) });
  return r.status;
}, profilClasse.id);
check(envoi === 201, 'une partie enregistrée sur le compte classique');
await p.click('#contenu button:has-text("Se déconnecter")');
await p.waitForSelector('.faux-google');
prochain = { sub: subAssocie, email: classique.email };
await p.click('#connexion .faux-google');
await p.waitForSelector('#connexion .google-bloc .message.erreur');
check((await p.textContent('#connexion .google-bloc .message'))?.includes('existe déjà'), 'même adresse qu’un compte existant : pas de fusion, explication');
check((await etat(p)).connecte === false, 'pas connecté sans preuve du mot de passe');
await p.screenshot({ path: `${out}/ordinateur-compte-existant.png` });
await p.fill('#connexion input[name="email"]', classique.email);
await p.fill('#connexion input[name="motDePasse"]', classique.mdp);
await p.click('#connexion button[type="submit"]');
await p.waitForSelector('h1:has-text("Espace famille")');
check(await p.locator('.google-compte h3', { hasText: 'Se connecter plus vite' }).isVisible(), 'espace famille : proposition d’associer Google');
await p.screenshot({ path: `${out}/ordinateur-associer.png` });
prochain = { sub: subAssocie, email: classique.email };
await p.click('.google-compte .faux-google');
await p.waitForSelector('.google-compte:has-text("Compte Google associé")');
e = await etat(p);
check(e.google === true && e.motDePasse === true, 'Google associé, mot de passe conservé');
await p.click('#contenu button:has-text("Se déconnecter")');
await p.waitForSelector('.faux-google');
prochain = { sub: subAssocie, email: classique.email };
await p.click('#connexion .faux-google');
await p.waitForSelector('h1:has-text("Espace famille")');
e = await etat(p);
check(e.email === classique.email && e.profils.length === 1 && e.profils[0].pseudo === 'Classe', 'connexion avec Google : même compte, profil conservé');
const res = await p.evaluate(async (id) => (await (await fetch(`api/profils/${id}/resultats`)).json()).resultats.length, profilClasse.id);
check(res === 1, 'résultats conservés après association');
await c.close();

// --- 4. Tablette ---------------------------------------------------------------------------------------
console.log('• Tablette');
({ c, p } = await nouvellePage(tablette));
await p.goto(`${base}/compte.html#connexion`, { waitUntil: 'networkidle' });
await p.waitForSelector('#connexion .faux-google');
const boite = await p.locator('#connexion .faux-google').boundingBox();
check(boite && boite.width >= 220 && boite.height >= 40, `tablette : bouton Google assez grand pour le doigt (${Math.round(boite?.width ?? 0)}×${Math.round(boite?.height ?? 0)})`);
await p.screenshot({ path: `${out}/tablette-espace-parents.png` });
prochain = compteG;
await p.tap('#connexion .faux-google');
await p.waitForSelector('h1:has-text("Espace famille")');
check(await p.locator('.profil h3', { hasText: 'Gogo' }).isVisible(), 'tablette : connexion au doigt, profil retrouvé');
await p.screenshot({ path: `${out}/tablette-espace-famille.png` });
await c.close();

// --- 5. Google injoignable : le reste fonctionne ----------------------------------------------------------
console.log('• Google injoignable');
({ c, p } = await nouvellePage(ordinateur, 'panne'));
await p.goto(`${base}/compte.html#connexion`, { waitUntil: 'networkidle' });
await p.waitForTimeout(500);
check(await p.locator('.google-bloc').count() === 0, 'Google injoignable : le bloc Google disparaît');
await p.fill('#connexion input[name="email"]', classique.email);
await p.fill('#connexion input[name="motDePasse"]', classique.mdp);
await p.click('#connexion button[type="submit"]');
await p.waitForSelector('h1:has-text("Espace famille")');
check(true, 'Google injoignable : connexion par mot de passe');
await p.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
check(await p.locator('.mosaique, #niveau').first().isVisible(), 'accueil normal');
await c.close();

// --- Nettoyage -----------------------------------------------------------------------------------------
console.log('• Nettoyage');
({ c, p } = await nouvellePage(ordinateur));
p.on('dialog', (d) => d.accept());
await p.goto(`${base}/compte.html#connexion`, { waitUntil: 'networkidle' });
prochain = compteG;
await p.click('#connexion .faux-google');
await p.waitForSelector('h1:has-text("Espace famille")');
await p.locator('summary', { hasText: 'Supprimer le compte' }).click();
await p.fill('form:has(button:has-text("Supprimer mon compte")) input[name="confirmation"]', compteG.email);
await Promise.all([p.waitForNavigation(), p.click('button:has-text("Supprimer mon compte")')]);
check((await etat(p)).connecte === false, 'compte Google supprimé (confirmation par l’adresse)');
await p.waitForSelector('#connexion input[name="email"]');
await p.fill('#connexion input[name="email"]', classique.email);
await p.fill('#connexion input[name="motDePasse"]', classique.mdp);
await p.click('#connexion button[type="submit"]');
await p.waitForSelector('h1:has-text("Espace famille")');
await p.locator('summary', { hasText: 'Supprimer le compte' }).click();
await p.fill('form:has(button:has-text("Supprimer mon compte")) input[name="motDePasse"]', classique.mdp);
await Promise.all([p.waitForNavigation(), p.click('button:has-text("Supprimer mon compte")')]);
check((await etat(p)).connecte === false, 'compte classique supprimé');
await c.close();

check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.join(' | ')})`);
await browser.close();
console.log(`\n${total - problems.length}/${total} vérifications réussies`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
