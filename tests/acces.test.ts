import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decider, destinationApresConnexion, lienCompte, retourSur } from '../src/platform/acces';
import type { AccountState, Profile } from '../src/platform/api';

const profil = (id: number, personnel = false): Profile => ({ id, pseudo: `p${id}`, avatar: 'astronaute', niveau: 'ce2', personnel });

describe('accès aux jeux (plus de mode invité)', () => {
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

  it('visiteur : part vers la connexion avec le jeu demandé', () => {
    const etat: AccountState = { connecte: false };
    expect(decider(etat, null, 'jeu/decollage.html?niveau=cm1')).toEqual({ ok: false, vers: '/compte.html?retour=jeu%2Fdecollage.html%3Fniveau%3Dcm1#connexion' });
    // Un ancien joueur retenu dans le navigateur ne suffit plus sans compte.
    expect(decider(etat, { id: 3 }, 'jeu/decollage.html').ok).toBe(false);
  });

  it('compte connecté : joue avec son profil, ou le titulaire, ou le profil unique', () => {
    expect(decider({ connecte: true, profils: [profil(1), profil(2)] }, { id: 2 }, 'jeu/decollage.html').ok).toBe(true);
    expect(decider({ connecte: true, profils: [profil(1), profil(2, true)] }, null, 'jeu/decollage.html').ok).toBe(true);
    expect(decider({ connecte: true, profils: [profil(1)] }, { id: 9 }, 'jeu/decollage.html').ok).toBe(true);
  });

  it('compte sans joueur à choisir d’office : Mon espace, qui ramènera au jeu (sans boucle)', () => {
    const d = decider({ connecte: true, profils: [profil(1), profil(2)] }, null, 'jeu/decollage.html?niveau=cp');
    expect(d).toEqual({ ok: false, vers: '/compte.html?retour=jeu%2Fdecollage.html%3Fniveau%3Dcp' });
    expect(decider({ connecte: true, profils: [] }, null, 'jeu/decollage.html').ok).toBe(false);
  });

  it('serveur injoignable : un joueur déjà choisi continue, sinon connexion', () => {
    expect(decider(null, { id: 1 }, 'jeu/decollage.html').ok).toBe(true);
    expect(decider(null, null, 'jeu/decollage.html').ok).toBe(false);
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
