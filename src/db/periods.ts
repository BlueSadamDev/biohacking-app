// Étiquettes de période (lot 5a, F7) : table `period`. Les règles (chevauchement, dates permises,
// jours étiquetés) sont dans src/domain/periods.ts ; ici, seulement la lecture et l'écriture.

import { SETTINGS } from '@/domain/settings';
import type { Period, PeriodType } from '@/domain/periods';

import { getDb, writeSql } from './database';

type Row = { id: string; type: string; start_date: string; end_date: string | null; reminded_ms: number | null };

const isType = (v: string): v is PeriodType => (SETTINGS.periods.types as readonly string[]).includes(v);

export type StoredPeriod = Period & { remindedMs: number | null };

/** Toutes les périodes, de la plus récente à la plus ancienne. */
export async function loadPeriods(): Promise<StoredPeriod[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT id, type, start_date, end_date, reminded_ms FROM period ORDER BY start_date DESC');
  return rows
    .filter((r) => isType(r.type))
    .map((r) => ({ id: r.id, type: r.type as PeriodType, start: r.start_date, end: r.end_date, remindedMs: r.reminded_ms }));
}

/** Crée ou met à jour une période (déjà contrôlée par `validatePeriod`). */
export async function savePeriod(period: Period, now = Date.now()): Promise<void> {
  // Mise à jour d'abord (garde la date du rappel), puis création si la période n'existait pas.
  await writeSql(
    'UPDATE period SET type = ?, start_date = ?, end_date = ? WHERE id = ?',
    period.type,
    period.start,
    period.end,
    period.id,
  );
  await writeSql(
    'INSERT OR IGNORE INTO period (id, type, start_date, end_date, created_ms, reminded_ms) VALUES (?, ?, ?, ?, ?, NULL)',
    period.id,
    period.type,
    period.start,
    period.end,
    now,
  );
}

export async function deletePeriod(id: string): Promise<void> {
  await writeSql('DELETE FROM period WHERE id = ?', id);
}

/** Note que le rappel « période terminée ? » a été envoyé (une seule fois par période). */
export async function markPeriodReminded(id: string, now = Date.now()): Promise<void> {
  await writeSql('UPDATE period SET reminded_ms = ? WHERE id = ?', now, id);
}

/** Identifiant d'une nouvelle période. */
export function newPeriodId(now = Date.now()): string {
  return `period-${now}`;
}
