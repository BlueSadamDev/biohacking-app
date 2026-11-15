import { coachInputs } from './__fixtures__/coach';
import { buildCoachContext } from './coachContext';
import { buildUserMessage, fallbackAnswer, focusSections } from './coachPrompt';
import { runCoach, type CoachModel } from './coachRun';

const ctx = buildCoachContext(coachInputs());

/** Modèle simulé : renvoie les réponses prévues, dans l'ordre, et garde les messages reçus. */
function fakeModel(answers: (string | { text: string; stopped: boolean })[]): CoachModel & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async generate(_system, user, _max, onText) {
      calls.push(user);
      const a = answers[calls.length - 1] ?? '';
      const res = typeof a === 'string' ? { text: a, stopped: false } : a;
      onText(res.text);
      return res;
    },
  };
}

const GOOD = 'Tes protéines sont sous la cible : 118 g pour 140 g. Ajoute une portion au déjeuner.';
const question = { kind: 'question', text: 'Est-ce que je mange assez de protéines ?' } as const;

describe('demande au coach avec garde-fous', () => {
  it('affiche la première réponse si elle passe le contrôle', async () => {
    const model = fakeModel([GOOD]);
    const out = await runCoach(model, ctx, question);
    expect(out).toMatchObject({ kind: 'answer', text: GOOD, attempts: 1 });
    expect(model.calls).toHaveLength(1);
  });

  it('donne une seconde chance, avec la raison du refus', async () => {
    const model = fakeModel(['Vise 160 g de protéines.', GOOD]);
    const out = await runCoach(model, ctx, question);
    expect(out.kind).toBe('answer');
    expect(out.attempts).toBe(2);
    expect(out.rejections[0][0].kind).toBe('unknown-number');
    expect(model.calls[1]).toContain('Ta réponse précédente a été refusée : nombre absent du résumé (160)');
  });

  it('affiche le message de repli après deux refus', async () => {
    const model = fakeModel(['Tu as une bonne base nutritionnelle.', 'Tu manges assez de protéines !']);
    const out = await runCoach(model, ctx, question);
    expect(out.kind).toBe('fallback');
    expect(out.text).toBe(fallbackAnswer(ctx, question));
    expect(out.text).toContain('Nutrition : protéines hier : 118 g');
    expect(out.rejections).toHaveLength(2);
  });

  it("arrête sans seconde chance quand l'utilisateur appuie sur Arrêter", async () => {
    const model = fakeModel([{ text: 'Tes protéines sont sous', stopped: true }]);
    const out = await runCoach(model, ctx, question);
    expect(out).toMatchObject({ kind: 'stopped', text: 'Tes protéines sont sous', attempts: 1 });
    const bad = await runCoach(fakeModel([{ text: 'Vise 160 g', stopped: true }]), ctx, question);
    expect(bad).toMatchObject({ kind: 'stopped', text: '' });
  });

  it('retire les emoji de la réponse affichée', async () => {
    const out = await runCoach(fakeModel([`${GOOD} 🌟`]), ctx, question);
    expect(out.text).toBe(GOOD);
  });

  it('met les rubriques utiles en tête du message', () => {
    expect(focusSections(question)).toEqual(['nutrition', 'weight']);
    const msg = buildUserMessage(ctx, question);
    expect(msg.indexOf('Rubriques utiles')).toBeLessThan(msg.indexOf('- Nutrition :'));
    expect(msg.indexOf('- Nutrition :')).toBeLessThan(msg.indexOf('Autres données'));
    expect(msg.endsWith('Demande : Est-ce que je mange assez de protéines ?')).toBe(true);
  });

  it("met l'alerte et ses rubriques en tête pour un « Pourquoi ? »", () => {
    const task = { kind: 'why-alert', title: 'Charge en hausse', theme: 'load' } as const;
    expect(focusSections(task)).toEqual(['alerts', 'load', 'zone2', 'recovery']);
    expect(buildUserMessage(ctx, task)).toContain("Pourquoi ai-je reçu l'alerte « Charge en hausse »");
  });

  it('donne tout le résumé pour le bilan de la semaine', () => {
    const msg = buildUserMessage(ctx, { kind: 'weekly' });
    expect(focusSections({ kind: 'weekly' })).toEqual([]);
    expect(msg).not.toContain('Rubriques utiles');
    expect(msg).toContain('Fais le bilan de ma semaine');
  });
});
