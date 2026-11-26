// Lecture et écriture des données de santé dans la base locale.
// Convertit les lignes de la base vers les types de `src/domain/`.

import type { StepsRecord, WeightEntry } from '@/domain/daily';
import { dayKey } from '@/domain/dates';
import { computeNights, type NightValue, type Sample, type SleepSession } from '@/domain/nightly';
import { countedSessions, type ExerciseSession } from '@/domain/load';
import type { Meal } from '@/domain/nutrition';

import { getDb, writeTransaction } from './database';
import { currentRecorder } from './syncRuns';

type Value = string | number | null;

/**
 * Insère (ou remplace, à identifiant égal) des lignes en une seule transaction.
 * Pendant une synchro, les lignes écrites sont comptées dans son relevé (lot 5b).
 */
export async function upsertRows(table: string, columns: string[], rows: Value[][]): Promise<void> {
  if (rows.length === 0) return;
  currentRecorder()?.addWritten(rows.length);
  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  await writeTransaction(async (tx) => {
    const statement = await tx.prepareAsync(sql);
    try {
      for (const row of rows) await statement.executeAsync(row);
    } finally {
      await statement.finalizeAsync();
    }
  });
  if (NIGHT_TABLES.has(table)) invalidateNights();
}

export async function getLastSync(recordType: string): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ last_sync_ms: number }>(
    'SELECT last_sync_ms FROM sync_state WHERE record_type = ?',
    recordType,
  );
  return row?.last_sync_ms ?? null;
}

export async function setLastSync(recordType: string, ms: number): Promise<void> {
  // Mise à jour de la seule date : le jeton de suivi des modifications (lot 5b) est gardé.
  await writeTransaction(async (tx) => {
    await tx.runAsync(
      `INSERT INTO sync_state (record_type, last_sync_ms) VALUES (?, ?)
       ON CONFLICT(record_type) DO UPDATE SET last_sync_ms = excluded.last_sync_ms`,
      recordType,
      ms,
    );
  });
}

/** Poids venus de Health Connect (jamais les saisies manuelles) : condition SQL pour la réconciliation. */
export const WEIGHT_FROM_HEALTH_CONNECT = "source = 'health_connect'";

/** Jeton de suivi des modifications Health Connect d'un type (lot 5b), ou null. */
export async function getChangesToken(recordType: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ changes_token: string | null }>(
    'SELECT changes_token FROM sync_state WHERE record_type = ?',
    recordType,
  );
  return row?.changes_token ?? null;
}

/** Fin réussie de la synchro d'un type : date et jeton enregistrés ensemble. */
export async function saveSyncState(recordType: string, ms: number, changesToken: string | null): Promise<void> {
  await writeTransaction(async (tx) => {
    await tx.runAsync(
      `INSERT INTO sync_state (record_type, last_sync_ms, changes_token) VALUES (?, ?, ?)
       ON CONFLICT(record_type) DO UPDATE SET last_sync_ms = excluded.last_sync_ms, changes_token = excluded.changes_token`,
      recordType,
      ms,
      changesToken,
    );
  });
}

/**
 * Lignes locales venues de Health Connect qui touchent la période [since, until] (réconciliation, lot 5b).
 * `where` : condition en plus (par exemple, le poids venu de Health Connect seulement, jamais la saisie).
 */
export async function loadLocalRows(
  table: string,
  idColumn: string,
  startColumn: string,
  endColumn: string,
  since: number,
  until: number,
  where = '1 = 1',
): Promise<{ id: string; start: number; end: number }[]> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT ${idColumn} AS id, ${startColumn} AS start, ${endColumn} AS "end" FROM ${table}
     WHERE ${endColumn} >= ? AND ${startColumn} <= ? AND (${where})`,
    since,
    until,
  );
}

/** Supprime des lignes par identifiant (enregistrements supprimés ou réécrits dans Health Connect). */
export async function deleteRowsById(table: string, idColumn: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await writeTransaction(async (tx) => {
    const statement = await tx.prepareAsync(`DELETE FROM ${table} WHERE ${idColumn} = ?`);
    try {
      for (const id of ids) await statement.executeAsync(id);
    } finally {
      await statement.finalizeAsync();
    }
  });
  if (NIGHT_TABLES.has(table)) invalidateNights();
}

/** Enregistrements de FC présents en base entre deux instants (réconciliation d'une plage). */
export async function heartRateRecordIds(start: number, end: number): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ record_id: string }>(
    'SELECT DISTINCT record_id FROM hc_heart_rate WHERE time_ms BETWEEN ? AND ?',
    start,
    end,
  );
  return rows.map((r) => r.record_id);
}

/** Supprime les mesures de FC d'enregistrements disparus, dans une plage seulement. */
export async function deleteHeartRateRecords(recordIds: readonly string[], start: number, end: number): Promise<void> {
  if (recordIds.length === 0) return;
  await writeTransaction(async (tx) => {
    const statement = await tx.prepareAsync('DELETE FROM hc_heart_rate WHERE record_id = ? AND time_ms BETWEEN ? AND ?');
    try {
      for (const id of recordIds) await statement.executeAsync(id, start, end);
    } finally {
      await statement.finalizeAsync();
    }
  });
  invalidateNights();
}

/** Plus ancien enregistrement local d'une table (rattrapage de l'historique), ou null si vide. */
export async function oldestLocalTime(table: string, timeColumn: string, where = '1 = 1'): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ t: number | null }>(`SELECT MIN(${timeColumn}) AS t FROM ${table} WHERE ${where}`);
  return row?.t ?? null;
}

/** Plus ancien enregistrement par app d'origine (affiché après le rattrapage de l'historique). */
export async function oldestByOrigin(table: string, timeColumn: string, where = '1 = 1'): Promise<{ origin: string; oldest: number }[]> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT origin, MIN(${timeColumn}) AS oldest FROM ${table} WHERE ${where} GROUP BY origin ORDER BY oldest`,
  );
}

