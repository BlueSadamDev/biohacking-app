import { coachInputs } from './__fixtures__/coach';
import { series } from './__fixtures__/nights';
import { buildCoachContext } from './coachContext';
import { buildUserMessage, factsFor, fallbackAdvice, focusSections } from './coachPrompt';
import { runCoach, type CoachModel } from './coachRun';
import { buildRecap } from './recap';

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

const GOOD = 'Tes protéines restent sous la cible.\nAction : ajoute une portion de protéines au déjeuner.';
const question = { kind: 'question', text: 'Est-ce que je mange assez de protéines ?' } as const;

describe('demande au coach avec garde-fous', () => {
  it('affiche le conseil accepté et le constat écrit par l’app', async () => {
    const model = fakeModel([GOOD]);
    const out = await runCoach(model, ctx, question);
    expect(out).toMatchObject({ kind: 'answer', text: GOOD, attempts: 1 });
    expect(out.facts[0]).toContain('Nutrition : protéines hier : 118 g pour une cible de 140 g (sous la cible)');
    expect(model.calls).toHaveLength(1);
  });

  it('donne une seconde chance, avec la raison du refus', async () => {
    const model = fakeModel(['Vise 160 g de protéines.', GOOD]);
    const out = await runCoach(model, ctx, question);
    expect(out.kind).toBe('answer');
    expect(out.attempts).toBe(2);
    expect(out.rejections[0][0].kind).toBe('number');
    expect(model.calls[1]).toContain('Ta réponse précédente a été refusée : chiffre écrit par le modèle (160)');
  });

  it('affiche le conseil de repli après deux refus, le constat restant juste', async () => {
    const model = fakeModel(['Tu as une bonne base nutritionnelle.', 'Tu es proche de ta cible !']);
    const out = await runCoach(model, ctx, question);
    expect(out.kind).toBe('fallback');
    expect(out.text).toBe(fallbackAdvice(question));
    expect(out.facts[0]).toContain('sous la cible');
    expect(out.rejections).toHaveLength(2);
  });

  it("arrête sans seconde chance quand l'utilisateur appuie sur Arrêter", async () => {
    const out = await runCoach(fakeModel([{ text: 'Tes protéines restent sous', stopped: true }]), ctx, question);
    expect(out).toMatchObject({ kind: 'stopped', text: 'Tes protéines restent sous', attempts: 1 });
    const bad = await runCoach(fakeModel([{ text: 'Vise 160 g', stopped: true }]), ctx, question);
    expect(bad).toMatchObject({ kind: 'stopped', text: '' });
  });

  it('retire les emoji du conseil affiché', async () => {
    const out = await runCoach(fakeModel([`${GOOD} 🌟`]), ctx, question);
    expect(out.text).toBe(GOOD);
  });

  it('choisit le constat selon la demande', () => {
    expect(focusSections(question)).toEqual(['nutrition', 'weight']);
    expect(factsFor(ctx, question).map((s) => s.key)).toEqual(['nutrition', 'weight']);
    const why = { kind: 'why-alert', title: 'Charge en hausse', theme: 'load' } as const;
    expect(factsFor(ctx, why).map((s) => s.key)).toEqual(['load', 'zone2', 'recovery']);
    expect(factsFor(ctx, { kind: 'weekly' }).map((s) => s.key)).toEqual([
      'recovery',
      'sleep',
      'hrv',
      'restingHr',
      'load',
      'zone2',
      'nutrition',
      'strength',
      'weight',
    ]);
    expect(factsFor(ctx, { kind: 'question', text: 'Une question sans sujet connu ?' }).map((s) => s.key)).toEqual([
      'recovery',
      'sleep',
      'load',
    ]);
  });

  it("donne au modèle le constat, l'alerte concernée et la demande", () => {
    const why = { kind: 'why-alert', title: 'Charge en hausse', theme: 'load' } as const;
    const msg = buildUserMessage(ctx, why);
    expect(msg.startsWith("Constat calculé par l'app Aube")).toBe(true);
    expect(msg).toContain('- Alertes des 7 derniers jours : « Charge en hausse »');
    expect(msg).toContain("- Charge d'entraînement : ratio 7 jours / 28 jours de 1,42");
    expect(msg).toContain("Demande : Explique simplement pourquoi j'ai reçu l'alerte « Charge en hausse »");
    expect(buildUserMessage(ctx, { kind: 'weekly' })).toContain('exactement 2 actions numérotées');
  });

  it('signale la calibration en cours au modèle', () => {
    const nights = series('2026-11-08', 10);
    const calibrating = buildCoachContext(coachInputs({ nights, recap: buildRecap(nights, '2026-11-08') }));
    expect(buildUserMessage(calibrating, question)).toContain('Calibration en cours');
  });
});
