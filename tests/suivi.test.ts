import { describe, expect, it } from 'vitest';
import { FIN_VISITE, INACTIVITE, appareil, nouvelId, secondeActive, visiteEnCours } from '../src/platform/suivi';

describe('suivi d’audience', () => {
  it('identifiants aléatoires au format attendu par le serveur', () => {
    const a = nouvelId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(nouvelId()).not.toBe(a);
  });

  it('type d’appareil sans empreinte', () => {
    expect(appareil(false, 1920, 1080)).toBe('ordinateur');
    expect(appareil(true, 390, 844)).toBe('telephone');
    expect(appareil(true, 844, 390)).toBe('telephone');
    expect(appareil(true, 820, 1180)).toBe('tablette');
  });

  it('une seconde ne compte que page visible, joueur présent, hors pause', () => {
    const t = 1_000_000;
    expect(secondeActive(true, t, t - 1000)).toBe(true);
    expect(secondeActive(false, t, t - 1000)).toBe(false);
    expect(secondeActive(true, t, t - INACTIVITE - 1)).toBe(false);
    expect(secondeActive(true, t, t - 1000, true)).toBe(false);
  });

  it('onglet oublié trois heures : au plus une minute comptée', () => {
    let actif = 0;
    const geste = 0;
    for (let s = 1; s <= 3 * 3600; s++) if (secondeActive(true, s * 1000, geste)) actif++;
    expect(actif).toBeLessThanOrEqual(INACTIVITE / 1000);
  });

  it('une visite se termine après 30 minutes sans activité', () => {
    const v = { id: nouvelId(), dernier: 0, actif: 10 };
    expect(visiteEnCours(v, FIN_VISITE - 1)).toBe(true);
    expect(visiteEnCours(v, FIN_VISITE + 1)).toBe(false);
    expect(visiteEnCours(null, 0)).toBe(false);
    expect(visiteEnCours({ ...v, id: 'x' }, 1)).toBe(false);
  });
});
