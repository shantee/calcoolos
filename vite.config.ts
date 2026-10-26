import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import brand from './brand.json' with { type: 'json' };

/**
 * Le nom de la plateforme n'est écrit qu'une fois, dans brand.json.
 * Les pages HTML utilisent %BRAND_NAME%, %BRAND_TAGLINE% et %BRAND_DESCRIPTION% ; le manifeste en est tiré aussi.
 */
function brandPlugin(): Plugin {
  // Manifeste de l'application (« Ajouter à l'écran d'accueil ») : ouvert sans barre du navigateur.
  // Pas de service worker : le site reste toujours à jour, rien n'est mis en cache en douce.
  const manifest = JSON.stringify(
    {
      name: brand.name,
      short_name: brand.name,
      description: brand.description,
      lang: 'fr',
      start_url: './index.html',
      scope: './',
      display: 'fullscreen',
      display_override: ['fullscreen', 'standalone'],
      background_color: '#0d0a1c',
      theme_color: '#0d0a1c',
      icons: [
        { src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icones/icone-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icones/icone-masquable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  );
  return {
    name: 'brand',
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(manifest);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest });
    },
    transformIndexHtml(html) {
      return html
        .replaceAll('%BRAND_NAME%', brand.name)
        .replaceAll('%BRAND_TAGLINE%', brand.tagline)
        .replaceAll('%BRAND_DESCRIPTION%', brand.description);
    },
  };
}

export default defineConfig({
  // Chemins relatifs : le site fonctionne aussi dans un sous-dossier.
  base: './',
  plugins: [brandPlugin()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    // Jamais de fichier intégré en data: (les petites polices le seraient) : la CSP du
    // serveur n'autorise que les polices servies par le site lui-même.
    assetsInlineLimit: 0,
    rollupOptions: {
      // Phaser dans son propre fichier : mis en cache une fois pour tous les jeux.
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) return 'echarts';
          return undefined;
        },
      },
      input: {
        accueil: resolve(import.meta.dirname, 'index.html'),
        cubes: resolve(import.meta.dirname, 'jeu/cubes-de-siege.html'),
        meteores: resolve(import.meta.dirname, 'jeu/pluie-de-meteores.html'),
        dragon: resolve(import.meta.dirname, 'jeu/dragon-gourmand.html'),
        fusee: resolve(import.meta.dirname, 'jeu/decollage.html'),
        compte: resolve(import.meta.dirname, 'compte.html'),
        tableau: resolve(import.meta.dirname, 'tableau.html'),
        classements: resolve(import.meta.dirname, 'classements.html'),
        confidentialite: resolve(import.meta.dirname, 'confidentialite.html'),
      },
    },
  },
  // L'API PHP tourne à côté (npm run api) ; Vite lui transmet les appels /api en gardant
  // l'en-tête Host (l'API compare l'origine de chaque POST à ce nom d'hôte).
  server: { host: true, port: 5173, proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: false } } },
  preview: { host: true, port: 4173, proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: false } } },
});
