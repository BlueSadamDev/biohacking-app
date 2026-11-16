// Couleur d'état et recommandation du jour, à partir du score de récupération.
// Textes en français, tutoiement, jamais de vocabulaire médical.

import type { Calibration } from './calibration';
import type { PeriodType } from './periods';
import type { Recovery } from './recovery';
import { SETTINGS, type Settings } from './settings';

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
  /** Phrase d'action (carte « Recommandation du jour »). */
  action: string;
  /** Justification courte. */
  reason: string;
};

const ACTIONS: Record<Exclude<Zone, 'neutral' | 'paused'>, { status: string; action: string }> = {
  good: { status: 'Bonne récupération', action: 'Séance lourde OK' },
  mid: { status: 'Récupération moyenne', action: 'Séance modérée ou technique' },
  low: { status: 'Récupération faible', action: 'Journée légère : mobilité ou marche' },
};

/** Chaque raison devient une phrase : « HRV basse. FC au repos haute. » */
function joinReasons(parts: string[]): string {
  return parts.map((p) => `${p}.`).join(' ');
}

/**
 * Pendant une période (lot 5a) : pas de recommandation chiffrée ni de couleur d'état,
 * une phrase propre au type (settings.periods.advice).
 */
export function pausedRecommendation(type: PeriodType, settings: Settings = SETTINGS): Recommendation {
  return {
    zone: 'paused',
    status: 'En pause',
    action: settings.periods.advice[type],
    reason: 'Tes normes et tes alertes sont en pause.',
  };
}

export function recommend(recovery: Recovery, calibration: Calibration, settings: Settings = SETTINGS): Recommendation {
  if (recovery.score === null) {
    return {
      zone: 'neutral',
      status: 'Récap incomplet',
      action: 'Synchronise ta nuit pour obtenir ton récap',
      reason: joinReasons(recovery.missing),
    };
  }
  if (!calibration.done) {
    return {
      zone: 'neutral',
      status: calibration.label,
      action: 'Écoute tes sensations aujourd’hui',
      reason: 'Ta norme personnelle se construit : les valeurs sont affichées sans jugement.',
    };
  }
  const zone = zoneOf(recovery.score, settings);
  // Justification : ce qui fait baisser le score en priorité, sinon ce qui le fait monter.
  const down = recovery.components.filter((c) => c.effect === 'down');
  const up = recovery.components.filter((c) => c.effect === 'up');
  const shown = zone === 'good' ? (up.length ? up : down) : down.length ? down : up;
  return {
    zone,
    ...ACTIONS[zone],
    reason: joinReasons(shown.map((c) => c.explanation)) || 'Toutes tes valeurs sont dans ta norme.',
  };
}
