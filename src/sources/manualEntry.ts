// Connecteur « saisie manuelle » : journal du matin (lot 5a, F8) : comportements de la veille,
// poids et ressenti, tapés dans l'app.
// Le poids saisi est rangé avec les pesées Zepp (table `weight`, source 'manual') :
// la règle « la saisie fait foi » est appliquée par src/domain/daily.ts.
// Les comportements cochés sont enregistrés pour la veille (table `behavior_entry`) ; les règles
// « oui / non / inconnu » sont dans src/domain/journal.ts.

import { loadComputedLateMeal } from '@/db/behaviors';
import { getDb, writeSql, writeTransaction } from '@/db/database';
import { upsertRows } from '@/db/healthData';
import { addDays, dayKey } from '@/domain/dates';
import { behaviorDayOf, journalRows, type Behavior } from '@/domain/journal';
import { SETTINGS } from '@/domain/settings';

export type MorningEntry = {
  date: string;
  weightKg: number | null;
  /** Ressentis de 1 à 5 ; null = non renseigné. */
  energy: number | null;
  soreness: number | null;
  mood: number | null;
  note: string;
};

export type Journal = MorningEntry & {
  /** Comportements cochés pour la veille. */
  checked: Set<string>;
  /** Journal déjà enregistré pour ce matin (lot 5a) ; false pour une saisie d'avant le journal. */
  saved: boolean;
  /**
   * Lot 5b : « repas tardif » pré-rempli d'après Suivi macro (journal pas encore enregistré, repas
   * enregistrés ce jour-là). false : rien de pré-rempli, à cocher à la main.
   */
  lateMealPrefilled: boolean;
};

const MANUAL_ORIGIN = 'saisie manuelle';
const weightId = (date: string) => `manual-${date}`;

type EntryRow = { energy: number | null; soreness: number | null; mood: number | null; note: string | null; journal_ms: number | null };

/** Journal du matin `date` : saisie existante (ou vide) et comportements cochés pour la veille. */
export async function loadJournal(date: string = dayKey(new Date())): Promise<Journal> {
  const db = await getDb();
  const row = await db.getFirstAsync<EntryRow>('SELECT energy, soreness, mood, note, journal_ms FROM morning_entry WHERE date = ?', date);
  const weight = await db.getFirstAsync<{ kg: number }>('SELECT kg FROM weight WHERE id = ?', weightId(date));
  const done = await db.getAllAsync<{ behavior_id: string }>(
    'SELECT behavior_id FROM behavior_entry WHERE day = ? AND done = 1',
    behaviorDayOf(date),
  );
  const saved = row?.journal_ms != null;
  const checked = new Set(done.map((d) => d.behavior_id));
  // Lot 5b : tant que le journal n'est pas enregistré, le repas tardif est pré-rempli d'après Suivi macro.
  const day = behaviorDayOf(date);
  const computed = saved ? undefined : (await loadComputedLateMeal(addDays(day, -1)).catch(() => new Map<string, boolean>())).get(day);
  if (computed) checked.add(SETTINGS.journal.lateMealBehaviorId);
  return {
    date,
    weightKg: weight?.kg ?? null,
    energy: row?.energy ?? null,
    soreness: row?.soreness ?? null,
    mood: row?.mood ?? null,
    note: row?.note ?? '',
    checked,
    saved,
    lateMealPrefilled: computed !== undefined,
  };
}

/** Journal enregistré pour ces matins (notification et accueil) : ensemble des dates remplies. */
export async function filledJournalDates(dates: string[]): Promise<Set<string>> {
  if (dates.length === 0) return new Set();
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT date FROM morning_entry WHERE journal_ms IS NOT NULL AND date IN (${dates.map(() => '?').join(', ')})`,
    ...dates,
  );
  return new Set(rows.map((r) => r.date));
}

/**
 * Enregistre le journal du matin `entry.date` (une seule fois par jour : un nouvel enregistrement
 * remplace le précédent). Comportements : une ligne oui / non par comportement affiché, pour la veille.
 */
export async function saveJournal(entry: MorningEntry, visible: readonly Behavior[], checked: ReadonlySet<string>): Promise<void> {
  const now = Date.now();
  const rows = journalRows(entry.date, visible, checked);
  await writeTransaction(async (tx) => {
    await tx.runAsync(
      'INSERT OR REPLACE INTO morning_entry (date, energy, soreness, mood, note, saved_ms, journal_ms) VALUES (?, ?, ?, ?, ?, ?, ?)',
      entry.date,
      entry.energy,
      entry.soreness,
      entry.mood,
      entry.note.trim() || null,
      now,
      now,
    );
    for (const r of rows) {
      await tx.runAsync(
        'INSERT OR REPLACE INTO behavior_entry (day, behavior_id, done) VALUES (?, ?, ?)',
        r.day,
        r.behaviorId,
        r.done ? 1 : 0,
      );
    }
  });
  if (entry.weightKg === null) {
    // Champ vidé : on retire la saisie, la pesée Zepp du jour (s'il y en a une) reprend la main.
    await writeSql('DELETE FROM weight WHERE id = ?', weightId(entry.date));
  } else {
    await upsertRows(
      'weight',
      ['id', 'time_ms', 'kg', 'source', 'origin'],
      [[weightId(entry.date), weightTime(entry.date, now), entry.weightKg, 'manual', MANUAL_ORIGIN]],
    );
  }
}

/** Heure de la pesée : maintenant pour aujourd'hui ; 8 h du matin pour un jour passé corrigé. */
function weightTime(date: string, now: number): number {
  if (date === dayKey(now)) return now;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 8).getTime();
}
