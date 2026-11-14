// Composition corporelle (lot 3, cahier des charges section 4 F3). Calcul pur.
// - Poids lissé : moyenne des pesées des 7 derniers jours, jour par jour.
// - Tendance : pente de la droite qui suit au mieux le poids lissé sur 28 jours, en kg par semaine.
// - Comparaison à la cible de poids (Réglages).
// - Phrase d'interprétation : première règle de settings.ts qui correspond à
//   (tendance du poids, tendance de la force, protéines). Jamais de vocabulaire médical.

import type { DailyWeight } from './daily';
import { addDays } from './dates';
import type { DayNutrition } from './nutrition';
import { averageWeight, proteinTargetGrams } from './profile';
import type { ChartData } from './recap';
import { SETTINGS, type BodyRule, type Settings } from './settings';
import type { ExerciseProgress } from './strength';

export type WeightTrend = 'loss' | 'stable' | 'slow-gain' | 'fast-gain';
export type StrengthDirection = 'up' | 'flat' | 'down';
export type ProteinStatus = 'reached' | 'below';

/** Poids lissé (moyenne 7 j) de chacun des `days` derniers jours, du plus ancien à aujourd'hui. */
export function smoothedWeights(
  weights: Map<string, DailyWeight>,
  today: string,
  days: number,
  settings: Settings = SETTINGS,
): { date: string; value: number | null }[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, -(days - 1 - i));
    return { date, value: averageWeight(weights, date, settings) };
  });
}

