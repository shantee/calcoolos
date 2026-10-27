import { describe, expect, it } from 'vitest';
import { AVATARS, AVATAR_INVITE, AVATAR_PAR_DEFAUT, avatarUrl } from '../src/platform/avatars';
import php from '../server/src/Api.php?raw';

describe('avatars', () => {
  it('49 avatars, chacun avec sa vignette', () => {
    expect(Object.keys(AVATARS)).toHaveLength(49);
    for (const id of Object.keys(AVATARS)) expect(avatarUrl(id)).toContain(`${id}.webp`);
  });

  it('le serveur accepte exactement les mêmes avatars, dans le même ordre', () => {
    const liste = /const AVATARS = \[([^\]]*)\]/.exec(php)![1];
    const ids = [...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(ids).toEqual(Object.keys(AVATARS));
    // La colonne profils.avatar est un VARCHAR(20).
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(20);
  });

  it('un ancien avatar retenu dans le navigateur montre son remplaçant, un inconnu l’avatar par défaut', () => {
    expect(avatarUrl('dragon')).toContain('flamme.webp');
    expect(avatarUrl('chouette')).toContain('pigeon.webp');
    expect(avatarUrl('licorne')).toBe(avatarUrl(AVATAR_PAR_DEFAUT));
    expect(AVATARS[AVATAR_INVITE]).toBeDefined();
  });
});
