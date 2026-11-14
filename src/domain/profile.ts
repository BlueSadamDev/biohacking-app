// Réglages personnels (écran Réglages) : cibles, profil cardiaque, notifications.
// Calculs purs : lecture des champs, FC max, cible de protéines, poids moyen.

import type { DailyWeight } from './daily';
import { addDays } from './dates';
import type { TimeOfDay } from './notification';
import { SETTINGS, type Settings } from './settings';

export type Sex = 'male' | 'female';

export type UserSettings = {
  /** Poids visé (kg) ; null = « à définir ». */
  targetWeightKg: number | null;
  proteinGPerKg: number;
  /** Calories par jour ; null = « à définir ». */
  caloriesKcal: number | null;
  sessionsPerWeek: number;
  birthYear: number | null;
  /** Sexe : choisit le coefficient du TRIMP ; null = « à définir ». */
  sex: Sex | null;
  /** FC max saisie ; null = valeur estimée. */
  hrMaxBpm: number | null;
  notificationTime: TimeOfDay;
  quietStart: TimeOfDay;
  quietEnd: TimeOfDay;
  alertsEnabled: boolean;
};

export function defaultUserSettings(settings: Settings = SETTINGS): UserSettings {
  return {
    targetWeightKg: null,
    proteinGPerKg: settings.targets.proteinGPerKgDefault,
    caloriesKcal: null,
    sessionsPerWeek: settings.targets.sessionsPerWeekDefault,
    birthYear: null,
    sex: null,
    hrMaxBpm: null,
    notificationTime: { hour: settings.notification.defaultHour, minute: settings.notification.defaultMinute },
    quietStart: { ...settings.quietHours.defaultStart },
    quietEnd: { ...settings.quietHours.defaultEnd },
    alertsEnabled: true,
  };
}

/**
 * Lit un nombre tapé dans un champ (« 1,8 » ou « 1.8 »).
 * null si le champ est vide, 'invalid' si ce n'est pas un nombre entre min et max.
 * Arrondi à `decimals` chiffres après la virgule.
 */
export function parseNumber(text: string, min: number, max: number, decimals = 0): number | null | 'invalid' {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  if (!/^\d+(\.\d+)?$/.test(clean)) return 'invalid';
  const factor = 10 ** decimals;
  const value = Math.round(Number(clean) * factor) / factor;
  if (value < min || value > max) return 'invalid';
  return value;
}

/** Année de naissance acceptée (âge entre ageMin et ageMax). */
export function parseBirthYear(text: string, now: Date, settings: Settings = SETTINGS): number | null | 'invalid' {
  const year = now.getFullYear();
  return parseNumber(text, year - settings.profile.ageMax, year - settings.profile.ageMin);
}

/** FC max estimée à partir de l'année de naissance (formule de Tanaka), ou null. */
export function estimateHrMax(birthYear: number | null, now: Date, settings: Settings = SETTINGS): number | null {
  if (birthYear === null) return null;
  const age = now.getFullYear() - birthYear;
  return Math.round(settings.profile.hrMaxIntercept - settings.profile.hrMaxSlope * age);
}

export type HrMax = { bpm: number; source: 'manual' | 'estimated' };

/** FC max retenue : la valeur saisie fait foi, sinon l'estimation. null si aucune des deux. */
export function effectiveHrMax(user: Pick<UserSettings, 'hrMaxBpm' | 'birthYear'>, now: Date, settings: Settings = SETTINGS): HrMax | null {
  if (user.hrMaxBpm !== null) return { bpm: user.hrMaxBpm, source: 'manual' };
  const estimated = estimateHrMax(user.birthYear, now, settings);
  return estimated === null ? null : { bpm: estimated, source: 'estimated' };
}

/** Coefficient du TRIMP selon le sexe ; null tant que le sexe n'est pas renseigné. */
export function trimpCoefficient(sex: Sex | null, settings: Settings = SETTINGS): number | null {
  return sex === null ? null : settings.profile.trimpCoefficient[sex];
}

/**
 * Poids moyen des N derniers jours (aujourd'hui compris), sur les jours qui ont une pesée.
 * null s'il n'y a aucune pesée sur la période.
 */
export function averageWeight(
  weights: Map<string, DailyWeight>,
  today: string,
  settings: Settings = SETTINGS,
): number | null {
  const values: number[] = [];
  for (let i = 0; i < settings.targets.weightAverageDays; i++) {
    const w = weights.get(addDays(today, -i));
    if (w) values.push(w.kg);
  }
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Cible de protéines du jour en grammes (arrondie), ou null sans poids connu. */
export function proteinTargetGrams(gPerKg: number, weightKg: number | null): number | null {
  if (weightKg === null) return null;
  return Math.round(gPerKg * weightKg);
}
