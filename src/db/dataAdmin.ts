// Sauvegarde (export CSV) et effacement des données, déclenchés par l'utilisateur.
// L'export écrit des fichiers dans un dossier choisi par l'utilisateur
// (sélecteur de dossier d'Android) : aucune donnée ne part sur Internet.

import { Directory } from 'expo-file-system';

import { toCsv, type Row } from '@/domain/csv';
import { dayKey } from '@/domain/dates';

import { getDb } from './database';

/** Tables exportées, avec le nom du fichier CSV. */
const EXPORT_TABLES: { table: string; file: string }[] = [
  { table: 'hc_sleep', file: 'sommeil' },
  { table: 'hc_hrv', file: 'hrv' },
  { table: 'hc_resting_hr', file: 'fc-repos' },
  { table: 'hc_heart_rate', file: 'fc-continue' },
  { table: 'hc_steps', file: 'pas' },
  { table: 'weight', file: 'poids' },
  { table: 'morning_entry', file: 'ressenti' },
  { table: 'hc_exercise', file: 'seances' },
  { table: 'hc_nutrition', file: 'repas' },
  { table: 'strength_set', file: 'musculation' },
  { table: 'alert', file: 'alertes' },
  { table: 'app_setting', file: 'reglages' },
];

/** Tables effacées : toutes les données, sauf les réglages. */
const ERASE_TABLES = [
  'hc_sleep',
  'hc_hrv',
  'hc_resting_hr',
  'hc_heart_rate',
  'hc_steps',
  'weight',
  'morning_entry',
  'hc_exercise',
  'hc_nutrition',
  'strength_set',
  'alert',
  'sync_state',
];

async function tableColumns(table: string): Promise<string[]> {
  const db = await getDb();
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.map((c) => c.name);
}

/**
 * Demande un dossier à l'utilisateur et y écrit un fichier CSV par table.
 * Renvoie le nombre de fichiers écrits, ou null si l'utilisateur a annulé.
 */
export async function exportAllToCsv(now: Date = new Date()): Promise<number | null> {
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return null; // sélection annulée
  }
  const db = await getDb();
  const stamp = dayKey(now);
  for (const { table, file } of EXPORT_TABLES) {
    const rows = await db.getAllAsync<Row>(`SELECT * FROM ${table}`);
    const csv = toCsv(rows, await tableColumns(table));
    const out = dir.createFile(`aube-${stamp}-${file}.csv`, 'text/csv');
    // BOM UTF-8 : Excel affiche alors correctement les accents.
    await out.write('﻿' + csv);
  }
  return EXPORT_TABLES.length;
}

/** Efface toutes les données (pas les réglages). Health Connect sera relu à la prochaine synchro. */
export async function eraseAllData(): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of ERASE_TABLES) await tx.execAsync(`DELETE FROM ${table}`);
  });
}
