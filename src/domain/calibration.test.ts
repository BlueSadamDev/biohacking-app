import { night, series } from './__fixtures__/nights';
import { calibrationStatus } from './calibration';

const TODAY = '2026-03-01';

describe('calibration', () => {
  it('27 nuits complètes : calibration en cours', () => {
    const c = calibrationStatus(series(TODAY, 27), TODAY);
    expect(c.done).toBe(false);
    expect(c.label).toBe('Calibration : 27 / 28 jours');
  });

  it('28 nuits complètes : calibration terminée', () => {
    expect(calibrationStatus(series(TODAY, 28), TODAY).done).toBe(true);
  });

  it('une nuit sans HRV ou sans FC au repos ne compte pas', () => {
    const nights = [
      ...series('2026-02-27', 27),
      night('2026-02-28', { hrvMs: null }),
      night(TODAY, { restingHr: null }),
    ];
    expect(calibrationStatus(nights, TODAY).nights).toBe(27);
  });

  it('ne compte que les 60 derniers jours', () => {
    const old = series('2025-12-31', 20);
    const recent = series(TODAY, 10);
    expect(calibrationStatus([...old, ...recent], TODAY).nights).toBe(10);
  });

  it('le libellé plafonne à 28', () => {
    expect(calibrationStatus(series(TODAY, 40), TODAY).label).toBe('Calibration : 28 / 28 jours');
  });
});
