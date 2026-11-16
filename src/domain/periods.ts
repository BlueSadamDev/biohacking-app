// Étiquettes de période (lot 5a, F7 ; cahier des charges, section 5). Calculs purs.
//
// Un jour est « étiqueté » s'il est compris entre le début et la fin d'une période
// (une période en cours, sans date de fin, couvre tous les jours à partir de son début).
// `isTaggedDay` est la seule règle qui le décide ; `withoutTaggedNights` est le filtre unique
// appliqué aux nuits avant les normes, la calibration et les liens observés.
//
// Date d'une nuit : la date du réveil (`NightValue.date`). Une nuit est donc exclue si elle se
// termine un jour étiqueté : pour une période du 10 au 12, les nuits du 10, du 11 et du 12 sont
// exclues (celle du 9 au 10 comprise) ; la nuit du 12 au 13 compte de nouveau.

import { addDays, daysBetween } from './dates';
import type { NightValue } from './nightly';
import { SETTINGS, type Settings } from './settings';

export type PeriodType = Settings['periods']['types'][number];

export type Period = {
  id: string;
  type: PeriodType;
  /** Premier jour, « AAAA-MM-JJ ». */
  start: string;
  /** Dernier jour ; null tant que la période est en cours. */
  end: string | null;
};

/** Période qui couvre ce jour, ou null. */
export function periodOn(day: string, periods: readonly Period[]): Period | null {
  return periods.find((p) => day >= p.start && (p.end === null || day <= p.end)) ?? null;
}

/** La seule règle qui dit si un jour est étiqueté. */
export function isTaggedDay(day: string, periods: readonly Period[]): boolean {
  return periodOn(day, periods) !== null;
}

/**
 * Filtre unique : retire les nuits qui se terminent un jour étiqueté.
 * `keepDate` : nuit gardée même si elle est étiquetée (la nuit du jour, pour que le score
 * de récupération reste calculé pendant une période, comparé à des normes sans jours étiquetés).
 */
export function withoutTaggedNights(nights: NightValue[], periods: readonly Period[], keepDate?: string): NightValue[] {
  if (periods.length === 0) return nights;
  return nights.filter((n) => n.date === keepDate || !isTaggedDay(n.date, periods));
}

/** Copie d'une table « par jour » sans les jours étiquetés. */
export function withoutTaggedDays<T>(byDay: Map<string, T>, periods: readonly Period[]): Map<string, T> {
  if (periods.length === 0) return byDay;
  return new Map([...byDay].filter(([day]) => !isTaggedDay(day, periods)));
}

/** Les `count` derniers jours non étiquetés jusqu'à `today` compris (du plus récent au plus ancien). */
export function untaggedDaysBack(today: string, count: number, periods: readonly Period[], settings: Settings = SETTINGS): string[] {
  const days: string[] = [];
  for (let i = 0; days.length < count && i < settings.periods.maxLookbackDays; i++) {
    const day = addDays(today, -i);
    if (!isTaggedDay(day, periods)) days.push(day);
  }
  return days;
}

/** Nombre de jours étiquetés entre `from` et `to` (bornes comprises). */
export function taggedDaysBetween(from: string, to: string, periods: readonly Period[]): number {
  let count = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (isTaggedDay(d, periods)) count++;
  return count;
}

/** Période en cours (sans date de fin), ou null. */
export function openPeriod(periods: readonly Period[]): Period | null {
  return periods.find((p) => p.end === null) ?? null;
}

/** Nombre de jours de la période, début compris (jusqu'à `today` si elle est en cours). */
export function periodLength(period: Period, today: string): number {
  return daysBetween(period.start, period.end ?? today) + 1;
}

/** Libellé « depuis … » du bandeau de l'accueil. */
export function sinceLabel(period: Period, today: string): string {
  const days = daysBetween(period.start, today);
  if (days <= 0) return 'depuis aujourd’hui';
  if (days === 1) return 'depuis hier';
  return `depuis ${days} jours`;
}

/**
 * Contrôle d'une période avant enregistrement ; renvoie un message d'erreur ou null.
 * - début jamais dans le futur ; à la création, au plus `maxStartDaysBack` jours en arrière ;
 * - fin vide (en cours) ou comprise entre le début et aujourd'hui ;
 * - aucun chevauchement avec une autre période (une période en cours s'étend sans fin) ;
 * - une seule période en cours à la fois.
 */
export function validatePeriod(
  candidate: Period,
  others: readonly Period[],
  today: string,
  options: { isNew: boolean },
  settings: Settings = SETTINGS,
): string | null {
  const back = settings.periods.maxStartDaysBack;
  if (candidate.start > today) return 'La date de début ne peut pas être dans le futur.';
  if (options.isNew && daysBetween(candidate.start, today) > back) {
    return `La date de début peut remonter au plus à ${back} jours.`;
  }
  if (candidate.end !== null) {
    if (candidate.end < candidate.start) return 'La date de fin doit suivre la date de début.';
    if (candidate.end > today) return 'La date de fin ne peut pas être dans le futur.';
  }
  const rest = others.filter((p) => p.id !== candidate.id);
  if (candidate.end === null && rest.some((p) => p.end === null)) return 'Une période est déjà en cours.';
  const endOf = (p: Period) => p.end ?? '9999-12-31';
  const overlap = rest.some((p) => candidate.start <= endOf(p) && p.start <= endOf(candidate));
  return overlap ? 'Ces dates chevauchent une autre période.' : null;
}

/** Rappel « Ta période est-elle terminée ? » : une seule fois, hors plage silencieuse. */
export function shouldRemindPeriod(
  open: Period | null,
  alreadyReminded: boolean,
  today: string,
  quiet: boolean,
  settings: Settings = SETTINGS,
): boolean {
  if (!open || alreadyReminded || quiet) return false;
  return daysBetween(open.start, today) >= settings.periods.reminderAfterDays;
}
