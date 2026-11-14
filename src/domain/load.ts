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

export type SessionLoad = {
  id: string;
  date: string;
  durationMinutes: number;
  /** TRIMP de la séance ; null si la FC ou la FC au repos manquent. */
  trimp: number | null;
  reason?: 'no-heart-rate' | 'no-resting-hr';
};

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
  return sessions.map((session) => {
    const date = dayKey(session.start);
    const durationMinutes = (session.end - session.start) / 60000;
    const hrRest = restingHrReference(nights, date, settings);
    if (hrRest === null) return { id: session.id, date, durationMinutes, trimp: null, reason: 'no-resting-hr' };
    const trimp = sessionTrimp(session, samples, hrRest, hrMax, k, settings);
    return trimp === null
      ? { id: session.id, date, durationMinutes, trimp: null, reason: 'no-heart-rate' }
      : { id: session.id, date, durationMinutes, trimp };
  });
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

/** Charge aiguë (7 j), chronique (28 j) et ratio pour un jour. Ratio null si la charge chronique est nulle. */
export function loadRatio(daily: Map<string, number>, date: string, settings: Settings = SETTINGS): LoadRatio {
  const acute = averagePerDay(daily, date, settings.load.acuteDays);
  const chronic = averagePerDay(daily, date, settings.load.chronicDays);
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
  | {
      state: 'ok';
      acute: number;
      chronic: number;
      ratio: number;
      status: LoadStatus;
      sessions7d: number;
      /** Séances des 7 derniers jours sans TRIMP (FC ou FC au repos manquante). */
      sessionsWithoutHr: number;
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
  const sessions7d = week.length;
  const sessionsWithoutHr = week.filter((l) => l.trimp === null).length;

  const { acute, chronic, ratio } = loadRatio(dailyLoads(loads), input.today, settings);
  if (ratio === null) return { state: 'no-load', sessions7d, sessionsWithoutHr };
  return { state: 'ok', acute, chronic, ratio, status: loadStatus(ratio, settings), sessions7d, sessionsWithoutHr };
}
