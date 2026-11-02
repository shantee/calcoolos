/**
 * Accueil dans Chromium, avec la vraie API PHP : logo animé, espace joueur, manège des jeux (flèches, clavier,
 * glissé à la souris et au doigt, carte de côté, adresse #jeu-…), difficulté choisie au lancement des six jeux,
 * carnet, inscription et connexion, profils (niveau du profil, changement de joueur sans rechargement, niveau
 * enregistré sur le profil), déconnexion, animations réduites, formats tablette et téléphone.
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
// Le niveau retenu est celui qu'emportent les liens de lancement.
const niveauRetenu = (p = page) => p.evaluate(() => new URL(document.querySelector('a.jouer').href).searchParams.get('niveau'));
const nomDeFace = (p = page) => p.textContent('.vitrine-texte.devant h2');
const deFace = async (nom, p = page) => {
  await p.locator('.manege-noms button', { hasText: nom }).click();
  await p.locator('.vitrine-texte.devant h2', { hasText: nom }).waitFor();
};
const fenetre = '#choix-niveau[open]';

// --- 1. Nouveau venu ---------------------------------------------------------------------------------
console.log('• Nouveau venu (invité, aucun niveau choisi)');
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('.joueur-invite');
check((await page.textContent('.joueur'))?.includes('Invité'), 'barre : joueur « Invité »');
check((await page.textContent('.joueur'))?.includes('sans compte'), 'barre : statut « sans compte »');
check(await page.locator('#titre .logo-yeux .oeil').count() === 2, 'logo : deux yeux à la place de « oo »');
check((await page.textContent('#titre .visuel-masque')) === 'Calcoolos', 'logo : nom lisible « Calcoolos » pour les lecteurs d’écran');
check((await page.title()).startsWith('Calcoolos'), 'titre de la page : Calcoolos');
check(await niveauRetenu() === null, 'aucun niveau imposé au nouveau venu');
check(await page.locator('input[name="niveau"], .mosaique, .reperes').count() === 0, 'plus de sélecteur global, de vignettes ni de repères');
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

// --- Le manège --------------------------------------------------------------------------------------
console.log('• Manège');
check(await page.locator('.vitrine-image').count() === 6, 'six cartes sur le manège');
check(await page.locator('.manege-noms button').count() === 6, 'six noms de jeux à toucher');
check(await nomDeFace() === 'Décollage !', 'nouveau venu : Décollage ! de face');
check(await page.locator('.vitrine-texte:visible').count() === 1, 'une seule description visible');
const texteJeu = await page.textContent('.vitrine-texte.devant');
check(/Calcul rapide/.test(texteJeu) && /poussée/.test(texteJeu) && /décollage/.test(texteJeu), 'la description garde compétences, explication et exemple');
await page.click('.manege-suivant');
check(await nomDeFace() === 'Pluie de météores', 'flèche suivante : Pluie de météores de face');
check(await page.evaluate(() => document.documentElement.dataset.univers) === 'meteores', 'le fond prend l’ambiance du jeu de face');
check((await page.textContent('[aria-live="polite"].visuel-masque'))?.includes('jeu 2 sur 6'), 'jeu de face annoncé aux lecteurs d’écran');
await page.click('.manege-precedent');
await page.click('.manege-precedent');
check(await nomDeFace() === 'MULTIRAIL', 'flèche précédente : le manège fait le tour');
await page.locator('.manege-suivant').focus();
await page.keyboard.press('ArrowRight');
check(await nomDeFace() === 'Décollage !', 'touche flèche droite : jeu suivant');
const carteDe = (id) => page.locator(`#${id} .vitrine-image`);
const milieu = async (loc) => {
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
await page.locator('.vitrine-texte.devant a.jouer').focus();
await page.keyboard.press('ArrowRight');
check(await nomDeFace() === 'Pluie de météores' && await page.evaluate(() => document.activeElement === document.querySelector('.vitrine-texte.devant a.jouer')), 'clavier : le focus suit le bouton « Jouer » du jeu de face');
await page.keyboard.press('ArrowLeft');
await page.locator('.manege-noms button').last().focus();
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
check(await page.evaluate(() => document.activeElement === document.querySelector('.vitrine-texte.devant a.jouer')), 'tabulation : des noms au bouton « Jouer »');
await page.keyboard.press('Enter');
await page.waitForSelector(fenetre);
check(true, 'clavier : Entrée sur « Jouer » ouvre le choix de la difficulté');
await page.keyboard.press('Escape');
await page.waitForTimeout(900);
const m = await milieu(carteDe('jeu-fusee'));
await page.mouse.move(m.x, m.y);
await page.mouse.down();
await page.mouse.move(m.x - 60, m.y, { steps: 4 });
await page.mouse.move(m.x - 180, m.y, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(120);
check(await nomDeFace() === 'Pluie de météores', 'glisser à la souris : le manège tourne');
check(await page.locator(fenetre).count() === 0, 'glisser ne lance pas de jeu');
await page.waitForTimeout(900);
const cote = await milieu(carteDe('jeu-cubes'));
await page.mouse.click(cote.x + 60, cote.y);
await page.waitForTimeout(200);
check(await nomDeFace() === 'Panique au phare !' && await page.locator(fenetre).count() === 0, 'carte de côté : elle vient de face, sans lancer le jeu');
await page.waitForTimeout(900);
await page.goto(`${base}/index.html#jeu-neon`, { waitUntil: 'networkidle' });
check(await nomDeFace() === 'Neon Flight', 'adresse #jeu-neon : Neon Flight de face');
await page.evaluate(() => { location.hash = '#jeu-dragon'; });
await page.locator('.vitrine-texte.devant h2', { hasText: 'Dragon' }).waitFor();
check(true, 'changement d’adresse : le manège suit');

// --- La difficulté se choisit à chaque lancement ------------------------------------------------------
console.log('• Difficulté au lancement');
await deFace('Panique au phare !');
await page.click('.vitrine-texte.devant a.jouer');
await page.waitForSelector(fenetre);
check((await page.textContent('#choix-niveau-jeu')) === 'Panique au phare !', 'la fenêtre nomme le jeu');
check(await page.locator('.choix-niveau-option').count() === 4, 'quatre difficultés proposées');
check(await page.locator('.choix-niveau-option.choisi').count() === 0, 'nouveau venu : aucune difficulté présélectionnée');
await page.waitForTimeout(400); // fin du fondu d'ouverture
await page.screenshot({ path: `${out}/ordinateur-choix-niveau.png` });
await page.keyboard.press('Escape');
check(await page.locator(fenetre).count() === 0 && page.url().includes('index.html'), 'Échap : retour à l’accueil, aucun jeu lancé');
await page.click('.vitrine-texte.devant a.jouer');
await page.waitForSelector(fenetre);
await page.click('.choix-niveau-fermer');
check(await page.locator(fenetre).count() === 0 && page.url().includes('index.html'), '« Annuler » : aucun jeu lancé');
await page.click('.vitrine-image.devant a.lancer');
await page.waitForSelector(fenetre);
check(true, 'carte de face : ouvre aussi le choix de la difficulté');
await Promise.all([page.waitForURL(/cubes-de-siege\.html/), page.click('.choix-niveau-option[data-niveau="stratege"]')]);
check(new URL(page.url()).searchParams.get('niveau') === 'stratege', 'Panique au phare ! lancé au niveau Piquant');

// Retour : la dernière difficulté est proposée, mais la fenêtre s'ouvre à chaque fois.
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
check(await niveauRetenu() === 'stratege', 'retour à l’accueil : niveau Piquant retenu');
await page.click('.vitrine-texte.devant a.jouer');
await page.waitForSelector(fenetre);
check(await page.locator('.choix-niveau-option.choisi').getAttribute('data-niveau') === 'stratege', 'la dernière difficulté est mise en évidence');
check(await page.evaluate(() => document.activeElement?.getAttribute('data-niveau')) === 'stratege', 'le focus est sur la dernière difficulté');
await page.keyboard.press('Escape');

// Les six jeux reçoivent la difficulté choisie, et chaque niveau est bien transmis.
for (const [nom, fichier, niveau] of [
  ['Panique au phare !', 'cubes-de-siege', 'eveil'],
  ['Pluie de météores', 'pluie-de-meteores', 'explorateur'],
  ['Le Dragon gourmand', 'dragon-gourmand', 'stratege'],
  ['Décollage !', 'decollage', 'maitre'],
  ['Neon Flight', 'neon-flight', 'eveil'],
  ['MULTIRAIL', 'multirail', 'maitre'],
]) {
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await deFace(nom);
  await page.click('.vitrine-texte.devant a.jouer');
  await Promise.all([page.waitForURL(new RegExp(fichier)), page.click(`.choix-niveau-option[data-niveau="${niveau}"]`)]);
  await page.waitForSelector('canvas', { timeout: 15000 });
  check(new URL(page.url()).searchParams.get('niveau') === niveau, `${nom} : lancé au niveau choisi (${niveau})`);
}

// Un joueur qui revient : le manège s'ouvre sur son dernier jeu, « Reprendre » relance sans repasser par le choix.
await page.evaluate(() => {
  localStorage.setItem('calcoolos.derniere-partie', JSON.stringify({ jeu: 'dragon', niveau: 'stratege', mode: 'defi' }));
  localStorage.setItem('calcoolos.historique', JSON.stringify([{ jeu: 'dragon', niveau: 'stratege', mode: 'defi', score: 420, gagne: true, etoiles: 2, duree: 60, precision: 0.9, ops: {}, details: {}, date: new Date().toISOString() }]));
});
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
check(await nomDeFace() === 'Le Dragon gourmand', 'joueur qui revient : son dernier jeu de face');
await page.screenshot({ path: `${out}/ordinateur-accueil-retour.png`, fullPage: true });
await page.locator('.tuile-jeu a').first().click();
await page.waitForSelector(fenetre);
check((await page.textContent('#choix-niveau-jeu'))?.length > 2, 'tuile de « Mes jeux » : choix de la difficulté, avec le nom du jeu');
await page.keyboard.press('Escape');
await Promise.all([page.waitForURL(/dragon-gourmand\.html/), page.click('.univers-reprise')]);
check(new URL(page.url()).searchParams.get('niveau') === 'stratege' && !page.url().includes('?niveau=stratege?'), '« Reprendre » : relance directe au niveau de la dernière partie');
await page.evaluate(() => {
  localStorage.removeItem('calcoolos.derniere-partie');
  localStorage.removeItem('calcoolos.historique');
});
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });

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
await page.waitForSelector('.mon-espace');
const ajouter = async (pseudo, avatar, niveau) => {
  await page.evaluate(() => { document.querySelector('#ajout-enfant').open = true; });
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
check((await page.textContent('.joueur'))?.includes('Niveau Doux'), 'barre : niveau du profil affiché');
check(await niveauRetenu() === 'eveil', 'accueil : niveau du profil de Lina (Éveil)');
await page.waitForFunction(() => document.querySelector('#carnet-titre')?.textContent?.includes('Lina'));
check(true, 'carnet : « Le carnet de Lina »');
check(await page.locator('.barre .lien-compte', { hasText: 'Mon espace' }).isVisible(), 'barre : « Espace famille » pour un compte connecté');
check(await page.locator('#statut-invite').isHidden(), 'accueil : plus de message « invité »');
await page.evaluate(() => (window.__sansRechargement = true));
await page.click('.joueur');
await page.waitForTimeout(400); // fin du fondu d'ouverture
await page.screenshot({ path: `${out}/ordinateur-panneau-famille.png` });
await page.click('#panneau-joueur .panneau-profils button:has-text("Noé")');
await page.waitForFunction(() => document.querySelector('.joueur')?.textContent?.includes('Noé'));
check(await page.evaluate(() => window.__sansRechargement === true), 'changer de joueur depuis la barre : sans recharger la page');
check(await niveauRetenu() === 'maitre', 'changer de joueur : le niveau suit (Maître pour Noé)');
await page.waitForFunction(() => document.querySelector('#carnet-titre')?.textContent?.includes('Noé'));
check(true, 'changer de joueur : le carnet suit');
// Noé choisit Piquant au lancement : enregistré sur son profil avant de partir au jeu.
await page.click('.vitrine-texte.devant a.jouer');
await page.waitForSelector(fenetre);
await Promise.all([page.waitForURL(/jeu\//), page.click('.choix-niveau-option[data-niveau="stratege"]')]);
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('.joueur-profil');
const profils = await page.evaluate(async () => (await (await fetch('api/etat')).json()).profils);
check(profils.find((p) => p.pseudo === 'Noé')?.niveau === 'stratege', 'difficulté choisie au lancement : enregistrée sur le profil de Noé');
check((await page.textContent('.joueur'))?.includes('Niveau Piquant'), 'barre : niveau mis à jour');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.joueur-profil');
check((await page.textContent('.joueur'))?.includes('Noé') && (await niveauRetenu()) === 'stratege', 'après rechargement : Noé, niveau Piquant');
await page.waitForTimeout(1500); // fin de la rotation vers le dernier jeu
await page.screenshot({ path: `${out}/ordinateur-accueil-connecte.png`, fullPage: true });
// « Qui joue ? » sur l'accueil.
await page.locator('#qui-joue button', { hasText: 'Lina' }).click();
check(await niveauRetenu() === 'eveil' && (await page.textContent('.joueur'))?.includes('Lina'), '« Qui joue ? » : Lina, niveau Éveil');

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

// --- 6. Invité sur tablette et téléphone, animations réduites ---------------------------------------
console.log('• Invité : formats, animations réduites');
for (const [nom, opts] of [
  ['tablette', { viewport: { width: 834, height: 1112 }, hasTouch: true }],
  ['telephone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
]) {
  const c = await browser.newContext({ ...opts, locale: 'fr-FR' });
  const p = await c.newPage();
  await p.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `${out}/${nom}-accueil-invite.png` });
  const debord = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(debord <= 0, `${nom} : le manège ne crée aucun défilement horizontal (${debord} px)`);
  // Glisser au doigt, avec de vrais événements tactiles.
  const cdp = await c.newCDPSession(p);
  const b = await p.locator('.vitrine-image.devant').boundingBox();
  const y = b.y + b.height / 2;
  const doigt = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await doigt('touchStart', b.x + b.width * 0.8);
  for (let i = 1; i <= 6; i++) await doigt('touchMove', b.x + b.width * (0.8 - i * 0.08));
  await doigt('touchEnd');
  await p.waitForTimeout(150);
  check((await nomDeFace(p)) === 'Pluie de météores', `${nom} : glisser au doigt fait tourner le manège`);
  // Juste après le geste : le toucher suivant ne doit pas se perdre (l'inertie invisible de Chrome).
  await p.waitForTimeout(250);
  const carte = await p.locator('.vitrine-image.devant').boundingBox();
  const toucher = async (x, yy) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: yy }] });
    await p.waitForTimeout(50);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await toucher(carte.x + carte.width / 2, carte.y + carte.height / 2);
  await p.waitForSelector(fenetre, { timeout: 3000 });
  check(true, `${nom} : toucher la carte de face ouvre le choix, même juste après un glissé`);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(800);
  // Défiler la page en partant d'une carte : ni rotation, ni lancement.
  const avant = await p.evaluate(() => scrollY);
  const faceAvant = await nomDeFace(p);
  const vx = carte.x + carte.width / 2;
  const vy = carte.y + carte.height * 0.8;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vx, y: vy }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: vx + i, y: vy - i * 16 }] });
    await p.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(500);
  check((await p.evaluate(() => scrollY)) > avant, `${nom} : glisser vers le haut sur une carte fait défiler la page`);
  check((await nomDeFace(p)) === faceAvant && await p.locator(fenetre).count() === 0, `${nom} : défiler ne fait pas tourner le manège et ne lance rien`);
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(300);
  // Une carte de côté vient de face, sans rien lancer.
  const voisine = await p.evaluate(() => {
    const r = document.querySelector('#jeu-cubes .vitrine-image').getBoundingClientRect();
    return { x: Math.min(innerWidth - 6, r.right - 10), y: r.top + r.height / 2 };
  });
  await toucher(voisine.x, voisine.y);
  await p.waitForTimeout(300);
  check((await nomDeFace(p)) === 'Panique au phare !' && await p.locator(fenetre).count() === 0, `${nom} : toucher une carte de côté l’amène de face, sans rien lancer`);
  await p.waitForTimeout(800);
  // Les six jeux restent à portée de doigt.
  const boutons = p.locator('.manege-noms button');
  check(await boutons.count() === 6 && (await boutons.nth(5).boundingBox()).height >= 44, `${nom} : six jeux à toucher, assez grands pour un doigt`);
  await boutons.nth(5).tap();
  await p.locator('.vitrine-texte.devant h2', { hasText: 'MULTIRAIL' }).waitFor();
  check(true, `${nom} : toucher la miniature de MULTIRAIL l’amène de face`);
  await p.waitForTimeout(800);
  await p.tap('.vitrine-texte.devant a.jouer');
  await p.waitForSelector(fenetre);
  check(/Tables de 2/.test(await p.textContent('#choix-niveau-liste')), `${nom} : pour MULTIRAIL, la fenêtre parle de tables`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${nom}-choix-difficulte.png` });
  const dansEcran = await p.locator('.choix-niveau').evaluate((d) => { const r = d.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  check(dansEcran, `${nom} : la fenêtre tient dans l’écran`);
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
  await p.click('.manege-suivant');
  const aussitot = await p.evaluate(() => {
    const cartes = [...document.querySelectorAll('.vitrine-image')];
    const r = document.querySelector('.vitrine-image.devant').getBoundingClientRect();
    return { centre: Math.abs(r.left + r.width / 2 - innerWidth / 2), anims: document.getAnimations().filter((a) => a.playState === 'running').length, cartes: cartes.length };
  });
  check(aussitot.centre < 2 && aussitot.anims === 0, `animations réduites : la carte arrive directement (écart ${aussitot.centre} px)`);
  await p.screenshot({ path: `${out}/ordinateur-animations-reduites.png` });
  await c.close();
}
{
  const c = await browser.newContext(ordinateur);
  const p = await c.newPage();
  await p.goto(`${base}/index.html?leger`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);
  await p.click('.manege-suivant');
  await p.waitForTimeout(900);
  const plat = await p.evaluate(() => ({
    classe: document.querySelector('#jeux').classList.contains('manege-leger'),
    style: document.querySelector('.vitrine-image.devant').style.transform,
    nom: document.querySelector('.vitrine-texte.devant h2').textContent,
  }));
  check(plat.classe && !plat.style.includes('perspective') && plat.nom === 'Pluie de météores', 'appareil modeste : le manège marche à plat, sans 3D');
  await p.screenshot({ path: `${out}/ordinateur-leger.png` });
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
  await p.waitForSelector('.mon-espace');
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
