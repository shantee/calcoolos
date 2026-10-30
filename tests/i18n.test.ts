import { afterEach, describe, expect, it, vi } from 'vitest';
import { langueDuNavigateur } from '../src/i18n/langue';

/** Charge le module de traduction avec une langue choisie (comme si le visiteur avait cliqué un drapeau). */
async function avecLangue(l: string) {
  vi.resetModules();
  vi.stubGlobal('localStorage', { getItem: () => l, setItem: () => undefined });
  return import('../src/i18n/traduire');
}

afterEach(() => vi.unstubAllGlobals());

describe('détection de la langue', () => {
  it('prend la première langue connue du navigateur', () => {
    expect(langueDuNavigateur(['de-AT', 'en'])).toBe('de');
    expect(langueDuNavigateur(['es-ES', 'fr-CH'])).toBe('fr');
    expect(langueDuNavigateur(['en-US'])).toBe('en');
  });
  it('passe au français pour une langue non traduite ou inconnue', () => {
    expect(langueDuNavigateur(['it-IT', 'es'])).toBe('fr');
    expect(langueDuNavigateur([])).toBe('fr');
  });
});

describe('traduction', () => {
  it('ne touche à rien en français', async () => {
    const { t } = await avecLangue('fr');
    expect(t('Rejouer')).toBe('Rejouer');
  });
  it('traduit les textes simples et garde les espaces autour', async () => {
    const { t } = await avecLangue('en');
    expect(t('Rejouer')).toBe('Play again');
    expect(t('  Jouer ')).toBe('  Play ');
  });
  it('remplit les modèles et traduit les morceaux', async () => {
    const { t } = await avecLangue('de');
    expect(t('Vague 2 / 4')).toBe('Welle 2 / 4');
    expect(t('Niveau Relevé · + − jusqu’à 50, × faciles')).toBe('Level Mittel · + − bis 50, leichte ×');
    expect(t('Résultat enregistré pour Lina : nouveau record !')).toBe('Ergebnis für Lina gespeichert: neuer Rekord!');
  });
  it('traduit ligne par ligne et morceau par morceau', async () => {
    const { t } = await avecLangue('en');
    expect(t('Score 40\nNouveau record !')).toBe('Score 40\nNew record!');
    expect(t('★★☆   Mode invité : score gardé ici, hors classement.')).toBe('★★☆   Guest mode: score kept here, not ranked.');
  });
  it('laisse en français un texte inconnu et le note', async () => {
    const { t, manquantes } = await avecLangue('en');
    expect(t('Un texte tout neuf')).toBe('Un texte tout neuf');
    expect(manquantes.has('Un texte tout neuf')).toBe(true);
    expect(t('1 234')).toBe('1 234');
  });
});
