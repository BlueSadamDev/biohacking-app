// Lecture des mesures de la nuit (lot 5b) : seules les mesures prises pendant un sommeil sont lues,
// une seule fois chacune. Vraie base SQLite en mémoire (module `node:sqlite`), données fictives.

import { SCHEMA_MIGRATIONS } from './database';
import { samplesDuringSleep } from './healthData';

jest.mock('expo-sqlite', () => ({}));

type Db = { exec: (sql: string) => void; prepare: (sql: string) => { all: (...p: unknown[]) => unknown[]; run: (...p: unknown[]) => void } };

let DatabaseSync: (new (path: string) => Db) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch {
  DatabaseSync = null;
}
const maybe = DatabaseSync ? describe : describe.skip;

maybe('mesures lues pour le calcul des nuits', () => {
  it('garde les mesures du sommeil (bornes comprises), une seule fois même si deux sommeils se chevauchent', () => {
    const db = new DatabaseSync!(':memory:');
    for (const sql of SCHEMA_MIGRATIONS) db.exec(sql);
    const sleep = db.prepare('INSERT INTO hc_sleep (id, start_ms, end_ms, stages_json, origin) VALUES (?, ?, ?, ?, ?)');
    sleep.run('ancienne', 1000, 2000, '[]', 'zepp');
    sleep.run('nuit', 1000, 2000, '[]', 'zepp'); // même nuit réécrite : doublon de sommeil
    sleep.run('vieille', 100, 200, '[]', 'zepp'); // terminée avant la période demandée
    const hrv = db.prepare('INSERT INTO hc_hrv (id, time_ms, rmssd_ms, origin) VALUES (?, ?, ?, ?)');
    hrv.run('a', 999, 30, 'zepp'); // juste avant
    hrv.run('b', 1000, 31, 'zepp'); // début
    hrv.run('c', 1500, 32, 'zepp');
    hrv.run('d', 2000, 33, 'zepp'); // fin
    hrv.run('e', 3000, 34, 'zepp'); // journée
    hrv.run('f', 150, 35, 'zepp'); // nuit trop ancienne

    const rows = db.prepare(samplesDuringSleep('hc_hrv', 'rmssd_ms')).all(500);
    expect(rows).toEqual([
      { time: 1000, value: 31, origin: 'zepp' },
      { time: 1500, value: 32, origin: 'zepp' },
      { time: 2000, value: 33, origin: 'zepp' },
    ]);
  });
});
