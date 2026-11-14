import { session, steadyHr } from './__fixtures__/exercises';
import { at, night } from './__fixtures__/nights';
import { addDays } from './dates';
import {
  buildLoadSummary,
  dailyLoads,
  loadRatio,
  loadStatus,
  restingHrReference,
  sessionLoads,
  sessionTrimp,
  type LoadInputs,
} from './load';

// FC repos 60, FC max 180, FC 120 → FCr = 0,5.
// Par minute : 0,5 × 0,64 × e^(1,92 × 0,5) = 0,8357 (homme) ; 0,5 × 0,64 × e^(1,67 × 0,5) = 0,7376 (femme).
const START = at(2026, 2, 10, 18);
const PER_MIN_MALE = 0.5 * 0.64 * Math.exp(1.92 * 0.5);
const PER_MIN_FEMALE = 0.5 * 0.64 * Math.exp(1.67 * 0.5);

describe('TRIMP par séance', () => {
  it('60 min à FC constante : 60 × FCr × 0,64 × e^(k × FCr)', () => {
    const s = session('a', START, 60);
    expect(sessionTrimp(s, steadyHr(START, 60, 120), 60, 180, 1.92)).toBeCloseTo(60 * PER_MIN_MALE, 6);
  });

  it('le coefficient du profil change le résultat (femme : k = 1,67)', () => {
    const s = session('a', START, 60);
    expect(sessionTrimp(s, steadyHr(START, 60, 120), 60, 180, 1.67)).toBeCloseTo(60 * PER_MIN_FEMALE, 6);
  });

  it('une séance plus intense compte plus (relation non linéaire)', () => {
    const s = session('a', START, 60);
    const easy = sessionTrimp(s, steadyHr(START, 60, 120), 60, 180, 1.92)!;
    const hard = sessionTrimp(s, steadyHr(START, 60, 165), 60, 180, 1.92)!;
    expect(hard).toBeGreaterThan(easy * 1.75);
  });

  it('FC sous la FC au repos : compte 0, jamais négatif', () => {
    const s = session('a', START, 30);
    expect(sessionTrimp(s, steadyHr(START, 30, 50), 60, 180, 1.92)).toBe(0);
  });

  it('trous de mesure : le résultat est ramené à la durée totale', () => {
    const s = session('a', START, 60);
    // Mesures sur les 40 premières minutes seulement.
    expect(sessionTrimp(s, steadyHr(START, 40, 120), 60, 180, 1.92)).toBeCloseTo(60 * PER_MIN_MALE, 6);
  });

  it('pas assez de FC (moins de la moitié de la séance couverte) : non calculable', () => {
    const s = session('a', START, 60);
    expect(sessionTrimp(s, steadyHr(START, 20, 120), 60, 180, 1.92)).toBeNull();
    expect(sessionTrimp(s, [], 60, 180, 1.92)).toBeNull();
  });

  it('ignore les mesures prises hors de la séance', () => {
    const s = session('a', START, 60);
    const samples = [...steadyHr(START - 30 * 60000, 30, 170), ...steadyHr(START, 60, 120)];
    expect(sessionTrimp(s, samples, 60, 180, 1.92)).toBeCloseTo(60 * PER_MIN_MALE, 6);
  });
});

describe('FC au repos de référence', () => {
  it('moyenne des nuits des 30 derniers jours', () => {
    const nights = [night('2026-02-08', { restingHr: 58 }), night('2026-02-09', { restingHr: 60 }), night('2026-02-10', { restingHr: 62 })];
    expect(restingHrReference(nights, '2026-02-10')).toBe(60);
  });
  it('moins de 3 nuits : pas de référence, la séance est non calculable', () => {
    const nights = [night('2026-02-10', { restingHr: 60 })];
    expect(restingHrReference(nights, '2026-02-10')).toBeNull();
    const loads = sessionLoads([session('a', START, 60)], steadyHr(START, 60, 120), nights, 180, 1.92);
    expect(loads[0]).toMatchObject({ trimp: null, reason: 'no-resting-hr' });
  });
});

