import { coachInputs } from './__fixtures__/coach';
import { buildCoachContext } from './coachContext';
import { checkAnswer, describeProblem, sanitize } from './coachGuard';

// Résumé fictif : protéines sous la cible, sommeil sous la durée visée, HRV sous la plage,
// charge en hausse, zone 2 sous la cible, récupération en baisse, aucune alerte qui persiste.
const ctx = buildCoachContext(coachInputs());
const kinds = (answer: string, task: Parameters<typeof checkAnswer>[2] = null) =>
  checkAnswer(answer, ctx, task).problems.map((p) => p.kind);

describe('contrôle du conseil du coach', () => {
  it('accepte un conseil fidèle au constat, sans chiffre', () => {
    const r = checkAnswer('Tes protéines restent sous la cible.\nAction : ajoute une portion de protéines au déjeuner.', ctx);
    expect(r.ok).toBe(true);
  });

  it('refuse tout chiffre : le constat chiffré est écrit par l’app', () => {
    const r = checkAnswer('Vise 7 à 8 h de sommeil.', ctx);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toEqual({ kind: 'number', numbers: [7, 8] });
  });

  it('accepte les noms qui contiennent un chiffre et les numéros de liste', () => {
    expect(checkAnswer('Ajoute une sortie en zone 2 et vérifie ton 1RM.', ctx).ok).toBe(true);
    expect(checkAnswer('1. Couche-toi plus tôt.\n2. Allège la charge.', ctx, { kind: 'weekly' }).ok).toBe(true);
  });

  it('refuse un verdict contredit', () => {
    expect(kinds('Tu as une bonne base nutritionnelle, continue.')).toContain('contradiction');
    expect(kinds('Tu es proche de ta cible en protéines.')).toContain('contradiction');
    expect(kinds('Tu manges assez de protéines.')).toContain('contradiction');
    expect(kinds('Ton sommeil est bon cette semaine.')).toContain('contradiction');
    expect(kinds('Ta HRV est stable.')).toContain('contradiction');
    expect(kinds('Ta charge est normale.')).toContain('contradiction');
    expect(kinds("Ta charge d'entraînement est en hausse, ce qui est positif.")).toContain('contradiction');
    expect(kinds('Ta récupération est bonne.')).toContain('contradiction');
  });

  it('ne confond pas une négation avec une contradiction', () => {
    expect(checkAnswer('Tu ne manges pas assez de protéines.', ctx).ok).toBe(true);
    expect(checkAnswer("Tu n'as pas assez dormi cette semaine.", ctx).ok).toBe(true);
    expect(checkAnswer("Tu n'es pas encore dans la cible de protéines.", ctx).ok).toBe(true);
  });

  it("n'applique un verdict que s'il est vrai dans le résumé", () => {
    const reached = buildCoachContext(
      coachInputs({
        nutrition: { ...coachInputs().nutrition!, protein: { value: 140, target: 140, fraction: 1, reached: true } },
      }),
    );
    expect(checkAnswer('Tu manges assez de protéines.', reached).ok).toBe(true);
  });

  it('refuse le vocabulaire de diagnostic, sauf s’il vient déjà du résumé', () => {
    expect(kinds('Tu as peut-être une infection.')).toContain('diagnosis');
    const withIllnessAlert = buildCoachContext(
      coachInputs({ alerts: [{ ...coachInputs().alerts[0], title: 'Possible début de maladie ou stress' }] }),
    );
    expect(checkAnswer("L'alerte signale un possible début de maladie ou stress : lève le pied.", withIllnessAlert).ok).toBe(true);
  });

  it("refuse « consulte un professionnel » sans alerte qui persiste, l'accepte sinon", () => {
    expect(kinds('Consulte un professionnel si besoin.')).toContain('referral');
    const persistent = buildCoachContext(coachInputs({ alerts: [{ ...coachInputs().alerts[0], persistent: true }] }));
    expect(checkAnswer('Cette alerte revient souvent : consulte un médecin.', persistent).ok).toBe(true);
  });

  it('demande exactement 2 actions dans le bilan', () => {
    const three = 'Semaine chargée.\nAction n°1 : dors plus.\nAction n°2 : allège la charge.\nAction n°3 : surveille ta charge.';
    expect(kinds(three, { kind: 'weekly' })).toEqual(['action-count']);
    expect(kinds('Semaine chargée.\n1. Dors plus.', { kind: 'weekly' })).toEqual(['action-count']);
    expect(kinds(three)).toEqual([]);
  });

  it('refuse « je ne sais pas » dans le bilan, pas dans une question', () => {
    const answer = 'Je ne sais pas si une autre intervention est nécessaire.\n1. Dors plus.\n2. Allège la charge.';
    expect(kinds(answer, { kind: 'weekly' })).toEqual(['unsure']);
    expect(kinds('Je ne sais pas : l’app ne suit pas ce point.')).toEqual([]);
  });

  it('refuse les commentaires sur les données et les notions non mesurées', () => {
    expect(kinds('Le tableau semble un peu désordonné.')).toContain('meta');
    expect(kinds('Tu dors un peu moins, mais la qualité reste bonne.')).toContain('unmeasured');
    expect(describeProblem({ kind: 'meta', text: 'tableau' })).toContain('réponse directe');
  });

  it('refuse une réponse à la première personne, accepte « je ne peux pas encore le dire »', () => {
    expect(kinds('Non, je dors moins que prévu.\nAction : couche-toi plus tôt.')).toContain('first-person');
    expect(kinds('C’est important pour ma récupération.')).toContain('first-person');
    expect(kinds('Je ne peux pas encore le dire : il faut une pesée récente.\nAction : pèse-toi demain matin.')).toEqual([]);
  });

  it('refuse une réponse hors du sujet de la question', () => {
    const food = { kind: 'question' as const, text: 'Est-ce que je mange bien ?' };
    expect(kinds('Non, tu dors moins que la durée visée.\nAction : couche-toi plus tôt.', food)).toEqual(['off-topic']);
    expect(kinds('Tes protéines restent sous la cible.\nAction : ajoute une portion de protéines au déjeuner.', food)).toEqual([]);
    // Question sans sujet reconnu : pas de contrôle du sujet.
    expect(kinds('Tu récupères moins bien.\nAction : allège ta séance.', { kind: 'question', text: 'Que faire demain ?' })).toEqual([]);
  });

  it('refuse le vouvoiement', () => {
    expect(kinds('Action : augmentez votre apport en protéines.')).toContain('formal');
    expect(describeProblem({ kind: 'formal', text: 'votre' })).toContain('tutoie');
  });

  it('retire les questions de fin de réponse', () => {
    expect(sanitize('1. Dors plus.\n2. Allège la charge.\n\nQue dis-tu ?')).toBe('1. Dors plus.\n2. Allège la charge.');
    expect(sanitize('Est-ce suffisant ?')).toBe('Est-ce suffisant ?');
  });

  it('retire les étiquettes recopiées de la consigne', () => {
    expect(sanitize('Réponse :\n1re phrase : Non, tu dors peu.\n2e phrase : Ça freine ta récupération.\nAction : couche-toi plus tôt.')).toBe(
      'Non, tu dors peu.\nÇa freine ta récupération.\nAction : couche-toi plus tôt.',
    );
    expect(checkAnswer('1re phrase : Non, tu ne dors pas assez.\nAction : couche-toi plus tôt.', ctx).ok).toBe(true);
  });

  it('retire les emoji et refuse une réponse vide', () => {
    expect(sanitize('Prends soin de toi ! 🌟')).toBe('Prends soin de toi !');
    expect(kinds('  🌟 ')).toEqual(['empty']);
  });

  it('explique chaque refus', () => {
    expect(describeProblem({ kind: 'number', numbers: [7, 8] })).toContain('7, 8');
    expect(describeProblem({ kind: 'contradiction', section: 'Nutrition', text: 'bonne base' })).toContain('Nutrition');
    expect(describeProblem({ kind: 'action-count', count: 3, max: 2 })).toBe('3 actions au lieu de 2');
  });
});
