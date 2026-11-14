// Résumé des nuits pour l'écran de diagnostic : uniquement des comptages,
// jamais de valeurs de santé.

import type { NightValue } from './nightly';

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
