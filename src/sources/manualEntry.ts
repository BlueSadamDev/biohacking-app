// Connecteur « saisie manuelle » : poids et ressenti du matin, tapés dans l'app.
// Le poids saisi est rangé avec les pesées Zepp (table `weight`, source 'manual') :
// la règle « la saisie fait foi » est appliquée par src/domain/daily.ts.

import { getDb } from '@/db/database';
import { upsertRows } from '@/db/healthData';
import { dayKey } from '@/domain/dates';

export type MorningEntry = {
  date: string;
  weightKg: number | null;
  /** Ressentis de 1 à 5 ; null = non renseigné. */
  energy: number | null;
  soreness: number | null;
  mood: number | null;
  note: string;
};

const MANUAL_ORIGIN = 'saisie manuelle';
const weightId = (date: string) => `manual-${date}`;

export async function loadMorningEntry(date: string = dayKey(new Date())): Promise<MorningEntry> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ energy: number | null; soreness: number | null; mood: number | null; note: string | null }>(
    'SELECT energy, soreness, mood, note FROM morning_entry WHERE date = ?',
    date,
  );
  const weight = await db.getFirstAsync<{ kg: number }>('SELECT kg FROM weight WHERE id = ?', weightId(date));
  return {
    date,
    weightKg: weight?.kg ?? null,
    energy: row?.energy ?? null,
    soreness: row?.soreness ?? null,
    mood: row?.mood ?? null,
    note: row?.note ?? '',
  };
}

/** Enregistre la saisie du jour (une seule par jour : une nouvelle saisie remplace la précédente). */
export async function saveMorningEntry(entry: MorningEntry): Promise<void> {
  const now = Date.now();
  await upsertRows(
    'morning_entry',
    ['date', 'energy', 'soreness', 'mood', 'note', 'saved_ms'],
    [[entry.date, entry.energy, entry.soreness, entry.mood, entry.note.trim() || null, now]],
  );
  if (entry.weightKg === null) {
    // Champ vidé : on retire la saisie, la pesée Zepp du jour (s'il y en a une) reprend la main.
    const db = await getDb();
    await db.runAsync('DELETE FROM weight WHERE id = ?', weightId(entry.date));
  } else {
    await upsertRows(
      'weight',
      ['id', 'time_ms', 'kg', 'source', 'origin'],
      [[weightId(entry.date), now, entry.weightKg, 'manual', MANUAL_ORIGIN]],
    );
  }
}
