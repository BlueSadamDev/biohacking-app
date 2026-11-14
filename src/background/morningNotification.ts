// Notification du récap du matin (locale : rien ne passe par Internet).
//
// Une notification Android garde le texte fixé au moment où on la programme.
// On programme donc les 7 prochains matins, et on reprogramme à chaque synchro
// (app ouverte ou tâche de fond) : le matin même, le texte contient le score
// dès que la nuit est synchronisée ; sinon il invite à ouvrir l'app.

import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';

import { getNotificationTime } from '@/db/appSettings';
import { loadNights } from '@/db/healthData';
import { dayKey } from '@/domain/dates';
import { nextOccurrences, notificationText } from '@/domain/notification';
import { buildRecap } from '@/domain/recap';
import { SETTINGS } from '@/domain/settings';

const CHANNEL_ID = 'recap-matin';

// App ouverte au moment de la notification : on l'affiche quand même, sans son.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export async function getNotificationPermission(): Promise<NotificationPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/** Demande l'autorisation d'afficher des notifications (fenêtre Android). */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  await ensureChannel();
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

async function ensureChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Récap du matin',
    importance: AndroidImportance.DEFAULT,
    // Écran verrouillé : le contenu (score) reste masqué.
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
}

let queue: Promise<void> = Promise.resolve();

/**
 * (Re)programme les notifications des prochains matins avec le récap le plus récent.
 * Les appels passent l'un après l'autre : deux programmations simultanées
 * créeraient des notifications en double.
 */
export function scheduleMorningNotifications(): Promise<void> {
  const run = queue.then(() => schedule(new Date()));
  queue = run.catch(() => undefined);
  return run;
}

async function schedule(now: Date): Promise<void> {
  if ((await getNotificationPermission()) !== 'granted') return;
  await ensureChannel();
  const [time, nights] = await Promise.all([getNotificationTime(), loadNights()]);
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const date of nextOccurrences(now, time, SETTINGS.notification.daysAhead)) {
    const recap = buildRecap(nights, dayKey(date));
    await Notifications.scheduleNotificationAsync({
      content: notificationText(recap),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
    });
  }
}
