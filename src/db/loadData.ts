// Données nécessaires au calcul de la charge : séances, FC pendant les séances,
// profil cardiaque (Réglages). Partagé par l'accueil et le moteur d'alertes.

import type { LoadInputs } from '@/domain/load';
import type { NightValue } from '@/domain/nightly';
import { effectiveHrMax, trimpCoefficient } from '@/domain/profile';
import { SETTINGS } from '@/domain/settings';

import { getUserSettings } from './appSettings';
import { loadExerciseHeartRate, loadExercises } from './healthData';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Entrées du calcul de charge, avec `extraDays` jours de séances en plus des 28 jours. */
export async function loadLoadInputs(nights: NightValue[], today: string, now: Date, extraDays = 0): Promise<LoadInputs> {
  const since = now.getTime() - (SETTINGS.load.chronicDays + extraDays + 1) * DAY_MS;
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
