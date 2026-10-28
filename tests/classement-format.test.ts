import { describe, expect, it } from 'vitest';
import { dateCourte, dateLongue, duree, etoiles } from '../src/platform/classement-format';

const TZ = 'Europe/Paris';
const now = new Date('2026-10-28T15:00:00Z');

describe('textes de la page Classements', () => {
  it('date courte : aujourd’hui, hier, cette année, une autre année (heure de Paris)', () => {
    expect(dateCourte('2026-10-28T13:32:00Z', now, TZ)).toBe('aujourd’hui à 14 h 32');
    expect(dateCourte('2026-10-27T08:05:00Z', now, TZ)).toBe('hier à 9 h 05');
    expect(dateCourte('2026-03-03T10:00:00Z', now, TZ)).toBe('3 mars à 11 h 00');
    expect(dateCourte('2025-12-31T10:00:00Z', now, TZ)).toBe('31 déc. 2025');
    // 23 h 30 UTC le 27 = 0 h 30 à Paris le 28 : c'est aujourd'hui pour un joueur en France.
    expect(dateCourte('2026-10-27T23:30:00Z', now, TZ)).toBe('aujourd’hui à 0 h 30');
    expect(dateCourte('pas une date', now, TZ)).toBe('');
  });

  it('date longue', () => {
    expect(dateLongue('2026-10-28T13:32:00Z', TZ)).toBe('mercredi 28 octobre 2026 à 14 h 32');
  });

  it('durée et étoiles', () => {
    expect(duree(45)).toBe('45 s');
    expect(duree(192)).toBe('3 min 12 s');
    expect(duree(720)).toBe('12 min');
    expect(etoiles(2)).toBe('★★☆');
    expect(etoiles(7)).toBe('★★★');
  });
});
