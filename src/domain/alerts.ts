// Moteur d'alertes (cahier des charges, sections 4 F2 et 5). Calcul pur.
// - Règles simples : HRV, FC au repos, sommeil (durée, régularité), charge, poids, protéines.
// - Combinaisons : HRV basse + FC au repos haute + charge élevée = « surcharge » ;
//   même chose avec une charge normale = « possible début de maladie ou stress ».
//   Une combinaison remplace les alertes simples qu'elle regroupe.
// - Chaque alerte = constat + cause probable + action. Jamais de diagnostic médical.
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
import { averageWeight, proteinTargetGrams } from './profile';
import { SETTINGS, type Settings } from './settings';

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
  | 'weight-trend';

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
  today: string;
};

const fr = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',');

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

/** Ratio de charge du jour (null si la charge n'est pas calculable ou l'historique trop court). */
function ratioOn(input: AlertInputs, date: string, settings: Settings): number | null {
  if (!input.dailyLoad || input.loadHistoryDays < settings.load.calibrationDays) return null;
  return loadRatio(input.dailyLoad, date, settings).ratio;
}

/** Minutes depuis 18 h la veille : rend comparables les couchers avant et après minuit. */
function bedtimeMinutes(start: number): number {
  const d = new Date(start);
  return (((d.getHours() - 18) * 60 + d.getMinutes()) % 1440 + 1440) % 1440;
}

// ---------------------------------------------------------------------------
// Règles
// ---------------------------------------------------------------------------

