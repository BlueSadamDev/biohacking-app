// Données FICTIVES pour les tests. Aucune vraie donnée de santé.

import type { Meal } from '../nutrition';

/** Nom de paquet fictif pour l'app de nutrition. */
export const NUTRITION_ORIGIN = 'exemple.suivi.macro';

export function meal(start: number, values: Partial<Omit<Meal, 'start' | 'origin'>> = {}, origin = NUTRITION_ORIGIN): Meal {
  return {
    start,
    energyKcal: values.energyKcal ?? null,
    proteinG: values.proteinG ?? null,
    carbsG: values.carbsG ?? null,
    fatG: values.fatG ?? null,
    origin,
  };
}
