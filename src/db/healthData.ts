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
  await upsertRows('sync_state', ['record_type', 'last_sync_ms'], [[recordType, ms]]);
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
