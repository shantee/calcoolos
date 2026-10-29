import '../i18n/page';
import '../i18n/phaser';
import '@fontsource-variable/bricolage-grotesque';
import '../styles/game.css';
import Phaser from 'phaser';
import { MeteorScene, W, H } from '../game/meteors/meteor-scene';
import { maxTextures } from '../game/render-config';
import { installerPleinEcran } from '../game/plein-ecran';
import { demarrerSuivi } from '../platform/suivi';

demarrerSuivi('meteores');

async function start(): Promise<void> {
  // Les polices doivent être prêtes : elles servent aussi à dessiner les pancartes.
  try {
    await Promise.all([
      document.fonts.load('800 46px "Bricolage Grotesque Variable"'),
      document.fonts.load('600 18px "Bricolage Grotesque Variable"'),
    ]);
  } catch {
    /* police de secours */
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'jeu',
    width: W,
    height: H,
    antialias: true,
    maxTextures: maxTextures(),
    backgroundColor: '#0a0b24',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [MeteorScene],
  });
  installerPleinEcran(game, { droite: 962, milieu: 690 });
}

void start();
