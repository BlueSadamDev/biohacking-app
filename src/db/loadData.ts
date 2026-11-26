// Données nécessaires au calcul de la charge : séances, FC pendant les séances,
// profil cardiaque (Réglages). Partagé par l'accueil et le moteur d'alertes.

import { sessionChecks, type LoadInputs, type SessionCheck } from '@/domain/load';
import type { NightValue } from '@/domain/nightly';
import { effectiveHrMax, trimpCoefficient } from '@/domain/profile';
import { SETTINGS } from '@/domain/settings';

import { getUserSettings } from './appSettings';
import { loadExerciseHeartRate, loadExercises } from './healthData';

/**
 * Contrôle des activités des 28 derniers jours (écran « Contrôle des données ») : toutes les activités,
 * avec ce que le calcul de charge en fait (points mesurés ou estimés). null si le profil est incomplet.
 * Les 28 jours précédents sont lus aussi : ils servent de référence aux charges estimées.
 */
export async function loadSessionChecks(nights: NightValue[], now: Date): Promise<SessionCheck[] | null> {
  const since = now.getTime() - SETTINGS.load.chronicDays * DAY_MS;
  const from = since - SETTINGS.load.estimateWindowDays * DAY_MS;
  const [sessions, samples, user] = await Promise.all([loadExercises(from), loadExerciseHeartRate(from), getUserSettings()]);
  const hrMax = effectiveHrMax(user, now)?.bpm ?? null;
  const k = trimpCoefficient(user.sex);
  if (hrMax === null || k === null) return null;
  return sessionChecks(sessions, samples, nights, hrMax, k).filter((c) => c.start >= since);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Entrées du calcul de charge : toutes les activités (lot 5b), avec `extraDays` jours en plus des 28 jours
 * et de la mise en route des moyennes exponentielles.
 */
export async function loadLoadInputs(nights: NightValue[], today: string, now: Date, extraDays = 0): Promise<LoadInputs> {
  const since = now.getTime() - (SETTINGS.load.chronicDays + SETTINGS.load.ewmaWarmupDays + extraDays + 1) * DAY_MS;
  const [sessions, samples, user] = await Promise.all([
    loadExercises(since),
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
