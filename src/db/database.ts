// Base de données locale (SQLite), stockée uniquement sur le téléphone.
// Les heures sont enregistrées en millisecondes depuis 1970 (UTC).
// Chaque donnée lue dans Health Connect garde son identifiant (pas de doublon)
// et son app d'origine (`origin`).

import * as SQLite from 'expo-sqlite';

import { SETTINGS } from '@/domain/settings';

/**
 * Évolutions successives du schéma. Ne jamais modifier une étape existante :
 * ajouter une nouvelle étape à la fin.
 */
const MIGRATIONS: string[] = [
  // 1 – Lot 1 : données Health Connect, saisies du matin, état de synchro.
  `
  CREATE TABLE hc_sleep (
    id TEXT PRIMARY KEY NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    stages_json TEXT NOT NULL,
    origin TEXT NOT NULL
  );
  CREATE INDEX hc_sleep_end ON hc_sleep (end_ms);

  CREATE TABLE hc_hrv (
    id TEXT PRIMARY KEY NOT NULL,
    time_ms INTEGER NOT NULL,
    rmssd_ms REAL NOT NULL,
    origin TEXT NOT NULL
  );
  CREATE INDEX hc_hrv_time ON hc_hrv (time_ms);

  CREATE TABLE hc_resting_hr (
    id TEXT PRIMARY KEY NOT NULL,
    time_ms INTEGER NOT NULL,
    bpm REAL NOT NULL,
    origin TEXT NOT NULL
  );
  CREATE INDEX hc_resting_hr_time ON hc_resting_hr (time_ms);

  -- FC continue : seulement les mesures prises pendant un sommeil (volume limité).
  CREATE TABLE hc_heart_rate (
    record_id TEXT NOT NULL,
    time_ms INTEGER NOT NULL,
    bpm REAL NOT NULL,
    origin TEXT NOT NULL,
    PRIMARY KEY (record_id, time_ms)
  );
  CREATE INDEX hc_heart_rate_time ON hc_heart_rate (time_ms);

  CREATE TABLE hc_steps (
    id TEXT PRIMARY KEY NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    count INTEGER NOT NULL,
    origin TEXT NOT NULL
  );
  CREATE INDEX hc_steps_start ON hc_steps (start_ms);

  -- Poids : source 'health_connect' (Zepp) ou 'manual' (saisie dans l'app).
  CREATE TABLE weight (
    id TEXT PRIMARY KEY NOT NULL,
    time_ms INTEGER NOT NULL,
    kg REAL NOT NULL,
    source TEXT NOT NULL,
    origin TEXT NOT NULL
  );
  CREATE INDEX weight_time ON weight (time_ms);

  -- Ressenti du matin (1 à 5), une ligne par jour.
  CREATE TABLE morning_entry (
    date TEXT PRIMARY KEY NOT NULL,
    energy INTEGER,
    soreness INTEGER,
    mood INTEGER,
    note TEXT,
    saved_ms INTEGER NOT NULL
  );

  -- Dernière synchro réussie par type de donnée.
  CREATE TABLE sync_state (
    record_type TEXT PRIMARY KEY NOT NULL,
    last_sync_ms INTEGER NOT NULL
  );

  -- Réglages modifiables dans l'app (ex. heure de la notification).
  CREATE TABLE app_setting (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  // 2 – Lot 2 : séances d'exercice (charge) et repas (nutrition).
  `
  CREATE TABLE hc_exercise (
    id TEXT PRIMARY KEY NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    exercise_type INTEGER NOT NULL,
    origin TEXT NOT NULL
  );
  CREATE INDEX hc_exercise_start ON hc_exercise (start_ms);

  -- Valeurs absentes = NULL (jamais 0).
  CREATE TABLE hc_nutrition (
    id TEXT PRIMARY KEY NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    energy_kcal REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    meal_type INTEGER,
    origin TEXT NOT NULL
  );
  CREATE INDEX hc_nutrition_start ON hc_nutrition (start_ms);

  -- La FC continue est désormais gardée aussi pendant les séances :
  -- on relit tout l'historique de FC à la prochaine synchro.
  DELETE FROM sync_state WHERE record_type = 'HeartRate';
  `,
  // 3 – Lot 2 : historique des alertes.
  `
  CREATE TABLE alert (
    id TEXT PRIMARY KEY NOT NULL,
    rule TEXT NOT NULL,
    date TEXT NOT NULL,
    level TEXT NOT NULL,
    theme TEXT NOT NULL,
    title TEXT NOT NULL,
    finding TEXT NOT NULL,
    cause TEXT NOT NULL,
    action TEXT NOT NULL,
    delivery TEXT NOT NULL,
    persistent INTEGER NOT NULL,
    created_ms INTEGER NOT NULL,
    read INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX alert_date ON alert (date);
  `,
  // 4 – Lot 3 : meilleure série des exercices clés (saisie après chaque séance de musculation).
  `
  CREATE TABLE strength_set (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT,
    date TEXT NOT NULL,
    exercise TEXT NOT NULL,
    load_kg REAL,
    reps INTEGER,
    skipped INTEGER NOT NULL,
    created_ms INTEGER NOT NULL
  );
  CREATE INDEX strength_set_date ON strength_set (date);
  `,
  // 5 – Lot 4 : bilans de la semaine du coach (un par semaine, du lundi au dimanche).
  `
  CREATE TABLE coach_weekly (
    week_start TEXT PRIMARY KEY NOT NULL,
    week_end TEXT NOT NULL,
    synthesis TEXT NOT NULL,
    actions_json TEXT NOT NULL,
    worked_json TEXT NOT NULL,
    stuck_json TEXT NOT NULL,
    facts_json TEXT NOT NULL,
    source TEXT NOT NULL,
    created_ms INTEGER NOT NULL
  );
  `,
  // 6 – Lot 4 : conversation avec le coach (questions libres), effaçable depuis les Réglages.
  `
  CREATE TABLE coach_message (
    id TEXT PRIMARY KEY NOT NULL,
    created_ms INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    facts_json TEXT NOT NULL,
    kind TEXT NOT NULL
  );
  CREATE INDEX coach_message_created ON coach_message (created_ms);
  `,
  // 7 – Lot 5a : étiquettes de période, comportements du journal du matin.
  // Ajouts seulement : les saisies du matin existantes sont conservées telles quelles.
  `
  -- Période particulière (malade, blessure, voyage, vacances, autre). Fin NULL = en cours.
  CREATE TABLE period (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_ms INTEGER NOT NULL,
    reminded_ms INTEGER
  );

  -- Liste des comportements (jamais supprimés : masqués, ils gardent leur historique).
  CREATE TABLE behavior (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    visible INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL,
    created_ms INTEGER NOT NULL
  );

  -- Comportement d'un jour (la veille du journal). Une ligne par comportement affiché
  -- au moment de l'enregistrement : done = 1 « oui », done = 0 « non » ; pas de ligne = « inconnu ».
  CREATE TABLE behavior_entry (
    day TEXT NOT NULL,
    behavior_id TEXT NOT NULL,
    done INTEGER NOT NULL,
    PRIMARY KEY (day, behavior_id)
  );

  -- Journal du matin enregistré (heure) ; NULL pour les saisies d'avant le lot 5a.
  ALTER TABLE morning_entry ADD COLUMN journal_ms INTEGER;
  `,
  // 8 – Lot 5a.1 : forme « en phrase » facultative d'un comportement (liens observés).
  // Ajout seulement : NULL = phrase par défaut ou tournure générique (src/domain/texts/journal.ts).
  `
  ALTER TABLE behavior ADD COLUMN phrase TEXT;
  `,
  // 9 – Lot 5b (étape 1) : mesure des synchros. Comptages et durées seulement, jamais de valeurs ;
  // seules les dernières synchros sont gardées (SETTINGS.sync.runsKept).
  `
  CREATE TABLE sync_run (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_ms INTEGER NOT NULL,
    origin TEXT NOT NULL,
    total_ms INTEGER NOT NULL,
    home_ready_ms INTEGER,
    access_calls INTEGER NOT NULL,
    nights_runs INTEGER NOT NULL,
    nights_read_ms INTEGER NOT NULL,
    nights_compute_ms INTEGER NOT NULL,
    types_json TEXT NOT NULL
  );
  `,
];

/** Évolutions du schéma, exportées pour les tests de migration (base SQLite en mémoire). */
export const SCHEMA_MIGRATIONS: readonly string[] = MIGRATIONS;

// Base occupée (« database is locked ») : la synchro du lancement et la tâche de fond
// peuvent écrire en même temps. Deux protections :
// 1. une file d'attente : dans l'app, les écritures passent une par une (`runExclusive`) ;
// 2. un délai de patience SQLite (`busy_timeout`) sur chaque connexion : si une autre
//    connexion écrit (tâche de fond lancée dans un moteur séparé), on attend au lieu d'échouer.
const BUSY_TIMEOUT = `PRAGMA busy_timeout = ${Math.round(SETTINGS.database.busyTimeoutMs)};`;

/** Transaction exclusive (nouvelle connexion) avec le délai de patience réglé dessus. */
async function exclusiveTransaction(
  db: SQLite.SQLiteDatabase,
  task: (tx: SQLite.SQLiteDatabase) => Promise<void>,
): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.execAsync(BUSY_TIMEOUT);
    await task(tx);
  });
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    await exclusiveTransaction(db, async (tx) => {
      await tx.execAsync(MIGRATIONS[version]);
      await tx.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

/** Ouvre la base (une seule fois) et applique les évolutions du schéma. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) {
    opening = (async () => {
      const db = await SQLite.openDatabaseAsync('biohacking.db');
      await db.execAsync(BUSY_TIMEOUT);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await migrate(db);
      return db;
    })();
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}

/** Fin de la dernière écriture demandée : la suivante attend qu'elle soit terminée. */
let lastWrite: Promise<unknown> = Promise.resolve();

/**
 * File d'attente des écritures : `task` ne démarre qu'après la fin de l'écriture
 * précédente (réussie ou non). Deux écritures ne se chevauchent jamais.
 */
export function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = lastWrite.then(task, task);
  lastWrite = run.catch(() => undefined);
  return run;
}

/** Écritures groupées en une transaction, à leur tour dans la file d'attente. */
export async function writeTransaction(task: (tx: SQLite.SQLiteDatabase) => Promise<void>): Promise<void> {
  const db = await getDb();
  await runExclusive(() => exclusiveTransaction(db, task));
}

/** Une seule requête d'écriture (UPDATE, DELETE…), à son tour dans la file d'attente. */
export async function writeSql(sql: string, ...params: (string | number | null)[]): Promise<void> {
  const db = await getDb();
  await runExclusive(() => db.runAsync(sql, ...params));
}
