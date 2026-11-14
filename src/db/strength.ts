// Saisies de musculation (table `strength_set`) : meilleure série de chaque exercice clé par séance.
// Ré-enregistrer la même séance remplace la saisie précédente (identifiant = séance + exercice).

import { addDays, dayKey } from '@/domain/dates';
import { SETTINGS } from '@/domain/settings';
import { EXERCISES, sessionKeyOf, type Exercise, type StrengthEntry } from '@/domain/strength';

import { getDb } from './database';
import { upsertRows } from './healthData';

type Row = {
  id: string;
  session_id: string | null;
  date: string;
  exercise: string;
  load_kg: number | null;
  reps: number | null;
  skipped: number;
  created_ms: number;
};

const isExercise = (v: string): v is Exercise => (EXERCISES as readonly string[]).includes(v);

/** Saisies depuis le jour `since` (inclus). */
export async function loadStrengthEntries(since: string): Promise<StrengthEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM strength_set WHERE date >= ? ORDER BY date', since);
  return rows
    .filter((r) => isExercise(r.exercise))
    .map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      date: r.date,
      exercise: r.exercise as Exercise,
      loadKg: r.load_kg,
      reps: r.reps,
      skipped: r.skipped === 1,
      createdMs: r.created_ms,
    }));
}

/** Historique utile aux calculs : tendance (12 semaines) et stagnation (avec un historique plus ancien). */
export function loadStrengthHistory(now: Date = new Date()): Promise<StrengthEntry[]> {
  const weeks = Math.max(SETTINGS.strength.historyWeeks, 4 * Math.ceil(SETTINGS.strength.stagnationDays / 7));
  return loadStrengthEntries(addDays(dayKey(now), -7 * weeks));
}

const REMINDER_KEY = 'strength_reminder_date';

/** Jour du dernier rappel de saisie envoyé (AAAA-MM-JJ), ou null. */
export async function getStrengthReminderDate(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_setting WHERE key = ?', REMINDER_KEY);
  return row?.value || null;
}

export async function setStrengthReminderDate(date: string): Promise<void> {
  await upsertRows('app_setting', ['key', 'value'], [[REMINDER_KEY, date]]);
}

export type SetInput = { exercise: Exercise; loadKg: number; reps: number } | { exercise: Exercise; skipped: true };

/** Enregistre la séance (une ligne par exercice clé). */
export async function saveStrengthSession(sessionId: string | null, date: string, sets: SetInput[], now = Date.now()): Promise<void> {
  const key = sessionKeyOf(sessionId, date);
  await upsertRows(
    'strength_set',
    ['id', 'session_id', 'date', 'exercise', 'load_kg', 'reps', 'skipped', 'created_ms'],
    sets.map((s) => [
      `${key}-${s.exercise}`,
      sessionId,
      date,
      s.exercise,
      'skipped' in s ? null : s.loadKg,
      'skipped' in s ? null : s.reps,
      'skipped' in s ? 1 : 0,
      now,
    ]),
  );
}
