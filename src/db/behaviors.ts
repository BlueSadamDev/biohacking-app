// Journal du matin (lot 5a, F8) : liste des comportements (table `behavior`) et comportements notés
// (table `behavior_entry`). Les règles (oui / non / inconnu, noms permis) sont dans src/domain/journal.ts.

import { addDays } from '@/domain/dates';
import type { Behavior, BehaviorLog } from '@/domain/journal';
import { SETTINGS } from '@/domain/settings';

import { getDb, writeSql, writeTransaction } from './database';

type Row = { id: string; name: string; visible: number; position: number };

/** Liste par défaut, créée si la table est vide (premier usage, ou après un effacement des données). */
async function ensureDefaults(): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM behavior');
  if ((row?.n ?? 0) > 0) return;
  const now = Date.now();
  await writeTransaction(async (tx) => {
    for (const [i, b] of SETTINGS.journal.defaultBehaviors.entries()) {
      await tx.runAsync(
        'INSERT OR IGNORE INTO behavior (id, name, visible, position, created_ms) VALUES (?, ?, 1, ?, ?)',
        b.id,
        b.name,
        i + 1,
        now,
      );
    }
  });
}

/** Tous les comportements (affichés et masqués), dans l'ordre de la liste. */
export async function loadBehaviors(): Promise<Behavior[]> {
  await ensureDefaults();
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT id, name, visible, position FROM behavior ORDER BY position, created_ms');
  return rows.map((r) => ({ id: r.id, name: r.name, visible: r.visible === 1, position: r.position }));
}

/** Ajoute un comportement en fin de liste (nom déjà contrôlé par `validateBehaviorName`). */
export async function addBehavior(id: string, name: string, now = Date.now()): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ p: number | null }>('SELECT MAX(position) AS p FROM behavior');
  await writeSql(
    'INSERT INTO behavior (id, name, visible, position, created_ms) VALUES (?, ?, 1, ?, ?)',
    id,
    name.trim(),
    (row?.p ?? 0) + 1,
    now,
  );
}

export async function renameBehavior(id: string, name: string): Promise<void> {
  await writeSql('UPDATE behavior SET name = ? WHERE id = ?', name.trim(), id);
}

/** Affiché ou masqué (jamais supprimé : un comportement masqué garde son historique). */
export async function setBehaviorVisible(id: string, visible: boolean): Promise<void> {
  await writeSql('UPDATE behavior SET visible = ? WHERE id = ?', visible ? 1 : 0, id);
}

/** Comportements notés depuis le jour `since` (inclus). Absent = inconnu. */
export async function loadBehaviorLog(since: string): Promise<BehaviorLog> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day: string; behavior_id: string; done: number }>(
    'SELECT day, behavior_id, done FROM behavior_entry WHERE day >= ?',
    since,
  );
  const log: BehaviorLog = new Map();
  for (const r of rows) {
    if (!log.has(r.day)) log.set(r.day, new Map());
    log.get(r.day)!.set(r.behavior_id, r.done === 1);
  }
  return log;
}

/** Comportements notés sur la fenêtre des liens observés (90 jours). */
export function loadBehaviorLogForLinks(today: string): Promise<BehaviorLog> {
  return loadBehaviorLog(addDays(today, -(SETTINGS.correlations.windowDays + 1)));
}
