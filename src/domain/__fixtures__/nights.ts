// Données FICTIVES pour les tests. Aucune vraie donnée de santé.

import type { Sample, SleepSession } from '../nightly';

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
