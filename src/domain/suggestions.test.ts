// Tests des suggestions d'autres sports, sur données fictives.

import { session, steadyHr } from './__fixtures__/exercises';
import { addDays } from './dates';
import type { ExerciseSession } from './load';
import { CATALOG } from './sportCatalog';
import { activityFor, findGaps, recentZone2Minutes, weeklySuggestions, type SuggestionInputs } from './suggestions';

const TODAY = '2026-11-12';
const HR_MAX = 200;
const at = (daysAgo: number, hour = 18) => {
  const [y, m, d] = addDays(TODAY, -daysAgo).split('-').map(Number);
  return new Date(y, m - 1, d, hour).getTime();
};
const typed = (s: ExerciseSession, exerciseType: number) => ({ ...s, exerciseType });

/** Séance de zone 2 fictive (130 bpm = 65 % de la FC max) de `minutes` minutes, il y a `daysAgo` jours. */
function zone2Session(id: string, daysAgo: number, minutes: number) {
  return { session: typed(session(id, at(daysAgo), minutes), 56), samples: steadyHr(at(daysAgo), minutes, 130) };
}

const inputs = (parts: { session: ExerciseSession; samples?: ReturnType<typeof steadyHr> }[], over: Partial<SuggestionInputs> = {}): SuggestionInputs => ({
  sessions: parts.map((p) => p.session),
  samples: parts.flatMap((p) => p.samples ?? []),
  hrMax: HR_MAX,
  zone2Target: 120,
  today: TODAY,
  ...over,
});

const yoga = { session: typed(session('yoga', at(10), 60), 83) };

describe('règle endurance douce', () => {
  it('compte la zone 2 des 7 derniers jours seulement', () => {
    const input = inputs([zone2Session('a', 2, 60), zone2Session('b', 6, 30), zone2Session('vieux', 8, 90)]);
    expect(recentZone2Minutes(input)).toBeCloseTo(90);
  });

  it('zone 2 sous la cible : suggestion d’endurance douce', () => {
    const gaps = findGaps(inputs([zone2Session('a', 2, 60), yoga]));
    expect(gaps.map((g) => g.gap)).toEqual(['endurance']);
    expect(gaps[0].reason).toBe('60 min de zone 2 sur 7 jours, pour 120 min visées.');
  });

  it('cible atteinte : pas de suggestion d’endurance', () => {
    expect(findGaps(inputs([zone2Session('a', 1, 70), zone2Session('b', 3, 60), yoga]))).toEqual([]);
  });

  it('FC max inconnue : la règle d’endurance ne juge pas', () => {
    expect(findGaps(inputs([yoga], { hrMax: null }))).toEqual([]);
  });
});

describe('règle mobilité', () => {
  it('aucune séance de yoga, étirements ou pilates depuis 3 semaines : suggestion de mobilité', () => {
    const old = { session: typed(session('yoga-vieux', at(25), 60), 83) };
    const gaps = findGaps(inputs([zone2Session('a', 1, 130), old]));
    expect(gaps.map((g) => g.gap)).toEqual(['mobility']);
  });

  it('des étirements il y a 2 semaines suffisent', () => {
    const stretch = { session: typed(session('etirements', at(14), 20), 71) };
    expect(findGaps(inputs([zone2Session('a', 1, 130), stretch]))).toEqual([]);
  });
});

describe('weeklySuggestions', () => {
  it('une principale (endurance d’abord) et une secondaire au plus', () => {
    const s = weeklySuggestions(inputs([]))!;
    expect(s.primary.gap).toBe('endurance');
    expect(s.secondary?.gap).toBe('mobility');
    expect(s.primary.activity.where.length).toBeGreaterThan(0);
  });

  it('aucun manque : aucune suggestion', () => {
    expect(weeklySuggestions(inputs([zone2Session('a', 1, 130), yoga]))).toBeNull();
  });

  it('propose une autre activité la semaine suivante, la même toute la semaine', () => {
    const thisWeek = activityFor('endurance', TODAY)!;
    expect(activityFor('endurance', '2026-11-15')!.id).toBe(thisWeek.id); // dimanche, même semaine
    expect(activityFor('endurance', '2026-11-16')!.id).not.toBe(thisWeek.id); // lundi suivant
  });

  it('chaque activité du catalogue dit le manque comblé et où la pratiquer à Paris', () => {
    for (const a of CATALOG) {
      expect(a.benefit.length).toBeGreaterThan(0);
      expect(a.where.length).toBeGreaterThan(0);
    }
  });
});
