// Coach IA (lot 4, étape C4) : génère le bilan de la semaine s'il est dû.
// Appelé seulement depuis l'onglet Coach (le modèle n'est jamais chargé ailleurs) ; le modèle est
// chargé pour l'occasion puis libéré. Le résumé est construit pour le dimanche de la semaine couverte.

import { loadLatestWeeklyReview, saveWeeklyReview } from '@/db/coachWeekly';
import { dayKey } from '@/domain/dates';
import { isReviewDue, runWeeklyReview, weekToReview, type WeeklyReview } from '@/domain/weeklyReview';

import { loadCoachContext } from './contextLoader';
import { LlamaCoachModel } from './llamaModel';
import { getInstalledModel } from './modelStore';

/** Bilan en cours de rédaction : permet d'afficher le texte au fil de l'eau et d'arrêter. */
export type WeeklyJob = {
  /** Arrêt demandé par l'utilisateur : le bilan de repli de l'app est enregistré. */
  stop: () => Promise<void>;
  /** Arrêt décidé par l'app (onglet quitté) : rien n'est enregistré, le bilan sera rédigé à la prochaine visite. */
  cancel: () => Promise<void>;
};

/**
 * Rédige et enregistre le bilan dû, puis libère le modèle. Renvoie null si aucun bilan n'est dû
 * ou si le modèle n'est pas installé.
 */
export async function generateDueWeeklyReview(
  onText: (text: string) => void,
  onStart: (job: WeeklyJob) => void = () => undefined,
  now: Date = new Date(),
): Promise<WeeklyReview | null> {
  const installed = getInstalledModel();
  if (!installed) return null;
  const latest = await loadLatestWeeklyReview();
  if (!isReviewDue(dayKey(now), latest?.weekStart ?? null)) return null;

  const week = weekToReview(dayKey(now));
  // Résumé « au dimanche » de la semaine couverte (21 h, pour inclure la journée).
  const [y, m, d] = week.weekEnd.split('-').map(Number);
  const sunday = new Date(y, m - 1, d, 21, 0, 0, 0);
  const context = await loadCoachContext(sunday.getTime() < now.getTime() ? sunday : now);

  const model = new LlamaCoachModel(installed.uri);
  onStart({ stop: () => model.stop(), cancel: () => model.interrupt() });
  try {
    await model.load();
    const { review } = await runWeeklyReview(model, context, week, onText, now.getTime());
    // Interrompu par l'app (onglet quitté, app en arrière-plan, autre modèle) : réessayé à la prochaine visite.
    if (model.interrupted) return null;
    await saveWeeklyReview(review);
    return review;
  } finally {
    await model.release().catch(() => undefined);
  }
}
