import { at, NIGHT, ORIGIN, samples, sleep } from './__fixtures__/nights';
import { asleepMinutes, computeNights, mainSleepByNight, nightDateOf } from './nightly';
import { SETTINGS } from './settings';

const empty = { hrv: [], restingHr: [], heartRate: [] };

describe('rattachement d’un sommeil à une nuit', () => {
  it('un réveil le matin compte pour le jour même', () => {
    expect(nightDateOf(at(2026, 1, 10, 7))).toBe('2026-01-10');
  });
  it('un sommeil terminé avant minuit compte pour le lendemain', () => {
    expect(nightDateOf(at(2026, 1, 9, 23, 30))).toBe('2026-01-10');
  });
  it('une sieste l’après-midi est ignorée', () => {
    expect(nightDateOf(at(2026, 1, 10, 15))).toBeNull();
  });
  it('passe correctement d’un mois à l’autre', () => {
    expect(nightDateOf(at(2026, 1, 31, 22))).toBe('2026-02-01');
  });
});

describe('sommeil principal', () => {
  it('garde la séance la plus longue de la nuit', () => {
    const court = sleep('court', at(2026, 1, 10, 5), at(2026, 1, 10, 7));
    const map = mainSleepByNight([court, NIGHT]);
    expect(map.get('2026-01-10')?.id).toBe('nuit-10');
    expect(map.size).toBe(1);
  });
  it('ignore une séance de durée nulle ou négative', () => {
    const bad = sleep('bad', at(2026, 1, 10, 7), at(2026, 1, 10, 7));
    expect(mainSleepByNight([bad]).size).toBe(0);
  });
});

describe('durée dormie', () => {
  it('retire les phases d’éveil', () => {
    const s = sleep('n', at(2026, 1, 9, 23), at(2026, 1, 10, 7), [
      { start: at(2026, 1, 9, 23), end: at(2026, 1, 10, 3), stage: 4 },
      { start: at(2026, 1, 10, 3), end: at(2026, 1, 10, 3, 30), stage: 1 },
      { start: at(2026, 1, 10, 3, 30), end: at(2026, 1, 10, 7), stage: 5 },
    ]);
    expect(asleepMinutes(s)).toBe(8 * 60 - 30);
  });
  it('sans phases, prend la durée totale', () => {
    expect(asleepMinutes(NIGHT)).toBe(8 * 60);
  });
});

describe('HRV de la nuit', () => {
  it('moyenne de ln(rMSSD) des seules mesures pendant le sommeil', () => {
    const hrv = samples(
      [at(2026, 1, 10, 1), at(2026, 1, 10, 4), at(2026, 1, 10, 12)],
      [40, 90, 200], // la mesure de midi est hors sommeil
    );
    const [night] = computeNights({ ...empty, sleeps: [NIGHT], hrv });
    expect(night.lnRmssd).toBeCloseTo((Math.log(40) + Math.log(90)) / 2, 10);
    expect(night.hrvMs).toBeCloseTo(60, 10); // moyenne géométrique de 40 et 90
    expect(night.hrvSampleCount).toBe(2);
  });
  it('non calculable sans mesure pendant le sommeil', () => {
    const [night] = computeNights({ ...empty, sleeps: [NIGHT] });
    expect(night.lnRmssd).toBeNull();
    expect(night.hrvMs).toBeNull();
  });
  it('pas de nuit du tout sans sommeil enregistré', () => {
    const hrv = samples([at(2026, 1, 10, 1)], [50]);
    expect(computeNights({ ...empty, sleeps: [], hrv })).toEqual([]);
  });
});

describe('FC au repos de la nuit', () => {
  const times = [1, 2, 3, 4, 5, 6].map((h) => at(2026, 1, 10, h));

  it('moyenne des 5 valeurs les plus basses pendant le sommeil', () => {
    const restingHr = samples(times, [60, 50, 52, 54, 56, 58]);
    const [night] = computeNights({ ...empty, sleeps: [NIGHT], restingHr });
    expect(SETTINGS.night.restingHrLowestCount).toBe(5);
    expect(night.restingHr).toBe((50 + 52 + 54 + 56 + 58) / 5);
    expect(night.restingHrSource).toBe('resting');
  });
  it('avec moins de 5 valeurs, fait la moyenne de celles qui existent', () => {
    const restingHr = samples(times.slice(0, 2), [50, 54]);
    const [night] = computeNights({ ...empty, sleeps: [NIGHT], restingHr });
    expect(night.restingHr).toBe(52);
  });
  it('se replie sur la FC continue s’il n’y a pas de mesure « FC au repos »', () => {
    const heartRate = samples(times, [70, 48, 49, 50, 51, 52]);
    const [night] = computeNights({ ...empty, sleeps: [NIGHT], heartRate });
    expect(night.restingHr).toBe(50);
    expect(night.restingHrSource).toBe('heart_rate');
  });
  it('non calculable sans aucune mesure pendant le sommeil', () => {
    const restingHr = [{ time: at(2026, 1, 10, 15), value: 55, origin: ORIGIN }];
    const [night] = computeNights({ ...empty, sleeps: [NIGHT], restingHr });
    expect(night.restingHr).toBeNull();
    expect(night.restingHrSource).toBeNull();
  });
});
