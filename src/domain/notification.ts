// Notification du récap du matin : heures d'envoi et texte. Calcul pur.
// Le texte reste court et ne présente jamais le résultat comme un diagnostic.

import type { MorningRecap } from './recap';
import { SETTINGS, type Settings } from './settings';

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

/** Compléments du récap : rappel nutrition de la veille, titres des alertes non urgentes regroupées. */
export type RecapExtras = { nutritionReminder?: string | null; watchAlerts?: string[] };

/** Texte de la notification pour le récap d'un jour (null = nuit pas encore connue). */
export function notificationText(
  recap: MorningRecap | null,
  extras: RecapExtras = {},
  settings: Settings = SETTINGS,
): NotificationText {
  const title = 'Récap du matin';
  let body: string;
  if (!recap || recap.recovery.score === null) {
    body = 'Ouvre l’app pour synchroniser ta nuit et voir ta recommandation du jour.';
  } else if (!recap.calibration.done) {
    body = `${recap.calibration.label}. ${recap.recommendation.action}.`;
  } else {
    body = `Récupération ${recap.recovery.score} % · ${recap.recommendation.status}. ${recap.recommendation.action}.`;
  }
  if (extras.watchAlerts?.length) body += ` À surveiller : ${extras.watchAlerts.join(', ')}.`;
  if (extras.nutritionReminder) body += ` ${extras.nutritionReminder}`;
  return { title, body };
}

export const DEFAULT_TIME: TimeOfDay = {
  hour: SETTINGS.notification.defaultHour,
  minute: SETTINGS.notification.defaultMinute,
};
