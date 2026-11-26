import { coachInputs } from './__fixtures__/coach';
import { buildCoachContext } from './coachContext';
import type { CoachModel } from './coachRun';
import {
  fallbackWeekly,
  isReviewDue,
  parseWeeklyAnswer,
  runWeeklyReview,
  weeklyFacts,
  weekStatus,
  weekToReview,
} from './weeklyReview';

// Semaine fictive : sommeil court, HRV basse, récupération en baisse, charge en hausse,
// zone 2 et protéines sous la cible, squat en hausse, développé couché qui stagne.
const ctx = buildCoachContext(coachInputs());

function fakeModel(answers: string[]): CoachModel & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async generate(_s, user, _m, onText) {
      calls.push(user);
      const text = answers[calls.length - 1] ?? '';
      onText(text);
      return { text, stopped: false };
    },
  };
}

describe('bilan de la semaine', () => {
  it('fait le bilan de la semaine en cours le dimanche, sinon de la semaine passée', () => {
    // 2026-11-08 est un dimanche ; 2026-11-11 un mercredi.
    expect(weekToReview('2026-11-08')).toEqual({ weekStart: '2026-11-02', weekEnd: '2026-11-08' });
    expect(weekToReview('2026-11-11')).toEqual({ weekStart: '2026-11-02', weekEnd: '2026-11-08' });
    expect(weekToReview('2026-11-07')).toEqual({ weekStart: '2026-10-26', weekEnd: '2026-11-01' });
  });

  it('est dû le dimanche, ou au premier lancement suivant, une seule fois par semaine', () => {
    expect(isReviewDue('2026-11-08', null)).toBe(true);
    expect(isReviewDue('2026-11-08', '2026-10-26')).toBe(true);
    expect(isReviewDue('2026-11-08', '2026-11-02')).toBe(false);
    expect(isReviewDue('2026-11-10', '2026-11-02')).toBe(false);
    expect(isReviewDue('2026-11-15', '2026-11-02')).toBe(true); // dimanche suivant
    expect(isReviewDue('2026-11-16', '2026-11-02')).toBe(true); // rattrapage le lundi
    expect(isReviewDue('2026-11-16', '2026-11-09')).toBe(false);
  });

  it("décide ce qui a marché et ce qui coince d'après les verdicts", () => {
    const { worked, stuck } = weekStatus(ctx);
    // Au plus 3 points, dans l'ordre de priorité : charge, sommeil, protéines (puis zone 2, HRV…).
    expect(stuck.map((s) => s.text)).toEqual([
      'ta charge d’entraînement augmente',
      'ton sommeil reste sous la durée visée',
      'tes protéines restent souvent sous ta cible',
    ]);
    expect(worked.map((w) => w.text)).toEqual(['ton squat progresse']);
  });

  it('suit les verdicts quand la semaine va bien', () => {
    const good = buildCoachContext(
      coachInputs({
        load: { state: 'ok', acute: 50, chronic: 50, ratio: 1, status: 'balanced', sessions7d: 4, sessionsWithoutHr: 0, estimated7d: 0 },
        week: { weekStart: '2026-11-02', sessions: 4, sessionsTarget: 4, zone2Minutes: 130, zone2Target: 120, zone2Reached: true },
        nutrition: { ...coachInputs().nutrition!, proteinDaysBelow: 1 },
      }),
    );
    const { worked, stuck } = weekStatus(good);
    expect(worked.map((w) => w.text)).toContain('ta charge d’entraînement suit ton rythme habituel');
    expect(worked.map((w) => w.text)).toContain('ta cible d’endurance douce (zone 2) est atteinte');
    expect(stuck.map((s) => s.text)).not.toContain('ta charge d’entraînement augmente');
  });

  it('écrit les chiffres utilisés à partir du résumé', () => {
    const { worked, stuck } = weekStatus(ctx);
    expect(weeklyFacts(ctx, [...stuck, ...worked])).toEqual([
      'charge de la semaine : 42 % de plus que d’habitude',
      'sommeil 6,4 h par nuit',
      'protéines dans la cible 3 jours sur 7 avec repas',
      'squat 112 kg, développé couché 84 kg, soulevé de terre 138 kg',
    ]);
  });

  it('sépare la synthèse et les actions du conseil', () => {
    expect(parseWeeklyAnswer('Semaine fatigante.\n1. Couche-toi plus tôt.\n2) Allège une séance.')).toEqual({
      synthesis: 'Semaine fatigante.',
      actions: ['Couche-toi plus tôt.', 'Allège une séance.'],
    });
    expect(parseWeeklyAnswer('Voici ton bilan :\nSemaine dense.\nAction n°1 : dors.\nAction n°2 : marche.').actions).toEqual(['dors.', 'marche.']);
  });

  it('garde au plus 2 phrases de synthèse, sans phrase d’annonce', () => {
    const answer =
      'Ta semaine montre des progrès. Pour la semaine prochaine, fais ceci :\nLe sommeil reste à améliorer. Une troisième phrase.\n1. Couche-toi plus tôt.\n2. Marche après le dîner.';
    expect(parseWeeklyAnswer(answer).synthesis).toBe('Ta semaine montre des progrès. Le sommeil reste à améliorer.');
  });

  it("ne donne pas de verdict protéines sans assez de jours de repas", () => {
    const few = buildCoachContext(coachInputs({ nutrition: { ...coachInputs().nutrition!, proteinDaysBelow: 0, proteinDaysKnown: 2 } }));
    const { worked, stuck } = weekStatus(few);
    expect([...worked, ...stuck].map((i) => i.section)).not.toContain('nutrition');
  });

  it("propose un repli rédigé par l'app, avec 2 actions", () => {
    const { worked, stuck } = weekStatus(ctx);
    const f = fallbackWeekly(worked, stuck);
    expect(f.synthesis).toBe(
      'Ton squat progresse. En revanche, ta charge d’entraînement augmente, ton sommeil reste sous la durée visée et tes protéines restent souvent sous ta cible.',
    );
    expect(f.actions).toHaveLength(2);
  });

  it('complète avec une action pour garder ce qui a marché, et garde les sigles', () => {
    const worked = [
      { section: 'hrv', text: 'HRV dans ta norme toute la semaine', action: 'Garde l’alternance.' },
      { section: 'load', text: 'ta charge d’entraînement suit ton rythme habituel', action: 'Garde le même volume.' },
    ];
    const stuck = [{ section: 'sleep', text: 'ton sommeil reste sous la durée visée', action: 'Couche-toi plus tôt.' }];
    expect(fallbackWeekly(worked, stuck)).toEqual({
      synthesis:
        'HRV dans ta norme toute la semaine et ta charge d’entraînement suit ton rythme habituel. En revanche, ton sommeil reste sous la durée visée.',
      actions: ['Couche-toi plus tôt.', 'Garde l’alternance.'],
    });
    expect(fallbackWeekly(worked, []).synthesis).toContain('Rien ne coince');
  });

  it('garde la synthèse et les actions du modèle si elles passent le contrôle', async () => {
    const model = fakeModel(['Semaine fatigante, ta récupération baisse.\n1. Couche-toi plus tôt.\n2. Allège une séance.']);
    const { review, outcome } = await runWeeklyReview(model, ctx, weekToReview('2026-11-08'), undefined, 1000);
    expect(outcome.kind).toBe('answer');
    expect(review).toMatchObject({
      weekStart: '2026-11-02',
      weekEnd: '2026-11-08',
      synthesis: 'Semaine fatigante, ta récupération baisse.',
      actions: ['Couche-toi plus tôt.', 'Allège une séance.'],
      source: 'model',
      createdMs: 1000,
    });
    expect(model.calls[0]).toContain("Ce qui coince (décidé par l'app) : ta charge d’entraînement augmente ; ton sommeil reste sous la durée visée");
    expect(model.calls[0]).toContain('qui visent ce qui coince');
  });

  it('garde le bilan du modèle réparé : phrase chiffrée retirée, deux premières actions', async () => {
    const model = fakeModel([
      'Semaine fatigante, ta récupération baisse. Tu as dormi 6 h par nuit.\n1. Couche-toi plus tôt.\n2. Allège une séance.\n3. Marche le soir.',
    ]);
    const { review, outcome } = await runWeeklyReview(model, ctx, weekToReview('2026-11-08'));
    expect(model.calls).toHaveLength(1);
    expect(outcome.kind).toBe('answer');
    expect(review).toMatchObject({
      synthesis: 'Semaine fatigante, ta récupération baisse.',
      actions: ['Couche-toi plus tôt.', 'Allège une séance.'],
      source: 'model',
    });
  });

  it("passe au repli de l'app après trois conseils refusés", async () => {
    const model = fakeModel(['Dors 8 h.\n1. a\n2. b', 'Ton sommeil est bon.\n1. a\n2. b', 'Je ne sais pas.\n1. a\n2. b']);
    const { review, outcome } = await runWeeklyReview(model, ctx, weekToReview('2026-11-08'));
    expect(model.calls).toHaveLength(3);
    expect(outcome.rejections).toHaveLength(3);
    expect(review.source).toBe('app');
    expect(review.synthesis).toContain('En revanche');
    expect(review.actions).toHaveLength(2);
  });
});
