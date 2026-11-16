// Notification du récap du matin : heures d'envoi et texte. Calcul pur.
// Le texte reste court et ne présente jamais le résultat comme un diagnostic.

import type { MorningRecap } from './recap';
import { SETTINGS, type Settings } from './settings';
import { plainText } from './texts/markup';
import { NOTIFICATION } from './texts/today';

export type TimeOfDay = { hour: number; minute: number };

/** Heure décalée de `deltaMinutes`, en restant dans la journée (23:45 + 15 → 0:00). */
export function shiftTime(time: TimeOfDay, deltaMinutes: number): TimeOfDay {
  const total = (((time.hour * 60 + time.minute + deltaMinutes) % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

/** « 7 h 30 ». */
export function formatTime({ hour, minute }: TimeOfDay): string {
  return `${hour} h ${String(minute).padStart(2, '0')}`;
}

/**
 * Les `count` prochains instants à l'heure donnée, en heure locale.
 * Si l'heure du jour est déjà passée, on commence demain.
 */
export function nextOccurrences(now: Date, time: TimeOfDay, count: number): Date[] {
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.hour, time.minute);
  if (first.getTime() <= now.getTime()) first.setDate(first.getDate() + 1);
  return Array.from(
    { length: count },
    (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, time.hour, time.minute),
  );
}

export type NotificationText = { title: string; body: string };

/**
 * Compléments du récap : rappel nutrition de la veille, titres des alertes non urgentes regroupées,
 * rappel du journal du matin (lot 5a) quand il n'est pas rempli.
 */
export type RecapExtras = { nutritionReminder?: string | null; watchAlerts?: string[]; journalMissing?: boolean };

/** Texte de la notification pour le récap d'un jour (null = nuit pas encore connue). */
export function notificationText(
  recap: MorningRecap | null,
  extras: RecapExtras = {},
  settings: Settings = SETTINGS,
): NotificationText {
  const title = NOTIFICATION.title;
  // Une notification n'a pas de relief : texte nu.
  const action = recap ? plainText(recap.recommendation.action) : '';
  let body: string;
  if (recap?.period) {
    // Période en cours : ni score jugé ni recommandation chiffrée.
    body = NOTIFICATION.period(settings.periods.labels[recap.period.type], action);
  } else if (!recap || recap.recovery.score === null) {
    body = NOTIFICATION.noNight;
  } else if (!recap.calibration.done) {
    body = NOTIFICATION.calibration(recap.calibration.label, action);
  } else {
    body = NOTIFICATION.score(recap.recovery.score, recap.recommendation.status, action);
  }
  if (extras.watchAlerts?.length) body += ` ${NOTIFICATION.watch(extras.watchAlerts)}`;
  if (extras.nutritionReminder) body += ` ${extras.nutritionReminder}`;
  if (extras.journalMissing) body += ` ${settings.journal.reminder}`;
  return { title, body };
}

export const DEFAULT_TIME: TimeOfDay = {
  hour: SETTINGS.notification.defaultHour,
  minute: SETTINGS.notification.defaultMinute,
};
