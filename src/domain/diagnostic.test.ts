import { session } from './__fixtures__/exercises';
import { at, NIGHT, samples, sleep } from './__fixtures__/nights';
import { sessionTypeCounts, summarizeNights } from './diagnostic';
import { computeNights } from './nightly';

it('compte les séances par type et repère celles qui déclenchent la saisie de musculation', () => {
  const t = at(2026, 1, 10, 18);
  const sessions = [session('a', t, 60), session('b', t, 60), { ...session('c', t, 30), exerciseType: 56 }, { ...session('d', t, 30), exerciseType: 999 }];
  expect(sessionTypeCounts(sessions)).toEqual([
    { type: 70, label: 'Musculation', count: 2, strength: true },
    { type: 56, label: 'Course', count: 1, strength: false },
    { type: 999, label: 'Type 999', count: 1, strength: false },
  ]);
});

it('compte les nuits, avec HRV, avec FC au repos et la source utilisée', () => {
  const night2 = sleep('nuit-11', at(2026, 1, 10, 23), at(2026, 1, 11, 7), [
    { start: at(2026, 1, 10, 23), end: at(2026, 1, 11, 7), stage: 4 },
  ]);
  const nights = computeNights({
    sleeps: [NIGHT, night2],
    hrv: samples([at(2026, 1, 10, 2)], [50]),
    restingHr: samples([at(2026, 1, 10, 3)], [52]),
    heartRate: samples([at(2026, 1, 11, 3)], [55]),
  });
  expect(summarizeNights(nights)).toEqual({
    nights: 2,
    withHrv: 1,
    withRestingHr: 2,
    restingHrFromResting: 1,
    restingHrFromHeartRate: 1,
    withStages: 1,
    firstDate: '2026-01-10',
    lastDate: '2026-01-11',
  });
});
