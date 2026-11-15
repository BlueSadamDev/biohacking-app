// Coach IA (lot 4, étape C3) : une demande au coach, avec ses garde-fous.
// Le constat chiffré est écrit par l'app (toujours juste) ; le modèle écrit le conseil.
// 1re génération → contrôle ; si refusée, seconde chance avec la raison du refus ;
// si encore refusée, conseil de repli (le constat reste affiché).
// Le modèle est passé en paramètre : llama.rn dans l'app, un modèle simulé dans les tests.

import type { CoachContext } from './coachContext';
import { checkAnswer, describeProblem, type GuardProblem } from './coachGuard';
import { buildUserMessage, COACH_SYSTEM_PROMPT, factLines, fallbackAdvice, type CoachTask } from './coachPrompt';
import { SETTINGS, type Settings } from './settings';

/** Ce que l'app attend d'un modèle de langage local. */
export interface CoachModel {
  generate(
    system: string,
    user: string,
    maxTokens: number,
    onText: (text: string) => void,
  ): Promise<{ text: string; stopped: boolean }>;
}

export type CoachOutcome = {
  /** 'answer' : conseil du modèle accepté ; 'fallback' : conseil de repli ; 'stopped' : arrêté par l'utilisateur. */
  kind: 'answer' | 'fallback' | 'stopped';
  /** Conseil affiché (explication et action). */
  text: string;
  /** Constat écrit par l'app (« Chiffres utilisés »), affiché sous le conseil. */
  facts: string[];
  /** Générations faites (0 à maxAttempts). */
  attempts: number;
  /** Raisons des refus, dans l'ordre des essais. */
  rejections: GuardProblem[][];
};

export async function runCoach(
  model: CoachModel,
  context: CoachContext,
  task: CoachTask,
  onText: (text: string) => void = () => undefined,
  settings: Settings = SETTINGS,
): Promise<CoachOutcome> {
  const g = settings.coach.generation;
  const facts = factLines(context, task, settings);
  const base = buildUserMessage(context, task, settings);
  const rejections: GuardProblem[][] = [];
  let user = base;

  // Le bilan de la semaine (plus long, une fois par semaine) a droit à un essai de plus.
  const maxAttempts = task.kind === 'weekly' ? g.weeklyMaxAttempts : g.maxAttempts;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onText('');
    const res = await model.generate(COACH_SYSTEM_PROMPT, user, g.maxTokens, onText);
    const check = checkAnswer(res.text, context, task, settings);
    if (res.stopped) {
      // Arrêt demandé : on garde le début de réponse seulement s'il passe le contrôle.
      return {
        kind: 'stopped',
        text: check.ok ? check.text : '',
        facts,
        attempts: attempt,
        rejections: check.ok ? rejections : [...rejections, check.problems],
      };
    }
    if (check.ok) return { kind: 'answer', text: check.text, facts, attempts: attempt, rejections };
    rejections.push(check.problems);
    user = `${base}\n\nTa réponse précédente a été refusée : ${check.problems
      .map(describeProblem)
      .join(' ; ')}. Réécris-la en respectant strictement les consignes, sans aucun chiffre.`;
  }

  return { kind: 'fallback', text: fallbackAdvice(task), facts, attempts: maxAttempts, rejections };
}
