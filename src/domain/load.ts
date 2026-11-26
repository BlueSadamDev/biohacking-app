// Charge d'entraînement (cahier des charges, section 5).
// - TRIMP de Banister par séance, à partir de la FC du Helio Strap mesurée pendant la séance :
//   somme sur les mesures de minutes × FCr × a × e^(k × FCr),
//   avec FCr = (FC − FC repos) / (FC max − FC repos), bornée entre 0 et 1,
//   et k selon le sexe (réglage du profil cardiaque).
// - FC repos de référence : moyenne des nuits des 30 derniers jours.
// - Charge aiguë = TRIMP moyen par jour sur 7 jours ; chronique = sur 28 jours ; ratio = aiguë / chronique.

import { addDays, dayKey, daysBetween } from './dates';
import type { NightValue, Sample } from './nightly';
import { mean, nightsBetween } from './norms';
import { SETTINGS, type Settings } from './settings';

export type ExerciseSession = { id: string; start: number; end: number; exerciseType: number; origin: string };

/**
 * Activités et séances (décision du 18 novembre 2026, lot 5b) : une activité est tout ce que le bracelet
 * enregistre ; toutes comptent dans les zones et la charge. Une séance est une activité d'au moins
 * `load.sessionMinMinutes` minutes, ou de la musculation quelle que soit sa durée ; seules les séances
 * comptent dans le nombre de séances de la semaine, les jours d'entraînement des liens et les suggestions.
 */
export function isSession(activity: ExerciseSession, settings: Settings = SETTINGS): boolean {
  return (
    activity.end - activity.start >= settings.load.sessionMinMinutes * 60_000 ||
    settings.strength.sessionTypes.includes(activity.exerciseType)
  );
}

/** Les séances parmi les activités (voir `isSession`). */
export function sessionsOnly(activities: ExerciseSession[], settings: Settings = SETTINGS): ExerciseSession[] {
  return activities.filter((a) => isSession(a, settings));
}

/** Fusion de séances qui se chevauchent (Contrôle des données) : jour et nombre d'activités réunies. */
export type SessionMerge = { id: string; date: string; count: number };

/**
 * Activités qui se chevauchent (lot 5b), fusionnées en une seule avant tout calcul : du premier début à
 * la dernière fin. Elle garde l'identifiant et le type de la plus longue, sauf si l'une est de la
 * musculation : la fusion est alors de la musculation (identifiant de la plus longue séance de musculation,
 * pour garder le lien avec la saisie des séries).
 */
export function mergeOverlappingSessions(
  activities: readonly ExerciseSession[],
  settings: Settings = SETTINGS,
): { sessions: ExerciseSession[]; merges: SessionMerge[] } {
  const sorted = [...activities].sort((a, b) => a.start - b.start);
  const groups: ExerciseSession[][] = [];
  let groupEnd = -Infinity;
  for (const a of sorted) {
    if (groups.length && a.start < groupEnd) {
      groups[groups.length - 1].push(a);
      groupEnd = Math.max(groupEnd, a.end);
    } else {
      groups.push([a]);
      groupEnd = a.end;
    }
  }
  const longest = (list: ExerciseSession[]) => list.reduce((x, y) => (y.end - y.start > x.end - x.start ? y : x));
  const sessions: ExerciseSession[] = [];
  const merges: SessionMerge[] = [];
  for (const group of groups) {
    if (group.length === 1) {
      sessions.push(group[0]);
      continue;
    }
    const strength = group.filter((a) => settings.strength.sessionTypes.includes(a.exerciseType));
    const main = longest(strength.length ? strength : group);
    const merged = {
      ...main,
      start: Math.min(...group.map((a) => a.start)),
      end: Math.max(...group.map((a) => a.end)),
    };
    sessions.push(merged);
    merges.push({ id: merged.id, date: dayKey(merged.start), count: group.length });
  }
  return { sessions, merges };
}

