import { coachInputs } from './__fixtures__/coach';
import { buildCoachContext } from './coachContext';
import { appAnswer, focusSections } from './coachPrompt';
import { normalizeQuestion, suggestedQuestions, visibleExchanges, type CoachExchange } from './coachQuestions';
import { SETTINGS } from './settings';

describe('questions libres du coach', () => {
  it('suggère d’abord des questions sur ce qui coince', () => {
    // Semaine fictive : charge en hausse, sommeil court, protéines sous la cible.
    expect(suggestedQuestions(buildCoachContext(coachInputs()))).toEqual([
      'Ma charge d’entraînement est-elle trop élevée ?',
      'Comment améliorer mon sommeil ?',
      'Est-ce que je mange assez de protéines ?',
    ]);
  });

  it('complète avec des questions générales quand rien ne coince', () => {
    const good = buildCoachContext(
      coachInputs({
        nights: coachInputs().nights.map((n) => ({ ...n, asleepMinutes: 480 })),
        load: { state: 'ok', acute: 50, chronic: 50, ratio: 1, status: 'balanced', sessions7d: 4, sessionsWithoutHr: 0 },
        week: { weekStart: '2026-11-02', sessions: 4, sessionsTarget: 4, zone2Minutes: 130, zone2Target: 120, zone2Reached: true },
        nutrition: { ...coachInputs().nutrition!, proteinDaysBelow: 1 },
        strength: [],
      }),
    );
    const s = suggestedQuestions(good);
    expect(s).toHaveLength(SETTINGS.coach.questions.maxSuggestions);
    expect(s).toContain('Est-ce que je récupère bien ?');
  });

  it('propose des relances sur le sujet de la dernière question, sans reproposer une question posée', () => {
    const ctx = buildCoachContext(coachInputs());
    const exchange = (question: string, createdMs: number): CoachExchange => ({
      id: `${createdMs}`,
      createdMs,
      question,
      answer: 'R',
      facts: [],
      kind: 'answer',
    });
    const afterSleep = suggestedQuestions(ctx, [exchange('Comment améliorer mon sommeil ?', 1)]);
    expect(afterSleep[0]).toBe('Comment mieux dormir les jours d’entraînement ?');
    expect(afterSleep).not.toContain('Comment améliorer mon sommeil ?');
    // La relance suit la question la plus récente.
    const afterFood = suggestedQuestions(ctx, [exchange('Comment améliorer mon sommeil ?', 1), exchange('Est-ce que je mange bien ?', 2)]);
    expect(afterFood[0]).toBe('Comment répartir mes protéines dans la journée ?');
    expect(afterFood).toHaveLength(SETTINGS.coach.questions.maxSuggestions);
  });

  it('oriente chaque question suggérée vers la bonne rubrique', () => {
    for (const [section, question] of Object.entries(SETTINGS.coach.questions.bySection)) {
      expect(focusSections({ kind: 'question', text: question })).toContain(section);
    }
  });

  it('reconnaît le sujet des questions écrites au clavier', () => {
    expect(focusSections({ kind: 'question', text: 'Est ce que je dors bien?' })).toContain('sleep');
    expect(focusSections({ kind: 'question', text: 'Je me réveille souvent, pourquoi ?' })).toContain('sleep');
    expect(focusSections({ kind: 'question', text: 'Est-ce que je mange bien ?' })).toContain('nutrition');
  });

  it('répond sans le modèle aux questions hors des sujets suivis', () => {
    const ctx = buildCoachContext(coachInputs());
    const ask = (text: string) => appAnswer(ctx, { kind: 'question', text });
    expect(ask('Quel est mon tour de cou ?')).toEqual({ text: SETTINGS.coach.questions.outOfScope, facts: [] });
    expect(ask('Que faire demain ?')).toBeNull(); // question générale : le modèle répond
    expect(ask('Comment je vais en ce moment ?')).toBeNull();
    // Aucune question proposée par l'app n'est refusée.
    const proposed = [
      ...Object.values(SETTINGS.coach.questions.bySection),
      ...SETTINGS.coach.questions.general,
      ...Object.values(SETTINGS.coach.questions.followUps).flat(),
    ];
    expect(proposed.filter((q) => ask(q) !== null)).toEqual([]);
  });

  it('dit ce qui manque quand la rubrique de la question n’a pas de verdict', () => {
    const noWeight = buildCoachContext(
      coachInputs({ nutrition: { ...coachInputs().nutrition!, protein: { value: 110, target: null, fraction: null, reached: null } } }),
    );
    const out = appAnswer(noWeight, { kind: 'question', text: 'Est-ce que je mange bien ?' });
    expect(out?.text).toBe('Je ne peux pas encore te répondre : il faut une pesée récente pour calculer ta cible de protéines.');
    expect(out?.facts[0]).toContain('cible de protéines non calculable');
    const noStrength = buildCoachContext(coachInputs({ strength: [] }));
    expect(appAnswer(noStrength, { kind: 'question', text: 'Comment progresser en force ?' })?.text).toContain('onglet Sport');
    expect(appAnswer(noStrength, { kind: 'weekly' })).toBeNull();
  });

  it('nettoie la question et limite sa longueur', () => {
    expect(normalizeQuestion('   ')).toBeNull();
    expect(normalizeQuestion('  Est-ce   que je dors\nassez ? ')).toBe('Est-ce que je dors assez ?');
    expect(normalizeQuestion('a'.repeat(500))).toHaveLength(SETTINGS.coach.questions.maxLength);
  });

  it('affiche les échanges les plus récents, du plus ancien au plus récent', () => {
    const ex = (i: number): CoachExchange => ({ id: `q${i}`, createdMs: i, question: `Q${i}`, answer: 'R', facts: [], kind: 'answer' });
    const all = Array.from({ length: 25 }, (_, i) => ex(25 - i));
    const shown = visibleExchanges(all);
    expect(shown).toHaveLength(SETTINGS.coach.questions.historyShown);
    expect(shown[0].id).toBe('q6');
    expect(shown[shown.length - 1].id).toBe('q25');
  });
});
