// Données FICTIVES pour les tests. Aucune vraie donnée de santé.

import type { ExerciseSession } from '../load';
import type { Sample } from '../nightly';
import { ORIGIN } from './nights';

const MINUTE = 60 * 1000;

/** Séance fictive de `minutes` minutes à partir de `start`. */
export function session(id: string, start: number, minutes: number): ExerciseSession {
  return { id, start, end: start + minutes * MINUTE, exerciseType: 70, origin: ORIGIN };
}

/** Mesures de FC constantes : une toutes les `everySeconds` secondes pendant `minutes` minutes. */
export function steadyHr(start: number, minutes: number, bpm: number, everySeconds = 60): Sample[] {
  const result: Sample[] = [];
  for (let t = 0; t < minutes * 60; t += everySeconds) result.push({ time: start + t * 1000, value: bpm, origin: ORIGIN });
  return result;
}
