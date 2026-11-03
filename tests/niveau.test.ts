import { describe, expect, it } from 'vitest';
import { EXEMPLES_PAR_JEU, NIVEAUX, NIVEAU_INFOS, PHRASE_NIVEAUX, estNiveau, familleDuJeu, niveauDepart } from '../src/platform/niveau';
import { lire } from './outils-calculs';
import { TIERS } from '../src/core/difficulty';

describe('niveau de départ de l’accueil', () => {
  it('le niveau du profil actif l’emporte sur celui retenu sur l’appareil', () => {
    expect(niveauDepart('cp', 'aventurier')).toEqual({ niveau: 'cp', confirme: true });
  });

  it('sans profil, on retrouve le dernier niveau choisi', () => {
    expect(niveauDepart(null, 'ce2')).toEqual({ niveau: 'ce2', confirme: true });
  });

  it('un nouveau venu n’a pas de niveau imposé : il devra le choisir', () => {
    expect(niveauDepart(undefined, null)).toEqual({ niveau: null, confirme: false });
  });

  it('une valeur inconnue (ancienne version, stockage modifié) est ignorée', () => {
    expect(niveauDepart('expert', 'n’importe quoi')).toEqual({ niveau: null, confirme: false });
    expect(niveauDepart('expert', 'cp')).toEqual({ niveau: 'cp', confirme: true });
    expect(estNiveau('aventurier')).toBe(true);
    expect(estNiveau('')).toBe(false);
    expect(estNiveau(undefined)).toBe(false);
  });
});

describe('fiches des niveaux', () => {
  it('chaque palier des jeux a sa fiche, dans l’ordre de difficulté', () => {
    expect(NIVEAUX).toEqual(Object.keys(TIERS));
    for (const id of NIVEAUX) {
      expect(NIVEAU_INFOS[id].nom).toBe(TIERS[id].label);
      expect(NIVEAU_INFOS[id].public).toBe(TIERS[id].public);
    }
  });

  it('chaque niveau a un exemple par famille de jeu, juste à afficher', () => {
    for (const famille of Object.values(EXEMPLES_PAR_JEU)) {
      for (const id of NIVEAUX) {
        const { exemple, detail } = famille[id];
        expect(detail.length).toBeGreaterThan(5);
        // « 8 + 5 », ou une égalité pour les cubes et le dragon (« 13 = 6 + 7 »).
        const [cible, calcul] = exemple.includes(' = ') ? exemple.split(' = ') : [null, exemple];
        const v = lire(calcul).valeur;
        if (cible !== null) expect(v, exemple).toBe(Number(cible));
      }
    }
  });

  it('les noms sont ceux des classes, sans âge ni piment ; la phrase rappelle qu’on peut changer', () => {
    expect(NIVEAUX.map((id) => NIVEAU_INFOS[id].nom)).toEqual(['CP', 'CE1', 'CE2', 'CM1', 'CM2', 'Aventurier']);
    for (const id of NIVEAUX) expect(NIVEAU_INFOS[id].public).not.toMatch(/\d+ ans|piment/);
    expect(PHRASE_NIVEAUX).toContain('Tu peux changer à tout moment');
  });

  it('famille de chaque jeu d’après sa page', () => {
    expect(familleDuJeu('jeu/neon-flight.html')).toBe('tables');
    expect(familleDuJeu('jeu/multirail.html')).toBe('tables');
    expect(familleDuJeu('jeu/cubes-de-siege.html')).toBe('cubes');
    expect(familleDuJeu('jeu/dragon-gourmand.html')).toBe('dragon');
    expect(familleDuJeu('jeu/decollage.html')).toBe('calcul');
  });

  it('un ancien niveau à piments ne se traduit pas en classe', () => {
    for (const ancien of ['eveil', 'explorateur', 'stratege', 'maitre']) {
      expect(estNiveau(ancien)).toBe(false);
      expect(niveauDepart(ancien, null)).toEqual({ niveau: null, confirme: false });
    }
  });
});