/** Pente (unité par pas de x) de la droite des moindres carrés ; null avec moins de 2 points distincts. */
export function slope(points: { x: number; y: number }[]): number | null {
  if (points.length < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const my = points.reduce((s, p) => s + p.y, 0) / points.length;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

/** Tendance du poids en kg par semaine sur 28 jours ; null s'il n'y a pas assez de pesées. */
export function weightTrendPerWeek(weights: Map<string, DailyWeight>, today: string, settings: Settings = SETTINGS): number | null {
  const b = settings.bodyComposition;
  let weighings = 0;
  for (let i = 0; i < b.trendDays; i++) if (weights.has(addDays(today, -i))) weighings++;
  if (weighings < b.trendMinWeighings) return null;
  const points = smoothedWeights(weights, today, b.trendDays, settings)
    .map((p, i) => (p.value === null ? null : { x: i, y: p.value }))
    .filter((p): p is { x: number; y: number } => p !== null);
  const perDay = slope(points);
  return perDay === null ? null : perDay * 7;
}

export function classifyWeightTrend(kgPerWeek: number, settings: Settings = SETTINGS): WeightTrend {
  const b = settings.bodyComposition;
  if (kgPerWeek < -b.stableKgPerWeek) return 'loss';
  if (kgPerWeek <= b.stableKgPerWeek) return 'stable';
  return kgPerWeek > b.fastGainKgPerWeek ? 'fast-gain' : 'slow-gain';
}

/**
 * Tendance globale de la force (3 exercices) : 'up' si au moins un exercice monte et aucun ne baisse,
 * 'down' si au moins un baisse et aucun ne monte, sinon 'flat'. null si aucun exercice n'a assez de saisies.
 */
export function strengthDirection(progress: ExerciseProgress[]): StrengthDirection | null {
  const known = progress.filter((p) => p.trend !== 'insufficient');
  if (known.length === 0) return null;
  const up = known.some((p) => p.trend === 'rising');
  const down = known.some((p) => p.trend === 'falling');
  if (up && !down) return 'up';
  if (down && !up) return 'down';
  return 'flat';
}

/** Protéines des 28 derniers jours complets (avec repas) : moyenne ≥ 90 % de la cible = 'reached'. null si pas assez de jours. */
export function proteinStatus(
  nutrition: Map<string, DayNutrition>,
  weights: Map<string, DailyWeight>,
  proteinGPerKg: number,
  today: string,
  settings: Settings = SETTINGS,
): ProteinStatus | null {
  const b = settings.bodyComposition;
  const target = proteinTargetGrams(proteinGPerKg, averageWeight(weights, today, settings));
  if (target === null || target <= 0) return null;
  const values: number[] = [];
  for (let i = 1; i <= b.proteinDays; i++) {
    const day = nutrition.get(addDays(today, -i));
    if (day && day.proteinG !== null) values.push(day.proteinG);
  }
  if (values.length < b.proteinMinDays) return null;
  const mean = values.reduce((a, c) => a + c, 0) / values.length;
  return mean >= settings.nutrition.reachedFraction * target ? 'reached' : 'below';
}

/** Première règle de settings.ts qui correspond ; null si aucune. */
export function interpret(
  weight: WeightTrend,
  strength: StrengthDirection | null,
  protein: ProteinStatus | null,
  settings: Settings = SETTINGS,
): BodyRule | null {
  const ok = <T,>(allowed: readonly T[] | undefined, value: T | null) => allowed === undefined || (value !== null && allowed.includes(value));
  return settings.bodyComposition.rules.find((r) => ok(r.weight, weight) && ok(r.strength, strength) && ok(r.protein, protein)) ?? null;
}

/** Graphique du détail « Poids » : une barre par pesée retenue (saisie, sinon Zepp), cible en pointillé. */
export function weightChartData(weights: Map<string, DailyWeight>, today: string, days: number, targetKg: number | null): ChartData {
  return {
    points: Array.from({ length: days }, (_, i) => {
      const date = addDays(today, -(days - 1 - i));
      return { date, value: weights.get(date)?.kg ?? null, unfavorable: false };
    }),
    band: null,
    reference: targetKg,
    referenceLabel: targetKg === null ? null : 'Cible',
  };
}

export type BodyComposition = {
  /** Poids moyen 7 j ; null sans pesée récente. */
  average7d: number | null;
  /** Tendance en kg par semaine ; null s'il n'y a pas assez de pesées. */
  trendKgPerWeek: number | null;
  trend: WeightTrend | null;
  /** Pesées sur la période de tendance (pour « n / 14 »). */
  weighings: number;
  targetKg: number | null;
  /** Poids moyen − cible (kg) ; null sans cible ou sans poids. */
  gapToTarget: number | null;
  targetReached: boolean | null;
  strength: StrengthDirection | null;
  protein: ProteinStatus | null;
  /** Phrase d'interprétation (ou explication s'il manque des données). */
  sentence: string;
  tone: BodyRule['tone'];
  curve: { date: string; value: number | null }[];
};

export type BodyInputs = {
  weights: Map<string, DailyWeight>;
  nutrition: Map<string, DayNutrition>;
  strength: ExerciseProgress[];
  proteinGPerKg: number;
  targetWeightKg: number | null;
  today: string;
};

export function bodyComposition(input: BodyInputs, settings: Settings = SETTINGS): BodyComposition {
  const b = settings.bodyComposition;
  const { weights, today } = input;
  const average7d = averageWeight(weights, today, settings);
  const trendKgPerWeek = weightTrendPerWeek(weights, today, settings);
  const trend = trendKgPerWeek === null ? null : classifyWeightTrend(trendKgPerWeek, settings);
  let weighings = 0;
  for (let i = 0; i < b.trendDays; i++) if (weights.has(addDays(today, -i))) weighings++;
  const gapToTarget = input.targetWeightKg === null || average7d === null ? null : average7d - input.targetWeightKg;
  const strength = strengthDirection(input.strength);
  const protein = proteinStatus(input.nutrition, weights, input.proteinGPerKg, today, settings);

  let sentence: string;
  let tone: BodyRule['tone'] = 'neutral';
  if (trend === null) {
    sentence = `Pas encore assez de pesées pour interpréter ta tendance (${weighings} / ${b.trendMinWeighings} sur ${b.trendDays} jours).`;
  } else {
    const rule = interpret(trend, strength, protein, settings);
    sentence = rule?.text ?? 'Pas assez de données pour interpréter ta tendance.';
    tone = rule?.tone ?? 'neutral';
  }

  return {
    average7d,
    trendKgPerWeek,
    trend,
    weighings,
    targetKg: input.targetWeightKg,
    gapToTarget,
    targetReached: gapToTarget === null ? null : Math.abs(gapToTarget) <= b.targetToleranceKg,
    strength,
    protein,
    sentence,
    tone,
    curve: smoothedWeights(weights, today, b.chartDays, settings),
  };
}
