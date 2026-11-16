// Couleur d'état et recommandation du jour, à partir du score de récupération.
// Textes en français, tutoiement, jamais de vocabulaire médical.

import type { Calibration } from './calibration';
import type { PeriodType } from './periods';
import type { Recovery } from './recovery';
import { SETTINGS, type Settings } from './settings';
import { RECOMMENDATION } from './texts/today';

/**
 * 'good' = vert, 'mid' = ambre, 'low' = corail, 'neutral' = sans couleur (calibration ou donnée manquante),
 * 'paused' = période en cours (lot 5a) : gris, sans jugement de couleur.
 */
export type Zone = 'good' | 'mid' | 'low' | 'neutral' | 'paused';

export function zoneOf(score: number, settings: Settings = SETTINGS): Exclude<Zone, 'neutral' | 'paused'> {
  if (score >= settings.zones.goodMin) return 'good';
  if (score <= settings.zones.lowMax) return 'low';
  return 'mid';
}

export type Recommendation = {
  zone: Zone;
  /** Texte de la pastille sous l'anneau. */
  status: string;
  /** Phrase d'action, dernière ligne de la carte (relief balisé par astérisques, lot 5a.1). */
  action: string;
  /** Pourquoi, en phrases, affiché avant l'action ('' si rien à dire). */
  reason: string;
};

const ACTIONS: Record<Exclude<Zone, 'neutral' | 'paused'>, { status: string; action: string }> = {
  good: RECOMMENDATION.good,
  mid: RECOMMENDATION.mid,
  low: RECOMMENDATION.low,
};

/**
 * Pendant une période (lot 5a) : pas de recommandation chiffrée ni de couleur d'état,
 * une phrase propre au type (settings.periods.advice).
 */
export function pausedRecommendation(type: PeriodType, settings: Settings = SETTINGS): Recommendation {
  return {
    zone: 'paused',
    status: RECOMMENDATION.paused.status,
    action: settings.periods.advice[type],
    reason: RECOMMENDATION.paused.reason,
  };
}

export function recommend(recovery: Recovery, calibration: Calibration, settings: Settings = SETTINGS): Recommendation {
  if (recovery.score === null) {
    // Nuit absente : la carte « Ouvrir Zepp » le dit déjà, la recommandation ne le répète pas.
    if (recovery.noNight) return { zone: 'neutral', ...RECOMMENDATION.noNight, reason: '' };
    return { zone: 'neutral', ...RECOMMENDATION.incomplete, reason: recovery.missing.join(' ') };
  }
  if (!calibration.done) {
    // L'anneau affiche déjà « n / 28 » : la pastille ne le répète pas.
    return { zone: 'neutral', ...RECOMMENDATION.calibration };
  }
  const zone = zoneOf(recovery.score, settings);
  // Justification : ce qui fait baisser le score en priorité, sinon ce qui le fait monter.
  const down = recovery.components.filter((c) => c.effect === 'down');
  const up = recovery.components.filter((c) => c.effect === 'up');
  const shown = zone === 'good' ? (up.length ? up : down) : down.length ? down : up;
  return {
    zone,
    ...ACTIONS[zone],
    reason: shown.map((c) => c.sentence).join(' ') || RECOMMENDATION.allInNorm,
  };
}
