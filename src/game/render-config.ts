/**
 * Réglage de rendu partagé par les mini-jeux.
 *
 * Avec le GPU logiciel (SwiftShader) utilisé pour les captures automatiques,
 * Phaser 4 affiche des morceaux d'une texture à la place d'une autre dès que
 * plus de 2 textures sont regroupées dans un même lot de dessin (constaté le
 * 24/10/2026). On limite donc à 1 texture par lot : c'est sans effet visible
 * et peu coûteux pour des scènes de cette taille.
 * `?textures=N` permet de retester une autre valeur sur un vrai GPU.
 */
export function maxTextures(): number {
  const n = Number(new URLSearchParams(window.location.search).get('textures'));
  return Number.isInteger(n) && n >= 1 && n <= 32 ? n : 1;
}
