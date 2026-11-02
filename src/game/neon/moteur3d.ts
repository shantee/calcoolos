/**
 * Démarrage du moteur de Neon Flight, du rendu le plus riche au plus simple.
 *
 * WebGL seulement, comme MULTIRAIL : WebGPU a été retiré le 02/11/2026. Babylon est importé module par module et
 * il manquait l'extension WebGPU des textures dynamiques (le ciel) : le jeu s'arrêtait net sur tous les
 * navigateurs où WebGPU fonctionne, dont Brave sur tablette, alors que Firefox, sans WebGPU, passait par WebGL.
 * WebGPU n'apportait rien de visible à cette scène. Voir JOURNAL_PROJET.md.
 */
export interface Profil3d {
  nom: string;
  webgl2: boolean;
  /** Sans lissage, post-traitement ni halo, et en qualité Éco. */
  leger: boolean;
}

export const PROFILS_3D: readonly Profil3d[] = [
  { nom: "complet", webgl2: true, leger: false },
  { nom: "allégé", webgl2: true, leger: true },
  { nom: "WebGL 1", webgl2: false, leger: true },
];

/** Renvoie le premier profil qui démarre ; sans aucun profil possible, relance la dernière erreur. */
export async function essayerProfils<T>(
  profils: readonly Profil3d[],
  essayer: (profil: Profil3d) => Promise<T>,
  noter: (message: string) => void = () => {},
): Promise<{ profil: Profil3d; resultat: T }> {
  let derniere: unknown = new Error("Aucun profil 3D");
  for (const profil of profils) {
    try {
      const resultat = await essayer(profil);
      noter(`Profil ${profil.nom} : démarré`);
      return { profil, resultat };
    } catch (e) {
      derniere = e;
      noter(`Profil ${profil.nom} : échec, ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw derniere;
}
