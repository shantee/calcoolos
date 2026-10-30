import { describe, expect, it } from 'vitest';
import { NIVEAUX, NIVEAU_INFOS, estNiveau, niveauDepart } from '../src/platform/niveau';
import { TIERS } from '../src/core/difficulty';

describe('niveau de départ de l’accueil', () => {
  it('le niveau du profil actif l’emporte sur celui retenu sur l’appareil', () => {
    expect(niveauDepart('eveil', 'maitre')).toEqual({ niveau: 'eveil', confirme: true });
  });

  it('sans profil, on retrouve le dernier niveau choisi', () => {
    expect(niveauDepart(null, 'stratege')).toEqual({ niveau: 'stratege', confirme: true });
  });

  it('un nouveau venu n’a pas de niveau imposé : il devra le choisir', () => {
    expect(niveauDepart(undefined, null)).toEqual({ niveau: null, confirme: false });
  });

  it('une valeur inconnue (ancienne version, stockage modifié) est ignorée', () => {
    expect(niveauDepart('expert', 'n’importe quoi')).toEqual({ niveau: null, confirme: false });
    expect(niveauDepart('expert', 'eveil')).toEqual({ niveau: 'eveil', confirme: true });
    expect(estNiveau('maitre')).toBe(true);
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

  it('les exemples de calcul sont justes à afficher (aucun texte, aucun reste)', () => {
    for (const id of NIVEAUX) expect(NIVEAU_INFOS[id].exemple).toMatch(/^\d+ [+−×÷] \d+$/);
  });

  it('chaque niveau a son échelle de piments, sans mention d’âge', () => {
    expect(NIVEAUX.map((id) => NIVEAU_INFOS[id].piments)).toEqual([1, 2, 3, 4]);
    for (const id of NIVEAUX) expect(NIVEAU_INFOS[id].public).not.toMatch(/ans|adulte/);
  });
});
