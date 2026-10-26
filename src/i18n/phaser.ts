/**
 * Traduction des textes des jeux : chaque texte Phaser passe par t() au moment où il est posé.
 * À importer dans les points d'entrée des jeux. En français, ne fait rien.
 */
import Phaser from 'phaser';
import { langue } from './langue';
import { t } from './traduire';

if (langue() !== 'fr') {
  const proto = Phaser.GameObjects.Text.prototype;
  const setText = proto.setText;
  // Décollage ! glisse un antiligature (U+200C) entre « f » et « i »/« l » (la police pixel n'a pas ces
  // ligatures) : on traduit le texte sans lui, puis on le remet dans la traduction.
  const tr = (s: string) => {
    if (!s.includes('\u200c')) return t(s);
    return t(s.replaceAll('\u200c', '')).replace(/f(?=[il])/g, 'f\u200c');
  };
  proto.setText = function (this: Phaser.GameObjects.Text, value: string | number | string[]) {
    const v = Array.isArray(value) ? value.map(tr) : typeof value === 'string' ? tr(value) : value;
    return setText.call(this, v as string);
  };
}
