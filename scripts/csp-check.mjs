/**
 * Vérifie que le site construit (dist/) fonctionne avec les en-têtes de sécurité
 * prévus dans deploy/nginx-calcoolos.conf (CSP stricte, etc.) : chaque page est
 * ouverte dans Chromium et toute violation de la politique est signalée.
 * L'API (npm run api) est jointe par un petit relais, comme le ferait Nginx.
 *
 * Usage : npm run build && node scripts/csp-check.mjs
 */
import { createServer, request } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    return createRequire(import.meta.url)('playwright');
  }
}

// Les en-têtes sont lus dans la configuration Nginx elle-même : une seule source.
const conf = readFileSync(new URL('../deploy/nginx-calcoolos.conf', import.meta.url), 'utf8');
const headers = {};
for (const m of conf.matchAll(/add_header\s+([\w-]+)\s+"([^"]+)"\s+always;/g)) headers[m[1]] = m[2];
if (!headers['Content-Security-Policy']) throw new Error('CSP introuvable dans deploy/nginx-calcoolos.conf');

const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname.startsWith('/api/')) {
    const p = request({ host: '127.0.0.1', port: 8080, path: req.url, method: req.method, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    p.on('error', () => res.writeHead(502).end());
    req.pipe(p);
    return;
  }
  let file = join(root, decodeURIComponent(url.pathname));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', ...headers });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(4180, '127.0.0.1', r));

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ locale: 'fr-FR' });
const problems = [];
page.on('console', (m) => {
  if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(`${page.url()} : ${m.text()}`);
  else if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) problems.push(`${page.url()} : ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`${page.url()} : ${e.message}`));
const pages = ['index.html', 'compte.html', 'tableau.html', 'classements.html', 'confidentialite.html', 'jeu/cubes-de-siege.html', 'jeu/pluie-de-meteores.html', 'jeu/dragon-gourmand.html', 'jeu/decollage.html'];
for (const p of pages) {
  await page.goto(`http://127.0.0.1:4180/${p}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // Dans les jeux, on lance une partie pour exercer le rendu et le son.
  await page.evaluate(() => {
    const w = window;
    w.__siege?.start('tranquille');
    w.__meteores?.start('tranquille');
    w.__dragon?.start('tranquille');
    w.__fusee?.start('tranquille');
  });
  await page.mouse.click(400, 300);
  await page.waitForTimeout(1500);
  if (p === 'index.html') {
    // Accueil : les illustrations (chargement différé) doivent toutes s'afficher une fois la page parcourue.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1500);
    const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
    for (const b of broken) problems.push(`${p} : image non chargée ${b}`);
  }
  console.log('ok :', p);
}
await browser.close();
server.close();
console.log(`En-têtes testés : ${Object.keys(headers).join(', ')}`);
if (problems.length) {
  console.log('PROBLÈMES :');
  for (const p of problems) console.log(' -', p);
  process.exitCode = 1;
} else {
  console.log('aucune violation de la politique de sécurité');
}
