import { SETTINGS } from '../settings';

import { textProblems } from './guard';
import { behaviorPhrase, DEFAULT_BEHAVIOR_PHRASES } from './journal';
import { LINK_TEXT, linkHeader } from './links';
import { loadDetail, loadPercent, loadSentence } from './today';
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

describe('forme « en phrase » des comportements (liens observés)', () => {
  it('chaque comportement par défaut a sa phrase, avec le même nom que dans les réglages', () => {
    for (const b of SETTINGS.journal.defaultBehaviors) {
      expect(DEFAULT_BEHAVIOR_PHRASES[b.id]?.name).toBe(b.name);
      expect(behaviorPhrase(b)).toBe(DEFAULT_BEHAVIOR_PHRASES[b.id].phrase);
    }
  });

  it('phrase saisie dans « Gérer la liste » : prioritaire, minuscule au début, sans astérisque', () => {
    expect(behaviorPhrase({ id: 'x1', name: 'Yoga', phrase: 'Les jours où tu fais du *yoga*' })).toBe('les jours où tu fais du yoga');
  });

  it('comportement par défaut renommé : plus de phrase par défaut (elle serait fausse)', () => {
    expect(behaviorPhrase({ id: 'alcohol', name: 'Vin rouge' })).toBe('les jours avec « Vin rouge »');
  });

  it('comportement ajouté sans phrase : tournure générique correcte', () => {
    expect(behaviorPhrase({ id: 'x2', name: 'Lecture le soir', phrase: '  ' })).toBe('les jours avec « Lecture le soir »');
  });
});

describe('phrases des liens observés', () => {
  it('écart en relief et repère de comparaison', () => {
    expect(LINK_TEXT.behaviorSleep('les soirs où tu bois de l’alcool', false, 12)).toBe(
      'Les soirs où tu bois de l’alcool, tu dors *12 % de moins* que les autres nuits.',
    );
  });

  it('en-tête de carte en mots', () => {
    expect(linkHeader('moderate', false)).toBe('Effet net, qui te dessert');
    expect(linkHeader('strong', true)).toBe('Effet marqué, qui t’aide');
    expect(linkHeader('weak', false)).toBe('Effet léger');
  });

  it('toutes les phrases respectent la charte', () => {
    const p = 'les soirs où tu bois de l’alcool';
    const all = [
      LINK_TEXT.lateSessionHrv(20, false, 10),
      LINK_TEXT.bedtimeSleep('23 h 30', false, 10),
      LINK_TEXT.proteinRecovery(true, 5),
      LINK_TEXT.loadHrv(false, 9),
      LINK_TEXT.stepsSleep('8 000', true, 5),
      LINK_TEXT.behaviorHrv(p, false, 10),
      LINK_TEXT.behaviorSleep(p, true, 10),
      LINK_TEXT.behaviorScore(p, false, 10),
      LINK_TEXT.behaviorAction('Alcool', true),
      LINK_TEXT.behaviorAction('Alcool', false),
    ];
    for (const text of all) expect(textProblems(text)).toEqual([]);
  });
});

describe('carte de charge en mots', () => {
  it('le rapport devient un pourcentage', () => {
    expect(loadPercent(1.45)).toBe(45);
    expect(loadPercent(0.8)).toBe(-20);
    expect(plainText(loadSentence('high', 1.6))).toBe('Tu t’entraînes 60 % de plus que d’habitude cette semaine. Allège tes prochaines séances.');
    expect(plainText(loadSentence('under', 0.7))).toBe('Tu t’entraînes 30 % de moins que d’habitude cette semaine.');
    expect(plainText(loadSentence('balanced', 1))).toBe('Tu t’entraînes autant que d’habitude cette semaine, dans ton rythme habituel.');
  });

  it('vrais pluriels dans le détail', () => {
    expect(loadDetail(1, 80, 70, 1)).toBe(
      '1 séance ces 7 derniers jours · charge de 80 par jour, contre 70 d’habitude.\n1 séance sans fréquence cardiaque suffisante, non comptée.',
    );
    expect(loadDetail(3, 80, 70, 2)).toContain('2 séances sans fréquence cardiaque suffisante, non comptées.');
  });
});