export async function getAllLastSyncs(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ record_type: string; last_sync_ms: number }>(
    'SELECT record_type, last_sync_ms FROM sync_state',
  );
  return new Map(rows.map((r) => [r.record_type, r.last_sync_ms]));
}

export async function loadSleeps(sinceMs: number): Promise<SleepSession[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    start_ms: number;
    end_ms: number;
    stages_json: string;
    origin: string;
  }>('SELECT * FROM hc_sleep WHERE end_ms >= ? ORDER BY end_ms', sinceMs);
  return rows.map((r) => ({
    id: r.id,
    start: r.start_ms,
    end: r.end_ms,
    stages: JSON.parse(r.stages_json),
    origin: r.origin,
  }));
}

async function loadSamples(sql: string, sinceMs: number): Promise<Sample[]> {
  const db = await getDb();
  return db.getAllAsync<Sample>(sql, sinceMs);
}

/**
 * Mesures d'une table prises pendant un sommeil terminé après `sinceMs` (lot 5b). Seules ces mesures
 * servent au calcul des nuits : la HRV de la journée et la FC des séances ne sont plus lues ici.
 * Chaque mesure n'est lue qu'une fois, même si deux sommeils se chevauchent.
 */
export function samplesDuringSleep(table: string, valueColumn: string): string {
  return `SELECT time_ms AS time, ${valueColumn} AS value, origin FROM ${table}
    WHERE rowid IN (
      SELECT m.rowid FROM hc_sleep s JOIN ${table} m ON m.time_ms BETWEEN s.start_ms AND s.end_ms
      WHERE s.end_ms >= ?
    )
    ORDER BY time_ms`;
}

/** Tout ce qu'il faut pour calculer les valeurs par nuit depuis `sinceMs`. */
export async function loadNightInputs(sinceMs: number) {
  const [sleeps, hrv, restingHr, heartRate] = await Promise.all([
    loadSleeps(sinceMs),
    loadSamples(samplesDuringSleep('hc_hrv', 'rmssd_ms'), sinceMs),
    loadSamples(samplesDuringSleep('hc_resting_hr', 'bpm'), sinceMs),
    loadSamples(samplesDuringSleep('hc_heart_rate', 'bpm'), sinceMs),
  ]);
  return { sleeps, hrv, restingHr, heartRate };
}

export async function loadWeights(sinceMs: number): Promise<WeightEntry[]> {
  const db = await getDb();
  return db.getAllAsync<WeightEntry>(
    'SELECT time_ms AS time, kg, source, origin FROM weight WHERE time_ms >= ?',
    sinceMs,
  );
}

export async function loadSteps(sinceMs: number): Promise<StepsRecord[]> {
  const db = await getDb();
  return db.getAllAsync<StepsRecord>(
    'SELECT start_ms AS start, end_ms AS "end", count, origin FROM hc_steps WHERE start_ms >= ?',
    sinceMs,
  );
}

/** Mesures de FC prises pendant une séance terminée après `sinceMs`. */
export async function loadExerciseHeartRate(sinceMs: number): Promise<Sample[]> {
  const db = await getDb();
  return db.getAllAsync<Sample>(
    `SELECT DISTINCT h.time_ms AS time, h.bpm AS value, h.origin AS origin
     FROM hc_heart_rate h JOIN hc_exercise e ON h.time_ms BETWEEN e.start_ms AND e.end_ms
     WHERE e.end_ms >= ? ORDER BY h.time_ms`,
    sinceMs,
  );
}

export async function loadExercises(sinceMs: number): Promise<ExerciseSession[]> {
  const db = await getDb();
  return db.getAllAsync<ExerciseSession>(
    'SELECT id, start_ms AS start, end_ms AS "end", exercise_type AS exerciseType, origin FROM hc_exercise WHERE end_ms >= ? ORDER BY start_ms',
    sinceMs,
  );
}

