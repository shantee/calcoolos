// MULTIRAIL : jeu en 3D (Three.js). Ce point d'entrée n'est chargé que par jeu/multirail.html,
// Three.js ne pèse donc ni sur l'accueil ni sur les autres jeux.
import '../i18n/page';
import { demarrerSuivi } from '../platform/suivi';

demarrerSuivi('multirail');

void import('../game/multirail/main');
