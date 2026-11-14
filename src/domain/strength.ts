// Musculation (lot 3, cahier des charges sections 4 F3 et 5). Calcul pur.
// - 3 exercices clés : squat, développé couché, soulevé de terre.
// - Après chaque séance, saisie de la meilleure série (charge × répétitions) ou « Pas fait ».
// - 1RM estimé par la formule d'Epley : charge × (1 + répétitions / 30) ; 1 répétition = la charge.
// - Tendance par exercice (hausse, baisse, stagnation sur 6 semaines) et meilleur 1RM par semaine.
// - Séance « en attente de saisie » : séance de musculation du jour sans saisie liée.

import { addDays, dayKey, startOfWeek } from './dates';
import type { ExerciseSession } from './load';
import { SETTINGS, type Settings } from './settings';

export type Exercise = 'squat' | 'bench' | 'deadlift';

export const EXERCISES: readonly Exercise[] = ['squat', 'bench', 'deadlift'];

export const EXERCISE_LABEL: Record<Exercise, string> = {
  squat: 'Squat',
  bench: 'Développé couché',
  deadlift: 'Soulevé de terre',
};

/** Une saisie : meilleure série d'un exercice lors d'une séance, ou « Pas fait ». */
export type StrengthEntry = {
  id: string;
  /** Séance Health Connect liée ; null si saisie sans séance détectée. */
  sessionId: string | null;
  /** Jour de la séance (AAAA-MM-JJ). */
  date: string;
  exercise: Exercise;
  /** null si « Pas fait ». */
  loadKg: number | null;
  reps: number | null;
  skipped: boolean;
  createdMs: number;
};

/** 1RM estimé (formule d'Epley). */
export function estimateOneRepMax(loadKg: number, reps: number): number {
  if (reps <= 1) return loadKg;
  return loadKg * (1 + reps / 30);
}

const oneRm = (e: StrengthEntry) => (e.skipped || e.loadKg === null || e.reps === null ? null : estimateOneRepMax(e.loadKg, e.reps));

/** Meilleur 1RM d'un exercice entre deux jours (inclus) ; null si aucune série. */
function best(entries: StrengthEntry[], exercise: Exercise, from: string | null, to: string): number | null {
  let result: number | null = null;
  for (const e of entries) {
    if (e.exercise !== exercise || e.date > to || (from !== null && e.date < from)) continue;
    const v = oneRm(e);
    if (v !== null && (result === null || v > result)) result = v;
  }
  return result;
}

/** Meilleur 1RM de chaque semaine (lundi → dimanche), de la plus ancienne à celle de `today`. */
export function weeklyBests(entries: StrengthEntry[], exercise: Exercise, today: string, settings: Settings = SETTINGS): (number | null)[] {
  const current = startOfWeek(today);
  return Array.from({ length: settings.strength.historyWeeks }, (_, i) => {
    const start = addDays(current, -7 * (settings.strength.historyWeeks - 1 - i));
    return best(entries, exercise, start, addDays(start, 6));
  });
}

export type StrengthTrend = 'rising' | 'falling' | 'stagnant' | 'steady' | 'insufficient';

export type ExerciseProgress = {
  exercise: Exercise;
  /** Niveau actuel : meilleur 1RM des 6 dernières semaines ; null sans série récente. */
  current: number | null;
  trend: StrengthTrend;
  weekly: (number | null)[];
};

/** Progression d'un exercice à la date `today`. */
export function exerciseProgress(entries: StrengthEntry[], exercise: Exercise, today: string, settings: Settings = SETTINGS): ExerciseProgress {
  const s = settings.strength;
  const done = entries.filter((e) => e.exercise === exercise && e.date <= today && oneRm(e) !== null);
  const current = best(entries, exercise, addDays(today, -(s.stagnationDays - 1)), today);
  const weekly = weeklyBests(entries, exercise, today, settings);
  if (done.length < s.trendMinEntries) return { exercise, current, trend: 'insufficient', weekly };

  const recent = best(entries, exercise, addDays(today, -(s.recentDays - 1)), today);
  const prior = best(entries, exercise, addDays(today, -(2 * s.recentDays - 1)), addDays(today, -s.recentDays));
  const before = best(entries, exercise, null, addDays(today, -s.stagnationDays));
  const lastPeriodCount = done.filter((e) => e.date > addDays(today, -s.stagnationDays)).length;

  let trend: StrengthTrend = 'steady';
  if (recent !== null && prior !== null && recent >= prior * (1 + s.risingFraction)) trend = 'rising';
  else if (recent !== null && prior !== null && recent < prior * (1 - s.fallingFraction)) trend = 'falling';
  else if (
    before !== null &&
    current !== null &&
    lastPeriodCount >= s.stagnationMinEntries &&
    current < before * (1 + s.risingFraction)
  )
    trend = 'stagnant';
  return { exercise, current, trend, weekly };
}