export type SessionLoad = {
  id: string;
  date: string;
  durationMinutes: number;
  exerciseType: number;
  /** Séance (et pas seulement activité), voir `isSession`. */
  isSession: boolean;
  /** TRIMP de l'activité ; null si la FC ou la FC au repos manquent (et pas d'estimation possible). */
  trimp: number | null;
  /** Lot 5b : TRIMP estimé (activité sans FC, d'après les activités du même type). */
  estimated?: boolean;
  reason?: 'no-heart-rate' | 'no-resting-hr';
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Activités sans fréquence cardiaque (lot 5b) : charge estimée = charge médiane par minute des
 * activités mesurées du même type des `estimateWindowDays` derniers jours × durée ; seulement avec au
 * moins `estimateMinReferences` activités de référence. Marquée « estimée ».
 */
export function withEstimatedLoads(loads: SessionLoad[], settings: Settings = SETTINGS): SessionLoad[] {
  const s = settings.load;
  const measured = loads.filter((l) => l.trimp !== null && !l.estimated && l.durationMinutes > 0);
  return loads.map((l) => {
    if (l.trimp !== null || l.reason !== 'no-heart-rate') return l;
    const from = addDays(l.date, -(s.estimateWindowDays - 1));
    const refs = measured.filter((m) => m.exerciseType === l.exerciseType && m.date >= from && m.date <= l.date);
    if (refs.length < s.estimateMinReferences) return l;
    const perMinute = median(refs.map((m) => (m.trimp as number) / m.durationMinutes));
    return { id: l.id, date: l.date, durationMinutes: l.durationMinutes, exerciseType: l.exerciseType, isSession: l.isSession, trimp: perMinute * l.durationMinutes, estimated: true };
  });
}

/** FC au repos de référence pour un jour : moyenne des nuits des N derniers jours (jour compris). */
export function restingHrReference(nights: NightValue[], date: string, settings: Settings = SETTINGS): number | null {
  const values = nightsBetween(nights, addDays(date, -(settings.norms.restingHrBaselineDays - 1)), date)
    .map((n) => n.restingHr)
    .filter((v): v is number => v !== null);
  return values.length >= settings.norms.baselineMinNights ? mean(values) : null;
}

/**
 * TRIMP d'une séance. Chaque mesure compte jusqu'à la suivante (au plus `maxSampleGapSeconds`).
 * Si une partie de la séance n'a pas de mesure, le résultat est ramené à la durée totale.
 * null si moins de `minSamples` mesures ou si moins de `minCoverage` de la séance est couverte.
 */
export function sessionTrimp(
  session: Pick<ExerciseSession, 'start' | 'end'>,
  samples: Sample[],
  hrRest: number,
  hrMax: number,
  k: number,
  settings: Settings = SETTINGS,
): number | null {
  const s = settings.load;
  if (hrMax <= hrRest) return null;
  const points = samples
    .filter((p) => p.time >= session.start && p.time <= session.end)
    .sort((a, b) => a.time - b.time);
  if (points.length < s.minSamples) return null;
  const durationMinutes = (session.end - session.start) / 60000;
  if (durationMinutes <= 0) return null;

  let total = 0;
  let covered = 0;
  points.forEach((p, i) => {
    const next = i + 1 < points.length ? points[i + 1].time : session.end;
    const minutes = Math.min(next - p.time, s.maxSampleGapSeconds * 1000) / 60000;
    const ratio = Math.max(0, Math.min(1, (p.value - hrRest) / (hrMax - hrRest)));
    total += minutes * ratio * s.trimpA * Math.exp(k * ratio);
    covered += minutes;
  });
  if (covered < s.minCoverage * durationMinutes) return null;
  return total * (durationMinutes / covered);
}

/** TRIMP de chaque séance (FC repos de référence du jour de la séance). */
export function sessionLoads(
  sessions: ExerciseSession[],
  samples: Sample[],
  nights: NightValue[],
  hrMax: number,
  k: number,
  settings: Settings = SETTINGS,
): SessionLoad[] {
  const measured = sessions.map((session): SessionLoad => {
    const base = {
      id: session.id,
      date: dayKey(session.start),
      durationMinutes: (session.end - session.start) / 60000,
      exerciseType: session.exerciseType,
      isSession: isSession(session, settings),
    };
    const hrRest = restingHrReference(nights, base.date, settings);
    if (hrRest === null) return { ...base, trimp: null, reason: 'no-resting-hr' };
    const trimp = sessionTrimp(session, samples, hrRest, hrMax, k, settings);
    return trimp === null ? { ...base, trimp: null, reason: 'no-heart-rate' } : { ...base, trimp };
  });
  return withEstimatedLoads(measured, settings);
}

/** TRIMP total par jour (les séances sans TRIMP ne comptent pas). */
export function dailyLoads(loads: SessionLoad[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const l of loads) {
    if (l.trimp === null) continue;
    result.set(l.date, (result.get(l.date) ?? 0) + l.trimp);
  }
  return result;
}

function averagePerDay(daily: Map<string, number>, date: string, days: number): number {
  let sum = 0;
  for (let i = 0; i < days; i++) sum += daily.get(addDays(date, -i)) ?? 0;
  return sum / days;
}

export type LoadRatio = { acute: number; chronic: number; ratio: number | null };

/**
 * Ancien calcul (jusqu'au lot 5a) : moyennes simples sur 7 et 28 jours (la semaine est incluse dans les
 * 28 jours). Gardé pour la comparaison affichée dans Contrôle des données.
 */
export function simpleLoadRatio(daily: Map<string, number>, date: string, settings: Settings = SETTINGS): LoadRatio {
  const acute = averagePerDay(daily, date, settings.load.acuteDays);
  const chronic = averagePerDay(daily, date, settings.load.chronicDays);
  return { acute, chronic, ratio: chronic > 0 ? acute / chronic : null };
}

/**
 * Charge aiguë et chronique en moyennes exponentielles sur 7 et 28 jours (lot 5b) : chaque jour pèse
 * d'autant moins qu'il est ancien (coefficient 2 / (N + 1)). Le calcul part du début de l'historique
 * (`historyStart`), au plus `chronicDays + ewmaWarmupDays` jours en arrière, en partant de la moyenne
 * simple des premiers `chronicDays` jours. Ratio null si la charge chronique est nulle.
 */
export function loadRatio(
  daily: Map<string, number>,
  date: string,
  settings: Settings = SETTINGS,
  historyStart: string | null = null,
): LoadRatio {
  const s = settings.load;
  const earliest = addDays(date, -(s.chronicDays + s.ewmaWarmupDays - 1));
  const start = historyStart && historyStart > earliest ? historyStart : earliest;
  if (start > date) return { acute: 0, chronic: 0, ratio: null };
  const seedDays = Math.min(s.chronicDays, daysBetween(start, date) + 1);
  let seed = 0;
  for (let i = 0; i < seedDays; i++) seed += daily.get(addDays(start, i)) ?? 0;
  seed /= seedDays;
  const la = 2 / (s.acuteDays + 1);
  const lc = 2 / (s.chronicDays + 1);
  let acute = seed;
  let chronic = seed;
  for (let day = start; day <= date; day = addDays(day, 1)) {
    const x = daily.get(day) ?? 0;
    acute += la * (x - acute);
    chronic += lc * (x - chronic);
  }
  return { acute, chronic, ratio: chronic > 0 ? acute / chronic : null };
}

export type LoadStatus = 'under' | 'balanced' | 'rising' | 'high';

export function loadStatus(ratio: number, settings: Settings = SETTINGS): LoadStatus {
  if (ratio > settings.load.highMin) return 'high';
  if (ratio > settings.load.balancedMax) return 'rising';
  if (ratio < settings.load.underMax) return 'under';
  return 'balanced';
}

export type LoadSummary =
  | { state: 'profile-missing'; missing: ('sex' | 'hrMax')[] }
  | { state: 'calibrating'; days: number; required: number }
  | { state: 'no-load'; sessions7d: number; sessionsWithoutHr: number }
  /** Trop de minutes d'activité sans fréquence cardiaque sur 28 jours : la charge serait faussée. */
  | { state: 'unreliable'; unmeasured: number; total: number }
  | {
      state: 'ok';
      acute: number;
      chronic: number;
      ratio: number;
      status: LoadStatus;
      sessions7d: number;
      /** Séances des 7 derniers jours sans TRIMP (FC ou FC au repos manquante, pas d'estimation). */
      sessionsWithoutHr: number;
      /** Lot 5b : activités des 7 derniers jours dont la charge est estimée. */
      estimated7d: number;
    };

export type LoadInputs = {
  sessions: ExerciseSession[];
  /** Mesures de FC prises pendant les séances. */
  samples: Sample[];
  nights: NightValue[];
  /** FC max retenue (saisie ou estimée) ; null si inconnue. */
  hrMax: number | null;
  /** Coefficient k du TRIMP ; null tant que le sexe n'est pas renseigné. */
  coefficient: number | null;
  /** Premier jour où l'app a des données (début de l'historique). */
  historyStart: string | null;
  today: string;
};

/**
 * Minutes d'activité des `chronicDays` derniers jours, et combien n'ont pas de charge (FC manquante).
 * Lot 5b : compté en minutes, toutes activités ; une charge estimée compte comme mesurée.
 */
export function unmeasuredMinutes(
  loads: SessionLoad[],
  today: string,
  settings: Settings = SETTINGS,
): { unmeasured: number; total: number } {
  const start = addDays(today, -(settings.load.chronicDays - 1));
  const recent = loads.filter((l) => l.date >= start && l.date <= today);
  const minutes = (list: SessionLoad[]) => Math.round(list.reduce((sum, l) => sum + l.durationMinutes, 0));
  return { unmeasured: minutes(recent.filter((l) => l.trimp === null)), total: minutes(recent) };
}

/** Charge non fiable : plus de `maxUnmeasuredShare` des minutes d'activité sans fréquence cardiaque. */
export function isUnreliable(m: { unmeasured: number; total: number }, settings: Settings = SETTINGS): boolean {
  return m.total > 0 && m.unmeasured / m.total > settings.load.maxUnmeasuredShare;
}

/** Résumé de la charge du jour, ou la raison pour laquelle il ne peut pas être calculé. */
export function buildLoadSummary(input: LoadInputs, settings: Settings = SETTINGS): LoadSummary {
  const missing: ('sex' | 'hrMax')[] = [];
  if (input.coefficient === null) missing.push('sex');
  if (input.hrMax === null) missing.push('hrMax');
  if (input.coefficient === null || input.hrMax === null) return { state: 'profile-missing', missing };

  const required = settings.load.calibrationDays;
  const days = input.historyStart === null ? 0 : daysBetween(input.historyStart, input.today) + 1;
  if (days < required) return { state: 'calibrating', days: Math.max(0, days), required };

  const loads = sessionLoads(input.sessions, input.samples, input.nights, input.hrMax, input.coefficient, settings);
  const weekStart = addDays(input.today, -(settings.load.acuteDays - 1));
  const week = loads.filter((l) => l.date >= weekStart && l.date <= input.today);
  const sessions7d = week.filter((l) => l.isSession).length;
  const sessionsWithoutHr = week.filter((l) => l.isSession && l.trimp === null).length;
  const estimated7d = week.filter((l) => l.estimated).length;

  // Trop de minutes d'activité sans fréquence cardiaque : la charge serait faussée (aucune valeur affichée).
  const measure = unmeasuredMinutes(loads, input.today, settings);
  if (isUnreliable(measure, settings)) return { state: 'unreliable', ...measure };

  const { acute, chronic, ratio } = loadRatio(dailyLoads(loads), input.today, settings, input.historyStart);
  if (ratio === null) return { state: 'no-load', sessions7d, sessionsWithoutHr };
  return { state: 'ok', acute, chronic, ratio, status: loadStatus(ratio, settings), sessions7d, sessionsWithoutHr, estimated7d };
}

/**
 * Séances à relire dans Health Connect (rattrapage de la FC) : séances comptées, terminées depuis
 * `sinceMs`, sans aucune mesure de FC dans la base ; les plus récentes d'abord, au plus `max`.
 * Lot 5b : une séance déjà relue `maxAttempts` fois sans succès n'est plus relue (`attempts` : essais
 * déjà faits par séance).
 */
export function heartRateBackfillTargets(
  sessions: ExerciseSession[],
  samplesBySession: Map<string, number>,
  sinceMs: number,
  max: number,
  settings: Settings = SETTINGS,
  attempts: ReadonlyMap<string, number> = new Map(),
  maxAttempts: number = settings.sync.heartRateBackfillMaxAttempts,
): ExerciseSession[] {
  return sessions
    .filter((s) => s.end >= sinceMs && (samplesBySession.get(s.id) ?? 0) === 0)
    .filter((s) => (attempts.get(s.id) ?? 0) < maxAttempts)
    .sort((a, b) => b.start - a.start)
    .slice(0, max);
}

// ---------------------------------------------------------------------------
// Contrôle des séances (écran « Contrôle des données ») : ce que le calcul de charge fait de chaque
// séance, sans rien changer au calcul. Les points viennent de `sessionLoads` (mêmes règles).
// ---------------------------------------------------------------------------

/** Mesures de FC d'une séance et part de sa durée qu'elles couvrent (même règle que `sessionTrimp`). */
export function heartRateCoverage(
  session: Pick<ExerciseSession, 'start' | 'end'>,
  samples: Sample[],
  settings: Settings = SETTINGS,
): { count: number; coverage: number } {
  const points = samples
    .filter((p) => p.time >= session.start && p.time <= session.end)
    .sort((a, b) => a.time - b.time);
  const durationMs = session.end - session.start;
  if (points.length === 0 || durationMs <= 0) return { count: points.length, coverage: 0 };
  let covered = 0;
  points.forEach((p, i) => {
    const next = i + 1 < points.length ? points[i + 1].time : session.end;
    covered += Math.min(next - p.time, settings.load.maxSampleGapSeconds * 1000);
  });
  return { count: points.length, coverage: Math.min(1, covered / durationMs) };
}

export type SessionCheck = {
  id: string;
  start: number;
  date: string;
  exerciseType: number;
  durationMinutes: number;
  /** Mesures de FC pendant la séance et part de la durée couverte (0 à 1). */
  samples: number;
  coverage: number;
  /** Séance (au moins 45 min ou musculation) ou simple activité. */
  isSession: boolean;
  /** Points comptés dans la charge ; null si l'activité n'a pas de charge. */
  trimp: number | null;
  /** Lot 5b : points estimés (pas de FC, d'après les activités du même type). */
  estimated: boolean;
  /** Pourquoi l'activité n'a pas de charge (null si elle en a une). */
  reason: 'no-heart-rate' | 'no-resting-hr' | null;
};

/**
 * Chaque activité de la période, de la plus récente à la plus ancienne : ses points de charge (mesurés
 * ou estimés), ou pourquoi elle n'en a pas (fréquence cardiaque insuffisante, pas de FC au repos).
 */
export function sessionChecks(
  sessions: ExerciseSession[],
  samples: Sample[],
  nights: NightValue[],
  hrMax: number,
  k: number,
  settings: Settings = SETTINGS,
): SessionCheck[] {
  const loads = new Map(sessionLoads(sessions, samples, nights, hrMax, k, settings).map((l) => [l.id, l]));
  return [...sessions]
    .sort((a, b) => b.start - a.start)
    .map((s) => {
      const { count, coverage } = heartRateCoverage(s, samples, settings);
      const load = loads.get(s.id);
      return {
        id: s.id,
        start: s.start,
        date: dayKey(s.start),
        exerciseType: s.exerciseType,
        durationMinutes: (s.end - s.start) / 60000,
        samples: count,
        coverage,
        isSession: isSession(s, settings),
        trimp: load?.trimp ?? null,
        estimated: load?.estimated ?? false,
        reason: !load || load.trimp === null ? (load?.reason ?? 'no-heart-rate') : null,
      };
    });
}