/** Nombre de mesures de FC enregistrées pendant chaque séance terminée après `sinceMs`. */
export async function countExerciseHeartRate(sinceMs: number): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; n: number }>(
    `SELECT e.id AS id, COUNT(h.time_ms) AS n
     FROM hc_exercise e LEFT JOIN hc_heart_rate h ON h.time_ms BETWEEN e.start_ms AND e.end_ms
     WHERE e.end_ms >= ? GROUP BY e.id`,
    sinceMs,
  );
  return new Map(rows.map((r) => [r.id, r.n]));
}

/** Essais de rattrapage de la FC déjà faits, par séance (lot 5b). */
export async function loadBackfillAttempts(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ session_id: string; attempts: number }>(
    'SELECT session_id, attempts FROM hr_backfill_attempt',
  );
  return new Map(rows.map((r) => [r.session_id, r.attempts]));
}

/** Note un essai de rattrapage de la FC pour une séance. */
export async function recordBackfillAttempt(sessionId: string, now: number): Promise<void> {
  await writeTransaction(async (tx) => {
    await tx.runAsync(
      `INSERT INTO hr_backfill_attempt (session_id, attempts, last_ms) VALUES (?, 1, ?)
       ON CONFLICT(session_id) DO UPDATE SET attempts = attempts + 1, last_ms = excluded.last_ms`,
      sessionId,
      now,
    );
  });
}

/** Séances qui comptent dans les calculs (sans les courtes activités détectées automatiquement). */
export async function loadCountedExercises(sinceMs: number): Promise<ExerciseSession[]> {
  return countedSessions(await loadExercises(sinceMs));
}

export async function loadMeals(sinceMs: number): Promise<Meal[]> {
  const db = await getDb();
  return db.getAllAsync<Meal>(
    `SELECT start_ms AS start, energy_kcal AS energyKcal, protein_g AS proteinG,
            carbs_g AS carbsG, fat_g AS fatG, origin
     FROM hc_nutrition WHERE start_ms >= ? ORDER BY start_ms`,
    sinceMs,
  );
}

/** Nombre de lignes par table (écran de diagnostic : des comptages, jamais de valeurs). */
export async function countRows(): Promise<Record<string, number>> {
  const db = await getDb();
  const tables = [
    'hc_sleep',
    'hc_hrv',
    'hc_resting_hr',
    'hc_heart_rate',
    'hc_steps',
    'weight',
    'hc_exercise',
    'hc_nutrition',
    'strength_set',
  ];
  const result: Record<string, number> = {};
  for (const table of tables) {
    const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
    result[table] = row?.n ?? 0;
  }
  return result;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Valeurs par nuit des `days` derniers jours.
 * 160 jours par défaut : 90 jours de graphique + 60 jours de norme + marge.
 */
export function loadNights(days = 160): Promise<NightValue[]> {
  // Lot 5b : un seul calcul tant que la base n'a pas changé, partagé par l'accueil, les alertes, la
  // notification du matin et les autres écrans (auparavant : un calcul par usage, 6 par synchro).
  const key = `${days}|${dayKey(new Date())}|${nightsVersion}`;
  if (nightsCache?.key !== key) {
    const version = nightsVersion;
    const promise = computeNightsFromDb(days);
    nightsCache = { key, promise };
    promise.catch(() => {
      if (nightsCache?.promise === promise && nightsVersion === version) nightsCache = null;
    });
  }
  return nightsCache.promise;
}

async function computeNightsFromDb(days: number): Promise<NightValue[]> {
  const t0 = Date.now();
  const inputs = await loadNightInputs(t0 - days * DAY_MS);
  const t1 = Date.now();
  const nights = computeNights(inputs);
  // Mesure de la synchro (lot 5b) : chaque calcul réel des nuits pendant une synchro est compté.
  currentRecorder()?.addNights(t1 - t0, Date.now() - t1);
  return nights;
}

/** Tables dont dépendent les nuits : toute écriture dedans rend le calcul en mémoire périmé. */
const NIGHT_TABLES = new Set(['hc_sleep', 'hc_hrv', 'hc_resting_hr', 'hc_heart_rate']);
let nightsVersion = 0;
let nightsCache: { key: string; promise: Promise<NightValue[]> } | null = null;

/** À appeler après toute écriture ou suppression dans les tables des nuits (synchro, effacement). */
export function invalidateNights(): void {
  nightsVersion += 1;
  nightsCache = null;
}

export type SourcesStatus = {
  /** Dernière synchro réussie, tous types confondus. */
  lastSync: number | null;
  rows: Record<string, number>;
  lastWeight: { time: number; source: WeightEntry['source'] } | null;
};

/** État des sources pour l'écran « Sources de données ». */
export async function loadSourcesStatus(): Promise<SourcesStatus> {
  const db = await getDb();
  const syncs = await getAllLastSyncs();
  const lastWeight = await db.getFirstAsync<{ time: number; source: WeightEntry['source'] }>(
    'SELECT time_ms AS time, source FROM weight ORDER BY time_ms DESC LIMIT 1',
  );
  return {
    lastSync: syncs.size ? Math.max(...syncs.values()) : null,
    rows: await countRows(),
    lastWeight,
  };
}
