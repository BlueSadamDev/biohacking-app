// Règle « une valeur par nuit » (cahier des charges, section 3).
// Calculs purs : aucune lecture de base de données ni de Health Connect ici.
//
// 1. Chaque séance de sommeil est rattachée à une nuit (date du réveil).
// 2. Pour chaque nuit, les séances séparées de moins de 60 min forment un seul sommeil (lot 5b).
// 3. Mesures impossibles puis aberrantes écartées (lot 5b).
// 4. HRV de la nuit : moyenne de ln(rMSSD) des mesures retenues pendant ce sommeil.
// 5. FC au repos de la nuit : 10e centile des mesures retenues (lot 5b).

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
  /** Lot 5b : parties dormies de la nuit (2 ou plus : nuit coupée réunie). */
  parts: number;
  /** Lot 5b : séances de sommeil réunies dans cette nuit (doublons compris). */
  sleepSessions: number;
  /** Lot 5b : mesures écartées (valeurs impossibles ou aberrantes) pour la HRV et la FC au repos. */
  discardedHrv: number;
  discardedRestingHr: number;
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

/** Plage de temps (début et fin, en millisecondes). */
type Range = { start: number; end: number };

/** Réunit les plages qui se chevauchent (union), triées. */
function union(ranges: readonly Range[]): Range[] {
  const sorted = ranges.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ start: r.start, end: r.end });
  }
  return merged;
}

const totalLength = (ranges: readonly Range[]) => ranges.reduce((sum, r) => sum + (r.end - r.start), 0);

/** Sommeil principal d'une nuit, éventuellement fait de plusieurs parties (lot 5b : nuits coupées). */
export type NightSleep = {
  /** Sommeil vu comme un tout : du premier coucher au dernier réveil, phases de toutes les parties. */
  sleep: SleepSession;
  /** Parties réellement dormies (sans les éveils entre deux parties), sans chevauchement. */
  parts: Range[];
  /** Séances de sommeil réunies (2 ou plus : nuit coupée, ou nuit réécrite en double par l'app). */
  sessions: number;
};

/**
 * Sommeil principal de chaque nuit (lot 5b) : les séances d'une même nuit séparées de moins de
 * `mergeGapMinutes` forment une seule nuit ; si plusieurs groupes restent, on garde celui où l'on a
 * dormi le plus longtemps. Le sommeil réuni garde l'identifiant de sa plus longue séance.
 */
export function nightSleeps(sleeps: SleepSession[], settings: Settings = SETTINGS): Map<string, NightSleep> {
  const byNight = new Map<string, SleepSession[]>();
  for (const sleep of sleeps) {
    if (sleep.end <= sleep.start) continue;
    const date = nightDateOf(sleep.end, settings);
    if (!date) continue;
    byNight.set(date, [...(byNight.get(date) ?? []), sleep]);
  }
  const gapMs = settings.night.mergeGapMinutes * 60_000;
  const result = new Map<string, NightSleep>();
  for (const [date, list] of byNight) {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    const groups: SleepSession[][] = [];
    let groupEnd = -Infinity;
    for (const sleep of sorted) {
      if (groups.length && sleep.start - groupEnd < gapMs) {
        groups[groups.length - 1].push(sleep);
        groupEnd = Math.max(groupEnd, sleep.end);
      } else {
        groups.push([sleep]);
        groupEnd = sleep.end;
      }
    }
    let best: NightSleep | null = null;
    for (const group of groups) {
      const parts = union(group);
      const longest = group.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
      const candidate: NightSleep = {
        sleep: {
          id: longest.id,
          start: Math.min(...group.map((x) => x.start)),
          end: Math.max(...group.map((x) => x.end)),
          stages: group.flatMap((x) => x.stages),
          origin: longest.origin,
        },
        parts,
        sessions: group.length,
      };
      if (!best || totalLength(parts) > totalLength(best.parts)) best = candidate;
    }
    if (best) result.set(date, best);
  }
  return result;
}

/** Sommeil principal de chaque nuit (sommeil réuni, voir `nightSleeps`). */
export function mainSleepByNight(
  sleeps: SleepSession[],
  settings: Settings = SETTINGS,
): Map<string, SleepSession> {
  return new Map([...nightSleeps(sleeps, settings)].map(([date, n]) => [date, n.sleep]));
}

