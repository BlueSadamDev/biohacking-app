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

describe('mesures de la nuit trouvées par dichotomie (lot 5b)', () => {
  /** Ancienne méthode : parcours de toutes les mesures pour chaque nuit, dans l'ordre d'arrivée. */
  function naive(input: Parameters<typeof computeNights>[0]) {
    const inNight = (s: { start: number; end: number }, list: { time: number; value: number }[]) =>
      list.filter((x) => x.time >= s.start && x.time <= s.end && x.value > 0).map((x) => x.value);
    return [...mainSleepByNight(input.sleeps)].map(([date, s]) => {
      const hrv = inNight(s, input.hrv);
      const lowest = (v: number[]) => {
        const l = [...v].sort((a, b) => a - b).slice(0, SETTINGS.night.restingHrLowestCount);
        return l.length ? l.reduce((a, b) => a + b, 0) / l.length : null;
      };
      return {
        date,
        lnRmssd: hrv.length ? hrv.reduce((a, b) => a + Math.log(b), 0) / hrv.length : null,
        count: hrv.length,
        restingHr: lowest(inNight(s, input.restingHr)) ?? lowest(inNight(s, input.heartRate)),
      };
    });
  }

  it('donne les mêmes nuits que l’ancienne méthode sur 30 nuits fictives, mesures dans le désordre', () => {
    // Générateur pseudo-aléatoire à graine fixe (données inventées, reproductibles).
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const sleeps = [];
    const hrv = [];
    const restingHr = [];
    const heartRate = [];
    for (let d = 1; d <= 30; d++) {
      const start = at(2026, 3, d, 23);
      const end = at(2026, 3, d + 1, 7);
      sleeps.push(sleep(`n${d}`, start, end));
      // Mesures toute la journée (pas seulement la nuit), dont des bornes exactes et des valeurs nulles.
      for (let t = at(2026, 3, d, 8); t <= end; t += 10 * 60_000) {
        hrv.push({ time: t, value: d % 7 === 0 ? 0 : 20 + rand() * 40, origin: ORIGIN });
        heartRate.push({ time: t, value: 45 + rand() * 30, origin: ORIGIN });
      }
      hrv.push({ time: start, value: 33, origin: ORIGIN }, { time: end, value: 35, origin: ORIGIN });
      if (d % 5 !== 0) restingHr.push({ time: at(2026, 3, d + 1, 4), value: 50 + rand() * 8, origin: ORIGIN });
    }
    const shuffle = <T,>(list: T[]) => [...list].sort(() => rand() - 0.5);
    const input = { sleeps, hrv: shuffle(hrv), restingHr: shuffle(restingHr), heartRate: shuffle(heartRate) };

    const fast = computeNights(input);
    const slow = naive(input);
    expect(fast).toHaveLength(30);
    fast.forEach((night, i) => {
      expect(night.date).toBe(slow[i].date);
      expect(night.hrvSampleCount).toBe(slow[i].count);
      if (slow[i].lnRmssd === null) expect(night.lnRmssd).toBeNull();
      else expect(night.lnRmssd).toBeCloseTo(slow[i].lnRmssd!, 10);
      expect(night.restingHr).toBeCloseTo(slow[i].restingHr!, 10);
    });
  });
});
