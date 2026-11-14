import { night, series } from './__fixtures__/nights';
import { buildRecap, chartData, shortMean } from './recap';

const TODAY = '2026-03-01';
const history = series('2026-02-28', 60, (i) => ({ hrvMs: i % 2 ? 60 : 40, restingHr: 50 }));

describe('récap du matin', () => {
  it('rassemble nuit, calibration, score et recommandation', () => {
    const recap = buildRecap([...history, night(TODAY, { hrvMs: 49, restingHr: 50 })], TODAY);
    expect(recap.night?.date).toBe(TODAY);
    expect(recap.calibration.done).toBe(true);
    expect(recap.recovery.score).not.toBeNull();
    expect(recap.recommendation.zone).toBe('good');
  });

  it('sans nuit du jour : pas de nuit, recommandation neutre', () => {
    const recap = buildRecap(history, TODAY);
    expect(recap.night).toBeNull();
    expect(recap.recommendation.zone).toBe('neutral');
  });
});

describe('moyenne 7 jours', () => {
  it('FC au repos et sommeil : moyenne simple des nuits disponibles', () => {
    const nights = series(TODAY, 7, (i) => ({ restingHr: 50 + i, asleepMinutes: 400 + i * 10 }));
    expect(shortMean(nights, 'restingHr', TODAY)).toBe(53);
    expect(shortMean(nights, 'sleep', TODAY)).toBe(430);
  });
  it('HRV : moyenne sur le logarithme (40 et 90 donnent 60)', () => {
    const nights = series(TODAY, 4, (i) => ({ hrvMs: i % 2 ? 90 : 40 }));
    expect(shortMean(nights, 'hrv', TODAY)).toBeCloseTo(60, 10);
  });
});

describe('graphique de tendance', () => {
  it('un point par jour, vide si la nuit manque', () => {
    const data = chartData([night('2026-02-27'), night(TODAY)], 'sleep', TODAY, 7);
    expect(data.points).toHaveLength(7);
    expect(data.points[6]).toMatchObject({ date: TODAY, value: 450 });
    expect(data.points[5].value).toBeNull();
    expect(data.reference).toBe(450);
  });
  it('HRV : plage normale en ms et barres sous la plage signalées', () => {
    const data = chartData([...history, night(TODAY, { hrvMs: 20 })], 'hrv', TODAY, 7);
    expect(data.band!.low).toBeLessThan(40 + 1);
    expect(data.band!.high).toBeGreaterThan(60 - 1);
    expect(data.points[6].unfavorable).toBe(true);
    expect(data.points[5].unfavorable).toBe(false);
  });
  it('FC au repos : repère = moyenne 30 j, barre signalée au-delà de +3 bpm', () => {
    const data = chartData([...history, night(TODAY, { restingHr: 54 })], 'restingHr', TODAY, 7);
    expect(data.reference).toBe(50);
    expect(data.points[6].unfavorable).toBe(true);
  });
});
