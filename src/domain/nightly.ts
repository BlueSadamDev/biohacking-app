// Règle « une valeur par nuit » (cahier des charges, section 3).
// Calculs purs : aucune lecture de base de données ni de Health Connect ici.
//
// 1. Chaque séance de sommeil est rattachée à une nuit (date du réveil).
// 2. Pour chaque nuit, le sommeil principal est la séance la plus longue.
// 3. HRV de la nuit : moyenne de ln(rMSSD) des mesures prises pendant ce sommeil.
// 4. FC au repos de la nuit : moyenne des N valeurs les plus basses pendant ce sommeil.

import { addDays, dayKey } from './dates';
import { SETTINGS, type Settings } from './settings';

export type SleepStage = { start: number; end: number; stage: number };

export type SleepSession = {
  id: string;
  /** Début et fin, en millisecondes depuis 1970. */
  start: number;
  end: number;
  /** Phases de sommeil, si l'app d'origine les fournit. */
  stages: SleepStage[];
  origin: string;
};

/** Une mesure ponctuelle (HRV en ms, FC en bpm). */
export type Sample = { time: number; value: number; origin: string };

export type NightValue = {
  /** Date du réveil, « AAAA-MM-JJ ». */
  date: string;
  sleep: SleepSession;
  /** Minutes réellement dormies (phases d'éveil retirées quand elles sont connues). */
  asleepMinutes: number;
  /** Moyenne de ln(rMSSD) ; null = non calculable (aucune mesure pendant le sommeil). */
  lnRmssd: number | null;
  /** exp(lnRmssd), en ms, pour l'affichage. */
  hrvMs: number | null;
  hrvSampleCount: number;
  /** FC au repos de la nuit en bpm ; null = non calculable. */
  restingHr: number | null;
  /** Mesures utilisées pour la FC au repos. */
  restingHrSource: 'resting' | 'heart_rate' | null;
};

/** Minutes dormies : durée totale moins les phases d'éveil (si connues). */
export function asleepMinutes(sleep: SleepSession, settings: Settings = SETTINGS): number {
  const total = sleep.end - sleep.start;
  const awake = sleep.stages
    .filter((s) => settings.night.awakeStageCodes.includes(s.stage))
    .reduce((sum, s) => sum + Math.max(0, Math.min(s.end, sleep.end) - Math.max(s.start, sleep.start)), 0);
  return Math.max(0, total - awake) / 60000;
}

/**
 * Nuit à laquelle appartient une séance de sommeil, d'après son heure de fin.
 * Renvoie null pour une sieste (fin entre `windowEndHour` et `windowStartHour`).
 */
export function nightDateOf(sleepEnd: number, settings: Settings = SETTINGS): string | null {
  const end = new Date(sleepEnd);
  const hour = end.getHours() + end.getMinutes() / 60;
  if (hour < settings.night.windowEndHour) return dayKey(end);
  if (hour >= settings.night.windowStartHour) return addDays(dayKey(end), 1);
  return null;
}

/** Sommeil principal de chaque nuit : la séance la plus longue rattachée à cette nuit. */
export function mainSleepByNight(
  sleeps: SleepSession[],
  settings: Settings = SETTINGS,
): Map<string, SleepSession> {
  const result = new Map<string, SleepSession>();
  for (const sleep of sleeps) {
    if (sleep.end <= sleep.start) continue;
    const date = nightDateOf(sleep.end, settings);
    if (!date) continue;
    const current = result.get(date);
    if (!current || sleep.end - sleep.start > current.end - current.start) {
      result.set(date, sleep);
    }
  }
  return result;
}

/** Mesures triées par heure (copie ; tri stable : l'ordre d'arrivée est gardé à heure égale). */
export function sortByTime(samples: readonly Sample[]): Sample[] {
  return [...samples].sort((a, b) => a.time - b.time);
}

/** Premier indice dont l'heure est ≥ `time` (recherche par dichotomie dans des mesures triées). */
function firstAtOrAfter(sorted: readonly Sample[], time: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Mesures valides prises pendant un sommeil (bornes comprises), dans des mesures triées par heure.
 * Dichotomie : on ne parcourt que les mesures de la nuit, pas toutes les mesures pour chaque nuit.
 */
function inside(sleep: SleepSession, sorted: readonly Sample[]): Sample[] {
  const result: Sample[] = [];
  for (let i = firstAtOrAfter(sorted, sleep.start); i < sorted.length && sorted[i].time <= sleep.end; i++) {
    if (sorted[i].value > 0) result.push(sorted[i]);
  }
  return result;
}

function meanOfLowest(values: number[], count: number): number | null {
  if (values.length === 0) return null;
  const lowest = [...values].sort((a, b) => a - b).slice(0, count);
  return lowest.reduce((a, b) => a + b, 0) / lowest.length;
}

/** Valeurs par nuit, triées par date. Une nuit sans sommeil principal n'apparaît pas. */
export function computeNights(
  input: {
    sleeps: SleepSession[];
    hrv: Sample[];
    restingHr: Sample[];
    heartRate: Sample[];
  },
  settings: Settings = SETTINGS,
): NightValue[] {
  const nights: NightValue[] = [];
  const hrvSorted = sortByTime(input.hrv);
  const restingSorted = sortByTime(input.restingHr);
  const heartRateSorted = sortByTime(input.heartRate);
  for (const [date, sleep] of mainSleepByNight(input.sleeps, settings)) {
    const hrv = inside(sleep, hrvSorted);
    const lnRmssd = hrv.length
      ? hrv.reduce((sum, s) => sum + Math.log(s.value), 0) / hrv.length
      : null;

    let restingHr = meanOfLowest(
      inside(sleep, restingSorted).map((s) => s.value),
      settings.night.restingHrLowestCount,
    );
    let restingHrSource: NightValue['restingHrSource'] = restingHr === null ? null : 'resting';
    if (restingHr === null && settings.night.restingHrFallbackToHeartRate) {
      restingHr = meanOfLowest(
        inside(sleep, heartRateSorted).map((s) => s.value),
        settings.night.restingHrLowestCount,
      );
      restingHrSource = restingHr === null ? null : 'heart_rate';
    }

    nights.push({
      date,
      sleep,
      asleepMinutes: asleepMinutes(sleep, settings),
      lnRmssd,
      hrvMs: lnRmssd === null ? null : Math.exp(lnRmssd),
      hrvSampleCount: hrv.length,
      restingHr,
      restingHrSource,
    });
  }
  return nights.sort((a, b) => a.date.localeCompare(b.date));
}
