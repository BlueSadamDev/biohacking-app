// Récap du matin : rassemble en un seul objet tout ce que l'accueil,
// l'écran détail et la notification affichent. Calcul pur.

import { calibrationStatus, type Calibration } from './calibration';
import { addDays } from './dates';
import type { NightValue } from './nightly';
import { hrvNorm, mean, nightsBetween, restingHrNorm, type HrvNorm, type RestingHrNorm } from './norms';
import { recommend, type Recommendation } from './recommendation';
import { computeRecovery, type Recovery } from './recovery';
import { SETTINGS, type Settings } from './settings';

export type Metric = 'hrv' | 'restingHr' | 'sleep';

export type MorningRecap = {
  date: string;
  night: NightValue | null;
  calibration: Calibration;
  recovery: Recovery;
  recommendation: Recommendation;
  hrv: HrvNorm;
  restingHr: RestingHrNorm;
};

export function buildRecap(nights: NightValue[], date: string, settings: Settings = SETTINGS): MorningRecap {
  const calibration = calibrationStatus(nights, date, settings);
  const recovery = computeRecovery(nights, date, settings);
  return {
    date,
    night: nights.find((n) => n.date === date) ?? null,
    calibration,
    recovery,
    recommendation: recommend(recovery, calibration, settings),
    hrv: hrvNorm(nights, date, settings),
    restingHr: restingHrNorm(nights, date, settings),
  };
}

/** Valeur affichée d'une nuit : HRV en ms, FC au repos en bpm, sommeil en minutes. */
export function metricValue(night: NightValue | null | undefined, metric: Metric): number | null {
  if (!night) return null;
  if (metric === 'hrv') return night.hrvMs;
  if (metric === 'restingHr') return night.restingHr;
  return night.asleepMinutes;
}

/**
 * Moyenne sur 7 jours (nuit du jour comprise).
 * HRV : moyenne calculée sur le logarithme, comme la norme.
 */
export function shortMean(nights: NightValue[], metric: Metric, date: string, settings: Settings = SETTINGS): number | null {
  if (metric === 'hrv') {
    const m = hrvNorm(nights, date, settings).shortMean;
    return m === null ? null : Math.exp(m);
  }
  const values = nightsBetween(nights, addDays(date, -(settings.norms.hrvShortWindowDays - 1)), date)
    .map((n) => metricValue(n, metric))
    .filter((v): v is number => v !== null);
  return mean(values);
}

export type ChartPoint = { date: string; value: number | null; unfavorable: boolean };

export type ChartData = {
  points: ChartPoint[];
  /** Plage normale (HRV). */
  band: { low: number; high: number } | null;
  /** Ligne de repère : moyenne 30 j (FC au repos) ou objectif (sommeil). */
  reference: number | null;
  referenceLabel: string | null;
};

/** Données du graphique de tendance sur `days` jours se terminant à `date`. */
export function chartData(
  nights: NightValue[],
  metric: Metric,
  date: string,
  days: number,
  settings: Settings = SETTINGS,
): ChartData {
  const byDate = new Map(nights.map((n) => [n.date, n]));
  let band: ChartData['band'] = null;
  let reference: number | null = null;
  let referenceLabel: string | null = null;

  if (metric === 'hrv') {
    const b = hrvNorm(nights, date, settings).baseline;
    if (b) band = { low: Math.exp(b.low), high: Math.exp(b.high) };
  } else if (metric === 'restingHr') {
    reference = restingHrNorm(nights, date, settings).baselineMean;
    referenceLabel = reference === null ? null : 'Moyenne 30 j';
  } else {
    reference = settings.recovery.sleepTargetMinutes;
    referenceLabel = 'Objectif';
  }

  const unfavorable = (value: number): boolean => {
    if (metric === 'hrv') return band !== null && value < band.low;
    if (metric === 'restingHr') return reference !== null && value > reference + settings.display.restingHrHighBpm;
    return value < settings.display.sleepShortMinutes;
  };

  const points: ChartPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(date, -i);
    const value = metricValue(byDate.get(d), metric);
    points.push({ date: d, value, unfavorable: value !== null && unfavorable(value) });
  }
  return { points, band, reference, referenceLabel };
}
