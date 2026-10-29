import '../i18n/page';
import '../i18n/phaser';
import '../styles/minecraftia.css';
import '../styles/game.css';
import Phaser from 'phaser';
import { RocketScene, W, H } from '../game/rocket/rocket-scene';
import { maxTextures } from '../game/render-config';
import { installerPleinEcran } from '../game/plein-ecran';
import { demarrerSuivi } from '../platform/suivi';

demarrerSuivi('fusee');

async function start(): Promise<void> {
  // Les polices doivent être prêtes avant que Phaser ne dessine du texte.
  try {
    await Promise.all([document.fonts.load('32px "Minecraftia"'), document.fonts.load('32px "Symboles pixel"', '♥')]);
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
  installerPleinEcran(game, { droite: 1036, milieu: 692 });
}

void start();
