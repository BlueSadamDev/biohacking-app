// Notification du récap du matin (locale : rien ne passe par Internet).
//
// Une notification Android garde le texte fixé au moment où on la programme.
// On programme donc les 7 prochains matins, et on reprogramme à chaque synchro
// (app ouverte ou tâche de fond) : le matin même, le texte contient le score
// dès que la nuit est synchronisée ; sinon il invite à ouvrir l'app.

import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';

import { loadAlerts } from '@/db/alerts';
import { getNotificationTime } from '@/db/appSettings';
import { loadNights } from '@/db/healthData';
import { loadNutritionView } from '@/db/nutritionData';
import { loadPeriods } from '@/db/periods';
import { filledJournalDates } from '@/sources/manualEntry';
import { addDays, dayKey } from '@/domain/dates';
import { nextOccurrences, notificationText } from '@/domain/notification';
import { nutritionReminder } from '@/domain/nutrition';
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
  const today = dayKey(now);
  const [time, nights, alerts, periods] = await Promise.all([
    getNotificationTime(),
    loadNights(),
    loadAlerts().catch(() => []),
    loadPeriods().catch(() => []),
  ]);
  const mornings = nextOccurrences(now, time, SETTINGS.notification.daysAhead);
  // Journal du matin déjà rempli (on reprogramme aussi après chaque enregistrement du journal).
  const filled = await filledJournalDates(mornings.map((d) => dayKey(d))).catch(() => new Set<string>());
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const date of mornings) {
    const key = dayKey(date);
    // Une période en cours couvre aussi les matins à venir : texte « en pause » jusqu'à sa fin.
    const recap = buildRecap(nights, key, SETTINGS, periods);
    // Alertes non urgentes de la veille et de la nuit, regroupées dans ce récap.
    const watchAlerts = alerts
      .filter((a) => a.delivery === 'recap' && (a.date === key || a.date === addDays(key, -1)))
      .map((a) => a.title);
    // Rappel nutrition : seulement quand la veille de ce récap est aujourd'hui ou déjà passée.
    const yesterday = addDays(key, -1);
    const nutrition =
      yesterday <= today ? await loadNutritionView(yesterday, today, now).catch(() => null) : null;
    await Notifications.scheduleNotificationAsync({
      content: notificationText(recap, {
        watchAlerts,
        nutritionReminder: nutrition ? nutritionReminder(nutrition) : null,
        journalMissing: !filled.has(key),
      }),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
    });
  }
}
