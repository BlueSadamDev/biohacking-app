// Moteur d'alertes (cahier des charges, sections 4 F2 et 5). Calcul pur.
// - Règles simples : HRV, FC au repos, sommeil (durée, régularité), charge, poids, protéines.
// - Combinaisons : HRV basse + FC au repos haute + charge élevée = « surcharge » ;
//   même chose avec une charge normale = « signes de fatigue sans raison sportive ».
//   Une combinaison remplace les alertes simples qu'elle regroupe.
// - Chaque alerte = constat + pourquoi + action (textes dans texts/alerts.ts). Jamais de diagnostic médical.
// - Sélection : rien pendant la calibration ni si les alertes sont coupées, au plus 2 par jour,
//   pas de répétition pendant 3 jours sauf aggravation ; les non urgentes vont dans le récap du matin,
//   les urgentes partent tout de suite, sauf pendant la plage silencieuse.

import type { DailyWeight } from './daily';
import { addDays } from './dates';
import { loadRatio } from './load';
import type { NightValue } from './nightly';
import { hrvBaseline, hrvNorm, restingHrNorm } from './norms';
import type { TimeOfDay } from './notification';
import type { DayNutrition } from './nutrition';
import { isTaggedDay, withoutTaggedDays, withoutTaggedNights, type Period } from './periods';
import { averageWeight, proteinTargetGrams } from './profile';
import { SETTINGS, type Settings } from './settings';
import { EXERCISE_LABEL, stagnantExercises, type StrengthEntry } from './strength';
import { ALERT_TEXT } from './texts/alerts';
import { joinList } from './texts/common';
import { loadPercent } from './texts/today';

export type AlertLevel = 'watch' | 'important';
export type AlertTheme = 'recovery' | 'load' | 'nutrition';
export type AlertRule =
  | 'overload'
  | 'illness-or-stress'
  | 'load-high'
  | 'hrv-low'
  | 'resting-hr-high'
  | 'sleep-short'
  | 'bedtime-irregular'
  | 'load-under'
  | 'protein-low'
  | 'weight-trend'
  | 'strength-stagnation';

/** Ordre de priorité quand il faut choisir (au plus 2 par jour). */
const PRIORITY: AlertRule[] = [
  'overload',
  'illness-or-stress',
  'load-high',
  'hrv-low',
  'resting-hr-high',
  'sleep-short',
  'protein-low',
  'bedtime-irregular',
  'load-under',
  'weight-trend',
  'strength-stagnation',
];

export type Alert = {
  /** Identifiant stable : règle + date. */
  id: string;
  rule: AlertRule;
  date: string;
  level: AlertLevel;
  theme: AlertTheme;
  title: string;
  /** Constat (en une phrase). */
  finding: string;
  /** Cause probable. */
  cause: string;
  /** Action proposée. */
  action: string;
};

export const LEVEL_LABEL: Record<AlertLevel, string> = { watch: 'À surveiller', important: 'Important' };
export const THEME_LABEL: Record<AlertTheme, string> = {
  recovery: 'Récupération',
  load: 'Charge',
  nutrition: 'Nutrition',
};

export type AlertInputs = {
  /** Nuits calculées (une valeur par nuit). */
  nights: NightValue[];
  /** Charge par jour (TRIMP) ; null si le profil cardiaque est incomplet. */
  dailyLoad: Map<string, number> | null;
  /** Jours d'historique disponibles pour la charge (ratio fiable à partir de 28). */
  loadHistoryDays: number;
  weights: Map<string, DailyWeight>;
  nutrition: Map<string, DayNutrition>;
  proteinGPerKg: number;
  /** Saisies de musculation (lot 3) ; absentes = pas de règle de stagnation. */
  strength?: StrengthEntry[];
  /**
   * Périodes (lot 5a). Si aujourd'hui est étiqueté : aucune alerte (pause). Sinon, les nuits et les repas
   * des jours étiquetés sont retirés, et une sous-charge ne compte pas des jours étiquetés.
   * Les alertes reprennent donc le lendemain de la fin d'une période.
   */
  periods?: readonly Period[];
  today: string;
};

function make(rule: AlertRule, date: string, level: AlertLevel, theme: AlertTheme, text: Omit<Alert, 'id' | 'rule' | 'date' | 'level' | 'theme'>): Alert {
  return { id: `${rule}-${date}`, rule, date, level, theme, ...text };
}

