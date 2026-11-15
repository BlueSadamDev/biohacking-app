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
    const base = { text: '', facts: [], rejectedTexts: [], removed: [] };
    expect(outcomeLine({ ...base, kind: 'answer', attempts: 1, rejections: [] })).toBe('Contrôle réussi au 1er essai');
    expect(outcomeLine({ ...base, kind: 'answer', attempts: 2, rejections: [[{ kind: 'number', numbers: [160] }]] })).toBe(
      "Contrôle réussi au 2e essai (1er essai refusé : chiffre écrit (160) : l'utilisateur voit déjà ses chiffres, n'en écris aucun)",
    );
    expect(outcomeLine({ ...base, kind: 'fallback', attempts: 2, rejections: [[{ kind: 'empty' }], [{ kind: 'empty' }]] })).toContain(
      'Message de repli',
    );
  });
});
