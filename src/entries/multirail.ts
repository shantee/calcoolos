// MULTIRAIL : jeu en 3D (Three.js). Ce point d'entrée n'est chargé que par jeu/multirail.html,
// Three.js ne pèse donc ni sur l'accueil ni sur les autres jeux.
import '../i18n/page';
import { ecouterErreurs3d, ouvrirDiag3d } from '../platform/diag3d';
import { afficherSans3d, webgl2Disponible } from '../platform/sans3d';
import { demarrerSuivi } from '../platform/suivi';
import { exigerJoueur } from '../platform/acces';

ecouterErreurs3d();
demarrerSuivi('multirail');

// Plus de mode invité : sans compte ni profil, la page part vers la connexion et le jeu ne se charge pas.
void exigerJoueur().then(() => {
  if (webgl2Disponible()) {
    import('../game/multirail/main').catch((e: unknown) => {
      console.error(e);
      afficherSans3d();
    });
  } else {
    afficherSans3d();
  }
});
if (new URLSearchParams(location.search).has('diag')) void ouvrirDiag3d();
