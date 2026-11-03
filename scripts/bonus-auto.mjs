/** Test ciblé des livraisons : souris, doigt, expiration neutre et anciens raccourcis retirés.
 * NODE_PATH=… CHROME=… node scripts/bonus-auto.mjs [base] [captures]
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5181';
const out = process.argv[3] ?? 'CAPTURES/livraisons-magiques';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  for (const [name, width, height, touch, reduced] of [
    ['ordinateur', 1280, 720, false, false], ['tablette', 820, 1180, true, false], ['telephone', 390, 844, true, true],
  ]) {
    if (process.env.FORMAT && process.env.FORMAT !== name) continue;
    const p = await b.newPage({ viewport: { width, height }, hasTouch: touch, locale: 'fr-FR',
      reducedMotion: reduced ? 'reduce' : 'no-preference' });
    p.on('pageerror', e => errors.push(e.message));
    p.on('response', r => { if (r.status() >= 400 && !r.url().includes('/api/')) errors.push(r.url()); });
    await p.goto(base + '/jeu/cubes-de-siege.html?niveau=cm2&graine=5', { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.__siege);
    await p.evaluate(() => window.__siege.start('tranquille'));
    await p.waitForFunction(() => window.__siege.enemyX() !== null && window.__siege.enemyX() < 1145 && !window.__siege.busy());
    await p.evaluate(() => window.__siege.select(0));
    const snapshot = () => p.evaluate(() => ({
      charges: window.__siege.bonus().charges, selected: window.__siege.session().round.selected,
      target: window.__siege.session().round.target, misses: window.__siege.session().round.misses,
      score: window.__siege.session().score,
    }));
    const before = await snapshot();
    await p.keyboard.press('KeyB'); await p.keyboard.press('KeyN');
    if (JSON.stringify(before) !== JSON.stringify(await snapshot())) throw Error('B/N agit encore');
    if (!await p.evaluate(() => window.__siege.forceBonus())) throw Error('livraison absente');
    await p.waitForFunction(() => { const pos = window.__siege.flightPos(); return pos && pos.x < 1050; });
    await p.screenshot({ path: out + '/' + name + '-livraison.png' });
    const pos = await p.evaluate(() => window.__siege.flightPos());
    const c = await p.locator('canvas').boundingBox();
    const tap = async (x, y) => {
      const px = c.x + x * c.width / 1280, py = c.y + y * c.height / 720;
      if (touch) await p.touchscreen.tap(px, py); else await p.mouse.click(px, py);
      await p.waitForTimeout(250);
    };
    await tap(pos.x, pos.y);
    await p.waitForFunction(() => window.__siege.bonus().caught === 1);
    const after = await snapshot();
    if (after.charges.reduce((a, v) => a + v, 0) !== 4 || after.charges.some(n => n > 2)) throw Error('charges incohérentes');
    if (JSON.stringify({ ...before, charges: [] }) !== JSON.stringify({ ...after, charges: [] })) throw Error('calcul principal modifié');
    for (const i of [2, 1, 0]) {
      const pos = await p.evaluate(i => window.__siege.spellPos(i), i);
      await tap(pos.x, pos.y);
    }
    await p.waitForFunction(() => window.__siege.bonus().frozen);
    const check = await p.evaluate(() => {
      const r = window.__siege.session().round;
      return { selected: r.selected, soluble: r.puzzle.solution.reduce((n, i) => n + r.cubes[i], 0) === r.target };
    });
    if (check.selected.length || !check.soluble) throw Error('météorite incohérente');
    await p.screenshot({ path: out + '/' + name + '-sorts.png' });
    if (name === 'ordinateur') {
      const pre = await snapshot();
      await p.evaluate(() => window.__siege.forceBonus());
      await p.waitForFunction(() => window.__siege.bonus().flight === null, null, { timeout: 18000 });
      if (JSON.stringify(pre) !== JSON.stringify(await snapshot())) throw Error('expiration pénalisante');
    }
    console.log('OK : ' + name + ', livraison, B/N inactifs et trois sorts');
    await p.close();
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally { await b.close(); }
