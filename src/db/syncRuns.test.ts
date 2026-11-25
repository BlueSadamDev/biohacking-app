// Relevé des synchros (lot 5b) : un relevé est toujours clos et enregistré, même quand une étape
// ne répond plus. Base simulée (aucune donnée de santé). jest.mock est remonté avant les imports.

import { writeTransaction } from './database';
import { activeRunStartedMs, beginSyncRun, endSyncRun, settleWithin, syncRunSaveError } from './syncRuns';

jest.mock('./database', () => ({
  getDb: jest.fn(),
  writeTransaction: jest.fn(async (task: (tx: { runAsync: jest.Mock }) => Promise<void>) => {
    await task({ runAsync: jest.fn(async () => undefined) });
  }),
}));

afterEach(() => {
  jest.useRealTimers();
});

describe('settleWithin', () => {
  it('rend la main dès que la tâche finit, ou au bout du délai si elle ne répond pas', async () => {
    jest.useFakeTimers();
    let done = false;
    const never = new Promise<void>(() => undefined);
    const waiting = settleWithin(never, 20).then(() => (done = true));
    await jest.advanceTimersByTimeAsync(19_000);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(1_000);
    await waiting;
    expect(done).toBe(true);

    await expect(settleWithin(Promise.reject(new Error('refus')), 20)).resolves.toBeUndefined();
  });
});

describe('relevé en cours', () => {
  it('une demande pendant une synchro rejoint le relevé ; un relevé abandonné est enregistré et remplacé', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const first = beginSyncRun('launch');
    expect(first.owner).toBe(true);
    expect(beginSyncRun('button')).toEqual({ recorder: first.recorder, owner: false });

    // 11 minutes plus tard, le relevé n'a jamais été clos : il est enregistré tel quel.
    jest.setSystemTime(1_000_000 + 11 * 60_000);
    const second = beginSyncRun('button');
    expect(second.owner).toBe(true);
    expect(second.recorder).not.toBe(first.recorder);
    expect(first.recorder.finished).toBe(true);
    expect(activeRunStartedMs()).toBe(second.recorder.startedMs);

    await endSyncRun(second.recorder);
    expect(activeRunStartedMs()).toBeNull();
    expect(writeTransaction).toHaveBeenCalledTimes(2);
    expect(syncRunSaveError()).toBeNull();
  });

  it('un échec d’enregistrement est gardé pour Contrôle des données, sans casser la synchro', async () => {
    (writeTransaction as jest.Mock).mockRejectedValueOnce(new Error('table absente'));
    const { recorder } = beginSyncRun('background');
    await expect(endSyncRun(recorder)).resolves.toBeUndefined();
    expect(syncRunSaveError()).toBe('table absente');
  });
});
