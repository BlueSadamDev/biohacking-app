// Données de l'onglet Sport : séances et FC de la semaine, cibles et FC max (Réglages),
// composition corporelle (poids, protéines, cible de poids).

import { bodyComposition, type BodyComposition } from '@/domain/bodyComposition';
import { weightByDay } from '@/domain/daily';
import { dayKey, startOfWeek } from '@/domain/dates';
import { nutritionByDay } from '@/domain/nutrition';
import { effectiveHrMax } from '@/domain/profile';
import { SETTINGS } from '@/domain/settings';
import type { ExerciseProgress } from '@/domain/strength';
import { weeklySuggestions, type WeeklySuggestions } from '@/domain/suggestions';
import { weekActivity, type WeekActivity } from '@/domain/zones';

import { getUserSettings } from './appSettings';
import { loadExerciseHeartRate, loadExercises, loadMeals, loadWeights } from './healthData';

export type SportWeek = WeekActivity & {
  /** Séances visées par semaine (Réglages). */
  sessionsTarget: number;
  /** FC max inconnue : les zones ne sont pas calculables. */
  hrMaxMissing: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Composition corporelle du jour (poids, protéines, cible ; la force est passée par l'appelant). */
export async function loadBodyComposition(strength: ExerciseProgress[], now: Date = new Date()): Promise<BodyComposition> {
  const b = SETTINGS.bodyComposition;
  const days = Math.max(b.chartDays, b.trendDays) + SETTINGS.targets.weightAverageDays + 1;
  const [weights, meals, user] = await Promise.all([
    loadWeights(now.getTime() - days * DAY_MS),
    loadMeals(now.getTime() - (b.proteinDays + 2) * DAY_MS),
    getUserSettings(),
  ]);
  return bodyComposition({
    weights: weightByDay(weights),
    nutrition: nutritionByDay(meals),
    strength,
    proteinGPerKg: user.proteinGPerKg,
    targetWeightKg: user.targetWeightKg,
    today: dayKey(now),
  });
}

/** Suggestions d'autres sports de la semaine (manques repérés sur les séances locales). */
export async function loadSuggestions(now: Date = new Date()): Promise<WeeklySuggestions> {
  const s = SETTINGS.suggestions;
  const [sessions, samples, user] = await Promise.all([
    loadExercises(now.getTime() - (s.mobilityWindowDays + 1) * DAY_MS),
    loadExerciseHeartRate(now.getTime() - (s.zone2WindowDays + 1) * DAY_MS),
    getUserSettings(),
  ]);
  return weeklySuggestions({
    sessions,
    samples,
    hrMax: effectiveHrMax(user, now)?.bpm ?? null,
    zone2Target: user.zone2TargetMinutes,
    today: dayKey(now),
  });
}

/** Activité de la semaine en cours (lundi → dimanche). */
export async function loadSportWeek(now: Date = new Date()): Promise<SportWeek> {
  const today = dayKey(now);
  const [y, m, d] = startOfWeek(today).split('-').map(Number);
  const since = new Date(y, m - 1, d).getTime();
  const [sessions, samples, user] = await Promise.all([
    loadExercises(since),
    loadExerciseHeartRate(since),
    getUserSettings(),
  ]);
  const hrMax = effectiveHrMax(user, now)?.bpm ?? null;
  return {
    ...weekActivity(sessions, samples, hrMax, user.zone2TargetMinutes, today),
    sessionsTarget: user.sessionsPerWeek,
    hrMaxMissing: hrMax === null,
  };
}
