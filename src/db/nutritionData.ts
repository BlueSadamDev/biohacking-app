// Nutrition d'un jour par rapport aux cibles des Réglages.
// Partagé par la carte « Nutrition d'hier » et le rappel du récap du matin.

import { weightByDay } from '@/domain/daily';
import { addDays } from '@/domain/dates';
import { nutritionByDay, nutritionDayView, type NutritionDayView } from '@/domain/nutrition';
import { averageWeight, proteinTargetGrams } from '@/domain/profile';
import { SETTINGS } from '@/domain/settings';

import { getUserSettings } from './appSettings';
import { loadMeals, loadWeights } from './healthData';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nutrition du jour `date`, avec la cible de protéines calculée sur le poids moyen 7 j de `today`. */
export async function loadNutritionView(date: string, today: string, now: Date): Promise<NutritionDayView> {
  const days = SETTINGS.nutrition.weekDays + 2;
  const [meals, weights, user] = await Promise.all([
    loadMeals(now.getTime() - (days + 1) * DAY_MS),
    loadWeights(now.getTime() - (SETTINGS.targets.weightAverageDays + 1) * DAY_MS),
    getUserSettings(),
  ]);
  const weight = averageWeight(weightByDay(weights), today);
  return nutritionDayView(
    nutritionByDay(meals),
    date,
    proteinTargetGrams(user.proteinGPerKg, weight),
    user.caloriesKcal,
  );
}

/** Nutrition d'hier. */
export function loadYesterdayNutrition(today: string, now: Date): Promise<NutritionDayView> {
  return loadNutritionView(addDays(today, -1), today, now);
}
