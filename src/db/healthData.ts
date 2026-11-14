// Lecture et écriture des données de santé dans la base locale.
// Convertit les lignes de la base vers les types de `src/domain/`.

import type { StepsRecord, WeightEntry } from '@/domain/daily';
import { computeNights, type NightValue, type Sample, type SleepSession } from '@/domain/nightly';

import { getDb } from './database';

type Value = string | number | null;

/** Insère (ou remplace, à identifiant égal) des lignes en une seule transaction. */
export async function upsertRows(table: string, columns: string[], rows: Value[][]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const statement = await tx.prepareAsync(sql);
    try {
      for (const row of rows) await statement.executeAsync(row);
    } finally {
      await statement.finalizeAsync();
    }
  });
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

/** Tout ce qu'il faut pour calculer les valeurs par nuit depuis `sinceMs`. */
export async function loadNightInputs(sinceMs: number) {
  const [sleeps, hrv, restingHr, heartRate] = await Promise.all([
    loadSleeps(sinceMs),
    loadSamples('SELECT time_ms AS time, rmssd_ms AS value, origin FROM hc_hrv WHERE time_ms >= ?', sinceMs),
    loadSamples('SELECT time_ms AS time, bpm AS value, origin FROM hc_resting_hr WHERE time_ms >= ?', sinceMs),
    loadSamples('SELECT time_ms AS time, bpm AS value, origin FROM hc_heart_rate WHERE time_ms >= ?', sinceMs),
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

/** Nombre de lignes par table (écran de diagnostic : des comptages, jamais de valeurs). */
export async function countRows(): Promise<Record<string, number>> {
  const db = await getDb();
  const tables = ['hc_sleep', 'hc_hrv', 'hc_resting_hr', 'hc_heart_rate', 'hc_steps', 'weight'];
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
export async function loadNights(days = 160): Promise<NightValue[]> {
  return computeNights(await loadNightInputs(Date.now() - days * DAY_MS));
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
