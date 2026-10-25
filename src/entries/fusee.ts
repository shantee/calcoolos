import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '../styles/game.css';
import Phaser from 'phaser';
import { RocketScene, W, H } from '../game/rocket/rocket-scene';
import { maxTextures } from '../game/render-config';
import { installerPleinEcran } from '../game/plein-ecran';

async function start(): Promise<void> {
  // Les polices doivent être prêtes avant que Phaser ne dessine du texte.
  try {
    await Promise.all([document.fonts.load('700 32px "Pixelify Sans"'), document.fonts.load('400 24px "Pixelify Sans"')]);
  } catch {
    /* police de secours */
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'jeu',
    width: W,
    height: H,
    pixelArt: true,
    roundPixels: true,
    maxTextures: maxTextures(),
    backgroundColor: '#8fd3ff',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [RocketScene],
  });
  installerPleinEcran(game);
}

void start();
