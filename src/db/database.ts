// Base de données locale (SQLite), stockée uniquement sur le téléphone.
// Les heures sont enregistrées en millisecondes depuis 1970 (UTC).
// Chaque donnée lue dans Health Connect garde son identifiant (pas de doublon)
// et son app d'origine (`origin`).

import * as SQLite from 'expo-sqlite';

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
];

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withExclusiveTransactionAsync(async (tx) => {
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