/** Progression des 3 exercices clés. */
export function strengthProgress(entries: StrengthEntry[], today: string, settings: Settings = SETTINGS): ExerciseProgress[] {
  return EXERCISES.map((e) => exerciseProgress(entries, e, today, settings));
}

/** Exercices qui stagnent depuis 6 semaines (alerte « changer de programme »). */
export function stagnantExercises(entries: StrengthEntry[], today: string, settings: Settings = SETTINGS): Exercise[] {
  return strengthProgress(entries, today, settings)
    .filter((p) => p.trend === 'stagnant')
    .map((p) => p.exercise);
}

export type SetComparison = {
  oneRm: number;
  /** Écart au niveau des 6 dernières semaines (hors séance en cours) ; null sans niveau. */
  deltaToLevel: number | null;
  /** Au-dessus du meilleur 1RM jamais saisi (hors séance en cours). */
  record: boolean;
};

/** Compare une série en cours de saisie à l'historique (les saisies de la même séance sont ignorées). */
export function compareSet(
  entries: StrengthEntry[],
  exercise: Exercise,
  loadKg: number,
  reps: number,
  date: string,
  sessionKey: string,
  settings: Settings = SETTINGS,
): SetComparison {
  const others = entries.filter((e) => entryKey(e) !== sessionKey);
  const value = estimateOneRepMax(loadKg, reps);
  const level = best(others, exercise, addDays(date, -(settings.strength.stagnationDays - 1)), date);
  const allTime = best(others, exercise, null, date);
  return {
    oneRm: value,
    deltaToLevel: level === null ? null : value - level,
    record: allTime !== null && value > allTime,
  };
}

/** Clé d'une séance de saisie : la séance Health Connect, sinon « manuel-<jour> ». */
export function sessionKeyOf(sessionId: string | null, date: string): string {
  return sessionId ?? `manuel-${date}`;
}

const entryKey = (e: StrengthEntry) => sessionKeyOf(e.sessionId, e.date);

/** Séance de musculation (types de settings.ts) ? */
export function isStrengthSession(session: Pick<ExerciseSession, 'exerciseType'>, settings: Settings = SETTINGS): boolean {
  return settings.strength.sessionTypes.includes(session.exerciseType);
}

/** Dernière séance de musculation du jour qui n'a pas encore de saisie ; null s'il n'y en a pas. */
export function pendingStrengthSession(
  sessions: ExerciseSession[],
  entries: StrengthEntry[],
  today: string,
  settings: Settings = SETTINGS,
): ExerciseSession | null {
  const entered = new Set(entries.map((e) => e.sessionId).filter((id): id is string => id !== null));
  const candidates = sessions
    .filter((s) => isStrengthSession(s, settings) && dayKey(s.start) === today && !entered.has(s.id))
    .sort((a, b) => b.start - a.start);
  return candidates[0] ?? null;
}

/**
 * Rappel de saisie : au plus un par jour, seulement s'il y a une séance à saisir
 * et hors plage silencieuse (la synchro suivante, après la plage, l'enverra si c'est encore le même jour).
 */
export function shouldRemindStrength(pending: ExerciseSession | null, lastReminderDate: string | null, today: string, quiet: boolean): boolean {
  return pending !== null && lastReminderDate !== today && !quiet;
}

/** Dernière charge et répétitions saisies pour un exercice (valeurs proposées par défaut). */
export function lastSet(entries: StrengthEntry[], exercise: Exercise): { loadKg: number; reps: number } | null {
  const done = entries
    .filter((e) => e.exercise === exercise && !e.skipped && e.loadKg !== null && e.reps !== null)
    .sort((a, b) => (a.date === b.date ? a.createdMs - b.createdMs : a.date < b.date ? -1 : 1));
  const last = done[done.length - 1];
  return last ? { loadKg: last.loadKg!, reps: last.reps! } : null;
}
