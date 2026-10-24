import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '../styles/game.css';
import Phaser from 'phaser';
import { SceneA } from '../game/siege/scene-a';
import { W, H } from '../game/siege/base-scene';
import { maxTextures } from '../game/render-config';

async function start(): Promise<void> {
  // Les polices doivent être prêtes avant que Phaser ne dessine du texte.
  try {
    await Promise.all([document.fonts.load('24px "Pixelify Sans"'), document.fonts.load('700 24px "Pixelify Sans"')]);
  } catch {
    /* police de secours */
  }
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'jeu',
    width: W,
    height: H,
    pixelArt: true,
    maxTextures: maxTextures(),
    backgroundColor: '#141029',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [SceneA],
  });
}

void start();
