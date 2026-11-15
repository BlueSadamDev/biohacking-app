// Données FICTIVES pour les tests et le banc d'essai du coach. Aucune vraie donnée de santé.
// Semaine fictive : HRV en baisse, sommeil court, charge en hausse, protéines sous la cible.

import type { CoachInputs } from '../coachContext';
import { targetProgress } from '../nutrition';
import { buildRecap } from '../recap';
import { series } from './nights';

export const COACH_TODAY = '2026-11-08';

/** 60 nuits : 53 nuits habituelles, puis 7 nuits plus difficiles (dont 3 sous 6 h). */
const LAST_WEEK_SLEEP = [350, 420, 340, 450, 355, 400, 380];
export const COACH_NIGHTS = series(COACH_TODAY, 60, (i) =>
  i < 53
    ? { hrvMs: 48 + (i % 5), restingHr: 52 + (i % 3), asleepMinutes: 430 + (i % 4) * 10 }
    : { hrvMs: 40 + (i % 3), restingHr: 56, asleepMinutes: LAST_WEEK_SLEEP[i - 53] },
);

export function coachInputs(overrides: Partial<CoachInputs> = {}): CoachInputs {
  return {
    today: COACH_TODAY,
    nights: COACH_NIGHTS,
    recap: buildRecap(COACH_NIGHTS, COACH_TODAY),
    load: { state: 'ok', acute: 71, chronic: 50, ratio: 1.42, status: 'rising', sessions7d: 5, sessionsWithoutHr: 0 },
    nutrition: {
      date: '2026-11-07',
      day: { date: '2026-11-07', energyKcal: 2350, proteinG: 118, carbsG: 260, fatG: 80, meals: 4, origins: ['exemple.suivi.macro'] },
      protein: targetProgress(118, 140),
      calories: targetProgress(2350, 2600),
      proteinDaysBelow: 4,
    },
    week: { weekStart: '2026-11-02', sessions: 5, sessionsTarget: 4, zone2Minutes: 45, zone2Target: 120, zone2Reached: false },
    strength: [
      { exercise: 'squat', current: 112, trend: 'rising', weekly: [] },
      { exercise: 'bench', current: 84, trend: 'stagnant', weekly: [] },
      { exercise: 'deadlift', current: 138, trend: 'steady', weekly: [] },
    ],
    body: {
      average7d: 78.4,
      trendKgPerWeek: 0.18,
      trend: 'slow-gain',
      targetKg: 80,
      gapToTarget: -1.6,
      sentence: 'Prise lente et force en hausse : monte tes protéines pour que la prise soit surtout du muscle.',
    },
    alerts: [
      {
        date: '2026-11-08',
        level: 'watch',
        title: 'Charge en hausse',
        finding: 'Ratio de charge 7 j / 28 j à 1,42, au-dessus de 1,3.',
        cause: '5 séances cette semaine pour 4 visées.',
        action: 'Une séance légère ou de mobilité demain.',
      },
    ],
    links: [
      {
        strength: 'moderate',
        favorable: false,
        days: 34,
        sentence: 'Les soirs de séance après 20 h, ta HRV de la nuit est inférieure de 12 % en moyenne.',
        action: 'Place tes séances intenses avant 20 h quand c’est possible.',
      },
    ],
    ...overrides,
  };
}
