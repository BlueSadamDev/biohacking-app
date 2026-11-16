// Nutrition : totaux par jour à partir des repas lus dans Health Connect
// (écrits par l'app Suivi macro). Un repas compte pour le jour de son début.
// Un jour sans repas n'a pas de total : l'app affiche « aucune donnée », jamais 0.

import { addDays, dayKey } from './dates';
import { SETTINGS, type Settings } from './settings';

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

// ---------------------------------------------------------------------------
// Comparaison aux cibles (carte « Nutrition d'hier » et rappel du récap du matin)
// ---------------------------------------------------------------------------

export type TargetProgress = {
  /** Valeur du jour ; null si inconnue (pas de repas ou valeur absente). */
  value: number | null;
  /** Cible ; null si « à définir » (ou sans poids connu pour les protéines). */
  target: number | null;
  /** value / target ; null si l'un des deux manque. */
  fraction: number | null;
  /**
   * Cible respectée ; null si non calculable. Protéines (« minimum ») : au moins 90 % de la cible.
   * Calories (« plafond ») : la cible ou moins ; au-dessus, même de peu, elle n'est pas respectée.
   */
  reached: boolean | null;
};

export type TargetKind = 'minimum' | 'ceiling';

export function targetProgress(
  value: number | null,
  target: number | null,
  settings: Settings = SETTINGS,
  kind: TargetKind = 'minimum',
): TargetProgress {
  if (value === null || target === null || target <= 0) return { value, target, fraction: null, reached: null };
  const fraction = value / target;
  const reached = kind === 'ceiling' ? value <= target : fraction >= settings.nutrition.reachedFraction;
  return { value, target, fraction, reached };
}

export type NutritionDayView = {
  date: string;
  /** Totaux du jour ; null = aucun repas enregistré. */
  day: DayNutrition | null;
  protein: TargetProgress;
  calories: TargetProgress;
  /** Jours sous la cible de protéines sur les 7 jours finissant à `date` (jours avec repas seulement). */
  proteinDaysBelow: number;
  /** Jours avec une valeur de protéines comparable à la cible, sur les mêmes 7 jours (lot 4 : coach). */
  proteinDaysKnown: number;
};

export function nutritionDayView(
  nutrition: Map<string, DayNutrition>,
  date: string,
  proteinTargetG: number | null,
  caloriesTargetKcal: number | null,
  settings: Settings = SETTINGS,
): NutritionDayView {
  const day = nutrition.get(date) ?? null;
  let proteinDaysBelow = 0;
  let proteinDaysKnown = 0;
  for (let i = 0; i < settings.nutrition.weekDays; i++) {
    const d = nutrition.get(addDays(date, -i));
    const reached = d ? targetProgress(d.proteinG, proteinTargetG, settings).reached : null;
    if (reached !== null) proteinDaysKnown++;
    if (reached === false) proteinDaysBelow++;
  }
  return {
    date,
    day,
    protein: targetProgress(day?.proteinG ?? null, proteinTargetG, settings),
    // Les calories sont un plafond (décision du 16 novembre 2026) : à respecter, pas à atteindre.
    calories: targetProgress(day?.energyKcal ?? null, caloriesTargetKcal, settings, 'ceiling'),
    proteinDaysBelow,
    proteinDaysKnown,
  };
}

/**
 * Rappel du récap du matin (cahier des charges, F1) : protéines de la veille sous la cible,
 * ou calories au-dessus de la cible (plafond). null s'il n'y a rien à signaler.
 */
export function nutritionReminder(view: NutritionDayView): string | null {
  const parts: string[] = [];
  const p = view.protein;
  if (p.reached === false) parts.push(`protéines ${Math.round(p.value!)} g sur ${Math.round(p.target!)} g`);
  const c = view.calories;
  if (c.reached === false) parts.push(`${Math.round(c.value!)} kcal pour un plafond de ${Math.round(c.target!)}`);
  return parts.length ? `Hier : ${parts.join(', ')}.` : null;
}
