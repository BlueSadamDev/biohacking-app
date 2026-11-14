// Zones cardiaques (lot 3, cahier des charges section 5). Calcul pur.
// - Zone d'une mesure de FC selon sa part de la FC max (Réglages) : seuils dans settings.ts.
// - Temps par zone d'une séance : chaque mesure compte jusqu'à la suivante (au plus N secondes).
// - Semaine (lundi → dimanche) : séances, temps d'activité, minutes par zone, zone 2 / cible.

import { addDays, dayKey, startOfWeek } from './dates';
import type { ExerciseSession } from './load';
import type { Sample } from './nightly';
import { SETTINGS, type Settings } from './settings';

/** Minutes passées en zones 1 à 5 (index 0 = zone 1). */
export type ZoneMinutes = [number, number, number, number, number];

const emptyZones = (): ZoneMinutes => [0, 0, 0, 0, 0];

/** Zone (1 à 5) d'une FC, selon sa part de la FC max. */
export function zoneOf(bpm: number, hrMax: number, settings: Settings = SETTINGS): 1 | 2 | 3 | 4 | 5 {
  const ratio = bpm / hrMax;
  let zone = 1;
  settings.heartZones.lowerBounds.forEach((bound, i) => {
    if (ratio >= bound) zone = i + 2;
  });
  return zone as 1 | 2 | 3 | 4 | 5;
}

/**
 * Minutes par zone d'une séance. null si la FC est insuffisante
 * (moins de `minSamples` mesures ou moins de `minCoverage` de la séance couverte).
 */
export function sessionZones(
  session: Pick<ExerciseSession, 'start' | 'end'>,
  samples: Sample[],
  hrMax: number,
  settings: Settings = SETTINGS,
): ZoneMinutes | null {
  const s = settings.heartZones;
  const durationMinutes = (session.end - session.start) / 60000;
  if (durationMinutes <= 0 || hrMax <= 0) return null;
  const points = samples
    .filter((p) => p.time >= session.start && p.time <= session.end)
    .sort((a, b) => a.time - b.time);
  if (points.length < s.minSamples) return null;

  const zones = emptyZones();
  let covered = 0;
  points.forEach((p, i) => {
    const next = i + 1 < points.length ? points[i + 1].time : session.end;
    const minutes = Math.min(next - p.time, s.maxSampleGapSeconds * 1000) / 60000;
    zones[zoneOf(p.value, hrMax, settings) - 1] += minutes;
    covered += minutes;
  });
  if (covered < s.minCoverage * durationMinutes) return null;
  return zones;
}

export type WeekActivity = {
  /** Lundi et dimanche de la semaine (clés de jour). */
  weekStart: string;
  weekEnd: string;
  sessions: number;
  /** Durée totale des séances (minutes). */
  activeMinutes: number;
  /** Minutes par zone, sur les séances avec assez de FC ; null si la FC max est inconnue. */
  zones: ZoneMinutes | null;
  /** Séances sans FC suffisante (non comptées dans les zones). */
  sessionsWithoutHr: number;
  zone2Minutes: number | null;
  zone2Target: number;
  /** Cible de zone 2 atteinte ; null si les zones ne sont pas calculables. */
  zone2Reached: boolean | null;
};

/** Activité de la semaine (lundi → dimanche) qui contient `today`. */
export function weekActivity(
  sessions: ExerciseSession[],
  samples: Sample[],
  hrMax: number | null,
  zone2Target: number,
  today: string,
  settings: Settings = SETTINGS,
): WeekActivity {
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const inWeek = sessions.filter((s) => {
    const day = dayKey(s.start);
    return day >= weekStart && day <= weekEnd;
  });
  const activeMinutes = inWeek.reduce((sum, s) => sum + Math.max(0, s.end - s.start) / 60000, 0);

  let zones: ZoneMinutes | null = null;
  let sessionsWithoutHr = 0;
  if (hrMax !== null) {
    zones = emptyZones();
    for (const session of inWeek) {
      const z = sessionZones(session, samples, hrMax, settings);
      if (z === null) sessionsWithoutHr += 1;
      else z.forEach((m, i) => (zones![i] += m));
    }
  }
  const zone2Minutes = zones ? zones[1] : null;
  return {
    weekStart,
    weekEnd,
    sessions: inWeek.length,
    activeMinutes,
    zones,
    sessionsWithoutHr,
    zone2Minutes,
    zone2Target,
    zone2Reached: zone2Minutes === null ? null : zone2Minutes >= zone2Target,
  };
}
