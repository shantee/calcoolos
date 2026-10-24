import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import brand from './brand.json' with { type: 'json' };

/**
 * Le nom de la plateforme n'est écrit qu'une fois, dans brand.json.
 * Les pages HTML utilisent %BRAND_NAME%, %BRAND_TAGLINE% et %BRAND_DESCRIPTION%.
 */
function brandPlugin(): Plugin {
  return {
    name: 'brand',
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
    rollupOptions: {
      // Phaser dans son propre fichier : mis en cache une fois pour tous les jeux.
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          return undefined;
        },
      },
      input: {
        accueil: resolve(import.meta.dirname, 'index.html'),
        cubes: resolve(import.meta.dirname, 'jeu/cubes-de-siege.html'),
        prototypeA: resolve(import.meta.dirname, 'prototypes/a.html'),
        prototypeB: resolve(import.meta.dirname, 'prototypes/b.html'),
      },
    },
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
