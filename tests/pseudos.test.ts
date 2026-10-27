import { describe, expect, it } from 'vitest';
import { ADJECTIFS, ANIMAUX, JEUX_DE_MOTS, TITRES, pseudoAuHasard } from '../src/platform/pseudos';

const ACCEPTE = /^[\p{L}\p{N} _-]{2,20}$/u;

describe('Aide-moi à trouver un pseudo', () => {
  it('chaque idée possible est acceptée par le serveur (2 à 20 lettres, chiffres, espaces, - ou _)', () => {
    for (const p of [...JEUX_DE_MOTS, ...TITRES]) expect(p).toMatch(ACCEPTE);
    for (const [nom, genre] of ANIMAUX) {
      for (const adj of ADJECTIFS) expect(`${nom} ${adj[genre === 'f' ? 1 : 0]}`).toMatch(ACCEPTE);
    }
  });
  it('aucun doublon dans les listes', () => {
    const toutes = [...JEUX_DE_MOTS, ...TITRES];
    expect(new Set(toutes).size).toBe(toutes.length);
  });
  it('propose toujours un autre pseudo que celui déjà écrit', () => {
    for (let i = 0; i < 500; i++) expect(pseudoAuHasard('Lama Fâché')).not.toBe('Lama Fâché');
  });
});
