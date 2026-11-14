import {
  BENCH_CONTEXT,
  BENCH_PROMPTS,
  buildUserMessage,
  countWords,
  extractNumbers,
  unknownNumbers,
  wordsPerSecond,
} from './benchPrompts';

describe('banc d’essai du coach', () => {
  it('prévoit les 3 demandes types', () => {
    expect(BENCH_PROMPTS.map((p) => p.id)).toEqual(['bilan', 'pourquoi', 'libre']);
  });

  it('met le résumé chiffré avant la demande', () => {
    const msg = buildUserMessage('Question ?');
    expect(msg.indexOf('"score_moyen_7j":58')).toBeGreaterThan(-1);
    expect(msg.endsWith('Demande : Question ?')).toBe(true);
  });

  it('compte les mots et la vitesse', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  Bonne   semaine, continue ! ')).toBe(4);
    expect(wordsPerSecond('un deux trois quatre', 2000)).toBe(2);
    expect(wordsPerSecond('un', 0)).toBeNull();
  });

  it('lit les nombres avec virgule ou point', () => {
    expect(extractNumbers('Sommeil 6,4 h, ratio 1.42 et 5 séances')).toEqual([6.4, 1.42, 5]);
  });

  it('repère les nombres absents du résumé, sans compter les numéros de liste', () => {
    const answer = '1. Ton ratio est à 1,42.\n2) Vise 150 minutes de zone 2 et 6,4 h de sommeil.';
    expect(unknownNumbers(answer, BENCH_CONTEXT)).toEqual([150]);
  });
});
