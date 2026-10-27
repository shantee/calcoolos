/**
 * « Aide-moi à trouver un pseudo » : des pseudos rigolos, tirés au hasard parmi trois familles
 * (jeux de mots sur les maths, titres de héros, animal + adjectif accordé).
 * Contrainte du serveur : 2 à 20 caractères, lettres, chiffres, espaces, « - » et « _ » seulement.
 */
export const JEUX_DE_MOTS = [
  'Léa Dition', 'Sir Conférence', 'Pierre Amide', 'Cécile Indre', 'Hector Angle', 'Paul Ygone',
  'Alain Fini', 'Émile Liard', 'Anne Tier', 'Mathieu Matiques', 'Al Gèbre', 'Pi Casso',
  'Algo Rythme', 'Max Imum', 'Mini Mum', 'Tri Angle', 'Cal Culette', 'Di Vision', 'Jean Tégral',
  'Sept Sur Sept', 'Cent Pour Cent', 'Zorro Zéro',
];

export const TITRES = [
  'Super Calculateur', 'Roi des Nombres', 'Reine des Nombres', 'Capitaine Pi', 'Ninja du Zéro',
  'Turbo Tables', 'Mister Mille', 'Lady Dizaine', 'Roi des Carrés', 'Pirate des Nombres',
  'Super Neuf', 'Docteur Double', 'Fée des Fractions', 'Baron Bonus', 'Mage des Multiples',
  'Duc de Douze', 'Cerveau Turbo', 'Fusée Mentale', 'Champion du Calcul', 'Professeur Pépin',
  'Agent Zéro Faute', 'Capitaine Chiffres', 'Princesse Plus', 'Prince des Puzzles',
];

/** Animal et genre grammatical (m/f), pour accorder l'adjectif. */
export const ANIMAUX: readonly [string, 'm' | 'f'][] = [
  ['Lama', 'm'], ['Poisson', 'm'], ['Hibou', 'm'], ['Escargot', 'm'], ['Panda', 'm'], ['Koala', 'm'],
  ['Renard', 'm'], ['Pingouin', 'm'], ['Hérisson', 'm'], ['Canard', 'm'], ['Dragon', 'm'], ['Raton', 'm'],
  ['Chouette', 'f'], ['Girafe', 'f'], ['Loutre', 'f'], ['Tortue', 'f'], ['Licorne', 'f'], ['Baleine', 'f'],
  ['Grenouille', 'f'], ['Poule', 'f'], ['Souris', 'f'], ['Pieuvre', 'f'],
];

export const ADJECTIFS: readonly [string, string][] = [
  ['Fâché', 'Fâchée'], ['Malin', 'Maligne'], ['Rigolo', 'Rigolote'], ['Futé', 'Futée'], ['Turbo', 'Turbo'],
  ['Farceur', 'Farceuse'], ['Gourmand', 'Gourmande'], ['Masqué', 'Masquée'], ['Volant', 'Volante'],
  ['Pressé', 'Pressée'], ['Génial', 'Géniale'], ['Rusé', 'Rusée'], ['Zinzin', 'Zinzin'], ['Costaud', 'Costaude'],
  ['Cosmique', 'Cosmique'], ['Têtu', 'Têtue'], ['Endormi', 'Endormie'], ['Joyeux', 'Joyeuse'],
];

const auHasard = <T>(liste: readonly T[]): T => liste[Math.floor(Math.random() * liste.length)];

function animal(): string {
  const [nom, genre] = auHasard(ANIMAUX);
  return `${nom} ${auHasard(ADJECTIFS)[genre === 'f' ? 1 : 0]}`;
}

/** Un pseudo au hasard, différent de `sauf` (le pseudo déjà dans le champ). */
export function pseudoAuHasard(sauf = ''): string {
  for (;;) {
    const famille = Math.random();
    const p = famille < 0.3 ? auHasard(JEUX_DE_MOTS) : famille < 0.55 ? auHasard(TITRES) : animal();
    if (p !== sauf) return p;
  }
}
