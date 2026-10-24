/**
 * Avatars des profils : les personnages des jeux, dessinés par code (aucune image
 * importée, aucun visage réel).
 */
import * as Wd from '../art/world-b';
import * as Sp from '../art/space';
import * as D from '../art/dragon';

export const AVATARS: Record<string, { label: string; draw: () => HTMLCanvasElement }> = {
  dragon: { label: 'Dragon', draw: () => D.dragonHead('content') },
  chouette: { label: 'Chouette', draw: () => Wd.owl('ouvert') },
  escargot: { label: 'Escargot', draw: () => Wd.snail(0) },
  robot: { label: 'Robot', draw: () => Sp.tinyBot(true) },
  chat: { label: 'Chat astronaute', draw: () => Sp.cat(0) },
  baleine: { label: 'Baleine', draw: () => Sp.whale(0) },
  canard: { label: 'Canard', draw: () => Sp.duck() },
  poisson: { label: 'Poisson volant', draw: () => Wd.flyingFish() },
};

const cache = new Map<string, string>();

/** Image (data URL) carrée de l'avatar, le personnage centré. */
export function avatarUrl(id: string): string {
  const key = AVATARS[id] ? id : 'dragon';
  const hit = cache.get(key);
  if (hit) return hit;
  const art = AVATARS[key].draw();
  const size = 160;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const k = Math.min((size * 0.82) / art.width, (size * 0.82) / art.height);
  const w = art.width * k;
  const h = art.height * k;
  ctx.drawImage(art, (size - w) / 2, (size - h) / 2, w, h);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export function avatarImg(id: string, size = 48, label?: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src = avatarUrl(id);
  img.width = size;
  img.height = size;
  img.className = 'avatar';
  img.alt = label ?? AVATARS[id]?.label ?? '';
  return img;
}