/** Charge par jour fictive : `value` chaque jour de `from` à `to`. */
function constantDaily(from: string, days: number, value: number, map = new Map<string, number>()) {
  for (let i = 0; i < days; i++) map.set(addDays(from, i), value);
  return map;
}

describe('ratio charge aiguë (7 j) / chronique (28 j)', () => {
  it('charge régulière : ratio 1', () => {
    const daily = constantDaily('2026-02-01', 28, 100);
    expect(loadRatio(daily, '2026-02-28')).toEqual({ acute: 100, chronic: 100, ratio: 1 });
  });

  it('semaine deux fois plus chargée : pic de charge (1,6)', () => {
    const daily = constantDaily('2026-02-01', 21, 100);
    constantDaily('2026-02-22', 7, 200, daily);
    const r = loadRatio(daily, '2026-02-28');
    expect(r.ratio).toBeCloseTo(1.6, 6);
    expect(loadStatus(r.ratio!)).toBe('high');
  });

  it('aucune séance sur 28 jours : ratio non calculable', () => {
    expect(loadRatio(new Map(), '2026-02-28').ratio).toBeNull();
  });

  it('seuils : < 0,8 sous-charge, 0,8 à 1,3 équilibrée, 1,3 à 1,5 en hausse, > 1,5 pic', () => {
    expect(loadStatus(0.79)).toBe('under');
    expect(loadStatus(0.8)).toBe('balanced');
    expect(loadStatus(1.3)).toBe('balanced');
    expect(loadStatus(1.31)).toBe('rising');
    expect(loadStatus(1.5)).toBe('rising');
    expect(loadStatus(1.51)).toBe('high');
  });

  it('additionne les séances du même jour', () => {
    const daily = dailyLoads([
      { id: 'a', date: '2026-02-10', durationMinutes: 30, trimp: 20 },
      { id: 'b', date: '2026-02-10', durationMinutes: 30, trimp: 30 },
      { id: 'c', date: '2026-02-10', durationMinutes: 30, trimp: null },
    ]);
    expect(daily.get('2026-02-10')).toBe(50);
  });
});

describe('résumé de la charge', () => {
  const nights = Array.from({ length: 40 }, (_, i) => night(addDays('2026-01-05', i), { restingHr: 60 }));
  const sessions = Array.from({ length: 28 }, (_, i) => session(`s${i}`, at(2026, 1, 15 + i, 18), 60));
  const samples = sessions.flatMap((s) => steadyHr(s.start, 60, 120));
  const base: LoadInputs = {
    sessions,
    samples,
    nights,
    hrMax: 180,
    coefficient: 1.92,
    historyStart: '2026-01-05',
    today: '2026-02-11',
  };

  it('profil incomplet : indique ce qui manque, aucun calcul', () => {
    expect(buildLoadSummary({ ...base, coefficient: null, hrMax: null })).toEqual({
      state: 'profile-missing',
      missing: ['sex', 'hrMax'],
    });
  });

  it("moins de 28 jours d'historique : calibration n / 28", () => {
    expect(buildLoadSummary({ ...base, historyStart: '2026-02-01' })).toEqual({ state: 'calibrating', days: 11, required: 28 });
  });

  it('une séance par jour, identique : ratio 1, charge équilibrée', () => {
    const summary = buildLoadSummary(base);
    expect(summary).toMatchObject({ state: 'ok', status: 'balanced', sessions7d: 7, sessionsWithoutHr: 0 });
    if (summary.state === 'ok') expect(summary.ratio).toBeCloseTo(1, 6);
  });

  it('aucune séance : rien à comparer, pas de valeur inventée', () => {
    expect(buildLoadSummary({ ...base, sessions: [], samples: [] })).toEqual({
      state: 'no-load',
      sessions7d: 0,
      sessionsWithoutHr: 0,
    });
  });

  it('compte les séances de la semaine sans FC', () => {
    const summary = buildLoadSummary({ ...base, samples: samples.filter((s) => s.time < at(2026, 2, 10)) });
    expect(summary).toMatchObject({ sessions7d: 7, sessionsWithoutHr: 2 });
  });
});
