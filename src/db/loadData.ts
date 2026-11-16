// Données nécessaires au calcul de la charge : séances, FC pendant les séances,
// profil cardiaque (Réglages). Partagé par l'accueil et le moteur d'alertes.

import { sessionChecks, type LoadInputs, type SessionCheck } from '@/domain/load';
import type { NightValue } from '@/domain/nightly';
import { effectiveHrMax, trimpCoefficient } from '@/domain/profile';
import { SETTINGS } from '@/domain/settings';

import { getUserSettings } from './appSettings';
import { loadCountedExercises, loadExerciseHeartRate, loadExercises } from './healthData';

/**
 * Contrôle des séances des 28 derniers jours (écran « Contrôle des données ») : toutes les séances,
 * même courtes, avec ce que le calcul de charge en fait. null si le profil cardiaque est incomplet.
 */
export async function loadSessionChecks(nights: NightValue[], now: Date): Promise<SessionCheck[] | null> {
  const since = now.getTime() - SETTINGS.load.chronicDays * DAY_MS;
  const [sessions, samples, user] = await Promise.all([loadExercises(since), loadExerciseHeartRate(since), getUserSettings()]);
  const hrMax = effectiveHrMax(user, now)?.bpm ?? null;
  const k = trimpCoefficient(user.sex);
  if (hrMax === null || k === null) return null;
  return sessionChecks(
    sessions.filter((s) => s.start >= since),
    samples,
    nights,
    hrMax,
    k,
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Entrées du calcul de charge, avec `extraDays` jours de séances en plus des 28 jours. */
export async function loadLoadInputs(nights: NightValue[], today: string, now: Date, extraDays = 0): Promise<LoadInputs> {
  const since = now.getTime() - (SETTINGS.load.chronicDays + extraDays + 1) * DAY_MS;
  const [sessions, samples, user] = await Promise.all([
    loadCountedExercises(since),
    loadExerciseHeartRate(since),
    getUserSettings(),
  ]);
  return {
    sessions,
    samples,
    nights,
    hrMax: effectiveHrMax(user, now)?.bpm ?? null,
    coefficient: trimpCoefficient(user.sex),
    historyStart: nights.length ? nights.reduce((min, n) => (n.date < min ? n.date : min), nights[0].date) : null,
    today,
  };
}