// ---------------------------------------------------------------------------
// Signaux (sans texte) : utilisés seuls ou combinés
// ---------------------------------------------------------------------------

/** HRV : moyenne 7 j sous la plage normale, ou N nuits d'affilée sous la plage. */
export function hrvLowSignal(nights: NightValue[], date: string, settings: Settings = SETTINGS): { mean7Below: boolean; nightsBelow: number } | null {
  const norm = hrvNorm(nights, date, settings);
  let streak = 0;
  for (let i = 0; i < settings.alerts.hrvConsecutiveNights; i++) {
    const d = addDays(date, -i);
    const n = nights.find((x) => x.date === d);
    const base = hrvBaseline(nights, d, settings);
    if (!n || n.lnRmssd === null || !base || n.lnRmssd >= base.low) break;
    streak++;
  }
  const mean7Below = norm.position === 'below';
  const consecutive = streak >= settings.alerts.hrvConsecutiveNights;
  return mean7Below || consecutive ? { mean7Below, nightsBelow: streak } : null;
}

/** FC au repos : plus de N bpm au-dessus de la moyenne 30 j, M jours d'affilée. Renvoie l'écart du jour. */
export function restingHrHighSignal(nights: NightValue[], date: string, settings: Settings = SETTINGS): number | null {
  let todayDelta: number | null = null;
  for (let i = 0; i < settings.alerts.restingHrDays; i++) {
    const delta = restingHrNorm(nights, addDays(date, -i), settings).delta;
    if (delta === null || delta <= settings.alerts.restingHrDeltaBpm) return null;
    if (i === 0) todayDelta = delta;
  }
  return todayDelta;
}

/** Premier jour de l'historique de charge (départ des moyennes exponentielles). */
function loadHistoryStart(input: AlertInputs): string | null {
  return input.loadHistoryDays > 0 ? addDays(input.today, -(input.loadHistoryDays - 1)) : null;
}

/** Ratio de charge du jour (null si la charge n'est pas calculable ou l'historique trop court). */
function ratioOn(input: AlertInputs, date: string, settings: Settings): number | null {
  if (!input.dailyLoad || input.loadHistoryDays < settings.load.calibrationDays) return null;
  return loadRatio(input.dailyLoad, date, settings, loadHistoryStart(input)).ratio;
}

/** Minutes depuis 18 h la veille : rend comparables les couchers avant et après minuit. */
export function bedtimeMinutes(start: number): number {
  const d = new Date(start);
  return (((d.getHours() - 18) * 60 + d.getMinutes()) % 1440 + 1440) % 1440;
}

// ---------------------------------------------------------------------------
// Règles
// ---------------------------------------------------------------------------

