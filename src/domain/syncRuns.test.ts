// Mesure de la synchro (lot 5b, étape 1) : relevé des durées et comptages, sur une horloge fictive.

import { createSyncRecorder, latestRuns, runTotals, type SyncRun } from './syncRuns';

/** Horloge fictive : avance seulement quand on le demande. */
function fakeClock(start = 1_000) {
  let now = start;
  return { clock: () => now, advance: (ms: number) => (now += ms) };
}

describe('relevé d’une synchro', () => {
  it('compte appels, lectures, écritures et durées par type, et les appels d’accès à part', () => {
    const { clock, advance } = fakeClock();
    const rec = createSyncRecorder('launch', clock);
    rec.countCall(); // avant tout type : appel d'accès (autorisations)
    rec.countAccessCall();

    rec.beginType('SleepSession');
    rec.countCall();
    rec.addRead(3);
    rec.addWritten(3);
    advance(200);
    rec.endType('ok', 1);

    rec.beginType('HeartRate');
    rec.countCall();
    rec.countCall();
    rec.addRead(7000);
    rec.addWritten(1200);
    advance(1500);
    rec.endType('ok', 300);

    rec.beginType('Weight');
    rec.endType('denied', 0);

    rec.addNights(50, 120);
    advance(100);
    rec.markHomeReady();
    rec.addNights(40, 110); // deuxième calcul (notification du matin)
    advance(400);
    const run = rec.finish();

    expect(run.origin).toBe('launch');
    expect(run.accessCalls).toBe(2);
    expect(run.types).toEqual([
      { type: 'SleepSession', state: 'ok', durationMs: 200, calls: 1, read: 3, written: 3, inserted: 1 },
      { type: 'HeartRate', state: 'ok', durationMs: 1500, calls: 2, read: 7000, written: 1200, inserted: 300 },
      { type: 'Weight', state: 'denied', durationMs: 0, calls: 0, read: 0, written: 0, inserted: 0 },
    ]);
    expect(run.homeReadyMs).toBe(1800);
    expect(run.totalMs).toBe(2200);
    expect(run.nightsRuns).toBe(2);
    expect(runTotals(run)).toEqual({ calls: 5, read: 7003, written: 1203, inserted: 301, typesMs: 1700, nightsMs: 320 });
  });

  it('ne compte rien après la fin, et l’accueil à jour n’est noté qu’une fois', () => {
    const { clock, advance } = fakeClock();
    const rec = createSyncRecorder('button', clock);
    advance(100);
    rec.markHomeReady();
    advance(100);
    rec.markHomeReady();
    const run = rec.finish();
    rec.countAccessCall();
    rec.addNights(10, 10);
    expect(rec.finished).toBe(true);
    expect(rec.finish()).toBe(run);
    expect(run).toMatchObject({ homeReadyMs: 100, totalMs: 200, accessCalls: 0, nightsRuns: 0 });
  });

  it('un type jamais terminé (lecture interrompue) est noté en erreur', () => {
    const rec = createSyncRecorder('background', fakeClock().clock);
    rec.beginType('Steps');
    rec.addRead(5);
    const run = rec.finish();
    expect(run.types).toEqual([{ type: 'Steps', state: 'error', durationMs: 0, calls: 0, read: 5, written: 0, inserted: 0 }]);
    expect(run.homeReadyMs).toBeNull();
  });

  it('les lignes nouvelles ne sont jamais négatives', () => {
    const rec = createSyncRecorder('button', fakeClock().clock);
    rec.beginType('Weight');
    rec.endType('ok', -2);
    expect(rec.finish().types[0].inserted).toBe(0);
  });
});

describe('dernières synchros gardées', () => {
  const run = (startedMs: number): SyncRun => ({
    startedMs,
    origin: 'button',
    totalMs: 0,
    homeReadyMs: null,
    accessCalls: 0,
    nightsRuns: 0,
    nightsReadMs: 0,
    nightsComputeMs: 0,
    types: [],
  });

  it('garde les plus récentes, de la plus récente à la plus ancienne', () => {
    const runs = [5, 1, 12, 3, 8, 2, 9, 11, 4, 7, 6, 10].map(run);
    expect(latestRuns(runs, 10).map((r) => r.startedMs)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(latestRuns(runs.slice(0, 3), 10).map((r) => r.startedMs)).toEqual([12, 5, 1]);
  });
});
