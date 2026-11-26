// Suivi des modifications et réconciliation (lot 5b) : quand lire par jeton, quand relire par période,
// et ce qui est supprimé. Base et Health Connect simulés, données fictives.

import { syncHealthConnect } from './healthConnect';

const mockDb = {
  tokens: new Map<string, string | null>(),
  upserts: [] as { table: string; ids: string[] }[],
  deletes: [] as { table: string; ids: string[] }[],
  local: [] as { id: string; start: number; end: number }[],
  saved: new Map<string, string | null>(),
};
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
}));
jest.mock('@/db/syncRuns', () => ({ currentRecorder: () => null, countTableRows: async () => 0 }));
jest.mock('react-native-health-connect', () => ({
  getGrantedPermissions: async () => [{ accessType: 'read', recordType: 'HeartRateVariabilityRmssd' }],
  getChanges: async (request: { changesToken?: string }) => {
    mockHc.calls.push(request.changesToken ? `changes:${request.changesToken}` : 'token');
    if (!request.changesToken) {
      return { upsertionChanges: [], deletionChanges: [], nextChangesToken: 'neuf', changesTokenExpired: false, hasMore: false };
    }
    return mockHc.changes.shift();
  },
  readRecords: async () => {
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
