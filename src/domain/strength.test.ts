// Tests de la musculation (1RM, tendance, stagnation, séance à saisir), sur données fictives.

import { session } from './__fixtures__/exercises';
import { set, skipped, weeklySets } from './__fixtures__/strength';
import {
  compareSet,
  estimateOneRepMax,
  exerciseProgress,
  lastSet,
  pendingStrengthSession,
  shouldRemindStrength,
  stagnantExercises,
  weeklyBests,
} from './strength';

const TODAY = '2026-11-12'; // jeudi

describe('estimateOneRepMax (Epley)', () => {
  it('applique charge × (1 + répétitions / 30)', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 2);
    expect(estimateOneRepMax(60, 10)).toBeCloseTo(80);
  });
  it('garde la charge pour une seule répétition', () => {
    expect(estimateOneRepMax(120, 1)).toBe(120);
  });
});

describe('weeklyBests', () => {
  it('garde le meilleur 1RM de chaque semaine, sur 12 semaines', () => {
    const entries = [set('2026-11-09', 'squat', 100, 1), set('2026-11-11', 'squat', 105, 1), set('2026-11-02', 'squat', 95, 1)];
    const weeks = weeklyBests(entries, 'squat', TODAY);
    expect(weeks).toHaveLength(12);
    expect(weeks[11]).toBe(105);
    expect(weeks[10]).toBe(95);
    expect(weeks[9]).toBeNull();
  });
});

describe('exerciseProgress', () => {
  it('signale une hausse quand le meilleur 1RM récent dépasse celui des 3 semaines d’avant', () => {
    const entries = weeklySets(TODAY, 'squat', 6, (i) => 100 + 2.5 * i);
    const p = exerciseProgress(entries, 'squat', TODAY);
    expect(p.trend).toBe('rising');
    expect(p.current).toBeCloseTo(estimateOneRepMax(112.5, 5));
  });

  it('signale une stagnation sans nouveau record depuis 6 semaines', () => {
    // Record à 110 il y a 10 semaines, puis 105 chaque semaine.
    const entries = [set('2026-09-03', 'bench', 110, 5), ...weeklySets(TODAY, 'bench', 8, () => 105)];
    expect(exerciseProgress(entries, 'bench', TODAY).trend).toBe('stagnant');
    expect(stagnantExercises(entries, TODAY)).toEqual(['bench']);
  });

  it('ne parle pas de stagnation sans historique plus ancien que 6 semaines', () => {
    const entries = weeklySets(TODAY, 'bench', 5, () => 105);
    expect(exerciseProgress(entries, 'bench', TODAY).trend).toBe('steady');
  });

  it('signale une baisse nette', () => {
    const entries = weeklySets(TODAY, 'deadlift', 6, (i) => (i < 3 ? 140 : 125));
    expect(exerciseProgress(entries, 'deadlift', TODAY).trend).toBe('falling');
  });

  it('attend assez de saisies avant de juger (les « Pas fait » ne comptent pas)', () => {
    const entries = [set(TODAY, 'squat', 100, 5), skipped('2026-11-05', 'squat'), skipped('2026-10-29', 'squat')];
    const p = exerciseProgress(entries, 'squat', TODAY);
    expect(p.trend).toBe('insufficient');
    expect(p.current).toBeCloseTo(estimateOneRepMax(100, 5));
  });
});

describe('compareSet', () => {
  const history = [set('2026-11-05', 'squat', 100, 5, 'old'), set('2026-08-01', 'squat', 110, 5, 'older')];

  it('donne l’écart au niveau des 6 dernières semaines et repère un record', () => {
    const c = compareSet(history, 'squat', 112.5, 5, TODAY, 'new');
    expect(c.deltaToLevel).toBeCloseTo(estimateOneRepMax(112.5, 5) - estimateOneRepMax(100, 5));
    expect(c.record).toBe(true);
    expect(compareSet(history, 'squat', 105, 5, TODAY, 'new').record).toBe(false);
  });

  it('ignore les saisies de la séance en cours de correction', () => {
    const c = compareSet(history, 'squat', 90, 5, '2026-11-05', 'old');
    expect(c.deltaToLevel).toBeNull(); // seule l'ancienne séance de 110 kg reste, hors des 6 semaines
  });
});

describe('pendingStrengthSession', () => {
  const morning = new Date(2026, 10, 12, 8).getTime();
  const evening = new Date(2026, 10, 12, 19).getTime();

  it('renvoie la dernière séance de musculation du jour sans saisie', () => {
    const sessions = [session('matin', morning, 60), session('soir', evening, 60)];
    expect(pendingStrengthSession(sessions, [], TODAY)?.id).toBe('soir');
    expect(pendingStrengthSession(sessions, [skipped(TODAY, 'squat', 'soir')], TODAY)?.id).toBe('matin');
  });

  it('ignore les autres sports et les jours précédents', () => {
    const run = { ...session('course', evening, 40), exerciseType: 56 };
    const yesterday = session('hier', new Date(2026, 10, 11, 19).getTime(), 60);
    expect(pendingStrengthSession([run, yesterday], [], TODAY)).toBeNull();
  });
});

describe('shouldRemindStrength', () => {
  const pending = session('soir', new Date(2026, 10, 12, 19).getTime(), 60);
  it('rappelle une fois par jour, hors plage silencieuse, s’il y a une séance à saisir', () => {
    expect(shouldRemindStrength(pending, null, TODAY, false)).toBe(true);
    expect(shouldRemindStrength(pending, '2026-11-11', TODAY, false)).toBe(true);
    expect(shouldRemindStrength(pending, TODAY, TODAY, false)).toBe(false); // déjà envoyé aujourd'hui
    expect(shouldRemindStrength(pending, null, TODAY, true)).toBe(false); // plage silencieuse
    expect(shouldRemindStrength(null, null, TODAY, false)).toBe(false); // rien à saisir
  });
});

describe('lastSet', () => {
  it('reprend la dernière série saisie pour proposer les mêmes valeurs', () => {
    const entries = [set('2026-11-05', 'bench', 80, 6), set('2026-10-29', 'bench', 77.5, 8), skipped(TODAY, 'bench')];
    expect(lastSet(entries, 'bench')).toEqual({ loadKg: 80, reps: 6 });
    expect(lastSet(entries, 'deadlift')).toBeNull();
  });
});
