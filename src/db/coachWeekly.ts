// Bilans de la semaine du coach (table `coach_weekly`), un par semaine (lundi → dimanche).
// Enregistrés seulement sur le téléphone ; inclus dans l'export CSV et dans l'effacement des données.

import type { WeeklyReview } from '@/domain/weeklyReview';

import { getDb, writeSql } from './database';

type Row = {
  week_start: string;
  week_end: string;
  synthesis: string;
  actions_json: string;
  worked_json: string;
  stuck_json: string;
  facts_json: string;
  source: string;
  created_ms: number;
};

const list = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

function fromRow(r: Row): WeeklyReview {
  return {
    weekStart: r.week_start,
    weekEnd: r.week_end,
    synthesis: r.synthesis,
    actions: list(r.actions_json),
    worked: list(r.worked_json),
    stuck: list(r.stuck_json),
    facts: list(r.facts_json),
    source: r.source === 'model' ? 'model' : 'app',
    createdMs: r.created_ms,
  };
}

/** Enregistre (ou remplace) le bilan d'une semaine. */
export async function saveWeeklyReview(r: WeeklyReview): Promise<void> {
  await writeSql(
    `INSERT OR REPLACE INTO coach_weekly
      (week_start, week_end, synthesis, actions_json, worked_json, stuck_json, facts_json, source, created_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    r.weekStart,
    r.weekEnd,
    r.synthesis,
    JSON.stringify(r.actions),
    JSON.stringify(r.worked),
    JSON.stringify(r.stuck),
    JSON.stringify(r.facts),
    r.source,
    r.createdMs,
  );
}

/** Supprime le bilan d'une semaine (banc d'essai : pour le faire rédiger de nouveau). */
export async function deleteWeeklyReview(weekStart: string): Promise<void> {
  await writeSql('DELETE FROM coach_weekly WHERE week_start = ?', weekStart);
}

/** Bilans, du plus récent au plus ancien. */
export async function loadWeeklyReviews(): Promise<WeeklyReview[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM coach_weekly ORDER BY week_start DESC');
  return rows.map(fromRow);
}

/** Bilan le plus récent, ou null. */
export async function loadLatestWeeklyReview(): Promise<WeeklyReview | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>('SELECT * FROM coach_weekly ORDER BY week_start DESC LIMIT 1');
  return row ? fromRow(row) : null;
}
