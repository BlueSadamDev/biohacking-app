// Nutrition : totaux par jour à partir des repas lus dans Health Connect
// (écrits par l'app Suivi macro). Un repas compte pour le jour de son début.
// Un jour sans repas n'a pas de total : l'app affiche « aucune donnée », jamais 0.

import { dayKey } from './dates';

/** Un repas, tel que rangé dans la base locale. Valeur absente = null (pas 0). */
export type Meal = {
  start: number;
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  origin: string;
};

export type DayNutrition = {
  date: string;
  /** Total du jour ; null si aucun repas du jour ne donne cette valeur. */
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  meals: number;
  /** Apps d'origine des repas du jour (sans doublon). */
  origins: string[];
};

type Field = 'energyKcal' | 'proteinG' | 'carbsG' | 'fatG';
const FIELDS: Field[] = ['energyKcal', 'proteinG', 'carbsG', 'fatG'];

function addValue(total: number | null, value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return total;
  return (total ?? 0) + value;
}

/** Totaux par jour (clé « AAAA-MM-JJ », heure locale). Les jours sans repas sont absents. */
export function nutritionByDay(meals: Meal[]): Map<string, DayNutrition> {
  const result = new Map<string, DayNutrition>();
  for (const meal of meals) {
    const date = dayKey(meal.start);
    let day = result.get(date);
    if (!day) {
      day = { date, energyKcal: null, proteinG: null, carbsG: null, fatG: null, meals: 0, origins: [] };
      result.set(date, day);
    }
    for (const field of FIELDS) day[field] = addValue(day[field], meal[field]);
    day.meals += 1;
    if (!day.origins.includes(meal.origin)) day.origins.push(meal.origin);
  }
  return result;
}
