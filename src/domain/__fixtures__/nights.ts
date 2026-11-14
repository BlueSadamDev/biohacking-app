// Données FICTIVES pour les tests. Aucune vraie donnée de santé.

import { addDays } from '../dates';
import type { NightValue, Sample, SleepSession } from '../nightly';

export const ORIGIN = 'com.huami.watch.hmwatchmanager';

/** Instant en heure locale : at(2026, 1, 10, 7, 30) = 10 janvier 2026, 7 h 30. */
export function at(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

export function sleep(id: string, start: number, end: number, stages: SleepSession['stages'] = []): SleepSession {
  return { id, start, end, stages, origin: ORIGIN };
}

export function samples(times: number[], values: number[]): Sample[] {
  return times.map((time, i) => ({ time, value: values[i], origin: ORIGIN }));
}

/** Nuit fictive du 9 au 10 janvier 2026, 23 h → 7 h. */
export const NIGHT = sleep('nuit-10', at(2026, 1, 9, 23), at(2026, 1, 10, 7));

export type NightOptions = { hrvMs?: number | null; restingHr?: number | null; asleepMinutes?: number };

/** Nuit fictive déjà calculée (pour tester les normes et le score). Par défaut : HRV 50 ms, FC 55 bpm, 7 h 30. */
export function night(date: string, values: NightOptions = {}): NightValue {
  const [y, m, d] = date.split('-').map(Number);
  const hrvMs = values.hrvMs === undefined ? 50 : values.hrvMs;
  const restingHr = values.restingHr === undefined ? 55 : values.restingHr;
  const asleep = values.asleepMinutes ?? 450;
  const end = at(y, m, d, 7);
  return {
    date,
    sleep: sleep(`s-${date}`, end - asleep * 60000, end),
    asleepMinutes: asleep,
    lnRmssd: hrvMs === null ? null : Math.log(hrvMs),
    hrvMs,
    hrvSampleCount: hrvMs === null ? 0 : 10,
    restingHr,
    restingHrSource: restingHr === null ? null : 'resting',
  };
}

/** `count` nuits consécutives se terminant le `lastDate` ; `make(i)` donne les valeurs (0 = la plus ancienne). */
export function series(lastDate: string, count: number, make: (i: number) => NightOptions = () => ({})): NightValue[] {
  return Array.from({ length: count }, (_, i) => night(addDays(lastDate, i - count + 1), make(i)));
}
