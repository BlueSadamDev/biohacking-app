// Migration de la base (lot 5a) : les saisies du matin existantes sont conservées.
// Test sur une vraie base SQLite en mémoire (module `node:sqlite` de Node), données fictives.

import { SCHEMA_MIGRATIONS } from './database';

// La base de l'app n'est pas ouverte ici (seul le texte des migrations est utilisé).
jest.mock('expo-sqlite', () => ({}));

type Db = { exec: (sql: string) => void; prepare: (sql: string) => { all: (...p: unknown[]) => unknown[]; run: (...p: unknown[]) => void } };

let DatabaseSync: (new (path: string) => Db) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch {
  DatabaseSync = null; // Node trop ancien : test ignoré
}
const maybe = DatabaseSync ? describe : describe.skip;

maybe('migration 7 (lot 5a)', () => {
  function migrated(upTo: number): Db {
    const db = new DatabaseSync!(':memory:');
    for (const sql of SCHEMA_MIGRATIONS.slice(0, upTo)) db.exec(sql);
    return db;
  }

  it('garde les saisies du matin existantes, sans les compter comme journal rempli', () => {
    const db = migrated(6);
    const insert = db.prepare('INSERT INTO morning_entry (date, energy, soreness, mood, note, saved_ms) VALUES (?, ?, ?, ?, ?, ?)');
    insert.run('2026-11-01', 4, 2, 3, 'note fictive', 1000);
    insert.run('2026-11-02', null, null, 5, null, 2000);

    db.exec(SCHEMA_MIGRATIONS[6]);

    const rows = db.prepare('SELECT date, energy, soreness, mood, note, saved_ms, journal_ms FROM morning_entry ORDER BY date').all();
    expect(rows).toEqual([
      { date: '2026-11-01', energy: 4, soreness: 2, mood: 3, note: 'note fictive', saved_ms: 1000, journal_ms: null },
      { date: '2026-11-02', energy: null, soreness: null, mood: 5, note: null, saved_ms: 2000, journal_ms: null },
    ]);
  });

  it('crée les tables des périodes et des comportements, vides (aucun « non » inventé)', () => {
    const db = migrated(7);
    expect(db.prepare('SELECT COUNT(*) AS n FROM period').all()).toEqual([{ n: 0 }]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM behavior_entry').all()).toEqual([{ n: 0 }]);
    db.prepare('INSERT INTO period (id, type, start_date, end_date, created_ms) VALUES (?, ?, ?, NULL, ?)').run('p1', 'sick', '2026-11-10', 1);
    expect(db.prepare('SELECT end_date, reminded_ms FROM period').all()).toEqual([{ end_date: null, reminded_ms: null }]);
  });

  it('un comportement est noté une seule fois par jour (une correction remplace la précédente)', () => {
    const db = migrated(7);
    const upsert = db.prepare('INSERT OR REPLACE INTO behavior_entry (day, behavior_id, done) VALUES (?, ?, ?)');
    upsert.run('2026-11-11', 'alcohol', 1);
    upsert.run('2026-11-11', 'alcohol', 0);
    expect(db.prepare('SELECT day, behavior_id, done FROM behavior_entry').all()).toEqual([{ day: '2026-11-11', behavior_id: 'alcohol', done: 0 }]);
  });
});

maybe('migration 8 (lot 5a.1)', () => {
  it('ajoute la forme « en phrase » sans toucher aux comportements existants', () => {
    const db = new DatabaseSync!(':memory:');
    for (const sql of SCHEMA_MIGRATIONS.slice(0, 7)) db.exec(sql);
    db.prepare('INSERT INTO behavior (id, name, visible, position, created_ms) VALUES (?, ?, ?, ?, ?)').run('alcohol', 'Alcool', 1, 1, 1);

    db.exec(SCHEMA_MIGRATIONS[7]);

    expect(db.prepare('SELECT id, name, visible, position, phrase FROM behavior').all()).toEqual([
      { id: 'alcohol', name: 'Alcool', visible: 1, position: 1, phrase: null },
    ]);
  });
});

maybe('migration 9 (lot 5b, mesure des synchros)', () => {
  it('crée la table des synchros, vide ; la requête de nettoyage garde les 10 plus récentes', () => {
    const db = new DatabaseSync!(':memory:');
    for (const sql of SCHEMA_MIGRATIONS.slice(0, 9)) db.exec(sql);
    expect(db.prepare('SELECT COUNT(*) AS n FROM sync_run').all()).toEqual([{ n: 0 }]);
    const insert = db.prepare(
      `INSERT INTO sync_run (started_ms, origin, total_ms, home_ready_ms, access_calls, nights_runs,
        nights_read_ms, nights_compute_ms, types_json) VALUES (?, 'button', 0, NULL, 0, 0, 0, 0, '[]')`,
    );
    for (let i = 1; i <= 12; i++) insert.run(i * 1000);
    // Même requête que src/db/syncRuns.ts.
    db.prepare('DELETE FROM sync_run WHERE id NOT IN (SELECT id FROM sync_run ORDER BY started_ms DESC, id DESC LIMIT ?)').run(10);
    const rows = db.prepare('SELECT started_ms FROM sync_run ORDER BY started_ms').all() as { started_ms: number }[];
    expect(rows.map((r) => r.started_ms)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => n * 1000));
  });
});
