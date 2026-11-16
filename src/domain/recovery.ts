// Score de récupération 0-100 (cahier des charges, section 5).
// Somme pondérée de 3 sous-scores : HRV, FC au repos, sommeil.
// La charge d'entraînement s'ajoutera au lot 2.
// Transparence : chaque composante indique si elle fait monter (+),
// baisser (−) ou ne change rien (=) au score.

import type { NightValue } from './nightly';
import { hrvBaseline, restingHrNorm } from './norms';
import { SETTINGS, type Settings } from './settings';
import {
  HRV_NO_MEASURE,
  hrvReason,
  NIGHT_MISSING,
  NORM_NOT_READY,
  RESTING_HR_NO_MEASURE,
  restingHrReason,
  sleepReason,
  type Reason,
} from './texts/today';

export type ComponentKey = 'hrv' | 'restingHr' | 'sleep';
export type Effect = 'up' | 'neutral' | 'down';

export type RecoveryComponent = {
  key: ComponentKey;
  label: string;
  weight: number;
  /** Sous-score 0-100 ; null si non calculable. */
  subScore: number | null;
  effect: Effect | null;
  /** Explication courte, prête à afficher (tuiles, écran détail). */
  explanation: string;
  /** La même raison en phrase (carte « Recommandation du jour », lot 5a.1). */
  sentence: string;
};

export type Recovery = {
  /** Score 0-100 arrondi ; null si une composante manque. */
  score: number | null;
  components: RecoveryComponent[];
  /** Raisons pour lesquelles le score n'a pas pu être calculé, en phrases (sans doublon). */
  missing: string[];
  /** Nuit du jour absente (la carte « Ouvrir Zepp » le dit déjà sur l'accueil). */
  noNight: boolean;
};

const clamp = (v: number) => Math.max(0, Math.min(100, v));

function effectOf(subScore: number, settings: Settings): Effect {
  const diff = subScore - settings.recovery.neutral;
  if (diff > settings.recovery.contributionMargin) return 'up';
  if (diff < -settings.recovery.contributionMargin) return 'down';
  return 'neutral';
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h} h ${String(m).padStart(2, '0')}`;
}

function component(
  key: ComponentKey,
  label: string,
  subScore: number | null,
  reason: Reason,
  settings: Settings,
): RecoveryComponent {
  return {
    key,
    label,
    weight: settings.recovery.weights[key],
    subScore,
    effect: subScore === null ? null : effectOf(subScore, settings),
    explanation: reason.note,
    sentence: reason.sentence,
  };
}

function hrvComponent(night: NightValue | undefined, nights: NightValue[], date: string, s: Settings) {
  const label = 'HRV';
  if (!night) return component('hrv', label, null, NIGHT_MISSING, s);
  if (night.lnRmssd === null) return component('hrv', label, null, HRV_NO_MEASURE, s);
  const baseline = hrvBaseline(nights, date, s);
  if (!baseline) return component('hrv', label, null, NORM_NOT_READY('HRV'), s);
  const z = baseline.sd > 0 ? (night.lnRmssd - baseline.mean) / baseline.sd : 0;
  const sub = clamp(s.recovery.neutral + s.recovery.hrvPointsPerSd * z);
  const where = night.lnRmssd < baseline.low ? 'below' : night.lnRmssd > baseline.high ? 'above' : 'within';
  return component('hrv', label, sub, hrvReason(where), s);
}

function restingHrComponent(night: NightValue | undefined, nights: NightValue[], date: string, s: Settings) {
  const label = 'FC au repos';
  if (!night) return component('restingHr', label, null, NIGHT_MISSING, s);
  if (night.restingHr === null) return component('restingHr', label, null, RESTING_HR_NO_MEASURE, s);
  const norm = restingHrNorm(nights, date, s);
  if (norm.delta === null) return component('restingHr', label, null, NORM_NOT_READY('fréquence cardiaque au repos'), s);
  const sub = clamp(s.recovery.neutral - s.recovery.restingHrPointsPerBpm * norm.delta);
  return component('restingHr', label, sub, restingHrReason(Math.round(norm.delta), s.norms.restingHrBaselineDays), s);
}

function sleepComponent(night: NightValue | undefined, s: Settings) {
  const label = 'Sommeil';
  if (!night) return component('sleep', label, null, NIGHT_MISSING, s);
  const sub = clamp((night.asleepMinutes / s.recovery.sleepTargetMinutes) * 100);
  return component('sleep', label, sub, sleepReason(formatDuration(night.asleepMinutes)), s);
}

/** Score de récupération pour la nuit `date` (date du réveil). */
export function computeRecovery(nights: NightValue[], date: string, settings: Settings = SETTINGS): Recovery {
  const night = nights.find((n) => n.date === date);
  const components = [
    hrvComponent(night, nights, date, settings),
    restingHrComponent(night, nights, date, settings),
    sleepComponent(night, settings),
  ];
  const missing = [...new Set(components.filter((c) => c.subScore === null).map((c) => c.sentence))];
  const score = missing.length
    ? null
    : Math.round(components.reduce((sum, c) => sum + c.weight * (c.subScore as number), 0));
  return { score, components, missing, noNight: !night };
}
