// Tests de la composition corporelle (tendance du poids, interprétation), sur données fictives.

import {
  bodyComposition,
  classifyWeightTrend,
  interpret,
  proteinStatus,
  slope,
  strengthDirection,
  weightChartData,
  weightTrendPerWeek,
  type BodyInputs,
} from './bodyComposition';
import type { DailyWeight } from './daily';
import { addDays } from './dates';
import type { DayNutrition } from './nutrition';
import type { ExerciseProgress, StrengthTrend } from './strength';

const TODAY = '2026-11-12';

/** Pesée fictive chaque jour pendant `days` jours : poids = start + perWeek × semaines écoulées. */
function dailyWeights(days: number, start: number, perWeek: number, every = 1): Map<string, DailyWeight> {
  const map = new Map<string, DailyWeight>();
  for (let i = 0; i < days; i += every) {
    const date = addDays(TODAY, -(days - 1 - i));
    map.set(date, { date, kg: start + (perWeek * i) / 7, source: 'manual', origin: 'saisie' });
  }
  return map;
}

/** Protéines fictives : `grams` chaque jour pendant 28 jours. */
function proteinDays(grams: number, days = 28): Map<string, DayNutrition> {
  const map = new Map<string, DayNutrition>();
  for (let i = 1; i <= days; i++) {
    const date = addDays(TODAY, -i);
    map.set(date, { date, energyKcal: null, proteinG: grams, carbsG: null, fatG: null, meals: 3, origins: ['exemple'] });
  }
  return map;
}

const progress = (...trends: StrengthTrend[]): ExerciseProgress[] =>
  trends.map((trend, i) => ({ exercise: (['squat', 'bench', 'deadlift'] as const)[i], current: 100, trend, weekly: [] }));

describe('tendance du poids', () => {
  it('calcule une pente simple', () => {
    expect(slope([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }])).toBeCloseTo(2);
    expect(slope([{ x: 0, y: 1 }])).toBeNull();
  });

  it('retrouve la vitesse de prise en kg par semaine sur 28 jours', () => {
    expect(weightTrendPerWeek(dailyWeights(40, 78, 0.25), TODAY)).toBeCloseTo(0.25, 2);
    expect(weightTrendPerWeek(dailyWeights(40, 80, -0.5), TODAY)).toBeCloseTo(-0.5, 2);
  });

  it("n'invente pas de tendance sans assez de pesées (moins de 14 sur 28 jours)", () => {
    expect(weightTrendPerWeek(dailyWeights(28, 78, 0.25, 3), TODAY)).toBeNull(); // 10 pesées
  });

  it('classe la tendance (perte, stable, prise lente, prise rapide)', () => {
    expect(classifyWeightTrend(-0.3)).toBe('loss');
    expect(classifyWeightTrend(0.05)).toBe('stable');
    expect(classifyWeightTrend(0.25)).toBe('slow-gain');
    expect(classifyWeightTrend(0.5)).toBe('fast-gain');
  });
});

describe('force et protéines', () => {
  it('résume la force des 3 exercices', () => {
    expect(strengthDirection(progress('rising', 'steady', 'stagnant'))).toBe('up');
    expect(strengthDirection(progress('falling', 'steady', 'insufficient'))).toBe('down');
    expect(strengthDirection(progress('rising', 'falling', 'steady'))).toBe('flat');
    expect(strengthDirection(progress('insufficient', 'insufficient', 'insufficient'))).toBeNull();
  });

  it('compare la moyenne de protéines à 90 % de la cible', () => {
    const weights = dailyWeights(10, 80, 0); // 80 kg → cible 1,8 g/kg = 144 g, seuil 129,6 g
    expect(proteinStatus(proteinDays(135), weights, 1.8, TODAY)).toBe('reached');
    expect(proteinStatus(proteinDays(120), weights, 1.8, TODAY)).toBe('below');
    expect(proteinStatus(proteinDays(150, 5), weights, 1.8, TODAY)).toBeNull(); // trop peu de jours
  });
});

describe('interprétation', () => {
  it('prise lente + force en hausse + protéines atteintes = profil de prise de muscle', () => {
    expect(interpret('slow-gain', 'up', 'reached')?.text).toMatch(/^Profil de prise de muscle/);
  });
  it('prise rapide + force stable = surveille les calories', () => {
    expect(interpret('fast-gain', 'flat', 'reached')?.text).toBe('Prise plus rapide que ta force : surveille les calories.');
  });
  it('prise lente sans protéines suffisantes : conseil sur les protéines', () => {
    expect(interpret('slow-gain', 'up', 'below')?.text).toMatch(/protéines/);
  });
  it('force inconnue : phrase générique selon le poids', () => {
    expect(interpret('stable', null, null)?.text).toMatch(/^Poids stable : saisis tes séances/);
  });
  it("n'emploie aucun vocabulaire médical", () => {
    const words = /diagnost|maladie|patholog|médic|obésit|trouble/i;
    for (const w of ['loss', 'stable', 'slow-gain', 'fast-gain'] as const)
      for (const s of ['up', 'flat', 'down', null] as const)
        for (const p of ['reached', 'below', null] as const) expect(interpret(w, s, p)?.text ?? '').not.toMatch(words);
  });
});

describe('weightChartData', () => {
  it('place une barre par pesée et la cible en repère', () => {
    const data = weightChartData(dailyWeights(11, 80, 0, 2), TODAY, 7, 82); // une pesée tous les 2 jours, aujourd'hui compris
    expect(data.points).toHaveLength(7);
    expect(data.points[6]).toEqual({ date: TODAY, value: 80, unfavorable: false });
    expect(data.points[5].value).toBeNull(); // pas de pesée ce jour-là
    expect(data.reference).toBe(82);
    expect(weightChartData(new Map(), TODAY, 7, null).referenceLabel).toBeNull();
  });
});

describe('bodyComposition', () => {
  const base = (over: Partial<BodyInputs> = {}): BodyInputs => ({
    weights: dailyWeights(40, 78, 0.25),
    nutrition: proteinDays(150),
    strength: progress('rising', 'steady', 'steady'),
    proteinGPerKg: 1.8,
    targetWeightKg: 82,
    today: TODAY,
    ...over,
  });

  it('assemble moyenne, tendance, écart à la cible et phrase', () => {
    const c = bodyComposition(base());
    expect(c.trend).toBe('slow-gain');
    expect(c.gapToTarget).toBeLessThan(0);
    expect(c.targetReached).toBe(false);
    expect(c.sentence).toMatch(/^Profil de prise de muscle/);
    expect(c.tone).toBe('good');
    expect(c.curve).toHaveLength(56);
  });

  it('explique ce qui manque au lieu d’interpréter', () => {
    const c = bodyComposition(base({ weights: dailyWeights(5, 78, 0) }));
    expect(c.trend).toBeNull();
    expect(c.sentence).toBe('Pas encore assez de pesées pour interpréter ta tendance (5 / 14 sur 28 jours).');
  });

  it('sans cible de poids : pas de comparaison', () => {
    const c = bodyComposition(base({ targetWeightKg: null }));
    expect(c.gapToTarget).toBeNull();
    expect(c.targetReached).toBeNull();
  });
});
