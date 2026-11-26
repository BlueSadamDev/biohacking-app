// Résumé des nuits pour l'écran de diagnostic : uniquement des comptages,
// jamais de valeurs de santé.

import { exerciseTypeLabel } from './exerciseTypes';
import type { ExerciseSession } from './load';
import type { NightValue } from './nightly';
import { SETTINGS, type Settings } from './settings';
import { isStrengthSession } from './strength';

export type SessionTypeCount = {
  type: number;
  label: string;
  count: number;
  /** Ce type déclenche la saisie de musculation (settings.ts). */
  strength: boolean;
};

/** Nombre de séances par type (pour vérifier sous quel type Zepp enregistre chaque sport). */
export function sessionTypeCounts(sessions: ExerciseSession[], settings: Settings = SETTINGS): SessionTypeCount[] {
  const counts = new Map<number, number>();
  for (const s of sessions) counts.set(s.exerciseType, (counts.get(s.exerciseType) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({
      type,
      label: exerciseTypeLabel(type),
      count,
      strength: isStrengthSession({ exerciseType: type }, settings),
    }))
    .sort((a, b) => b.count - a.count || a.type - b.type);
}

export type NightsSummary = {
  nights: number;
  withHrv: number;
  withRestingHr: number;
  /** FC au repos calculée à partir des enregistrements « FC au repos ». */
  restingHrFromResting: number;
  /** FC au repos calculée à partir de la FC continue (secours). */
  restingHrFromHeartRate: number;
  /** Sommeils principaux qui contiennent des phases (léger, profond…). */
  withStages: number;
  firstDate: string | null;
  lastDate: string | null;
};

export function summarizeNights(nights: NightValue[]): NightsSummary {
  return {
    nights: nights.length,
    withHrv: nights.filter((n) => n.lnRmssd !== null).length,
    withRestingHr: nights.filter((n) => n.restingHr !== null).length,
    restingHrFromResting: nights.filter((n) => n.restingHrSource === 'resting').length,
    restingHrFromHeartRate: nights.filter((n) => n.restingHrSource === 'heart_rate').length,
    withStages: nights.filter((n) => n.sleep.stages.length > 0).length,
    firstDate: nights[0]?.date ?? null,
    lastDate: nights[nights.length - 1]?.date ?? null,
  };
}

// ---------------------------------------------------------------------------
// Qualité des données (lot 5b, étape 2) : cartes de Contrôle des données. Dates et comptages seulement.
// ---------------------------------------------------------------------------

/** Nuits coupées réunies (2 parties ou plus), de la plus récente à la plus ancienne. */
export function joinedNights(nights: readonly NightValue[]): { date: string; parts: number }[] {
  return nights
    .filter((n) => n.parts > 1)
    .map((n) => ({ date: n.date, parts: n.parts }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Nuits avec des mesures écartées (impossibles ou aberrantes), de la plus récente à la plus ancienne. */
export function nightsWithDiscarded(nights: readonly NightValue[]): { date: string; hrv: number; restingHr: number }[] {
  return nights
    .filter((n) => n.discardedHrv + n.discardedRestingHr > 0)
    .map((n) => ({ date: n.date, hrv: n.discardedHrv, restingHr: n.discardedRestingHr }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Total d'une liste de comptages (en-tête des cartes). */
export function totalOf<T>(items: readonly T[], pick: (item: T) => number): number {
  return items.reduce((sum, item) => sum + pick(item), 0);
}
