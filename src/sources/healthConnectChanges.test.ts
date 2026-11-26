// Suivi des modifications et réconciliation (lot 5b) : quand lire par jeton, quand relire par période,
// et ce qui est supprimé. Base et Health Connect simulés, données fictives.

import { backfillHistory, syncHealthConnect } from './healthConnect';

const mockDb = {
  tokens: new Map<string, string | null>(),
  upserts: [] as { table: string; ids: string[] }[],
  deletes: [] as { table: string; ids: string[] }[],
  local: [] as { id: string; start: number; end: number }[],
  saved: new Map<string, string | null>(),
  oldest: null as number | null,
};
const mockGranted = { types: ['HeartRateVariabilityRmssd'] };
const mockHc = {
  changes: [] as {
    upsertionChanges: { record: unknown }[];
    deletionChanges: { recordId: string }[];
    nextChangesToken: string;
    changesTokenExpired: boolean;
    hasMore: boolean;
  }[],
  records: [] as unknown[],
  calls: [] as string[],
  ranges: [] as [number, number][],
};

jest.mock('@/db/healthData', () => ({
  WEIGHT_FROM_HEALTH_CONNECT: 'manuel exclu',
  getLastSync: async () => 1_000_000,
  getChangesToken: async (type: string) => mockDb.tokens.get(type) ?? null,
  saveSyncState: async (type: string, _ms: number, token: string | null) => void mockDb.saved.set(type, token),
  setLastSync: async () => undefined,
  upsertRows: async (table: string, _cols: string[], rows: unknown[][]) =>
    void (rows.length && mockDb.upserts.push({ table, ids: rows.map((r) => String(r[0])) })),
  deleteRowsById: async (table: string, _col: string, ids: string[]) => void (ids.length && mockDb.deletes.push({ table, ids })),
  loadLocalRows: async () => mockDb.local,
  loadSleeps: async () => [],
  loadExercises: async () => [],
  heartRateRecordIds: async () => [],
  deleteHeartRateRecords: async () => undefined,
  countExerciseHeartRate: async () => new Map(),
  loadBackfillAttempts: async () => new Map(),
  recordBackfillAttempt: async () => undefined,
  oldestLocalTime: async () => mockDb.oldest,
  oldestByOrigin: async (table: string) => (table === 'hc_hrv' ? [{ origin: 'zepp', oldest: 42 }] : []),
}));
jest.mock('@/db/syncRuns', () => ({ currentRecorder: () => null, countTableRows: async () => 0 }));
jest.mock('react-native-health-connect', () => ({
  getGrantedPermissions: async () => mockGranted.types.map((recordType) => ({ accessType: 'read', recordType })),
  getChanges: async (request: { changesToken?: string }) => {
    mockHc.calls.push(request.changesToken ? `changes:${request.changesToken}` : 'token');
    if (!request.changesToken) {
      return { upsertionChanges: [], deletionChanges: [], nextChangesToken: 'neuf', changesTokenExpired: false, hasMore: false };
    }
    return mockHc.changes.shift();
  },
  readRecords: async (_type: string, options: { timeRangeFilter: { startTime: string; endTime: string } }) => {
    mockHc.ranges.push([Date.parse(options.timeRangeFilter.startTime), Date.parse(options.timeRangeFilter.endTime)]);
    mockHc.calls.push('période');
    return { records: mockHc.records };
  },
  SdkAvailabilityStatus: {},
}));

const hrv = (id: string, time: number) => ({
  time: new Date(time).toISOString(),
  heartRateVariabilityMillis: 30,
  metadata: { id, dataOrigin: 'zepp' },
});
const NOW = 2_000_000_000;
const sync = () => syncHealthConnect(NOW, { types: ['HeartRateVariabilityRmssd'] });

beforeEach(() => {
  mockDb.tokens.clear();
  mockDb.saved.clear();
  mockDb.upserts = [];
  mockDb.deletes = [];
  mockDb.local = [];
  mockHc.changes = [];
  mockHc.records = [];
  mockHc.calls = [];
  mockHc.ranges = [];
  mockDb.oldest = null;
  mockGranted.types = ['HeartRateVariabilityRmssd'];
});

