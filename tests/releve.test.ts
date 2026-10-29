import { describe, expect, it } from 'vitest';
import { Releve, cleFait, mediane } from '../src/platform/releve';

describe('relevé commun des réponses', () => {
  it('compte justes, fausses, série et temps des bonnes réponses seulement', () => {
    const r = new Releve();
    r.reponse(true, 2000);
    r.reponse(true, 4000);
    r.reponse(false, 900);
    r.reponse(true, 3000);
    r.reponse(true);
    expect(r.mesures()).toEqual({ calculs: 5, justes: 4, fausses: 1, serie: 2, tempsMoyen: 3000, tempsMedian: 3000 });
  });
  it('ignore les temps impossibles (pause oubliée) sans inventer de valeur', () => {
    const r = new Releve();
    r.reponse(true, 120_000);
    r.reponse(true, -5);
    const m = r.mesures();
    expect(m.justes).toBe(2);
    expect(m.tempsMoyen).toBeUndefined();
  });
  it('range les multiplications par fait, dans l’ordre, et les divisions avec leur multiplication', () => {
    const r = new Releve();
    r.reponse(true, 1500, { op: '×', a: 8, b: 7 });
    r.reponse(false, 6000, { op: '×', a: 7, b: 8 });
    r.reponse(true, undefined, { op: '÷', a: 56, b: 7 });
    r.reponse(true, 800, { op: '+', a: 7, b: 8 });
    expect(r.mesures().faits).toEqual({ '7×8': [2, 1, 1500, 1] });
  });
  it('outils', () => {
    expect(cleFait(9, 3)).toBe('3×9');
    expect(cleFait(3.5, 2)).toBeNull();
    expect(mediane([5, 1, 3])).toBe(3);
    expect(mediane([4, 1, 3, 2])).toBe(2.5);
  });
});
