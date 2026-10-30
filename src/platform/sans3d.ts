/**
 * Écran affiché quand un jeu en 3D ne peut pas démarrer : WebGL bloqué par le navigateur, accélération
 * matérielle coupée, pilote graphique refusé. Sans lui, la page resterait vide.
 */
import './sans3d.css';

/** Interroge le navigateur sans charger le moteur 3D, qui pèse lourd pour un jeu qui ne démarrera pas. */
export function webgl2Disponible(): boolean {
  const gl = document.createElement('canvas').getContext('webgl2');
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return !!gl;
}

export function afficherSans3d(): void {
  if (document.querySelector('.sans3d')) return;
  const ecran = document.createElement('main');
  ecran.className = 'sans3d';
  const bloc = document.createElement('div');
  const titre = document.createElement('h1');
  titre.textContent = 'La 3D ne démarre pas sur ce navigateur';
  const raison = document.createElement('p');
  raison.textContent = 'Ce jeu a besoin de la 3D (WebGL), qui est bloquée ou indisponible ici.';
  const conseil = document.createElement('p');
  conseil.textContent =
    'Vérifie que l’accélération matérielle est activée dans les réglages du navigateur, puis redémarre-le. Sinon, essaie un autre navigateur : les jeux en 2D fonctionnent partout.';
  const retour = document.createElement('a');
  retour.href = '../';
  retour.textContent = 'Retour à l’accueil';
  bloc.append(titre, raison, conseil, retour);
  ecran.append(bloc);
  document.body.append(ecran);
}
