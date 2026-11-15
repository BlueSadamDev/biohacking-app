import { coachInputs } from './__fixtures__/coach';
import { buildCoachContext } from './coachContext';
import { focusSections } from './coachPrompt';
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

  it('oriente chaque question suggérée vers la bonne rubrique', () => {
    for (const [section, question] of Object.entries(SETTINGS.coach.questions.bySection)) {
      expect(focusSections({ kind: 'question', text: question })).toContain(section);
    }
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
