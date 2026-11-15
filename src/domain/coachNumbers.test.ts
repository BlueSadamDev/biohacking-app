import { extractNumbers, unknownNumbers } from './coachNumbers';

describe('nombres des réponses du coach', () => {
  it('lit les nombres avec virgule ou point', () => {
    expect(extractNumbers('Sommeil 6,4 h, ratio 1.42 et 5 séances')).toEqual([6.4, 1.42, 5]);
    expect(extractNumbers('Aucun chiffre ici.')).toEqual([]);
  });

  it('repère les nombres absents de la liste autorisée, sans compter les numéros de liste', () => {
    const answer = '1. Ton ratio est à 1,42.\n2) Vise 150 minutes de zone 2 et 6,4 h de sommeil.';
    expect(unknownNumbers(answer, [1.42, 2, 6.4])).toEqual([150]);
  });

  it('ne signale chaque nombre inventé qu’une fois', () => {
    expect(unknownNumbers('Dors 8 h, oui 8 h.', [7])).toEqual([8]);
  });
});
