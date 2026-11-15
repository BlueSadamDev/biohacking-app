// Coach IA (lot 4, étape C5) : « Pourquoi ? » d'une alerte ou d'un lien observé.
// Le modèle est chargé pour la demande puis libéré (jamais en arrière-plan). Le résumé est calculé
// à la date de l'alerte : pour une alerte ancienne, le coach explique la situation de ce jour-là.

import type { CoachTask } from '@/domain/coachPrompt';
import { runCoach, type CoachOutcome } from '@/domain/coachRun';
import { dayKey } from '@/domain/dates';

import { loadCoachContext } from './contextLoader';
import { LlamaCoachModel } from './llamaModel';
import { getInstalledModel } from './modelStore';

export type ExplainJob = { stop: () => Promise<void> };

/** Date à laquelle calculer le résumé : la date de l'alerte (en soirée), sans dépasser maintenant. */
function contextDate(date: string | null, now: Date): Date {
  if (!date || date >= dayKey(now)) return now;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 21, 0, 0, 0);
}

/**
 * Rédige l'explication d'une alerte ou d'un lien observé, puis libère le modèle.
 * Renvoie null si le modèle n'est pas installé.
 */
export async function explain(
  task: CoachTask,
  date: string | null,
  onText: (text: string) => void,
  onStart: (job: ExplainJob) => void = () => undefined,
  now: Date = new Date(),
): Promise<CoachOutcome | null> {
  const installed = getInstalledModel();
  if (!installed) return null;
  const context = await loadCoachContext(contextDate(date, now));
  const model = new LlamaCoachModel(installed.uri);
  onStart({ stop: () => model.stop() });
  try {
    await model.load();
    return await runCoach(model, context, task, onText);
  } finally {
    await model.release().catch(() => undefined);
  }
}
