// Neon Flight : jeu en 3D (Babylon.js). Ce point d'entrée n'est chargé que par jeu/neon-flight.html,
// Babylon et le modèle de la navette ne pèsent donc ni sur l'accueil ni sur les autres jeux.
import '../i18n/page';
import { ecouterErreurs3d } from '../platform/diag3d';
import { afficherSans3d } from '../platform/sans3d';
import { demarrerSuivi } from '../platform/suivi';

ecouterErreurs3d();
demarrerSuivi('neon');

import('../game/neon/app').catch((e: unknown) => {
  console.error(e);
  afficherSans3d();
});
