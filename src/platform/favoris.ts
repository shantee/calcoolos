/**
 * Personnalisation simple de l'accueil, retenue sur l'appareil pour chaque joueur : jeux favoris et grandes
 * présentations affichées ou non. Rien n'est envoyé au serveur.
 */
const cle = (profil: number | null, quoi: string) => `calcoolos.accueil.${profil ?? 'invite'}.${quoi}`;

export function lireFavoris(profil: number | null): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(cle(profil, 'favoris')) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function basculerFavori(profil: number | null, jeu: string): string[] {
  const avant = lireFavoris(profil);
  const apres = avant.includes(jeu) ? avant.filter((j) => j !== jeu) : [...avant, jeu];
  try {
    localStorage.setItem(cle(profil, 'favoris'), JSON.stringify(apres));
  } catch {
    /* stockage indisponible : le favori vaut pour cette page */
  }
  return apres;
}

/** Favoris d'abord (dans l'ordre choisi), puis les autres jeux dans leur ordre habituel. Logique pure (testée). */
export function ordonnerJeux<T extends string>(jeux: readonly T[], favoris: readonly string[]): T[] {
  return [...jeux].sort((a, b) => {
    const x = favoris.indexOf(a);
    const y = favoris.indexOf(b);
    return (x < 0 ? Infinity : x) - (y < 0 ? Infinity : y) || jeux.indexOf(a) - jeux.indexOf(b);
  });
}

export function presentationsMasquees(profil: number | null): boolean {
  try {
    return localStorage.getItem(cle(profil, 'presentations')) === 'non';
  } catch {
    return false;
  }
}

export function masquerPresentations(profil: number | null, masquer: boolean): void {
  try {
    localStorage.setItem(cle(profil, 'presentations'), masquer ? 'non' : 'oui');
  } catch {
    /* stockage indisponible */
  }
}
