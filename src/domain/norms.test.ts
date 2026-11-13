import { night, series } from './__fixtures__/nights';
import { hrvBaseline, hrvNorm, mean, restingHrNorm, standardDeviation } from './norms';

const TODAY = '2026-03-01';

describe('outils statistiques', () => {
  it('moyenne et écart-type', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(standardDeviation([2, 4, 6])).toBe(2);
    expect(mean([])).toBeNull();
    expect(standardDeviation([5])).toBeNull();
  });
});

describe('norme HRV', () => {
  // 60 nuits précédentes qui alternent 40 et 60 ms.
  const history = series('2026-02-28', 60, (i) => ({ hrvMs: i % 2 ? 60 : 40 }));

  it('plage normale = moyenne ± 1 écart-type de ln(rMSSD), nuit du jour exclue', () => {
    const base = hrvBaseline([...history, night(TODAY, { hrvMs: 500 })], TODAY)!;
    const lns = history.map((n) => n.lnRmssd as number);
    expect(base.nights).toBe(60);
    expect(base.mean).toBeCloseTo(mean(lns)!, 10);
    expect(base.low).toBeCloseTo(base.mean - base.sd, 10);
    expect(base.high).toBeCloseTo(base.mean + base.sd, 10);
  });

  it('ignore les nuits de plus de 60 jours', () => {
    const old = series('2025-12-01', 10, () => ({ hrvMs: 10 }));
    expect(hrvBaseline([...old, ...history], TODAY)!.nights).toBe(60);
  });

  it('moyenne 7 j sous la plage : « below »', () => {
    const lowWeek = series(TODAY, 7, () => ({ hrvMs: 30 }));
    const norm = hrvNorm([...history.slice(0, 54), ...lowWeek], TODAY);
    expect(norm.shortNights).toBe(7);
    expect(norm.position).toBe('below');
  });

  it('moyenne 7 j dans la plage : « within »', () => {
    expect(hrvNorm([...history, night(TODAY, { hrvMs: 49 })], TODAY).position).toBe('within');
  });

  it('moins de 3 nuits sur 7 jours : moyenne 7 j non calculable', () => {
    const norm = hrvNorm([night('2026-02-27'), night(TODAY)], TODAY);
    expect(norm.shortMean).toBeNull();
    expect(norm.position).toBeNull();
  });

  it('pas de norme avec moins de 3 nuits précédentes', () => {
    expect(hrvBaseline([night('2026-02-27'), night('2026-02-28')], TODAY)).toBeNull();
  });
});

describe('norme FC au repos', () => {
  it('compare la nuit à la moyenne des 30 nuits précédentes', () => {
    const history = series('2026-02-28', 30, () => ({ restingHr: 50 }));
    const norm = restingHrNorm([...history, night(TODAY, { restingHr: 56 })], TODAY);
    expect(norm.baselineMean).toBe(50);
    expect(norm.baselineNights).toBe(30);
    expect(norm.delta).toBe(6);
  });

  it('n’utilise que les 30 dernières nuits', () => {
    const old = series('2026-01-29', 10, () => ({ restingHr: 80 }));
    const recent = series('2026-02-28', 30, () => ({ restingHr: 50 }));
    expect(restingHrNorm([...old, ...recent], TODAY).baselineMean).toBe(50);
  });

  it('nuit du jour absente : écart non calculable', () => {
    const norm = restingHrNorm(series('2026-02-28', 30), TODAY);
    expect(norm.tonight).toBeNull();
    expect(norm.delta).toBeNull();
  });
});
