import { describe, expect, it } from 'vitest';
import { ordonnerJeux } from '../src/platform/favoris';
import { conseilsAccueil } from '../src/platform/progres';

describe('accueil personnel', () => {
  it('place les favoris en premier sans perdre de jeu', () => {
    expect(ordonnerJeux(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual(['c', 'a', 'b', 'd']);
    expect(ordonnerJeux(['a', 'b'], ['inconnu'])).toEqual(['a', 'b']);
  });
  it('n’invente aucun conseil sans résultat', () => {
    expect(conseilsAccueil([])).toEqual([]);
  });
});
