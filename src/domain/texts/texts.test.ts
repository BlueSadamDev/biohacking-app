import { countOf, joinList, pluralWord } from './common';
import { parseEmphasis, plainText, userText } from './markup';

describe('relief dans une phrase', () => {
  it('un passage avec un chiffre prend la police des chiffres', () => {
    expect(parseEmphasis('Tu t’entraînes *45 % de plus* que d’habitude.')).toEqual([
      { text: 'Tu t’entraînes ', emphasis: null },
      { text: '45 % de plus', emphasis: 'number' },
      { text: ' que d’habitude.', emphasis: null },
    ]);
  });

  it('un passage sans chiffre est une action, en gras', () => {
    expect(parseEmphasis('*Feu vert* pour une séance lourde.')).toEqual([
      { text: 'Feu vert', emphasis: 'action' },
      { text: ' pour une séance lourde.', emphasis: null },
    ]);
  });

  it('une phrase sans balisage reste d’un seul morceau', () => {
    expect(parseEmphasis('Rien de particulier.')).toEqual([{ text: 'Rien de particulier.', emphasis: null }]);
  });

  it('un astérisque isolé reste affiché tel quel', () => {
    expect(plainText('Note * importante')).toBe('Note * importante');
    expect(parseEmphasis('Note * importante')).toHaveLength(1);
  });

  it('le texte nu retire le balisage (notifications, lecteurs d’écran)', () => {
    expect(plainText('Pas enregistré. *Réessaie dans un instant.*')).toBe('Pas enregistré. Réessaie dans un instant.');
  });

  it('un nom saisi par l’utilisateur ne peut pas casser une phrase', () => {
    expect(plainText(`Les soirs avec ${userText('*Sport*')}, tu dors *12 % de moins*.`)).toBe(
      'Les soirs avec Sport, tu dors 12 % de moins.',
    );
  });
});

describe('pluriels et listes', () => {
  it('singulier pour 0 et 1, pluriel au-delà', () => {
    expect(countOf(0, 'nuit')).toBe('0 nuit');
    expect(countOf(1, 'nuit')).toBe('1 nuit');
    expect(countOf(3, 'nuit')).toBe('3 nuits');
    expect(countOf(1.5, 'heure')).toBe('1,5 heure');
  });

  it('mots déjà au pluriel et pluriels irréguliers', () => {
    expect(pluralWord(2, 'mois')).toBe('mois');
    expect(pluralWord(2, 'travail', 'travaux')).toBe('travaux');
  });

  it('liste en français', () => {
    expect(joinList([])).toBe('');
    expect(joinList(['sommeil'])).toBe('sommeil');
    expect(joinList(['sommeil', 'HRV'])).toBe('sommeil et HRV');
    expect(joinList(['sommeil', 'HRV', 'charge'])).toBe('sommeil, HRV et charge');
  });
});
