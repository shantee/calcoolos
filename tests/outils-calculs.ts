/**
 * Évaluateur indépendant des calculs affichés (« (7 × 8) + 23 », « 4 × 9 × 25 ») : il relit le texte tel que l'enfant
 * le voit, sans rien savoir du générateur. Il refuse toute étape négative, non entière ou au-delà de 999.
 */
export interface Lecture {
  valeur: number;
  nombres: number[];
  operations: string[];
}

export function lire(texte: string): Lecture {
  const jetons = texte.match(/\d+|[+−×÷()]/g) ?? [];
  if (jetons.join('') !== texte.replace(/\s+/g, '')) throw new Error(`caractère inattendu dans « ${texte} »`);
  let i = 0;
  const nombres: number[] = [];
  const operations: string[] = [];
  const etape = (v: number): number => {
    if (!Number.isInteger(v) || v < 0 || v > 999) throw new Error(`étape hors des règles (${v}) dans « ${texte} »`);
    return v;
  };
  const atome = (): number => {
    const t = jetons[i++];
    if (t === '(') {
      const v = somme();
      if (jetons[i++] !== ')') throw new Error(`parenthèse non fermée dans « ${texte} »`);
      return v;
    }
    if (t === undefined || !/^\d+$/.test(t)) throw new Error(`nombre attendu dans « ${texte} »`);
    const n = Number(t);
    nombres.push(n);
    return etape(n);
  };
  const produit = (): number => {
    let v = atome();
    while (jetons[i] === '×' || jetons[i] === '÷') {
      const op = jetons[i++];
      operations.push(op);
      const w = atome();
      if (op === '÷' && (w === 0 || v % w !== 0)) throw new Error(`division non exacte dans « ${texte} »`);
      v = etape(op === '×' ? v * w : v / w);
    }
    return v;
  };
  const somme = (): number => {
    let v = produit();
    while (jetons[i] === '+' || jetons[i] === '−') {
      const op = jetons[i++];
      operations.push(op);
      const w = produit();
      v = etape(op === '+' ? v + w : v - w);
    }
    return v;
  };
  const valeur = somme();
  if (i !== jetons.length) throw new Error(`fin inattendue dans « ${texte} »`);
  return { valeur, nombres, operations };
}