/** Minutes dormies d'une nuit en plusieurs parties : somme des parties, moins les phases d'éveil. */
export function asleepMinutesOf(parts: readonly Range[], stages: readonly SleepStage[], settings: Settings = SETTINGS): number {
  const awake = union(stages.filter((s) => settings.night.awakeStageCodes.includes(s.stage)));
  let awakeInside = 0;
  for (const a of awake) {
    for (const p of parts) awakeInside += Math.max(0, Math.min(a.end, p.end) - Math.max(a.start, p.start));
  }
  return Math.max(0, totalLength(parts) - awakeInside) / 60000;
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
 * Mesures prises pendant les parties d'une nuit (bornes comprises), dans des mesures triées par heure.
 * Dichotomie : on ne parcourt que les mesures de la nuit, pas toutes les mesures pour chaque nuit.
 */
function insideParts(parts: readonly Range[], sorted: readonly Sample[]): number[] {
  const result: number[] = [];
  for (const part of parts) {
    for (let i = firstAtOrAfter(sorted, part.start); i < sorted.length && sorted[i].time <= part.end; i++) {
      result.push(sorted[i].value);
    }
  }
  return result;
}

function median(sorted: readonly number[]): number {
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Mesures aberrantes (lot 5b) : on écarte d'abord les valeurs impossibles, puis, s'il y a au moins
 * `outlierMinSamples` mesures, celles à plus de `outlierMads` écarts absolus médians de la médiane.
 */
export function withoutOutliers(
  values: readonly number[],
  min: number,
  max: number,
  settings: Settings = SETTINGS,
): { kept: number[]; discarded: number } {
  const possible = values.filter((v) => v >= min && v <= max);
  let kept = possible;
  if (possible.length >= settings.night.outlierMinSamples) {
    const sorted = [...possible].sort((a, b) => a - b);
    const med = median(sorted);
    const mad = median(possible.map((v) => Math.abs(v - med)).sort((a, b) => a - b));
    if (mad > 0) kept = possible.filter((v) => Math.abs(v - med) <= settings.night.outlierMads * mad);
  }
  return { kept, discarded: values.length - kept.length };
}

/** Centile `p` (0 à 1) par interpolation linéaire ; null sans valeur. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
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
  const n = settings.night;
  const nights: NightValue[] = [];
  const hrvSorted = sortByTime(input.hrv);
  const restingSorted = sortByTime(input.restingHr);
  const heartRateSorted = sortByTime(input.heartRate);
  for (const [date, night] of nightSleeps(input.sleeps, settings)) {
    const hrv = withoutOutliers(insideParts(night.parts, hrvSorted), n.rmssdMin, n.rmssdMax, settings);
    const lnRmssd = hrv.kept.length ? hrv.kept.reduce((sum, v) => sum + Math.log(v), 0) / hrv.kept.length : null;

    const resting = withoutOutliers(insideParts(night.parts, restingSorted), n.heartRateMin, n.heartRateMax, settings);
    let restingHr = percentile(resting.kept, n.restingHrPercentile);
    let restingHrSource: NightValue['restingHrSource'] = restingHr === null ? null : 'resting';
    let discardedRestingHr = resting.discarded;
    if (restingHr === null && n.restingHrFallbackToHeartRate) {
      const fallback = withoutOutliers(insideParts(night.parts, heartRateSorted), n.heartRateMin, n.heartRateMax, settings);
      restingHr = percentile(fallback.kept, n.restingHrPercentile);
      restingHrSource = restingHr === null ? null : 'heart_rate';
      discardedRestingHr += fallback.discarded;
    }

    nights.push({
      date,
      sleep: night.sleep,
      asleepMinutes: asleepMinutesOf(night.parts, night.sleep.stages, settings),
      lnRmssd,
      hrvMs: lnRmssd === null ? null : Math.exp(lnRmssd),
      hrvSampleCount: hrv.kept.length,
      restingHr,
      restingHrSource,
      parts: night.parts.length,
      sleepSessions: night.sessions,
      discardedHrv: hrv.discarded,
      discardedRestingHr,
    });
  }
  return nights.sort((a, b) => a.date.localeCompare(b.date));
}
