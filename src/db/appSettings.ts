// Réglages modifiables dans l'app (table `app_setting`, une ligne par réglage).
// Valeur absente de la table = valeur par défaut (src/domain/profile.ts).

import { DEFAULT_TIME, type TimeOfDay } from '@/domain/notification';
import { defaultUserSettings, type Sex, type UserSettings } from '@/domain/profile';

import { getDb } from './database';
import { upsertRows } from './healthData';

const NOTIFICATION_TIME = 'notification_time';

/** Nom de chaque réglage dans la table. */
const KEYS: Record<keyof UserSettings, string> = {
  targetWeightKg: 'target_weight_kg',
  proteinGPerKg: 'protein_g_per_kg',
  caloriesKcal: 'calories_kcal',
  sessionsPerWeek: 'sessions_per_week',
  birthYear: 'birth_year',
  sex: 'sex',
  hrMaxBpm: 'hr_max_bpm',
  notificationTime: NOTIFICATION_TIME,
  quietStart: 'quiet_start',
  quietEnd: 'quiet_end',
  alertsEnabled: 'alerts_enabled',
};

function parseTime(value: string | undefined): TimeOfDay | null {
  const match = value?.match(/^(\d{1,2}):(\d{2})$/);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

const timeText = (t: TimeOfDay) => `${t.hour}:${String(t.minute).padStart(2, '0')}`;

function parseNumberOrNull(value: string | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Tous les réglages, avec les valeurs par défaut pour ceux jamais modifiés. */
export async function getUserSettings(): Promise<UserSettings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM app_setting');
  const raw = new Map(rows.map((r) => [r.key, r.value]));
  const d = defaultUserSettings();
  const num = (k: keyof UserSettings, fallback: number | null) => {
    const v = parseNumberOrNull(raw.get(KEYS[k]));
    return v === undefined ? fallback : v;
  };
  const sex = raw.get(KEYS.sex);
  return {
    targetWeightKg: num('targetWeightKg', d.targetWeightKg),
    proteinGPerKg: num('proteinGPerKg', d.proteinGPerKg) ?? d.proteinGPerKg,
    caloriesKcal: num('caloriesKcal', d.caloriesKcal),
    sessionsPerWeek: num('sessionsPerWeek', d.sessionsPerWeek) ?? d.sessionsPerWeek,
    birthYear: num('birthYear', d.birthYear),
    sex: sex === 'male' || sex === 'female' ? (sex as Sex) : d.sex,
    hrMaxBpm: num('hrMaxBpm', d.hrMaxBpm),
    notificationTime: parseTime(raw.get(KEYS.notificationTime)) ?? d.notificationTime,
    quietStart: parseTime(raw.get(KEYS.quietStart)) ?? d.quietStart,
    quietEnd: parseTime(raw.get(KEYS.quietEnd)) ?? d.quietEnd,
    alertsEnabled: raw.has(KEYS.alertsEnabled) ? raw.get(KEYS.alertsEnabled) === '1' : d.alertsEnabled,
  };
}

/** Enregistre un réglage. null = « à définir » (ou valeur estimée pour la FC max). */
export async function setUserSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]): Promise<void> {
  let text: string;
  if (value === null) text = '';
  else if (typeof value === 'boolean') text = value ? '1' : '0';
  else if (typeof value === 'object') text = timeText(value as TimeOfDay);
  else text = String(value);
  await upsertRows('app_setting', ['key', 'value'], [[KEYS[key], text]]);
}

export async function getNotificationTime(): Promise<TimeOfDay> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_setting WHERE key = ?', NOTIFICATION_TIME);
  return parseTime(row?.value) ?? DEFAULT_TIME;
}

export async function setNotificationTime(time: TimeOfDay): Promise<void> {
  await setUserSetting('notificationTime', time);
}
