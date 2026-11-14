// Historique des alertes (table `alert`), stocké uniquement sur le téléphone.

import type { AlertLevel, AlertRule, AlertTheme, PastAlert, SelectedAlert } from '@/domain/alerts';

import { getDb } from './database';
import { upsertRows } from './healthData';

export type StoredAlert = SelectedAlert & { createdMs: number; read: boolean };

type Row = {
  id: string;
  rule: AlertRule;
  date: string;
  level: AlertLevel;
  theme: AlertTheme;
  title: string;
  finding: string;
  cause: string;
  action: string;
  delivery: SelectedAlert['delivery'];
  persistent: number;
  created_ms: number;
  read: number;
};

const fromRow = (r: Row): StoredAlert => ({
  id: r.id,
  rule: r.rule,
  date: r.date,
  level: r.level,
  theme: r.theme,
  title: r.title,
  finding: r.finding,
  cause: r.cause,
  action: r.action,
  delivery: r.delivery,
  persistent: r.persistent === 1,
  createdMs: r.created_ms,
  read: r.read === 1,
});

export async function saveAlerts(alerts: SelectedAlert[], nowMs: number): Promise<void> {
  await upsertRows(
    'alert',
    ['id', 'rule', 'date', 'level', 'theme', 'title', 'finding', 'cause', 'action', 'delivery', 'persistent', 'created_ms', 'read'],
    alerts.map((a) => [
      a.id,
      a.rule,
      a.date,
      a.level,
      a.theme,
      a.title,
      a.finding,
      a.cause,
      a.action,
      a.delivery,
      a.persistent ? 1 : 0,
      nowMs,
      0,
    ]),
  );
}

/** Alertes enregistrées depuis `sinceDate` (pour la limite par jour et l'anti-répétition). */
export async function loadAlertHistory(sinceDate: string): Promise<PastAlert[]> {
  const db = await getDb();
  return db.getAllAsync<PastAlert>('SELECT rule, date, level FROM alert WHERE date >= ?', sinceDate);
}

/** Toutes les alertes, de la plus récente à la plus ancienne. */
export async function loadAlerts(): Promise<StoredAlert[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM alert ORDER BY date DESC, created_ms DESC');
  return rows.map(fromRow);
}

export type AlertsOverview = {
  /** Alerte du jour à montrer sur l'accueil (la plus importante), ou null. */
  today: StoredAlert | null;
  unread: number;
  /** Niveau de la dernière alerte non lue (couleur de la pastille). */
  unreadLevel: AlertLevel | null;
};

export async function loadAlertsOverview(today: string): Promise<AlertsOverview> {
  const db = await getDb();
  const todayRow = await db.getFirstAsync<Row>(
    `SELECT * FROM alert WHERE date = ? ORDER BY CASE level WHEN 'important' THEN 0 ELSE 1 END, created_ms LIMIT 1`,
    today,
  );
  const unread = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM alert WHERE read = 0');
  const last = await db.getFirstAsync<{ level: AlertLevel }>(
    'SELECT level FROM alert WHERE read = 0 ORDER BY date DESC, created_ms DESC LIMIT 1',
  );
  return { today: todayRow ? fromRow(todayRow) : null, unread: unread?.n ?? 0, unreadLevel: last?.level ?? null };
}

export async function markAllAlertsRead(): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE alert SET read = 1 WHERE read = 0');
}
