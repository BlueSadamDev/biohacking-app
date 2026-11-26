// Données de l'onglet Tendances : liens observés sur les 90 derniers jours (calcul local).

import { findLinks, type CorrelationReport } from '@/domain/correlations';
import { stepsByDay, weightByDay } from '@/domain/daily';
import { dayKey } from '@/domain/dates';
import { dailyLoads, sessionLoads, sessionsOnly } from '@/domain/load';
import { nutritionByDay } from '@/domain/nutrition';
import { SETTINGS } from '@/domain/settings';

import { getUserSettings } from './appSettings';
import { loadBehaviorLogForLinks, loadBehaviors } from './behaviors';
import { loadMeals, loadNights, loadSteps, loadWeights } from './healthData';
import { loadLoadInputs } from './loadData';
import { loadPeriods } from './periods';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function loadCorrelations(now: Date = new Date()): Promise<CorrelationReport> {
  const c = SETTINGS.correlations;
  const today = dayKey(now);
  const since = now.getTime() - (c.windowDays + 2) * DAY_MS;
  const nights = await loadNights();
  const [loadInputs, steps, meals, weights, user, periods, behaviors, behaviorLog] = await Promise.all([
    loadLoadInputs(nights, today, now, Math.max(0, c.windowDays - SETTINGS.load.chronicDays + 1)),
    loadSteps(since),
    loadMeals(since),
    loadWeights(since - SETTINGS.targets.weightAverageDays * DAY_MS),
    getUserSettings(),
    loadPeriods(),
    loadBehaviors(),
    loadBehaviorLogForLinks(today),
  ]);
  const dailyLoad =
    loadInputs.hrMax !== null && loadInputs.coefficient !== null
      ? dailyLoads(sessionLoads(loadInputs.sessions, loadInputs.samples, nights, loadInputs.hrMax, loadInputs.coefficient))
      : null;
  return findLinks({
    nights,
    // Jours d'entraînement des liens observés : séances seulement (lot 5b) ; la charge prend tout.
    sessions: sessionsOnly(loadInputs.sessions),
    dailyLoad,
    steps: stepsByDay(steps),
    nutrition: nutritionByDay(meals),
    weights: weightByDay(weights),
    proteinGPerKg: user.proteinGPerKg,
    periods,
    // Seuls les comportements affichés deviennent des paires testées.
    behaviors: behaviors.filter((b) => b.visible),
    behaviorLog,
    today,
  });
}
