// Réglages modifiables dans l'app (table `app_setting`).

import { DEFAULT_TIME, type TimeOfDay } from '@/domain/notification';

import { getDb } from './database';
import { upsertRows } from './healthData';

const NOTIFICATION_TIME = 'notification_time';

export async function getNotificationTime(): Promise<TimeOfDay> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_setting WHERE key = ?', NOTIFICATION_TIME);
  const match = row?.value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return DEFAULT_TIME;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export async function setNotificationTime(time: TimeOfDay): Promise<void> {
  await upsertRows('app_setting', ['key', 'value'], [[NOTIFICATION_TIME, `${time.hour}:${String(time.minute).padStart(2, '0')}`]]);
}
