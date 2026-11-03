/**
 * Le niveau choisi au lancement est-il vraiment appliqué ? Pour chacun des six jeux et des six niveaux scolaires
 * (CP à CM2, Aventurier) : passe par la vraie fenêtre de l'accueil, lance une partie et relève les calculs réellement
 * posés au joueur. Les niveaux s'enchaînent dans le même navigateur, puis on redescend au CP : des réglages mémorisés
 * à un autre niveau (l'ancien bug de MULTIRAIL : niveau le plus dur mais 2 × 2) feraient échouer le relevé.
 *
 * Prérequis : `npm run preview` (l'API n'est pas nécessaire).
 * Usage : node scripts/niveaux-e2e.mjs [urlDeBase] (MULTIRAIL et Neon Flight sont lents en GPU logiciel, 10 min environ)
 */
import { createRequire } from 'node:module';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    return createRequire(import.meta.url)('playwright');
  }
}
const { chromium } = await loadPlaywright();
const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const seul = process.env.JEU; // pour relancer un seul jeu : JEU=MULTIRAIL
const sauf = process.env.SAUF; // pour écarter un jeu lent : SAUF=MULTIRAIL
const NIVEAUX = ['cp', 'ce1', 'ce2', 'cm1', 'cm2', 'aventurier', 'cp'];
const RETOUR = NIVEAUX.length - 1;
/** opérations permises par classe (doc/NIVEAUX_SCOLAIRES.md) */
const OPERATIONS = { cp: '+−', ce1: '+−×', ce2: '+−×÷', cm1: '+−×÷', cm2: '+−×÷', aventurier: '+−×÷' };
const problems = [];
let total = 0;
const check = (cond, what) => {
  total++;
  if (!cond) problems.push(`ÉCHEC : ${what}`);
  console.log(cond ? '  ok' : '  ÉCHEC', '-', what);
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Calcul à plusieurs étapes : (7 × 8) + 23, 4 × 9 × 25. Les parenthèses d'abord, puis de gauche à droite. */
const lireParentheses = (texte) => {
  const jetons = texte.match(/\d+|[()+−×÷]/g) ?? [];
  let i = 0;
  const terme = () => {
    const j = jetons[i++];
    if (j !== '(') return Number(j);
    const v = suite();
    i++;
    return v;
  };
  const suite = () => {
    let v = terme();
    while (i < jetons.length && jetons[i] !== ')') {
      const op = jetons[i++];
      const b = terme();
      v = op === '+' ? v + b : op === '−' ? v - b : op === '×' ? v * b : v / b;
    }
    return v;
  };
  const valeur = suite();
  return Number.isInteger(valeur) ? { texte, valeur, combine: true } : { texte };
};

/** Un calcul relevé : { a, b, op, texte }. Les nombres viennent du jeu, jamais du niveau demandé. */
const lireCalcul = (texte) => {
  const m = String(texte).replace(/\s+/g, ' ').trim().match(/^(\d+) ([+\-−×÷]) (\d+)$/);
  if (m) return { a: +m[1], op: m[2], b: +m[3], texte: `${m[1]} ${m[2]} ${m[3]}` };
  // calcul à trois nombres de Neon Flight et MULTIRAIL : les produits d'abord, puis de gauche à droite
  const t = String(texte).replace(/\s+/g, ' ').trim().match(/^(\d+) ([+−×]) (\d+) ([+−×]) (\d+)$/);
  if (!t) return lireParentheses(String(texte));
  const nombres = [+t[1], +t[3], +t[5]];
  const ops = [t[2], t[4]];
  for (let i = ops.indexOf('×'); i >= 0; i = ops.indexOf('×')) {
    nombres.splice(i, 2, nombres[i] * nombres[i + 1]);
    ops.splice(i, 1);
  }
  const valeur = nombres.slice(1).reduce((v, n, i) => (ops[i] === '+' ? v + n : v - n), nombres[0]);
  return { texte: t[0], valeur, troisNombres: true };
};

// Chaque jeu : comment le démarrer, et comment relever ses calculs en y répondant.
const JEUX = [
  {
    nom: 'Décollage !', fichier: 'decollage', crochet: '__fusee',
    releve: async (p) => {
      await p.evaluate(() => window.__fusee.start('tranquille'));
      const vus = [];
      for (let i = 0; i < 40 && vus.length < 8; i++) {
        const q = await p.evaluate(() => {
          const s = window.__fusee.session();
          const t = s?.question?.expr?.text ?? null;
          if (t) window.__fusee.answer();
          return { t, tier: s?.tier };
        });
        if (q.t) vus.push({ t: q.t, tier: q.tier });
        await pause(350);
      }
      return { tier: vus[0]?.tier, calculs: vus.map((v) => lireCalcul(v.t)) };
    },
  },
  {
    nom: 'Pluie de météores', fichier: 'pluie-de-meteores', crochet: '__meteores',
    releve: async (p) => {
      await p.evaluate(() => window.__meteores.start('tranquille'));
      const vus = new Map();
      let tier;
      for (let i = 0; i < 40 && vus.size < 8; i++) {
        const q = await p.evaluate(() => {
          const s = window.__meteores.session();
          const a = (s?.alive ?? s?.meteors ?? []).map((m) => m.expr.text);
          const m = (s?.alive ?? [])[0];
          if (m) window.__meteores.type(String(m.expr.answer));
          return { a, tier: s?.tier };
        });
        tier = q.tier;
        for (const t of q.a) vus.set(t, t);
        await pause(350);
      }
      return { tier, calculs: [...vus.keys()].map(lireCalcul) };
    },
  },
  {
    nom: 'Panique au phare !', fichier: 'cubes-de-siege', crochet: '__siege',
    releve: async (p) => {
      await p.evaluate(() => window.__siege.start('tranquille'));
      await pause(800);
      const q = await p.evaluate(() => {
        const r = window.__siege.session().round;
        return { tier: r.tier.id, cible: r.target, cubes: [...r.cubes] };
      });
      return { tier: q.tier, calculs: [{ texte: `faire ${q.cible} avec ${q.cubes.join(', ')}`, valeur: q.cible }] };
    },
  },
  {
    nom: 'Le Dragon gourmand', fichier: 'dragon-gourmand', crochet: '__dragon',
    releve: async (p) => {
      await p.evaluate(() => window.__dragon.start('tranquille'));
      await pause(800);
      const q = await p.evaluate(() => {
        const s = window.__dragon.session();
        return { tier: s.tier?.id ?? s.tier, op: s.goal.op, cible: s.goal.target, lanternes: s.orbs?.map((o) => o.value) };
      });
      return { tier: q.tier, calculs: [{ texte: `faire ${q.cible} (${q.op}) avec ${q.lanternes?.join(', ')}`, valeur: q.cible }] };
    },
  },
  {
    nom: 'Neon Flight', fichier: 'neon-flight', crochet: '__neon',
    releve: async (p) => {
      await p.waitForFunction(() => window.__neon.ready(), null, { timeout: 60000 });
      const reglage = await p.inputValue('#difficulty');
      await p.evaluate(() => window.__neon.start());
      const vus = [];
      for (let i = 0; i < 80 && vus.length < 14; i++) {
        const t = await p.textContent('#equation').catch(() => '');
        if (t && /\d/.test(t) && vus.at(-1) !== t) vus.push(t);
        await p.evaluate(() => window.__neon.answer());
        await pause(300);
      }
      return { tier: reglage, calculs: vus.map(lireCalcul) };
    },
  },
  {
    nom: 'MULTIRAIL', fichier: 'multirail', crochet: '__multirail', test: true,
    releve: async (p) => {
      await p.evaluate(() => window.__multirail.start());
      const vus = [];
      const fin = Date.now() + 45000;
      while (Date.now() < fin && vus.length < 6) {
        const t = await p.evaluate(() => {
          const q = window.__multirail.question;
          if (q) window.__multirail.answer(true);
          return q?.text ?? null;
        });
        if (t && vus.at(-1) !== t) vus.push(t);
        await pause(400);
      }
      return { tier: null, calculs: vus.map(lireCalcul) };
    },
  },
];

// GPU=1 : la vraie carte du poste, nettement plus rapide pour les deux jeux en 3D
const browser = await chromium.launch({
  args: process.env.GPU ? ['--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
});
const synthese = [];
for (const jeu of JEUX) {
  if ((seul && !jeu.nom.includes(seul)) || (sauf && jeu.nom.includes(sauf))) continue;
  console.log(`• ${jeu.nom}`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const moyennes = {};
  for (const [rang, niveau] of NIVEAUX.entries()) {
    await page.goto(`${base}/index.html`, { waitUntil: 'load' });
    await page.locator('.manege-noms button', { hasText: jeu.nom }).click();
    await page.locator('.vitrine-texte.devant h2', { hasText: jeu.nom }).waitFor();
    await page.click('.vitrine-texte.devant a.jouer');
    await Promise.all([page.waitForURL(new RegExp(jeu.fichier)), page.click(`.choix-niveau-option[data-niveau="${niveau}"]`)]);
    check(new URL(page.url()).searchParams.get('niveau') === niveau, `${niveau} : l'adresse du jeu porte le niveau choisi`);
    if (jeu.test) await page.goto(`${page.url()}&test`, { waitUntil: 'load' });
    await page.waitForFunction((c) => window[c] !== undefined, jeu.crochet, { timeout: 60000 });
    await pause(jeu.test ? 2500 : 700);
    const { tier, calculs } = await jeu.releve(page);
    if (tier !== null && tier !== undefined) check(tier === niveau, `${niveau} : le jeu tourne bien à ce niveau (il annonce ${tier})`);
    check(calculs.length > 0, `${niveau} : calculs relevés`);
    const valeurs = calculs.filter((c) => c.valeur !== undefined || c.a !== undefined).map((c) => c.valeur ?? (c.op === '×' ? c.a * c.b : c.op === '÷' ? c.a : c.op === '-' || c.op === '−' ? c.a : c.a + c.b));
    const moyenne = valeurs.length ? Math.round(valeurs.reduce((x, y) => x + y, 0) / valeurs.length) : 0;
    if (rang < RETOUR) moyennes[niveau] = moyenne;
    synthese.push(`${jeu.nom.padEnd(20)} ${(rang === RETOUR ? 'cp (retour)' : niveau).padEnd(15)} moyenne ${String(moyenne).padStart(4)} : ${calculs.slice(0, 7).map((c) => c.texte).join(' ; ')}`);
    const ecrits = calculs.filter((c) => typeof c.texte === 'string' && !c.texte.startsWith('faire '));
    const signes = (c) => c.texte.match(/[+−×÷]/g) ?? [];
    for (const c of ecrits) check(c.valeur === undefined || (Number.isInteger(c.valeur) && c.valeur >= 1 && c.valeur <= 999), `${niveau} : ${c.texte} donne un entier de 1 à 999`);
    if (jeu.nom === 'Neon Flight' || jeu.nom === 'MULTIRAIL') {
      // Jeux de multiplications : rien d'autre que des ×, à tous les niveaux.
      const autres = ecrits.filter((c) => signes(c).some((o) => o !== '×'));
      check(autres.length === 0, `${niveau} : que des multiplications (${autres.map((c) => c.texte).join(', ') || 'oui'})`);
      if (niveau === 'cp') {
        const gros = ecrits.filter((c) => c.op !== '×' || c.a * c.b > (c.a === 10 || c.b === 10 ? 50 : 30));
        check(gros.length === 0, `${niveau} : petits groupements, produits jusqu’à 30 (${gros.map((c) => c.texte).join(', ') || 'oui'})`);
      }
      if (jeu.nom === 'Neon Flight' && (niveau === 'cp' || niveau === 'ce1')) check(ecrits.every((c) => c.op === '×'), `${niveau} : que des faits de table`);
    } else {
      const horsNiveau = ecrits.filter((c) => signes(c).some((o) => !OPERATIONS[niveau].includes(o)));
      check(horsNiveau.length === 0, `${niveau} : opérations de la classe seulement (${horsNiveau.map((c) => c.texte).join(', ') || 'oui'})`);
    }
    if (niveau === 'aventurier') {
      const trop = calculs.filter((c) => c.op === '×' && (Math.min(c.a, c.b) <= 1 || Math.max(c.a, c.b) <= 3));
      check(trop.length === 0, `Aventurier : aucun calcul trivial (${trop.map((c) => c.texte).join(', ') || 'aucun'})`);
    }
    if (rang === RETOUR) {
      // sur deux calculs relevés (MULTIRAIL), une moyenne ne prouve rien : pour les tables, on vérifie la table elle-même
      const produits = calculs.filter((c) => c.op === '×');
      if (produits.length === calculs.length) {
        const horsSerie = produits.filter((c) => Math.min(c.a, c.b) > 5);
        check(horsSerie.length === 0, `retour au CP : tables de 2 à 5 (${horsSerie.map((c) => c.texte).join(', ') || 'aucune autre'})`);
      } else check(moyenne <= moyennes.ce2, `retour au CP : les calculs redeviennent simples (moyenne ${moyenne})`);
    }
  }
  check(moyennes.cp < moyennes.aventurier, `Aventurier plus dur que le CP (moyennes ${moyennes.cp} < ${moyennes.aventurier})`);
  await ctx.close();
  console.log(synthese.splice(0).join('\n'));
}
await browser.close();
console.log(`\n${total - problems.length}/${total} vérifications réussies`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
