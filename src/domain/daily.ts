// Valeurs par jour : poids et pas.
// Poids : la saisie manuelle fait foi ; la valeur Zepp (Health Connect)
// n'est retenue que les jours sans saisie. Jamais de moyenne des deux.

import { dayKey } from './dates';
import { SETTINGS, type Settings } from './settings';

/**
 * Lit le poids tapé dans la saisie du matin (« 78,4 » ou « 78.4 »).
 * Renvoie null si le champ est vide, 'invalid' si la valeur n'est pas plausible.
 */
export function parseWeight(text: string, settings: Settings = SETTINGS): number | null | 'invalid' {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  if (!/^\d+(\.\d+)?$/.test(clean)) return 'invalid';
  const kg = Number(clean);
  if (kg < settings.entry.weightMinKg || kg > settings.entry.weightMaxKg) return 'invalid';
  return Math.round(kg * 10) / 10;
}

export type WeightEntry = {
  time: number;
  kg: number;
  /** 'manual' = saisie dans l'app ; 'health_connect' = lu dans Health Connect. */
  source: 'manual' | 'health_connect';
  origin: string;
};

export type DailyWeight = { date: string; kg: number; source: WeightEntry['source']; origin: string };

/**
 * Poids retenu pour chaque jour.
 * - Saisie manuelle : la plus récente du jour (une correction remplace la précédente).
 * - Health Connect (seulement sans saisie) : la première pesée du jour (le matin à jeun).
 */
export function weightByDay(entries: WeightEntry[]): Map<string, DailyWeight> {
  const result = new Map<string, DailyWeight & { time: number }>();
  for (const entry of entries) {
    if (!(entry.kg > 0)) continue;
    const date = dayKey(entry.time);
    const current = result.get(date);
    const replaces =
      !current ||
      (entry.source === 'manual' && current.source !== 'manual') ||
      (entry.source === current.source &&
        (entry.source === 'manual' ? entry.time > current.time : entry.time < current.time));
    if (replaces) result.set(date, { date, ...entry });
  }
  return new Map(
    [...result].map(([date, { kg, source, origin }]) => [date, { date, kg, source, origin }]),
  );
}

export type StepsRecord = { start: number; end: number; count: number; origin: string };

/** Total de pas par jour (un enregistrement compte pour le jour de son début). */
export function stepsByDay(records: StepsRecord[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const r of records) {
    const date = dayKey(r.start);
    result.set(date, (result.get(date) ?? 0) + r.count);
  }
  return result;
}
