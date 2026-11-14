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