/** Toutes les alertes candidates du jour (avant limite quotidienne et anti-répétition). */
export function evaluateAlerts(input: AlertInputs, settings: Settings = SETTINGS): Alert[] {
  const a = settings.alerts;
  const { nights, today } = input;
  const result: Alert[] = [];

  const hrv = hrvLowSignal(nights, today, settings);
  const rhrDelta = restingHrHighSignal(nights, today, settings);
  const ratio = ratioOn(input, today, settings);

  // Combinaisons HRV basse + FC au repos haute.
  if (hrv && rhrDelta !== null) {
    const shared = `HRV sous ta plage normale et FC au repos à +${fr(rhrDelta, 0)} bpm de ta moyenne`;
    if (ratio !== null && ratio > a.overloadRatio) {
      result.push(
        make('overload', today, 'important', 'load', {
          title: 'Surcharge',
          finding: `${shared}, avec une charge élevée (ratio ${fr(ratio, 2)}).`,
          cause: 'Ton corps n’absorbe pas la charge d’entraînement des derniers jours.',
          action: 'Remplace les deux prochaines séances par du repos ou de la mobilité, couche-toi tôt.',
        }),
      );
    } else {
      result.push(
        make('illness-or-stress', today, 'important', 'recovery', {
          title: 'Possible début de maladie ou stress',
          finding: `${shared}, sans hausse de ta charge d’entraînement.`,
          cause: 'Fatigue, stress ou infection qui commence : l’entraînement n’explique pas ces signaux.',
          action: 'Journée légère, hydrate-toi et dors plus. Si tu te sens malade, pas de séance intense.',
        }),
      );
    }
  } else {
    if (hrv) {
      result.push(
        make('hrv-low', today, 'watch', 'recovery', {
          title: 'HRV basse',
          finding:
            hrv.nightsBelow >= a.hrvConsecutiveNights
              ? `Ta HRV est sous ta plage normale depuis ${hrv.nightsBelow} nuits.`
              : 'Ta HRV moyenne sur 7 jours est sous ta plage normale.',
          cause: 'Récupération incomplète : charge, sommeil, stress ou alcool.',
          action: 'Séance technique ou mobilité aujourd’hui, couché avant 23 h.',
        }),
      );
    }
    if (rhrDelta !== null) {
      result.push(
        make('resting-hr-high', today, 'watch', 'recovery', {
          title: 'FC au repos élevée',
          finding: `Ta FC au repos est à +${fr(rhrDelta, 0)} bpm de ta moyenne depuis ${a.restingHrDays} jours.`,
          cause: 'Fatigue accumulée ou infection qui débute.',
          action: 'Évite l’intensité aujourd’hui et surveille comment tu te sens.',
        }),
      );
    }
  }

  // Charge seule.
  if (ratio !== null && ratio > settings.load.highMin && !result.some((r) => r.rule === 'overload')) {
    result.push(
      make('load-high', today, 'important', 'load', {
        title: 'Pic de charge',
        finding: `Ta charge des 7 derniers jours est ${fr(ratio, 2)} fois ta moyenne sur 28 jours.`,
        cause: 'Hausse rapide du volume ou de l’intensité : risque de blessure et de fatigue.',
        action: 'Allège les prochaines séances pour revenir sous 1,3.',
      }),
    );
  }
  if (input.dailyLoad && input.loadHistoryDays >= settings.load.calibrationDays + a.underloadDays - 1) {
    let under = true;
    for (let i = 0; i < a.underloadDays && under; i++) {
      const r = loadRatio(input.dailyLoad, addDays(today, -i), settings).ratio;
      under = r !== null && r < settings.load.underMax;
    }
    if (under) {
      result.push(
        make('load-under', today, 'watch', 'load', {
          title: 'Sous-charge',
          finding: `Ta charge est sous ${fr(settings.load.underMax, 1)} fois ta moyenne depuis ${a.underloadDays} jours.`,
          cause: 'Moins de séances ou des séances plus légères que d’habitude : tu perds en forme.',
          action: 'Reprends progressivement : ajoute une séance cette semaine.',
        }),
      );
    }
  }

  // Sommeil court : au moins N nuits sur les M dernières sous le seuil.
  const recent = Array.from({ length: a.sleepWindowNights }, (_, i) => nights.find((n) => n.date === addDays(today, -i)));
  const short = recent.filter((n) => n && n.asleepMinutes < a.sleepShortMinutes).length;
  if (short >= a.sleepShortNights) {
    result.push(
      make('sleep-short', today, 'watch', 'recovery', {
        title: 'Sommeil court',
        finding: `Moins de ${a.sleepShortMinutes / 60} h de sommeil ${short} nuits sur ${a.sleepWindowNights}.`,
        cause: 'Dette de sommeil : ta récupération et ta HRV vont en pâtir.',
        action: 'Avance ton coucher de 30 min ce soir et évite les écrans la dernière heure.',
      }),
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
        make('bedtime-irregular', today, 'watch', 'recovery', {
          title: 'Coucher irrégulier',
          finding: `Ton heure de coucher a varié de ${h} h ${String(m).padStart(2, '0')} cette semaine.`,
          cause: 'Des horaires irréguliers dérèglent ton rythme et la qualité du sommeil.',
          action: 'Choisis une heure de coucher fixe pour les 7 prochains jours, à 30 min près.',
        }),
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
      result.push(
        make('protein-low', today, 'watch', 'nutrition', {
          title: 'Protéines insuffisantes',
          finding: `Sous ta cible de ${target} g ${below} jours sur ${a.proteinWindowDays}.`,
          cause: 'Apport en protéines trop bas pour soutenir la prise de muscle.',
          action: 'Ajoute une source de protéines à chaque repas (œufs, skyr, viande, légumineuses).',
        }),
      );
    }
  }

  // Poids : tendance de la moyenne 7 j sur N semaines.
  const now = averageWeight(input.weights, today, settings);
  const before = averageWeight(input.weights, addDays(today, -7 * a.weightWeeks), settings);
  if (now !== null && before !== null) {
    const perWeek = (now - before) / a.weightWeeks;
    if (perWeek > a.weightGainMaxKgPerWeek || perWeek < -a.weightLossMaxKgPerWeek) {
      const gain = perWeek > 0;
      result.push(
        make('weight-trend', today, 'watch', 'nutrition', {
          title: gain ? 'Prise de poids rapide' : 'Perte de poids rapide',
          finding: `Ton poids moyen ${gain ? 'augmente' : 'baisse'} de ${fr(Math.abs(perWeek), 2)} kg par semaine depuis ${a.weightWeeks} semaines.`,
          cause: gain
            ? 'Surplus calorique trop important : une partie de la prise risque d’être du gras.'
            : 'Déficit calorique trop important : risque de perdre du muscle.',
          action: gain
            ? 'Réduis tes calories d’environ 200 kcal par jour et garde tes protéines.'
            : 'Remonte tes calories d’environ 200 kcal par jour et garde tes protéines.',
        }),
      );
    }
  }

  return result.sort((x, y) => PRIORITY.indexOf(x.rule) - PRIORITY.indexOf(y.rule));
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
    const recent = ctx.history.filter((h) => h.rule === c.rule && h.date > addDays(ctx.today, -a.repeatDays) && h.date <= ctx.today);
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
