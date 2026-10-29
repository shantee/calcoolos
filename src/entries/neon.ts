// Neon Flight : seul jeu en 3D (Babylon.js). Ce point d'entrée n'est chargé que par jeu/neon-flight.html,
// Babylon et le modèle de la navette ne pèsent donc ni sur l'accueil ni sur les quatre autres jeux.
import '../i18n/page';
import { demarrerSuivi } from '../platform/suivi';

demarrerSuivi('neon');

void import('../game/neon/app');
