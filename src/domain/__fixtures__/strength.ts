// Données FICTIVES pour les tests. Aucune vraie donnée de santé.

import { addDays } from '../dates';
import type { Exercise, StrengthEntry } from '../strength';

let counter = 0;

/** Meilleure série fictive d'un exercice un jour donné. */
export function set(date: string, exercise: Exercise, loadKg: number, reps: number, sessionId: string | null = null): StrengthEntry {
  counter += 1;
  return { id: `set-${counter}`, sessionId, date, exercise, loadKg, reps, skipped: false, createdMs: counter };
}

/** « Pas fait » fictif. */
export function skipped(date: string, exercise: Exercise, sessionId: string | null = null): StrengthEntry {
  counter += 1;
  return { id: `set-${counter}`, sessionId, date, exercise, loadKg: null, reps: null, skipped: true, createdMs: counter };
}

/** Une série par semaine pendant `weeks` semaines jusqu'à `lastDate`, charge = `loadOf(i)` (i = 0 la plus ancienne). */
export function weeklySets(lastDate: string, exercise: Exercise, weeks: number, loadOf: (i: number) => number, reps = 5): StrengthEntry[] {
  return Array.from({ length: weeks }, (_, i) => set(addDays(lastDate, -7 * (weeks - 1 - i)), exercise, loadOf(i), reps));
}
