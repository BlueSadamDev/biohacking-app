// Rappel de saisie après une séance de musculation (lot 3) : lancé après chaque synchro.
// Au plus une notification par jour, le jour même, hors plage silencieuse.
// Pendant la plage silencieuse, rien n'est envoyé : la synchro suivante (au plus une heure après)
// l'enverra si c'est encore le même jour. La notification ouvre l'écran de saisie.

import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';

import { getUserSettings } from '@/db/appSettings';
import { loadExercises } from '@/db/healthData';
import { getStrengthReminderDate, loadStrengthEntries, setStrengthReminderDate } from '@/db/strength';
import { isQuietTime } from '@/domain/alerts';
import { dayKey } from '@/domain/dates';
import { pendingStrengthSession, shouldRemindStrength } from '@/domain/strength';

import { getNotificationPermission } from './morningNotification';

const CHANNEL_ID = 'rappels';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Envoie le rappel de saisie si une séance de musculation du jour n'est pas encore saisie. */
export async function runStrengthReminder(now: Date = new Date()): Promise<void> {
  const today = dayKey(now);
  const [sessions, entries, user, last] = await Promise.all([
    loadExercises(now.getTime() - DAY_MS),
    loadStrengthEntries(today),
    getUserSettings(),
    getStrengthReminderDate(),
  ]);
  const pending = pendingStrengthSession(sessions, entries, today);
  const quiet = isQuietTime({ hour: now.getHours(), minute: now.getMinutes() }, user.quietStart, user.quietEnd);
  if (!shouldRemindStrength(pending, last, today, quiet)) return;
  if ((await getNotificationPermission()) !== 'granted') return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Rappels de saisie',
    importance: AndroidImportance.DEFAULT,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Séance de musculation détectée',
      body: 'Note ta meilleure série en squat, développé couché et soulevé de terre (10 secondes).',
      data: { url: '/seance' },
    },
    trigger: { channelId: CHANNEL_ID },
  });
  await setStrengthReminderDate(today);
}
