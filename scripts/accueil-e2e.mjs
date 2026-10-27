/**
 * Chantier 02 (accueil) dans Chromium, avec la vraie API PHP : logo animé, espace joueur, choix du niveau,
 * fenêtre du premier niveau, rappels près de « Jouer », lancement des quatre jeux au bon niveau, carnet,
 * inscription et connexion, profils (niveau du profil, changement de joueur sans rechargement, niveau
 * enregistré sur le profil), déconnexion, animations réduites, langues, formats tablette et téléphone.
 *
 * Prérequis : `npm run api` (PHP, base de développement) et `npm run dev`.
 * Usage : node scripts/accueil-e2e.mjs [urlDeBase] [dossierCaptures]
 * Crée un compte de test jetable (adresse aléatoire) puis le supprime.
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
const out = process.argv[3] ?? 'CAPTURES/chantier-02';
mkdirSync(out, { recursive: true });
const problems = [];
let total = 0;
const check = (cond, what) => {
  total++;
  if (!cond) problems.push(`ÉCHEC : ${what}`);
  console.log(cond ? '  ok' : '  ÉCHEC', '-', what);
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ordinateur = { viewport: { width: 1440, height: 900 }, locale: 'fr-FR' };
const ctx = await browser.newContext(ordinateur);
const page = await ctx.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
const niveauCoche = () => page.evaluate(() => document.querySelector('input[name="niveau"]:checked')?.value ?? null);

// --- 1. Nouveau venu ---------------------------------------------------------------------------------
console.log('• Nouveau venu (invité, aucun niveau choisi)');
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('.joueur-invite');
check((await page.textContent('.joueur'))?.includes('Invité'), 'barre : joueur « Invité »');
check((await page.textContent('.joueur'))?.includes('sans compte'), 'barre : statut « sans compte »');
check(await page.locator('#titre .logo-yeux .oeil').count() === 2, 'logo : deux yeux à la place de « oo »');
check((await page.textContent('#titre .visuel-masque')) === 'Calcoolos', 'logo : nom lisible « Calcoolos » pour les lecteurs d’écran');
check((await page.title()).startsWith('Calcoolos'), 'titre de la page : Calcoolos');
check(await niveauCoche() === null, 'aucun niveau imposé au nouveau venu');
check(await page.locator('#niveau.a-choisir .niveau-alerte').isVisible(), 'étiquette « avant de jouer » visible');
check(await page.locator('.barre .bouton-compte', { hasText: 'Créer mon compte' }).isVisible(), 'barre : bouton « Créer mon compte »');
check(await page.locator('.barre .lien-compte', { hasText: 'Se connecter' }).isVisible(), 'barre : lien « Se connecter »');
check(await page.locator('#carnet .bouton-creer').getAttribute('href') === 'compte.html#inscription', 'carnet : « Créer mon compte gratuit » mène à l’inscription');
// La bulle de pensée du logo a fait son calcul (attente de l'arrivée, ≈ 5 s en GPU logiciel).
await page.waitForSelector('.pensee.trouve', { timeout: 12000 }).catch(() => null);
const pensee = await page.textContent('.pensee-texte').catch(() => '');
check(/^\d+ [+−×÷] \d+ = \d+$/.test((pensee ?? '').replace(/\s+/g, ' ').trim()), `logo : la bulle affiche un calcul résolu (${pensee?.trim()})`);
await page.screenshot({ path: `${out}/ordinateur-accueil-pensee.png` });
await page.waitForSelector('.pensee:not(.visible)', { state: 'attached', timeout: 6000 }).catch(() => null);
await page.screenshot({ path: `${out}/ordinateur-accueil.png` });

// Panneau de l'espace joueur.
await page.click('.joueur');
check(await page.locator('#panneau-joueur').isVisible(), 'panneau joueur : s’ouvre au clic');
check((await page.textContent('#panneau-joueur'))?.includes('Tu joues en invité'), 'panneau joueur : statut invité expliqué');
check(await page.locator('#panneau-joueur a[href="compte.html#inscription"]').isVisible(), 'panneau joueur : « Créer mon compte »');
check(await page.locator('#panneau-joueur a[href="compte.html#connexion"]').isVisible(), 'panneau joueur : « Se connecter »');
await page.waitForTimeout(400); // fin du fondu d'ouverture
await page.screenshot({ path: `${out}/ordinateur-panneau-invite.png` });
await page.keyboard.press('Escape');
check(await page.locator('#panneau-joueur').isHidden(), 'panneau joueur : Échap le ferme');
check(await page.evaluate(() => document.activeElement?.classList.contains('joueur')), 'panneau joueur : le focus revient au bouton');

// Premier « Jouer » sans niveau : la fenêtre le demande, puis le jeu se lance à ce niveau.
await page.locator('#jeu-cubes').scrollIntoViewIfNeeded();
check((await page.textContent('#jeu-cubes .rappel-niveau'))?.includes('Niveau à choisir'), 'rappel près de « Jouer » : niveau à choisir');
await page.click('#jeu-cubes a.jouer');
await page.waitForSelector('#choix-niveau[open]');
check(true, 'premier « Jouer » : la fenêtre « Quel est ton niveau ? » s’ouvre');
await page.waitForTimeout(400); // fin du fondu d'ouverture
await page.screenshot({ path: `${out}/ordinateur-choix-niveau.png` });
await Promise.all([page.waitForURL(/cubes-de-siege\.html/), page.click('.choix-niveau-option[data-niveau="stratege"]')]);
check(new URL(page.url()).searchParams.get('niveau') === 'stratege', 'Cubes de siège lancé au niveau Stratège');

// Retour : le niveau est retenu, plus de fenêtre.
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
check(await niveauCoche() === 'stratege', 'retour à l’accueil : niveau Stratège retenu');
check((await page.textContent('#niveau-detail'))?.includes('Calculs jusqu’à 100'), 'détail du niveau affiché');
check((await page.textContent('#jeu-dragon .rappel-niveau'))?.includes('Stratège'), 'rappel près de « Jouer » : Stratège');

// Les quatre jeux reçoivent le niveau choisi (ici Éveil, choisi par un clic).
await page.click('input[value="eveil"]');
for (const [id, fichier] of [['jeu-cubes', 'cubes-de-siege'], ['jeu-meteores', 'pluie-de-meteores'], ['jeu-dragon', 'dragon-gourmand'], ['jeu-fusee', 'decollage']]) {
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await Promise.all([page.waitForURL(new RegExp(fichier)), page.click(`#${id} a.jouer`)]);
  await page.waitForSelector('canvas', { timeout: 15000 });
  check(new URL(page.url()).searchParams.get('niveau') === 'eveil', `${fichier} : lancé directement au niveau Éveil`);
}
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });

// Le rappel « changer » ramène au choix du niveau.
await page.locator('#jeu-fusee').scrollIntoViewIfNeeded();
await page.click('#jeu-fusee .rappel-niveau');
await page.waitForTimeout(900);
check(await page.evaluate(() => document.activeElement?.getAttribute('name') === 'niveau'), 'rappel « changer » : le focus va sur le choix du niveau');

// --- 2. Inscription depuis l'accueil -------------------------------------------------------------------
console.log('• Inscription et profils');
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await Promise.all([page.waitForURL(/compte\.html#inscription/), page.click('#carnet .bouton-creer')]);
await page.waitForSelector('#inscription.carte-voulue');
check(await page.evaluate(() => document.querySelector('.grille > .carte')?.id === 'inscription'), 'compte : la carte d’inscription passe en premier');
check(await page.evaluate(() => document.activeElement?.closest('#inscription') !== null), 'compte : le curseur est dans l’inscription');
await page.screenshot({ path: `${out}/ordinateur-inscription.png` });
const email = `chantier02-${Date.now()}@exemple.test`;
const mdp = 'motdepasse-test-123';
await page.fill('#inscription input[name="email"]', email);
await page.fill('#inscription input[name="motDePasse"]', mdp);
await page.check('#inscription input[name="adulte"]');
await page.click('#inscription button[type="submit"]');
await page.waitForSelector('h1:has-text("Espace famille")');
const ajouter = async (pseudo, avatar, niveau) => {
  const form = page.locator('section:has(h2:has-text("Nouveau profil")) form');
  await form.locator('input[name="pseudo"]').fill(pseudo);
  await form.locator('select[name="niveau"]').selectOption(niveau);
  await form.locator(`input[value="${avatar}"]`).check({ force: true });
  await form.locator('button[type="submit"]').click();
  await page.waitForSelector(`article.profil h3:has-text("${pseudo}")`);
};
await ajouter('Lina', 'chat-noir', 'eveil');
await ajouter('Noé', 'sorcier', 'maitre');
check(true, 'compte créé, deux profils ajoutés');

// --- 3. Accueil connecté --------------------------------------------------------------------------------
console.log('• Accueil connecté');
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('.joueur-profil');
check((await page.textContent('.joueur'))?.includes('Lina'), 'barre : Lina joue (premier profil)');
check((await page.textContent('.joueur'))?.includes('Niveau Éveil'), 'barre : niveau du profil affiché');
check(await niveauCoche() === 'eveil', 'accueil : niveau du profil de Lina (Éveil)');
await page.waitForFunction(() => document.querySelector('#carnet-titre')?.textContent?.includes('Lina'));
check(true, 'carnet : « Le carnet de Lina »');
check(await page.locator('.barre .lien-compte', { hasText: 'Espace famille' }).isVisible(), 'barre : « Espace famille » pour un compte connecté');
check(await page.locator('#statut-invite').isHidden(), 'accueil : plus de message « invité »');
await page.evaluate(() => (window.__sansRechargement = true));
await page.click('.joueur');
await page.waitForTimeout(400); // fin du fondu d'ouverture
await page.screenshot({ path: `${out}/ordinateur-panneau-famille.png` });
await page.click('#panneau-joueur .panneau-profils button:has-text("Noé")');
await page.waitForFunction(() => document.querySelector('.joueur')?.textContent?.includes('Noé'));
check(await page.evaluate(() => window.__sansRechargement === true), 'changer de joueur depuis la barre : sans recharger la page');
check(await niveauCoche() === 'maitre', 'changer de joueur : le niveau suit (Maître pour Noé)');
await page.waitForFunction(() => document.querySelector('#carnet-titre')?.textContent?.includes('Noé'));
check(true, 'changer de joueur : le carnet suit');
// Noé passe en Stratège : enregistré sur son profil.
await page.click('input[value="stratege"]');
await page.waitForTimeout(600);
const profils = await page.evaluate(async () => (await (await fetch('api/etat')).json()).profils);
check(profils.find((p) => p.pseudo === 'Noé')?.niveau === 'stratege', 'niveau changé à l’accueil : enregistré sur le profil de Noé');
check((await page.textContent('.joueur'))?.includes('Niveau Stratège'), 'barre : niveau mis à jour');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.joueur-profil');
check((await page.textContent('.joueur'))?.includes('Noé') && (await niveauCoche()) === 'stratege', 'après rechargement : Noé, niveau Stratège');
await page.screenshot({ path: `${out}/ordinateur-accueil-connecte.png` });
// « Qui joue ? » sur l'accueil.
await page.locator('#qui-joue button', { hasText: 'Lina' }).click();
check(await niveauCoche() === 'eveil' && (await page.textContent('.joueur'))?.includes('Lina'), '« Qui joue ? » : Lina, niveau Éveil');

// --- 4. Tablette et téléphone (même compte) ---------------------------------------------------------
console.log('• Tablette et téléphone');
const etat = await ctx.storageState();
for (const [nom, opts] of [
  ['tablette', { viewport: { width: 834, height: 1112 }, hasTouch: true }],
  ['tablette-paysage', { viewport: { width: 1180, height: 820 }, hasTouch: true }],
  ['telephone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
]) {
  const c = await browser.newContext({ ...opts, locale: 'fr-FR', storageState: etat });
  const p = await c.newPage();
  p.on('pageerror', (e) => erreurs.push(`${nom} : ${e.message}`));
  await p.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.joueur-profil');
  const debord = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(debord <= 0, `${nom} : aucune barre de défilement horizontale (${debord} px)`);
  const nomVisible = await p.evaluate(() => {
    const n = document.querySelector('.joueur-nom');
    return n && n.scrollWidth <= n.clientWidth + 1;
  });
  check(nomVisible, `${nom} : nom du joueur lisible en entier dans la barre`);
  await p.waitForTimeout(5500);
  await p.screenshot({ path: `${out}/${nom}-accueil-connecte.png` });
  await p.tap('.joueur');
  check(await p.locator('#panneau-joueur').isVisible(), `${nom} : panneau joueur au toucher`);
  const dansEcran = await p.evaluate(() => {
    const r = document.querySelector('#panneau-joueur').getBoundingClientRect();
    return r.left >= 0 && r.right <= window.innerWidth;
  });
  check(dansEcran, `${nom} : panneau joueur entièrement dans l’écran`);
  await p.waitForTimeout(400); // fin du fondu d'ouverture
  await p.screenshot({ path: `${out}/${nom}-panneau.png` });
  await c.close();
}

// --- 5. Déconnexion ------------------------------------------------------------------------------
console.log('• Déconnexion');
await page.click('.joueur');
await Promise.all([page.waitForNavigation(), page.click('#panneau-joueur .panneau-lien')]);
await page.waitForSelector('.joueur-invite');
check((await page.textContent('.joueur'))?.includes('Invité'), 'déconnexion depuis le panneau : retour en invité');

// --- 6. Invité sur tablette et téléphone, animations réduites, langue ------------------------------------
console.log('• Invité : formats, animations réduites, langues');
for (const [nom, opts] of [
  ['tablette', { viewport: { width: 834, height: 1112 }, hasTouch: true }],
  ['telephone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
]) {
  const c = await browser.newContext({ ...opts, locale: 'fr-FR' });
  const p = await c.newPage();
  await p.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `${out}/${nom}-accueil-invite.png` });
  await c.close();
}
{
  const c = await browser.newContext({ ...ordinateur, reducedMotion: 'reduce' });
  const p = await c.newPage();
  await p.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(3000);
  check(await p.locator('.pensee').count() === 0, 'animations réduites : pas de bulle animée');
  const anims = await p.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  check(anims === 0, `animations réduites : aucune animation en cours (${anims})`);
  check(await p.locator('#titre .oeil').count() === 2, 'animations réduites : logo complet (yeux présents)');
  await p.screenshot({ path: `${out}/ordinateur-animations-reduites.png` });
  await c.close();
}
for (const [loc, attendu] of [['en-GB', 'Create my account'], ['de-DE', 'Konto anlegen']]) {
  const c = await browser.newContext({ ...ordinateur, locale: loc });
  const p = await c.newPage();
  await p.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.bouton-compte');
  check((await p.textContent('.bouton-compte'))?.trim() === attendu, `${loc} : bouton « ${attendu} »`);
  const manquantes = await p.evaluate(() => [...(window.__tradManquantes ?? [])]);
  check(manquantes.length === 0, `${loc} : aucun texte resté en français (${manquantes.join(' | ')})`);
  check((await p.textContent('#titre .visuel-masque')) === 'Calcoolos', `${loc} : le nom Calcoolos n’est pas traduit`);
  await p.screenshot({ path: `${out}/ordinateur-${loc}.png` });
  await c.close();
}

// --- Nettoyage : suppression du compte de test ------------------------------------------------------
{
  const c = await browser.newContext(ordinateur);
  const p = await c.newPage();
  await p.goto(`${base}/compte.html#connexion`, { waitUntil: 'networkidle' });
  await p.fill('#connexion input[name="email"]', email);
  await p.fill('#connexion input[name="motDePasse"]', mdp);
  await p.click('#connexion button[type="submit"]');
  await p.waitForSelector('h1:has-text("Espace famille")');
  p.on('dialog', (d) => d.accept());
  await p.locator('summary', { hasText: 'Supprimer le compte' }).click();
  await p.fill('form:has(button:has-text("Supprimer mon compte")) input[name="motDePasse"]', mdp);
  await Promise.all([p.waitForNavigation(), p.click('button:has-text("Supprimer mon compte")')]);
  const e = await p.evaluate(async () => (await (await fetch('api/etat')).json()).connecte);
  check(e === false, 'compte de test supprimé');
  await c.close();
}

check(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.join(' | ')})`);
await browser.close();
console.log(`\n${total - problems.length}/${total} vérifications réussies`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
