// Rappel « Ta période est-elle terminée ? » (lot 5a, F7) : lancé après chaque synchro.
// Une seule notification par période, quand elle est ouverte depuis 14 jours, hors plage silencieuse.
// Pendant la plage silencieuse, rien n'est envoyé : la synchro suivante l'enverra.
// La notification ouvre l'accueil, où le bandeau propose « Terminer la période ».

import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';

import { getUserSettings } from '@/db/appSettings';
import { loadPeriods, markPeriodReminded } from '@/db/periods';
import { isQuietTime } from '@/domain/alerts';
import { dayKey } from '@/domain/dates';
import { openPeriod, shouldRemindPeriod } from '@/domain/periods';
import { SETTINGS } from '@/domain/settings';

import { getNotificationPermission } from './morningNotification';

const CHANNEL_ID = 'rappels';

export async function runPeriodReminder(now: Date = new Date()): Promise<void> {
  const today = dayKey(now);
  const [periods, user] = await Promise.all([loadPeriods(), getUserSettings()]);
  const open = openPeriod(periods);
  const reminded = periods.find((p) => p.id === open?.id)?.remindedMs != null;
  const quiet = isQuietTime({ hour: now.getHours(), minute: now.getMinutes() }, user.quietStart, user.quietEnd);
  if (!open || !shouldRemindPeriod(open, reminded, today, quiet)) return;
  if ((await getNotificationPermission()) !== 'granted') return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Rappels de saisie',
    importance: AndroidImportance.DEFAULT,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
  const label = SETTINGS.periods.labels[open.type].toLowerCase();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Ta période est-elle terminée ?',
      body: `Ta période « ${label} » est ouverte depuis ${SETTINGS.periods.reminderAfterDays} jours. Si elle est finie, termine-la pour réactiver tes normes et tes alertes.`,
      data: { url: '/' },
    },
    trigger: { channelId: CHANNEL_ID },
  });
  await markPeriodReminded(open.id, now.getTime());
}
