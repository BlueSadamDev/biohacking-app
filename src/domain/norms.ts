// Normes personnelles (cahier des charges, section 5).
// - HRV : moyenne glissante 7 j de ln(rMSSD), comparée à la plage normale
//   des 60 nuits précédentes (moyenne ± 1 écart-type).
// - FC au repos : valeur de la nuit, comparée à la moyenne des 30 nuits précédentes.

import { addDays } from './dates';
import type { NightValue } from './nightly';
import { SETTINGS, type Settings } from './settings';

/** Nuits dont la date est dans [from, to] (bornes comprises, clés « AAAA-MM-JJ »). */
export function nightsBetween(nights: NightValue[], from: string, to: string): NightValue[] {
  return nights.filter((n) => n.date >= from && n.date <= to);
}

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** Écart-type (échantillon, n − 1). */
export function standardDeviation(values: number[]): number | null {
  const m = mean(values);
  if (m === null || values.length < 2) return null;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

export type HrvBaseline = { mean: number; sd: number; low: number; high: number; nights: number };

/** Plage normale de ln(rMSSD) sur les nuits précédant `date` (la nuit du jour exclue). */
export function hrvBaseline(nights: NightValue[], date: string, settings: Settings = SETTINGS): HrvBaseline | null {
  const values = nightsBetween(nights, addDays(date, -settings.norms.hrvBaselineDays), addDays(date, -1))
    .map((n) => n.lnRmssd)
    .filter((v): v is number => v !== null);
  if (values.length < settings.norms.baselineMinNights) return null;
  const m = mean(values)!;
  const sd = standardDeviation(values)!;
  const k = settings.norms.hrvRangeSd;
  return { mean: m, sd, low: m - k * sd, high: m + k * sd, nights: values.length };
}

export type NormPosition = 'below' | 'within' | 'above';

export type HrvNorm = {
  /** Moyenne 7 j de ln(rMSSD) (nuit du jour comprise) ; null si trop peu de nuits. */
  shortMean: number | null;
  shortNights: number;
  baseline: HrvBaseline | null;
  /** Position de la moyenne 7 j par rapport à la plage normale. */
  position: NormPosition | null;
};

export function hrvNorm(nights: NightValue[], date: string, settings: Settings = SETTINGS): HrvNorm {
  const short = nightsBetween(nights, addDays(date, -(settings.norms.hrvShortWindowDays - 1)), date)
    .map((n) => n.lnRmssd)
    .filter((v): v is number => v !== null);
  const shortMean = short.length >= settings.norms.hrvShortWindowMinNights ? mean(short) : null;
  const baseline = hrvBaseline(nights, date, settings);
  let position: NormPosition | null = null;
  if (shortMean !== null && baseline) {
    position = shortMean < baseline.low ? 'below' : shortMean > baseline.high ? 'above' : 'within';
  }
  return { shortMean, shortNights: short.length, baseline, position };
}

export type RestingHrNorm = {
  /** FC au repos de la nuit du jour ; null si non calculable ou nuit absente. */
  tonight: number | null;
  /** Moyenne des 30 nuits précédentes ; null si trop peu de nuits. */
  baselineMean: number | null;
  baselineNights: number;
  /** tonight − baselineMean, en bpm (positif = plus haut que d'habitude). */
  delta: number | null;
};

export function restingHrNorm(nights: NightValue[], date: string, settings: Settings = SETTINGS): RestingHrNorm {
  const tonight = nights.find((n) => n.date === date)?.restingHr ?? null;
  const values = nightsBetween(nights, addDays(date, -settings.norms.restingHrBaselineDays), addDays(date, -1))
    .map((n) => n.restingHr)
    .filter((v): v is number => v !== null);
  const baselineMean = values.length >= settings.norms.baselineMinNights ? mean(values) : null;
  return {
    tonight,
    baselineMean,
    baselineNights: values.length,
    delta: tonight !== null && baselineMean !== null ? tonight - baselineMean : null,
  };
}
