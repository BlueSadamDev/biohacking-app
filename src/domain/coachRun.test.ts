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
    expect(model.calls[1]).toContain('Ta réponse précédente a été refusée : chiffre écrit (160)');
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

  it('répare au premier essai une réponse dont une seule phrase est fautive, sans nouvel essai', async () => {
    const model = fakeModel([
      'Non, tes protéines restent sous la cible. Vise 160 g par jour. Elles aident tes muscles à récupérer.\nAction : ajoute une portion de protéines au déjeuner.',
    ]);
    const out = await runCoach(model, ctx, question);
    expect(out).toMatchObject({ kind: 'answer', attempts: 1 });
    expect(out.text).toBe(
      'Non, tes protéines restent sous la cible. Elles aident tes muscles à récupérer.\nAction : ajoute une portion de protéines au déjeuner.',
    );
    expect(out.removed.map((r) => r.problem.kind)).toEqual(['number']);
    expect(model.calls).toHaveLength(1);
  });

  it('ne charge pas le modèle pour une question hors des sujets suivis', async () => {
    const model = fakeModel([GOOD]);
    const out = await runCoach(model, ctx, { kind: 'question', text: 'Quel est mon tour de cou ?' });
    expect(out).toMatchObject({ kind: 'fallback', attempts: 0, facts: [] });
    expect(model.calls).toHaveLength(0);
  });

  it('n’affiche jamais un chiffre, un diagnostic ou un verdict contredit, quelle que soit la réponse du modèle', async () => {
    const bad = [
      'Vise 160 g de protéines.',
      'Tu manges assez de protéines.\nAction : continue.',
      'C’est peut-être une maladie.\nAction : repose-toi.',
      'Tes protéines sont à 118 g, la cible est 140 g.\nAction : mange 22 g de plus.',
      'Consulte un médecin.',
      '',
    ];
    for (const answer of bad) {
      const out = await runCoach(fakeModel([answer, answer]), ctx, question);
      expect(out.text).not.toMatch(/\d/);
      expect(out.text.toLowerCase()).not.toMatch(/maladi|médecin|assez de prot/);
      expect(out.facts[0]).toContain('sous la cible'); // le constat de l'app reste juste
    }
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
    expect(msg.startsWith("Mes chiffres, calculés par l'app Aube")).toBe(true);
    expect(msg).not.toMatch(/constat|données/i);
    expect(msg).toContain('- Alertes des 7 derniers jours : « Charge en hausse »');
    expect(msg).toContain('- Charge d’entraînement : cette semaine, tu t’entraînes 42 % de plus que d’habitude');
    expect(msg).toContain("Demande : Explique simplement pourquoi j'ai reçu l'alerte « Charge en hausse »");
    expect(buildUserMessage(ctx, { kind: 'weekly' })).toContain('exactement 2 actions numérotées');
  });

  it('explique un lien observé à partir du lien lui-même, en rappelant que ce n’est pas une cause', async () => {
    const task = { kind: 'why-link', sentence: 'Les soirs de séance après 20 h, ta HRV de la nuit est inférieure de 12 % en moyenne.' } as const;
    expect(factsFor(ctx, task)).toEqual([]);
    const msg = buildUserMessage(ctx, task);
    expect(msg).toContain('- Liens observés (90 derniers jours) : lien modéré');
    expect(msg).toContain("en rappelant qu'un lien n'est pas une preuve de cause");
    expect(msg).not.toContain('- Sommeil :');
    const out = await runCoach(
      fakeModel(['Les séances tardives semblent peser sur ta HRV, sans que ce soit une preuve de cause.\nAction : avance tes séances intenses.']),
      ctx,
      task,
    );
    expect(out.kind).toBe('answer');
    expect(out.facts).toEqual([`Lien observé : ${task.sentence}`]);
  });

  it("met en avant les rubriques liées au thème de l'alerte", () => {
    const recovery = { kind: 'why-alert', title: 'HRV basse', theme: 'recovery' } as const;
    expect(factsFor(ctx, recovery).map((s) => s.key)).toEqual(['recovery', 'hrv', 'restingHr']);
    const nutrition = { kind: 'why-alert', title: 'Protéines sous la cible', theme: 'nutrition' } as const;
    expect(factsFor(ctx, nutrition).map((s) => s.key)).toEqual(['nutrition', 'weight']);
  });

  it('signale la calibration en cours au modèle', () => {
    const nights = series('2026-11-08', 10);
    const calibrating = buildCoachContext(coachInputs({ nights, recap: buildRecap(nights, '2026-11-08') }));
    expect(buildUserMessage(calibrating, question)).toContain('Calibration en cours');
  });
});
