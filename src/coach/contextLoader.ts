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
import { dayKey } from '@/domain/dates';
import { buildLoadSummary } from '@/domain/load';
import { buildRecap } from '@/domain/recap';
import { strengthProgress } from '@/domain/strength';

const orNull = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

export async function loadCoachContext(now: Date = new Date()): Promise<CoachContext> {
  const today = dayKey(now);
  const nights = await loadNights();
  const [load, nutrition, week, entries, alerts, correlations] = await Promise.all([
    orNull(loadLoadInputs(nights, today, now).then(buildLoadSummary)),
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
    recap: buildRecap(nights, today),
    load,
    nutrition,
    week,
    strength,
    body,
    alerts: alerts ?? [],
    links: correlations?.links ?? [],
  });
}
