import { SETTINGS } from './settings';
import { session, steadyHr } from './__fixtures__/exercises';
import { at, night } from './__fixtures__/nights';
import { addDays } from './dates';
import {
  buildLoadSummary,
  dailyLoads,
  isSession,
  loadRatio,
  mergeOverlappingSessions,
  simpleLoadRatio,
  withEstimatedLoads,
  type SessionLoad,
  loadStatus,
  restingHrReference,
  sessionLoads,
  heartRateBackfillTargets,
  sessionChecks,
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

describe('ancien ratio : moyennes simples sur 7 et 28 jours (comparaison)', () => {
  it('charge régulière : ratio 1', () => {
    const daily = constantDaily('2026-02-01', 28, 100);
    expect(simpleLoadRatio(daily, '2026-02-28')).toEqual({ acute: 100, chronic: 100, ratio: 1 });
  });

  it('semaine deux fois plus chargée : pic de charge (1,6)', () => {
    const daily = constantDaily('2026-02-01', 21, 100);
    constantDaily('2026-02-22', 7, 200, daily);
    expect(simpleLoadRatio(daily, '2026-02-28').ratio).toBeCloseTo(1.6, 6);
  });
});

describe('ratio en moyennes exponentielles sur 7 et 28 jours (lot 5b)', () => {
  it('charge régulière depuis le début de l’historique : ratio 1', () => {
    const daily = constantDaily('2026-01-01', 59, 100);
    const r = loadRatio(daily, '2026-02-28', SETTINGS, '2026-01-01');
    expect(r.acute).toBeCloseTo(100, 6);
    expect(r.chronic).toBeCloseTo(100, 6);
    expect(r.ratio).toBeCloseTo(1, 6);
  });

  it('semaine deux fois plus chargée : les derniers jours pèsent plus, ratio plus modéré qu’avant', () => {
    const daily = constantDaily('2026-01-01', 52, 100);
    constantDaily('2026-02-22', 7, 200, daily);
    const r = loadRatio(daily, '2026-02-28', SETTINGS, '2026-01-01');
    // aiguë : 100 + 100 × (1 − (1 − 2/8)^7) ; chronique : 100 + 100 × (1 − (1 − 2/29)^7).
    const acute = 100 + 100 * (1 - (6 / 8) ** 7);
    const chronic = 100 + 100 * (1 - (27 / 29) ** 7);
    expect(r.acute).toBeCloseTo(acute, 6);
    expect(r.chronic).toBeCloseTo(chronic, 6);
    expect(r.ratio).toBeCloseTo(acute / chronic, 6);
    // 1,34 (contre 1,6 en moyennes simples) : à seuils inchangés, « en hausse » plutôt que « pic ».
    expect(r.ratio).toBeCloseTo(1.339, 3);
    expect(loadStatus(r.ratio!)).toBe('rising');
  });

  it('les jours d’avant l’historique ne comptent pas comme des jours sans charge', () => {
    const daily = constantDaily('2026-02-01', 28, 100);
    expect(loadRatio(daily, '2026-02-28', SETTINGS, '2026-02-01').ratio).toBeCloseTo(1, 6);
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
    const load = (id: string, trimp: number | null): SessionLoad => ({
      id,
      date: '2026-02-10',
      durationMinutes: 30,
      exerciseType: 0,
      isSession: false,
      trimp,
    });
    const daily = dailyLoads([load('a', 20), load('b', 30), load('c', null)]);
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
    historyStart: '2026-01-15',
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

  it('un quart des minutes d’activité sans FC (le seuil) : la charge reste affichée', () => {
    // Les 7 premières séances (15 au 21 janvier, 60 min) sans mesure : 420 min sur 1 680 = 25 %.
    const summary = buildLoadSummary({ ...base, samples: samples.filter((s) => s.time >= at(2026, 1, 22)) });
    expect(summary.state).toBe('ok');
  });

  it('plus d’un quart des minutes sans FC : charge non fiable, aucune valeur (en minutes)', () => {
    // Pas d'estimation possible : aucune activité de référence mesurée avant elles.
    const summary = buildLoadSummary({ ...base, samples: samples.filter((s) => s.time >= at(2026, 1, 23)) });
    expect(summary).toEqual({ state: 'unreliable', unmeasured: 480, total: 1680 });
  });

  it('seule la dernière semaine mesurée (le cas du +300 %) : non fiable', () => {
    const summary = buildLoadSummary({ ...base, samples: samples.filter((s) => s.time >= at(2026, 2, 5)) });
    expect(summary).toEqual({ state: 'unreliable', unmeasured: 1260, total: 1680 });
  });

  it('séances de la semaine sans FC : charge estimée d’après les séances du même type (lot 5b)', () => {
    const summary = buildLoadSummary({ ...base, samples: samples.filter((s) => s.time < at(2026, 2, 10)) });
    expect(summary).toMatchObject({ state: 'ok', sessions7d: 7, sessionsWithoutHr: 0, estimated7d: 2 });
    if (summary.state === 'ok') expect(summary.ratio).toBeCloseTo(1, 6); // estimation = même charge
  });

  it('activités courtes : comptent dans la charge, pas dans le nombre de séances (lot 5b)', () => {
    const shortOnes = Array.from({ length: 7 }, (_, i) => session(`c${i}`, at(2026, 2, 5 + i, 8), 15));
    const withShort = buildLoadSummary({
      ...base,
      sessions: [...sessions, ...shortOnes.map((x) => ({ ...x, exerciseType: 79 }))],
      samples: [...samples, ...shortOnes.flatMap((x) => steadyHr(x.start, 15, 120))],
    });
    expect(withShort).toMatchObject({ state: 'ok', sessions7d: 7 });
    if (withShort.state === 'ok') expect(withShort.ratio).toBeGreaterThan(1);
  });
});

describe('activités et séances (décision du 18 novembre)', () => {
  // Types Health Connect fictifs : marche (79), course (56) ; musculation (70) dans strength.sessionTypes.
  const walk = (id: string, minutes: number) => ({ ...session(id, at(2026, 1, 10, 10), minutes), exerciseType: 79 });
  const run = (id: string, minutes: number) => ({ ...session(id, at(2026, 1, 10, 18), minutes), exerciseType: 56 });

  it('une séance dure au moins 45 minutes', () => {
    expect([walk('marche-44', 44), run('course-45', 45), walk('marche-90', 90)].map((a) => isSession(a))).toEqual([false, true, true]);
  });

  it('la musculation est toujours une séance, même courte', () => {
    expect(isSession(session('muscu-12', at(2026, 1, 10, 7), 12))).toBe(true);
  });
});

describe('séances qui se chevauchent (lot 5b)', () => {
  const t = (h: number, m = 0) => at(2026, 1, 10, h, m);
  const act = (id: string, start: number, minutes: number, exerciseType: number) => ({ ...session(id, start, minutes), exerciseType });

  it('fusionnées en une seule, du premier début à la dernière fin, type de la plus longue', () => {
    const { sessions, merges } = mergeOverlappingSessions([act('a', t(10), 60, 56), act('b', t(10, 30), 90, 79), act('c', t(15), 30, 79)]);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({ id: 'b', start: t(10), end: t(12), exerciseType: 79 });
    expect(merges).toEqual([{ id: 'b', date: '2026-01-10', count: 2 }]);
  });

  it('si l’une est de la musculation, la séance fusionnée est de la musculation', () => {
    const { sessions } = mergeOverlappingSessions([act('muscu', t(18), 40, 70), act('marche', t(17, 50), 80, 79)]);
    expect(sessions).toEqual([expect.objectContaining({ id: 'muscu', exerciseType: 70, start: t(17, 50), end: t(19, 10) })]);
  });

  it('deux séances qui se suivent sans se chevaucher restent séparées', () => {
    expect(mergeOverlappingSessions([act('a', t(10), 60, 56), act('b', t(11), 30, 56)]).sessions).toHaveLength(2);
  });
});

describe('charge estimée des activités sans fréquence cardiaque (lot 5b)', () => {
  const load = (id: string, date: string, trimp: number | null, minutes = 60, exerciseType = 56): SessionLoad => ({
    id,
    date,
    durationMinutes: minutes,
    exerciseType,
    isSession: true,
    trimp,
    ...(trimp === null ? { reason: 'no-heart-rate' as const } : {}),
  });

  it('charge médiane par minute des activités du même type des 28 derniers jours × durée', () => {
    const loads = [load('a', '2026-02-01', 60), load('b', '2026-02-03', 120), load('c', '2026-02-05', 90), load('x', '2026-02-10', null, 30)];
    // Par minute : 1, 2 et 1,5 → médiane 1,5 ; × 30 min = 45, marquée estimée.
    expect(withEstimatedLoads(loads)[3]).toMatchObject({ id: 'x', trimp: 45, estimated: true });
  });

  it('pas d’estimation avec moins de 3 références du même type', () => {
    const loads = [load('a', '2026-02-01', 60), load('b', '2026-02-03', 60, 60, 79), load('c', '2026-02-05', 60), load('x', '2026-02-10', null)];
    expect(withEstimatedLoads(loads)[3]).toMatchObject({ trimp: null, reason: 'no-heart-rate' });
  });

  it('les références de plus de 28 jours ne comptent pas', () => {
    const loads = [load('a', '2026-01-01', 60), load('b', '2026-01-02', 60), load('c', '2026-02-05', 60), load('x', '2026-02-10', null)];
    expect(withEstimatedLoads(loads)[3].trimp).toBeNull();
  });

  it('sans FC au repos de référence : pas d’estimation (rien à comparer)', () => {
    const loads = [load('a', '2026-02-01', 60), load('b', '2026-02-02', 60), load('c', '2026-02-03', 60), { ...load('x', '2026-02-10', null), reason: 'no-resting-hr' as const }];
    expect(withEstimatedLoads(loads)[3].trimp).toBeNull();
  });
});

describe('contrôle des séances (écran « Contrôle des données »)', () => {
  const nights = Array.from({ length: 40 }, (_, i) => night(addDays('2026-01-05', i), { restingHr: 60 }));
  const DAY = '2026-02-10';
  const t = (hour: number) => at(2026, 2, 10, hour);
  const other = (id: string, start: number, minutes: number) => ({ ...session(id, start, minutes), exerciseType: 0 });

  const sessions = [
    other('full', t(8), 40), // FC toutes les minutes : comptée
    other('sparse', t(12), 40), // FC toutes les 5 min : 40 % de la séance couverte
    other('short', t(15), 10), // activité courte : comptée dans la charge, pas une séance
    session('strength', t(18), 10), // musculation courte : une séance
  ];
  const samples = [
    ...steadyHr(t(8), 40, 120),
    ...steadyHr(t(12), 40, 120, 300),
    ...steadyHr(t(15), 10, 120),
    ...steadyHr(t(18), 10, 120),
  ];
  const checks = sessionChecks(sessions, samples, nights, 180, 1.92);
  const byId = (id: string) => checks.find((c) => c.id === id)!;

  it('de la plus récente à la plus ancienne', () => {
    expect(checks.map((c) => c.id)).toEqual(['strength', 'short', 'sparse', 'full']);
    expect(byId('full').date).toBe(DAY);
  });

  it('activité bien mesurée : comptée, couverture complète', () => {
    expect(byId('full')).toMatchObject({ reason: null, samples: 40, durationMinutes: 40, estimated: false });
    expect(byId('full').coverage).toBeCloseTo(1, 6);
  });

  it('mesures trop espacées : non comptée, et la couverture dit pourquoi', () => {
    // 8 mesures, chacune compte au plus 2 min : 16 min sur 40, soit 40 %.
    expect(byId('sparse')).toMatchObject({ reason: 'no-heart-rate', trimp: null, samples: 8 });
    expect(byId('sparse').coverage).toBeCloseTo(0.4, 6);
  });

  it('activité courte : comptée dans la charge, mais pas une séance ; musculation courte : une séance', () => {
    expect(byId('short')).toMatchObject({ reason: null, isSession: false });
    expect(byId('strength')).toMatchObject({ reason: null, isSession: true });
    expect(byId('full').isSession).toBe(false); // 40 min : activité
  });

  it('les points sont exactement ceux du calcul de charge', () => {
    const loads = sessionLoads(sessions, samples, nights, 180, 1.92);
    for (const l of loads) expect(byId(l.id).trimp).toBe(l.trimp);
  });

  it('sans FC au repos de référence : la raison est donnée', () => {
    const [c] = sessionChecks([other('x', t(8), 40)], steadyHr(t(8), 40, 120), [], 180, 1.92);
    expect(c.reason).toBe('no-resting-hr');
  });
});

describe('rattrapage de la FC des séances', () => {
  const t = (day: number, hour: number) => at(2026, 2, day, hour);
  const other = (id: string, start: number, minutes: number) => ({ ...session(id, start, minutes), exerciseType: 0 });
  const sessions = [
    other('old', t(1, 8), 40), // trop ancienne
    other('measured', t(9, 8), 40), // déjà mesurée
    other('missing-1', t(9, 12), 40),
    other('missing-2', t(10, 12), 40),
    other('short', t(10, 15), 10), // activité courte : rattrapée aussi (elle compte dans la charge, lot 5b)
    session('strength', t(10, 18), 10), // musculation courte : rattrapée
  ];
  const counts = new Map([['measured', 40]]);
  const since = t(5, 0);

  it('activités récentes sans aucune mesure, les plus récentes d’abord', () => {
    expect(heartRateBackfillTargets(sessions, counts, since, 40).map((s) => s.id)).toEqual(['strength', 'short', 'missing-2', 'missing-1']);
  });

  it('au plus N activités par synchro', () => {
    expect(heartRateBackfillTargets(sessions, counts, since, 2).map((s) => s.id)).toEqual(['strength', 'short']);
  });
  it('une activité déjà relue 3 fois sans succès n’est plus relue (lot 5b)', () => {
    const attempts = new Map([['missing-2', 3], ['missing-1', 2], ['short', 3]]);
    expect(heartRateBackfillTargets(sessions, counts, since, 40, SETTINGS, attempts, 3).map((s) => s.id)).toEqual([
      'strength',
      'missing-1',
    ]);
  });
});
