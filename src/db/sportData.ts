// Données de l'onglet Sport : séances et FC de la semaine, cibles et FC max (Réglages).

import { dayKey, startOfWeek } from '@/domain/dates';
import { effectiveHrMax } from '@/domain/profile';
import { weekActivity, type WeekActivity } from '@/domain/zones';

import { getUserSettings } from './appSettings';
import { loadExerciseHeartRate, loadExercises } from './healthData';

export type SportWeek = WeekActivity & {
  /** Séances visées par semaine (Réglages). */
  sessionsTarget: number;
  /** FC max inconnue : les zones ne sont pas calculables. */
  hrMaxMissing: boolean;
};

/** Activité de la semaine en cours (lundi → dimanche). */
export async function loadSportWeek(now: Date = new Date()): Promise<SportWeek> {
  const today = dayKey(now);
  const [y, m, d] = startOfWeek(today).split('-').map(Number);
  const since = new Date(y, m - 1, d).getTime();
  const [sessions, samples, user] = await Promise.all([
    loadExercises(since),
    loadExerciseHeartRate(since),
    getUserSettings(),
  ]);
  const hrMax = effectiveHrMax(user, now)?.bpm ?? null;
  return {
    ...weekActivity(sessions, samples, hrMax, user.zone2TargetMinutes, today),
    sessionsTarget: user.sessionsPerWeek,
    hrMaxMissing: hrMax === null,
  };
}