/** Toutes les alertes candidates du jour (avant limite quotidienne et anti-répétition). */
export function evaluateAlerts(raw: AlertInputs, settings: Settings = SETTINGS): Alert[] {
  const a = settings.alerts;
  const periods = raw.periods ?? [];
  // Période en cours : alertes en pause (rien n'est calculé, donc rien n'est envoyé ni enregistré).
  if (isTaggedDay(raw.today, periods)) return [];
  const input: AlertInputs = {
    ...raw,
    nights: withoutTaggedNights(raw.nights, periods),
    nutrition: withoutTaggedDays(raw.nutrition, periods),
  };
  const { nights, today } = input;
  const result: Alert[] = [];

  const hrv = hrvLowSignal(nights, today, settings);
  const rhrDelta = restingHrHighSignal(nights, today, settings);
  const ratio = ratioOn(input, today, settings);

  // Combinaisons HRV basse + FC au repos haute.
  if (hrv && rhrDelta !== null) {
    const bpm = Math.round(rhrDelta);
    const averageDays = settings.norms.restingHrBaselineDays;
    if (ratio !== null && ratio > a.overloadRatio) {
      result.push(make('overload', today, 'important', 'load', ALERT_TEXT.overload(bpm, averageDays, loadPercent(ratio))));
    } else {
      result.push(make('illness-or-stress', today, 'important', 'recovery', ALERT_TEXT.fatigueWithoutTraining(bpm, averageDays)));
    }
  } else {
    if (hrv) {
      const streak = hrv.nightsBelow >= a.hrvConsecutiveNights ? hrv.nightsBelow : null;
      result.push(make('hrv-low', today, 'watch', 'recovery', ALERT_TEXT.hrvLow(streak)));
    }
    if (rhrDelta !== null) {
      result.push(
        make(
          'resting-hr-high',
          today,
          'watch',
          'recovery',
          ALERT_TEXT.restingHrHigh(Math.round(rhrDelta), settings.norms.restingHrBaselineDays, a.restingHrDays),
        ),
      );
    }
  }

  // Charge seule.
  if (ratio !== null && ratio > settings.load.highMin && !result.some((r) => r.rule === 'overload')) {
    result.push(
      make('load-high', today, 'important', 'load', ALERT_TEXT.loadHigh(loadPercent(ratio), loadPercent(settings.load.balancedMax))),
    );
  }
  if (input.dailyLoad && input.loadHistoryDays >= settings.load.calibrationDays + a.underloadDays - 1) {
    let under = true;
    for (let i = 0; i < a.underloadDays && under; i++) {
      const day = addDays(today, -i);
      // Un jour étiqueté (vacances, maladie…) interrompt la série : pas de « sous-charge » au retour.
      const r = isTaggedDay(day, periods) ? null : loadRatio(input.dailyLoad, day, settings, loadHistoryStart(input)).ratio;
      under = r !== null && r < settings.load.underMax;
    }
    if (under) {
      result.push(
        make('load-under', today, 'watch', 'load', ALERT_TEXT.loadUnder(-loadPercent(settings.load.underMax), a.underloadDays)),
      );
    }
  }

  // Sommeil court : au moins N nuits sur les M dernières sous le seuil.
  const recent = Array.from({ length: a.sleepWindowNights }, (_, i) => nights.find((n) => n.date === addDays(today, -i)));
  const short = recent.filter((n) => n && n.asleepMinutes < a.sleepShortMinutes).length;
  if (short >= a.sleepShortNights) {
    result.push(
      make('sleep-short', today, 'watch', 'recovery', ALERT_TEXT.sleepShort(a.sleepShortMinutes / 60, short, a.sleepWindowNights)),
    );
  }

  // Heure de coucher irrégulière.
  const week = Array.from({ length: a.bedtimeWindowNights }, (_, i) => nights.find((n) => n.date === addDays(today, -i)))
    .filter((n): n is NightValue => !!n)
    .map((n) => bedtimeMinutes(n.sleep.start));
  if (week.length >= a.bedtimeMinNights) {
    const spread = Math.max(...week) - Math.min(...week);
    if (spread > a.bedtimeSpreadMinutes) {
      const h = Math.floor(spread / 60);
      const m = Math.round(spread % 60);
      result.push(
        make('bedtime-irregular', today, 'watch', 'recovery', ALERT_TEXT.bedtimeIrregular(`${h} h ${String(m).padStart(2, '0')}`)),
      );
    }
  }

  // Protéines : jours complets (hier et avant) avec repas et protéines connues.
  const weight = averageWeight(input.weights, today, settings);
  const target = proteinTargetGrams(input.proteinGPerKg, weight);
  if (target !== null) {
    let below = 0;
    for (let i = 1; i <= a.proteinWindowDays; i++) {
      const day = input.nutrition.get(addDays(today, -i));
      if (day && day.proteinG !== null && day.proteinG < settings.nutrition.reachedFraction * target) below++;
    }
    if (below > a.proteinMaxDaysBelow) {
      result.push(make('protein-low', today, 'watch', 'nutrition', ALERT_TEXT.proteinLow(target, below, a.proteinWindowDays)));
    }
  }

  // Poids : tendance de la moyenne 7 j sur N semaines.
  const now = averageWeight(input.weights, today, settings);
  const before = averageWeight(input.weights, addDays(today, -7 * a.weightWeeks), settings);
  if (now !== null && before !== null) {
    const perWeek = (now - before) / a.weightWeeks;
    if (perWeek > a.weightGainMaxKgPerWeek || perWeek < -a.weightLossMaxKgPerWeek) {
      const gain = perWeek > 0;
      result.push(make('weight-trend', today, 'watch', 'nutrition', ALERT_TEXT.weightTrend(gain, Math.abs(perWeek), a.weightWeeks)));
    }
  }

  // Force : stagnation sur 6 semaines (lot 3).
  const stagnant = input.strength ? stagnantExercises(input.strength, today, settings) : [];
  if (stagnant.length > 0) {
    const names = stagnant.map((e) => EXERCISE_LABEL[e].toLowerCase());
    const weeks = Math.round(settings.strength.stagnationDays / 7);
    result.push(make('strength-stagnation', today, 'watch', 'load', ALERT_TEXT.strengthStagnation(joinList(names), weeks)));
  }

  return result.sort((x, y) => PRIORITY.indexOf(x.rule) - PRIORITY.indexOf(y.rule));
}

