/**
 * Avatars des profils : 49 vignettes pixel art fournies par Philippe (grille du 27/10/2026,
 * originale dans sources-images/avatars/, découpée en WebP 128 × 128 dans src/images/avatars/).
 * L'ordre est mélangé une fois pour toutes (personnages voisins de la grille éloignés). La liste est recopiée
 * dans server/src/Api.php (AVATARS) : les deux doivent rester identiques.
 */
const FICHIERS = import.meta.glob<string>('../images/avatars/*.webp', { eager: true, query: '?url', import: 'default' });

export const AVATARS: Record<string, { label: string }> = {
  banane: { label: 'Banane' },
  extraterrestre: { label: 'Extraterrestre' },
  champignon: { label: 'Champignon' },
  elfe: { label: 'Elfe' },
  'chat-aviateur': { label: 'Chat aviateur' },
  lapin: { label: 'Lapin' },
  renard: { label: 'Renard' },
  robot: { label: 'Robot' },
  panda: { label: 'Panda' },
  vache: { label: 'Vache' },
  sorcier: { label: 'Sorcier' },
  console: { label: 'Console de jeu' },
  faucheuse: { label: 'Squelette à capuche' },
  'poisson-astro': { label: 'Poisson astronaute' },
  nouilles: { label: 'Bol de nouilles' },
  cyclope: { label: 'Monstre à un œil' },
  ogre: { label: 'Ogre' },
  'panda-roux': { label: 'Panda roux' },
  vampire: { label: 'Vampire' },
  axolotl: { label: 'Axolotl' },
  'ninja-masque': { label: 'Ninja masqué' },
  diablotin: { label: 'Diablotin' },
  'chat-noir': { label: 'Chat noir' },
  savant: { label: 'Savant fou' },
  pizza: { label: 'Pizza' },
  pingouin: { label: 'Pingouin' },
  fantome: { label: 'Fantôme' },
  'pieuvre-pirate': { label: 'Pieuvre pirate' },
  requin: { label: 'Requin' },
  ninja: { label: 'Ninja' },
  aventurier: { label: 'Aventurier' },
  astronaute: { label: 'Astronaute' },
  canard: { label: 'Canard' },
  'boule-de-suie': { label: 'Boule de suie' },
  flamme: { label: 'Petite flamme' },
  princesse: { label: 'Princesse rose' },
  viking: { label: 'Squelette viking' },
  yeti: { label: 'Yéti' },
  pigeon: { label: 'Pigeon' },
  'roi-squelette': { label: 'Roi squelette' },
  hamster: { label: 'Hamster' },
  grenouille: { label: 'Grenouille' },
  corgi: { label: 'Corgi' },
  cactus: { label: 'Cactus' },
  musicienne: { label: 'Fan de musique' },
  'cheveux-bleus': { label: 'Cheveux bleus' },
  'chat-lunettes': { label: 'Chat à lunettes' },
  donut: { label: 'Donut' },
  'chien-jaune': { label: 'Chien jaune' },
};

/** Avatar d'un nouveau profil, et de secours pour un identifiant inconnu. */
export const AVATAR_PAR_DEFAUT = 'astronaute';
/** Avatar de l'invité (pas de profil). */
export const AVATAR_INVITE = 'fantome';

/**
 * Anciens avatars dessinés par code (avant le 27/10/2026) : la base est convertie par la
 * migration 003, mais un joueur actif peut encore être retenu sous l'ancien nom dans le navigateur.
 */
const ANCIENS: Record<string, string> = {
  dragon: 'flamme',
  chouette: 'pigeon',
  escargot: 'axolotl',
  chat: 'chat-aviateur',
  baleine: 'requin',
  poisson: 'poisson-astro',
};

/** Identifiant valide : un ancien avatar donne son remplaçant, un inconnu l’avatar par défaut. */
export function avatarId(id: string): string {
  const v = ANCIENS[id] ?? id;
  return AVATARS[v] ? v : AVATAR_PAR_DEFAUT;
}

/** Adresse de l'image (carrée) de l'avatar. */
export function avatarUrl(id: string): string {
  return FICHIERS[`../images/avatars/${avatarId(id)}.webp`];
}

export function avatarImg(id: string, size = 48, label?: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src = avatarUrl(id);
  img.width = size;
  img.height = size;
  img.className = 'avatar';
  img.decoding = 'async';
  img.alt = label ?? AVATARS[avatarId(id)].label;
  return img;
}
