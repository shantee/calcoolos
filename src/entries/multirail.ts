// MULTIRAIL : jeu en 3D (Three.js). Ce point d'entrée n'est chargé que par jeu/multirail.html,
// Three.js ne pèse donc ni sur l'accueil ni sur les autres jeux.
import '../i18n/page';
import { afficherSans3d, webgl2Disponible } from '../platform/sans3d';
import { demarrerSuivi } from '../platform/suivi';

demarrerSuivi('multirail');

if (webgl2Disponible()) {
  import('../game/multirail/main').catch((e: unknown) => {
    console.error(e);
    afficherSans3d();
  });
} else {
  afficherSans3d();
}