it('sans jeton : jeton demandé avant la lecture par période, puis réconciliation ; le jeton est gardé', async () => {
  mockHc.records = [hrv('a', 1_500_000)];
  mockDb.local = [
    { id: 'a', start: 1_500_000, end: 1_500_000 },
    { id: 'disparue', start: 1_600_000, end: 1_600_000 },
  ];
  const [report] = await sync();
  expect(report.state).toBe('ok');
  expect(mockHc.calls).toEqual(['token', 'période']);
  expect(mockDb.upserts).toEqual([{ table: 'hc_hrv', ids: ['a'] }]);
  expect(mockDb.deletes).toEqual([{ table: 'hc_hrv', ids: ['disparue'] }]);
  expect(mockDb.saved.get('HeartRateVariabilityRmssd')).toBe('neuf');
});

it('avec un jeton : seulement les modifications (ajouts, suppressions), sur plusieurs pages', async () => {
  mockDb.tokens.set('HeartRateVariabilityRmssd', 'j1');
  mockHc.changes = [
    { upsertionChanges: [{ record: hrv('b', 1) }], deletionChanges: [], nextChangesToken: 'j2', changesTokenExpired: false, hasMore: true },
    { upsertionChanges: [], deletionChanges: [{ recordId: 'c' }], nextChangesToken: 'j3', changesTokenExpired: false, hasMore: false },
  ];
  const [report] = await sync();
  expect(report.count).toBe(2);
  expect(mockHc.calls).toEqual(['changes:j1', 'changes:j2']); // aucune lecture par période
  expect(mockDb.upserts).toEqual([{ table: 'hc_hrv', ids: ['b'] }]);
  expect(mockDb.deletes).toEqual([{ table: 'hc_hrv', ids: ['c'] }]);
  expect(mockDb.saved.get('HeartRateVariabilityRmssd')).toBe('j3');
});

it('jeton expiré : relecture par période et nouveau jeton', async () => {
  mockDb.tokens.set('HeartRateVariabilityRmssd', 'vieux');
  mockHc.changes = [
    { upsertionChanges: [], deletionChanges: [], nextChangesToken: '', changesTokenExpired: true, hasMore: false },
  ];
  mockHc.records = [hrv('a', 1_500_000)];
  await sync();
  expect(mockHc.calls).toEqual(['changes:vieux', 'token', 'période']);
  expect(mockDb.saved.get('HeartRateVariabilityRmssd')).toBe('neuf');
});

describe('rattrapage de l’historique', () => {
  const DAY = 24 * 3600_000;
  /** Avance l'horloge d'une heure : les autorisations, gardées 30 s, sont relues. */
  let clock = Date.now();
  beforeEach(() => {
    clock += 3600_000;
    jest.spyOn(Date, 'now').mockReturnValue(clock);
  });
  afterEach(() => jest.restoreAllMocks());

  it('lit même si l’autorisation « anciennes données » n’est pas signalée (la bibliothèque ne la signale jamais)', async () => {
    mockDb.oldest = NOW - 300 * DAY;
    const result = await backfillHistory(() => undefined, NOW);
    expect(mockHc.calls.filter((c) => c === 'période')).toHaveLength(3);
    expect(result.movedBack).toBe(0); // base simulée : le plus ancien enregistrement n'a pas reculé
  });

  it('lit par tranches de 30 jours, du plus ancien enregistrement local jusqu’à 365 jours, avec la progression', async () => {
    const now = NOW;
    mockDb.oldest = now - 300 * DAY;
    const progress: string[] = [];
    const result = await backfillHistory((p) => progress.push(`${p.done}/${p.total}`), now);
    expect(mockHc.ranges.map(([a, b]) => [(now - a) / DAY, (now - b) / DAY])).toEqual([
      [330, 300],
      [360, 330],
      [365, 360],
    ]);
    expect(progress).toEqual(['0/3', '1/3', '2/3', '3/3']);
    expect(result).toEqual({
      state: 'done',
      failedReads: 0,
      movedBack: 0,
      oldest: [{ label: 'HRV (rMSSD)', origin: 'zepp', oldest: 42 }],
    });
  });
});
