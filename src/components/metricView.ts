// Ce qu'on affiche pour un indicateur (tuile de l'accueil et écran détail) :
// valeur, unité, écart à la norme, ton (favorable / neutre / défavorable), état.

import type { MorningRecap, Metric } from '@/domain/recap';
import { metricValue } from '@/domain/recap';
import { SETTINGS } from '@/domain/settings';
import { TILE } from '@/domain/texts/today';

import { formatDuration } from './format';
import type { Tone } from './MetricTile';
import { colors } from './theme';

export const METRIC_LABEL: Record<Metric, string> = { hrv: 'HRV', restingHr: 'FC au repos', sleep: 'Sommeil' };

export function isMetric(v: unknown): v is Metric {
  return v === 'hrv' || v === 'restingHr' || v === 'sleep';
}

export function formatMetric(metric: Metric, value: number): { value: string; unit?: string } {
  if (metric === 'hrv') return { value: String(Math.round(value)), unit: 'ms' };
  if (metric === 'restingHr') return { value: String(Math.round(value)), unit: 'bpm' };
  return { value: formatDuration(value) };
}

export type MetricView = {
  label: string;
  value: string;
  unit?: string;
  /** Écart à la norme, court (« −4 bpm »). */
  note: string;
  /** Repère de comparaison (« vs moy. 30 j »). */
  context?: string;
  tone: Tone;
  /** Texte et couleur de la pastille d'état (écran détail). */
  status: string;
  statusColor?: string;
};

/** Écart en minutes : « 45 min » sous une heure, sinon « 1 h 15 ». */
function formatGap(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : formatDuration(minutes);
}

/** Écart à la norme (en couleur) et repère de comparaison (en gris). */
function deviation(recap: MorningRecap, metric: Metric, value: number): { note: string; context?: string } {
  if (metric === 'hrv') {
    const b = recap.hrv.baseline;
    if (!b) return { note: '' };
    const ln = Math.log(value);
    const note = ln < b.low ? TILE.belowNorm : ln > b.high ? TILE.aboveNorm : TILE.withinNorm;
    return { note, context: TILE.hrvContext };
  }
  if (metric === 'restingHr') {
    const d = recap.restingHr.delta;
    if (d === null) return { note: '' };
    const r = Math.round(d);
    return { note: r === 0 ? TILE.equalAverage : `${r > 0 ? '+' : '−'}${Math.abs(r)} bpm`, context: TILE.restingHrContext };
  }
  const target = SETTINGS.recovery.sleepTargetMinutes;
  const diff = Math.round(value - target);
  return { note: diff >= 0 ? TILE.sleepReached : `−${formatGap(-diff)}`, context: `obj. ${formatDuration(target)}` };
}

export function metricView(recap: MorningRecap | null, metric: Metric): MetricView {
  const label = METRIC_LABEL[metric];
  const raw = metricValue(recap?.night, metric);
  const component = recap?.recovery.components.find((c) => c.key === metric);

  if (!recap || raw === null) {
    return {
      label,
      value: '—',
      note: component?.explanation ?? TILE.notComputable,
      tone: 'neutral',
      status: TILE.notComputable,
    };
  }
  const shown = formatMetric(metric, raw);
  if (!recap.calibration.done) {
    // Calibration : valeurs brutes, sans jugement.
    return { label, ...shown, note: TILE.calibration, tone: 'neutral', status: 'Calibration', statusColor: colors.info };
  }
  if (!component || component.effect === null) {
    return { label, ...shown, note: component?.explanation ?? '', tone: 'neutral', status: TILE.normUnavailable };
  }
  const gap = deviation(recap, metric, raw);
  // Période en cours (lot 5a) : écart à la norme affiché, mais sans jugement de couleur.
  if (recap.period) return { label, ...shown, ...gap, tone: 'neutral', status: 'En pause' };
  if (component.effect === 'up') return { label, ...shown, ...gap, tone: 'good', status: 'Favorable', statusColor: colors.good };
  if (component.effect === 'down') return { label, ...shown, ...gap, tone: 'bad', status: 'À surveiller', statusColor: colors.mid };
  return { label, ...shown, ...gap, tone: 'neutral', status: 'Dans ta norme' };
}