/** Jours sans répétition d'une même règle (la stagnation évolue lentement : pas de rappel tous les 3 jours). */
function repeatDaysFor(rule: AlertRule, settings: Settings): number {
  return rule === 'strength-stagnation' ? settings.strength.alertRepeatDays : settings.alerts.repeatDays;
}

// ---------------------------------------------------------------------------
// Sélection et envoi
// ---------------------------------------------------------------------------

/** Alerte déjà enregistrée (historique). */
export type PastAlert = Pick<Alert, 'rule' | 'date' | 'level'>;

export type Delivery = 'now' | 'recap';
export type SelectedAlert = Alert & {
  /** 'now' : notification immédiate ; 'recap' : regroupée dans le récap du matin. */
  delivery: Delivery;
  /** Même règle déclenchée souvent ces derniers jours : rappeler qu'un avis médical peut être utile. */
  persistent: boolean;
};

/** L'heure `time` est-elle dans la plage silencieuse [start, end[ (qui peut passer minuit) ? */
export function isQuietTime(time: TimeOfDay, start: TimeOfDay, end: TimeOfDay): boolean {
  const t = time.hour * 60 + time.minute;
  const s = start.hour * 60 + start.minute;
  const e = end.hour * 60 + end.minute;
  if (s === e) return false;
  return s < e ? t >= s && t < e : t >= s || t < e;
}

const rank = (level: AlertLevel) => (level === 'important' ? 2 : 1);

export type SelectionContext = {
  calibrationDone: boolean;
  alertsEnabled: boolean;
  /** Alertes déjà enregistrées (au moins les 14 derniers jours). */
  history: PastAlert[];
  today: string;
  now: TimeOfDay;
  quietStart: TimeOfDay;
  quietEnd: TimeOfDay;
};

/**
 * Garde les alertes à enregistrer aujourd'hui : rien pendant la calibration ou si les alertes
 * sont coupées ; pas de répétition d'une règle avant N jours sauf aggravation ; au plus N par jour
 * (en comptant celles déjà enregistrées aujourd'hui), les plus importantes d'abord.
 */
export function selectAlerts(candidates: Alert[], ctx: SelectionContext, settings: Settings = SETTINGS): SelectedAlert[] {
  const a = settings.alerts;
  if (!ctx.calibrationDone || !ctx.alertsEnabled) return [];

  const fresh = candidates.filter((c) => {
    const repeat = repeatDaysFor(c.rule, settings);
    const recent = ctx.history.filter((h) => h.rule === c.rule && h.date > addDays(ctx.today, -repeat) && h.date <= ctx.today);
    return recent.every((h) => rank(c.level) > rank(h.level));
  });

  const remaining = Math.max(0, a.maxPerDay - ctx.history.filter((h) => h.date === ctx.today).length);
  const ordered = [...fresh].sort(
    (x, y) => rank(y.level) - rank(x.level) || PRIORITY.indexOf(x.rule) - PRIORITY.indexOf(y.rule),
  );
  const quiet = isQuietTime(ctx.now, ctx.quietStart, ctx.quietEnd);
  const windowStart = addDays(ctx.today, -(a.persistentWindowDays - 1));

  return ordered.slice(0, remaining).map((alert) => {
    const occurrences = ctx.history.filter((h) => h.rule === alert.rule && h.date >= windowStart && h.date < ctx.today).length + 1;
    return {
      ...alert,
      delivery: alert.level === 'important' && !quiet ? 'now' : 'recap',
      persistent: occurrences >= a.persistentCount,
    };
  });
}
