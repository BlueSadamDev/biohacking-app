import { BENCH_CONTEXT, BENCH_PROMPTS, countWords, outcomeLine, wordsPerSecond } from './benchPrompts';

describe('banc d’essai du coach', () => {
  it('prévoit les 3 demandes types', () => {
    expect(BENCH_PROMPTS.map((p) => p.task.kind)).toEqual(['weekly', 'why-alert', 'question']);
  });

  it('utilise le résumé fictif', () => {
    expect(BENCH_CONTEXT.text).toContain('protéines hier : 118 g pour une cible de 140 g (sous la cible)');
  });

  it('compte les mots et la vitesse', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  Bonne   semaine, continue ! ')).toBe(4);
    expect(wordsPerSecond('un deux trois quatre', 2000)).toBe(2);
    expect(wordsPerSecond('un', 0)).toBeNull();
  });

  it('décrit le résultat du contrôle', () => {
    expect(outcomeLine({ kind: 'answer', text: '', attempts: 1, rejections: [] })).toBe('Contrôle réussi au 1er essai');
    expect(
      outcomeLine({ kind: 'answer', text: '', attempts: 2, rejections: [[{ kind: 'unknown-number', numbers: [160] }]] }),
    ).toBe('Contrôle réussi au 2e essai (1er essai refusé : nombre absent du résumé (160))');
    expect(outcomeLine({ kind: 'fallback', text: '', attempts: 2, rejections: [[{ kind: 'empty' }], [{ kind: 'empty' }]] })).toContain(
      'Message de repli',
    );
  });
});
