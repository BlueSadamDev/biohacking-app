import { BENCH_PROMPTS, buildUserMessage, countWords, unknownNumbers, wordsPerSecond } from './benchPrompts';

describe('banc d’essai du coach', () => {
  it('prévoit les 3 demandes types', () => {
    expect(BENCH_PROMPTS.map((p) => p.id)).toEqual(['bilan', 'pourquoi', 'libre']);
  });

  it('met le résumé chiffré (fictif) avant la demande', () => {
    const msg = buildUserMessage('Question ?');
    expect(msg.startsWith("Résumé de mes données calculé par l'app Aube")).toBe(true);
    expect(msg).toContain('protéines hier : 118 g pour une cible de 140 g (sous la cible)');
    expect(msg.endsWith('Demande : Question ?')).toBe(true);
  });

  it('compte les mots et la vitesse', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  Bonne   semaine, continue ! ')).toBe(4);
    expect(wordsPerSecond('un deux trois quatre', 2000)).toBe(2);
    expect(wordsPerSecond('un', 0)).toBeNull();
  });

  it('repère les nombres absents du résumé fictif', () => {
    expect(unknownNumbers('Ton ratio est à 1,42 : vise 150 g de protéines.')).toEqual([150]);
  });
});
