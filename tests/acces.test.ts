import { beforeEach, describe, expect, it, vi } from 'vitest';
import { destinationApresConnexion, lienCompte, retourSur } from '../src/platform/acces';

describe('retour après connexion', () => {
  beforeEach(() => {
    // Page de jeu dans un site à la racine.
    vi.stubGlobal('window', { location: { pathname: '/jeu/decollage.html', href: 'https://exemple.fr/jeu/decollage.html' } });
  });

  it('ne laisse revenir que vers l’accueil ou une page de jeu du site', () => {
    expect(retourSur('jeu/decollage.html?niveau=ce2')).toBe('jeu/decollage.html?niveau=ce2');
    expect(retourSur('/index.html?jouer=dragon-gourmand')).toBe('index.html?jouer=dragon-gourmand');
    for (const mauvais of ['https://ailleurs.fr/', '//ailleurs.fr/jeu/x.html', 'compte.html', 'jeu/../compte.html', 'javascript:alert(1)', 'jeu/x.html#a', '', null]) {
      expect(retourSur(mauvais)).toBeNull();
    }
  });

  it('après connexion : le jeu avec son niveau, sinon l’accueil pour le choisir', () => {
    expect(destinationApresConnexion('jeu/decollage.html?niveau=ce1&graine=4')).toBe('jeu/decollage.html?niveau=ce1&graine=4');
    expect(destinationApresConnexion('jeu/dragon-gourmand.html')).toBe('index.html?jouer=dragon-gourmand');
    expect(destinationApresConnexion('jeu/dragon-gourmand.html?calme')).toBe('index.html?jouer=dragon-gourmand&calme');
    expect(destinationApresConnexion('index.html?jouer=multirail')).toBe('index.html?jouer=multirail');
    expect(destinationApresConnexion('https://ailleurs.fr/')).toBe('index.html');
    expect(destinationApresConnexion(null)).toBe('index.html');
  });

  it('lien vers Mon espace depuis une page de jeu ou un sous-dossier', () => {
    expect(lienCompte('index.html?jouer=decollage', 'inscription')).toBe('/compte.html?retour=index.html%3Fjouer%3Ddecollage#inscription');
    vi.stubGlobal('window', { location: { pathname: '/essai/index.html', href: 'https://exemple.fr/essai/index.html' } });
    expect(lienCompte('https://ailleurs.fr')).toBe('/essai/compte.html#connexion');
  });
});
