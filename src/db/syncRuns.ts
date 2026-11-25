// Mesure des synchros (lot 5b, étape 1) : relevé en cours et dernières synchros gardées en base.
// Comptages et durées seulement, jamais de valeurs de santé.
//
// Un seul relevé à la fois : la synchro qui le commence en est « propriétaire » et l'enregistre à la
// fin. Une demande qui arrive pendant une synchro en cours la rejoint, sans créer de deuxième ligne.

import { SETTINGS } from '@/domain/settings';
import { createSyncRecorder, latestRuns, type SyncOrigin, type SyncRecorder, type SyncRun } from '@/domain/syncRuns';

import { getDb, writeTransaction } from './database';

let active: SyncRecorder | null = null;
/** Dernier échec d'enregistrement d'un relevé (message technique, écran Contrôle des données seulement). */
let lastSaveError: string | null = null;

export function syncRunSaveError(): string | null {
  return lastSaveError;
}

/** Début du relevé en cours (ms), ou null s'il n'y en a pas. */
export function activeRunStartedMs(): number | null {
  return active && !active.finished ? active.startedMs : null;
}

/**
 * Attend `task` au plus `seconds` secondes. Sert à ne jamais bloquer la fin d'un relevé sur une étape
 * qui ne répond plus (la tâche continue de son côté).
 */
export function settleWithin(task: Promise<unknown>, seconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, Math.max(0, seconds) * 1000);
    task.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

/** Relevé de la synchro en cours, ou null. */
export function currentRecorder(): SyncRecorder | null {
  return active;
}

/** Commence un relevé, ou rejoint celui en cours (`owner` = false : ne pas l'enregistrer). */
export function beginSyncRun(origin: SyncOrigin): { recorder: SyncRecorder; owner: boolean } {
  if (active && !active.finished) {
    const stale = Date.now() - active.startedMs > SETTINGS.sync.staleRunMinutes * 60_000;
    if (!stale) return { recorder: active, owner: false };
    // Relevé abandonné (une étape n'a jamais répondu) : enregistré tel quel, sans bloquer celui-ci.
    void endSyncRun(active);
  }
  active = createSyncRecorder(origin);
  return { recorder: active, owner: true };
}

/** Clôt le relevé et l'enregistre. Une erreur d'écriture n'empêche jamais la synchro de finir. */
export async function endSyncRun(recorder: SyncRecorder): Promise<void> {
  const run = recorder.finish();
  if (active === recorder) active = null;
  try {
    await saveSyncRun(run);
    lastSaveError = null;
  } catch (e) {
    // Relevé perdu : sans conséquence sur les données. La cause s'affiche dans Contrôle des données.
    lastSaveError = e instanceof Error ? e.message : String(e);
  }
}

/** Nombre de lignes d'une table (pour compter les lignes nouvelles d'une synchro). */
export async function countTableRows(table: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return row?.n ?? 0;
}

async function saveSyncRun(run: SyncRun): Promise<void> {
  const kept = Math.max(1, Math.round(SETTINGS.sync.runsKept));
  await writeTransaction(async (tx) => {
    await tx.runAsync(
      `INSERT INTO sync_run (started_ms, origin, total_ms, home_ready_ms, access_calls, nights_runs,
        nights_read_ms, nights_compute_ms, types_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      run.startedMs,
      run.origin,
      run.totalMs,
      run.homeReadyMs,
      run.accessCalls,
      run.nightsRuns,
      Math.round(run.nightsReadMs),
      Math.round(run.nightsComputeMs),
      JSON.stringify(run.types),
    );
    await tx.runAsync(
      'DELETE FROM sync_run WHERE id NOT IN (SELECT id FROM sync_run ORDER BY started_ms DESC, id DESC LIMIT ?)',
      kept,
    );
  });
}

type Row = {
  started_ms: number;
  origin: SyncRun['origin'];
  total_ms: number;
  home_ready_ms: number | null;
  access_calls: number;
  nights_runs: number;
  nights_read_ms: number;
  nights_compute_ms: number;
  types_json: string;
};

/** Dernières synchros enregistrées, de la plus récente à la plus ancienne. */
export async function loadSyncRuns(): Promise<SyncRun[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM sync_run ORDER BY started_ms DESC');
  const runs = rows.map(
    (r): SyncRun => ({
      startedMs: r.started_ms,
      origin: r.origin,
      totalMs: r.total_ms,
      homeReadyMs: r.home_ready_ms,
      accessCalls: r.access_calls,
      nightsRuns: r.nights_runs,
      nightsReadMs: r.nights_read_ms,
      nightsComputeMs: r.nights_compute_ms,
      types: JSON.parse(r.types_json),
    }),
  );
  return latestRuns(runs, SETTINGS.sync.runsKept);
}
