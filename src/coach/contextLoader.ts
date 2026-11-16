// Coach IA (lot 4, étape C2) : rassemble, depuis la base locale, les résultats déjà calculés par
// l'app (mêmes fonctions que les écrans Aujourd'hui, Sport et Tendances), puis construit le
// résumé chiffré du coach. Rien ne sort du téléphone. Une source en erreur devient « non disponible ».

import { loadAlerts } from '@/db/alerts';
import { loadNights } from '@/db/healthData';
import { loadLoadInputs } from '@/db/loadData';
import { loadYesterdayNutrition } from '@/db/nutritionData';
import { loadBodyComposition, loadSportWeek } from '@/db/sportData';
import { loadStrengthHistory } from '@/db/strength';
import { loadCorrelations } from '@/db/trendsData';
import { buildCoachContext, type CoachContext } from '@/domain/coachContext';
import { addDays, dayKey } from '@/domain/dates';
import { behaviorFacts } from '@/domain/journal';
import { loadBehaviorLog, loadBehaviors } from '@/db/behaviors';
import { buildLoadSummary } from '@/domain/load';
import { withoutTaggedNights } from '@/domain/periods';
import { buildRecap } from '@/domain/recap';
import { SETTINGS } from '@/domain/settings';
import { loadPeriods } from '@/db/periods';
import { strengthProgress } from '@/domain/strength';

const orNull = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

export async function loadCoachContext(now: Date = new Date()): Promise<CoachContext> {
  const today = dayKey(now);
  const [allNights, periods, behaviors, behaviorLog] = await Promise.all([
    loadNights(),
    loadPeriods().catch(() => []),
    loadBehaviors().catch(() => []),
    loadBehaviorLog(addDays(today, -(SETTINGS.journal.coachDays + 1))).catch(() => new Map()),
  ]);
  // Moyennes et normes du coach sans les jours étiquetés (la nuit du jour reste, comme sur l'accueil).
  const nights = withoutTaggedNights(allNights, periods, today);
  const [load, nutrition, week, entries, alerts, correlations] = await Promise.all([
    orNull(loadLoadInputs(allNights, today, now).then(buildLoadSummary)),
    orNull(loadYesterdayNutrition(today, now)),
    orNull(loadSportWeek(now)),
    orNull(loadStrengthHistory(now)),
    orNull(loadAlerts()),
    orNull(loadCorrelations(now)),
  ]);
  const strength = entries ? strengthProgress(entries, today) : [];
  const body = await orNull(loadBodyComposition(strength, now));
  return buildCoachContext({
    today,
    nights,
    recap: buildRecap(allNights, today, SETTINGS, periods),
    load,
    nutrition,
    week,
    strength,
    body,
    alerts: alerts ?? [],
    links: correlations?.links ?? [],
    periods,
    behaviors: behaviorFacts(behaviors, behaviorLog, today),
  });
}
