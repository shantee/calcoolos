// Neon Flight : jeu en 3D (Babylon.js). Ce point d'entrée n'est chargé que par jeu/neon-flight.html,
// Babylon et le modèle de la navette ne pèsent donc ni sur l'accueil ni sur les autres jeux.
import '../i18n/page';
import { ecouterErreurs3d } from '../platform/diag3d';
import { afficherSans3d } from '../platform/sans3d';
import { demarrerSuivi } from '../platform/suivi';
import { reglerJoueur } from '../platform/acces';

ecouterErreurs3d();
demarrerSuivi('neon');

// Jouer est libre : on règle seulement qui joue (sans compte, partie anonyme, rien n'est enregistré).
void reglerJoueur().then(() =>
  import('../game/neon/app').catch((e: unknown) => {
    console.error(e);
    afficherSans3d();
  }),
);
