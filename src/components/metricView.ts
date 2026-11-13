// Ce qu'on affiche pour un indicateur (tuile de l'accueil et écran détail) :
// valeur, unité, écart à la norme, ton (favorable / neutre / défavorable), état.

import type { MorningRecap, Metric } from '@/domain/recap';
import { metricValue } from '@/domain/recap';
import { SETTINGS } from '@/domain/settings';

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
  /** Écart à la norme, court. */
  note: string;
  tone: Tone;
  /** Texte et couleur de la pastille d'état (écran détail). */
  status: string;
  statusColor?: string;
};

function deviationNote(recap: MorningRecap, metric: Metric, value: number): string {
  if (metric === 'hrv') {
    const b = recap.hrv.baseline;
    const ln = Math.log(value);
    if (!b) return '';
    return ln < b.low ? 'Sous ta plage' : ln > b.high ? 'Au-dessus de ta plage' : 'Dans ta plage';
  }
  if (metric === 'restingHr') {
    const d = recap.restingHr.delta;
    if (d === null) return '';
    const r = Math.round(d);
    return r === 0 ? '= moyenne 30 j' : `${r > 0 ? '+' : '−'}${Math.abs(r)} bpm vs 30 j`;
  }
  const diff = Math.round(value - SETTINGS.recovery.sleepTargetMinutes);
  return diff >= 0 ? 'Objectif atteint' : `−${formatDuration(-diff)} vs objectif`;
}

export function metricView(recap: MorningRecap | null, metric: Metric): MetricView {
  const label = METRIC_LABEL[metric];
  const raw = metricValue(recap?.night, metric);
  const component = recap?.recovery.components.find((c) => c.key === metric);

  if (!recap || raw === null) {
    return {
      label,
      value: '—',
      note: component?.explanation ?? 'Non calculable',
      tone: 'neutral',
      status: 'Non calculable',
    };
  }
  const shown = formatMetric(metric, raw);
  if (!recap.calibration.done) {
    // Calibration : valeurs brutes, sans jugement.
    return { label, ...shown, note: 'Calibration en cours', tone: 'neutral', status: 'Calibration', statusColor: colors.info };
  }
  if (!component || component.effect === null) {
    return { label, ...shown, note: component?.explanation ?? '', tone: 'neutral', status: 'Norme indisponible' };
  }
  const note = deviationNote(recap, metric, raw);
  if (component.effect === 'up') return { label, ...shown, note, tone: 'good', status: 'Favorable', statusColor: colors.good };
  if (component.effect === 'down') return { label, ...shown, note, tone: 'bad', status: 'À surveiller', statusColor: colors.mid };
  return { label, ...shown, note, tone: 'neutral', status: 'Dans ta norme' };
}
