// Coach IA (lot 4, étape C3) : une demande au coach, avec ses garde-fous.
// 1re génération → contrôle ; si refusée, seconde chance avec la raison du refus ;
// si encore refusée, message de repli construit à partir des verdicts du résumé (sans le modèle).
// Le modèle est passé en paramètre : llama.rn dans l'app, un modèle simulé dans les tests.

import type { CoachContext } from './coachContext';
import { checkAnswer, describeProblem, type GuardProblem } from './coachGuard';
import { buildUserMessage, COACH_SYSTEM_PROMPT, fallbackAnswer, type CoachTask } from './coachPrompt';
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
  /** 'answer' : réponse du modèle acceptée ; 'fallback' : message de repli ; 'stopped' : arrêtée par l'utilisateur. */
  kind: 'answer' | 'fallback' | 'stopped';
  text: string;
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
  const base = buildUserMessage(context, task, settings);
  const rejections: GuardProblem[][] = [];
  let user = base;

  for (let attempt = 1; attempt <= g.maxAttempts; attempt++) {
    onText('');
    const res = await model.generate(COACH_SYSTEM_PROMPT, user, g.maxTokens, onText);
    const check = checkAnswer(res.text, context, settings);
    if (res.stopped) {
      // Arrêt demandé : on garde le début de réponse seulement s'il passe le contrôle.
      return {
        kind: 'stopped',
        text: check.ok ? check.text : '',
        attempts: attempt,
        rejections: check.ok ? rejections : [...rejections, check.problems],
      };
    }
    if (check.ok) return { kind: 'answer', text: check.text, attempts: attempt, rejections };
    rejections.push(check.problems);
    user = `${base}\n\nTa réponse précédente a été refusée : ${check.problems
      .map(describeProblem)
      .join(' ; ')}. Réécris-la en respectant strictement les consignes et les verdicts du résumé.`;
  }

  return { kind: 'fallback', text: fallbackAnswer(context, task, settings), attempts: g.maxAttempts, rejections };
}
