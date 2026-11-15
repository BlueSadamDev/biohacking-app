// Base occupée (« database is locked ») : deux synchros simultanées ne doivent ni
// échouer ni se chevaucher. Base et Health Connect sont simulés, données fictives.

type Row = (string | number | null)[];

/**
 * Fausse base partagée par tous les « moteurs » JavaScript du test. Comme SQLite :
 * une seule connexion écrit à la fois ; une connexion sans délai de patience
 * échoue aussitôt (« database is locked »), une connexion avec délai attend.
 */
const mockStore = {
  lockOwner: null as object | null,
  tables: new Map<string, Map<string, Row>>(),
  writing: 0,
  maxWriting: 0,
};
/** Types lus dans Health Connect (un appel = une lecture). */
const mockReads: string[] = [];

jest.mock('expo-sqlite', () => {
  const pause = () => new Promise((resolve) => setTimeout(resolve, 1));

  function connection() {
    const conn = { busyTimeoutMs: 0 };
    async function lock() {
      const start = Date.now();
      while (mockStore.lockOwner && mockStore.lockOwner !== conn) {
        if (Date.now() - start >= conn.busyTimeoutMs) throw new Error('database is locked');
        await pause();
      }
      mockStore.lockOwner = conn;
    }
    function unlock() {
      if (mockStore.lockOwner === conn) mockStore.lockOwner = null;
    }
    async function write(table: string, row: Row) {
      mockStore.writing++;
      mockStore.maxWriting = Math.max(mockStore.maxWriting, mockStore.writing);
      await pause();
      if (!mockStore.tables.has(table)) mockStore.tables.set(table, new Map());
      mockStore.tables.get(table)!.set(String(row[0]), row);
      mockStore.writing--;
    }
    async function execAsync(sql: string) {
      const pragma = /busy_timeout = (\d+)/.exec(sql);
      if (pragma) conn.busyTimeoutMs = Number(pragma[1]);
      else if (/^(COMMIT|ROLLBACK)/.test(sql)) unlock();
      else if (!/^(BEGIN|PRAGMA)/.test(sql)) await lock();
    }
    return {
      execAsync,
      prepareAsync: async (sql: string) => ({
        executeAsync: async (row: Row) => {
          await lock();
          await write(/INTO (\w+)/.exec(sql)![1], row);
        },
        finalizeAsync: async () => undefined,
      }),
      runAsync: async (sql: string) => {
        await lock();
        await write('autre', [sql]);
        unlock();
      },
      getFirstAsync: async () => ({ user_version: 999 }), // schéma déjà à jour
      getAllAsync: async () => [],
      withExclusiveTransactionAsync: async (task: (tx: unknown) => Promise<void>) => {
        const tx = connection(); // expo-sqlite ouvre une nouvelle connexion
        await tx.execAsync('BEGIN');
        try {
          await task(tx);
          await tx.execAsync('COMMIT');
        } catch (e) {
          await tx.execAsync('ROLLBACK');
          throw e;
        }
      },
    };
  }

  return { openDatabaseAsync: async () => connection() };
});

jest.mock('react-native-health-connect', () => {
  const { FAKE_HC_RECORDS } = jest.requireActual('@/domain/__fixtures__/healthConnectRecords');
  const types = [
    'SleepSession',
    'ExerciseSession',
    'HeartRateVariabilityRmssd',
    'RestingHeartRate',
    'HeartRate',
    'Steps',
    'Weight',
    'Nutrition',
  ];
  return {
    getGrantedPermissions: async () => types.map((recordType) => ({ accessType: 'read', recordType })),
    readRecords: async (type: string) => {
      mockReads.push(type);
      await new Promise((resolve) => setTimeout(resolve, 2));
      return { records: FAKE_HC_RECORDS[type] ?? [] };
    },
    SdkAvailabilityStatus: {},
  };
});

type HealthConnectModule = typeof import('@/sources/healthConnect');
type DatabaseModule = typeof import('./database');

/** Charge une copie indépendante des modules, comme un second moteur JavaScript (tâche de fond). */
function loadEngine(): { hc: HealthConnectModule; db: DatabaseModule } {
  let engine!: { hc: HealthConnectModule; db: DatabaseModule };
  jest.isolateModules(() => {
    engine = { hc: jest.requireActual('@/sources/healthConnect'), db: jest.requireActual('./database') };
  });
  return engine;
}

const NOW = Date.parse('2026-01-12T00:00:00.000Z');

beforeEach(() => {
  mockStore.lockOwner = null;
  mockStore.tables.clear();
  mockStore.writing = 0;
  mockStore.maxWriting = 0;
  mockReads.length = 0;
});

describe('deux synchros simultanées', () => {
  it('dans l’app : la seconde attend la première et reçoit son résultat (une seule lecture)', async () => {
    const { hc } = loadEngine();
    const [first, second] = await Promise.all([hc.syncHealthConnect(NOW), hc.syncHealthConnect(NOW)]);

    expect(second).toBe(first);
    expect(first.every((r) => r.state === 'ok')).toBe(true);
    expect(mockReads).toHaveLength(8); // chaque type lu une seule fois
    expect(mockStore.tables.get('hc_hrv')?.size).toBe(2);
  });

  it('app et tâche de fond (deux moteurs séparés) : aucune erreur, aucune écriture chevauchée', async () => {
    const app = loadEngine();
    const background = loadEngine();
    const [fromApp, fromBackground] = await Promise.all([
      app.hc.syncHealthConnect(NOW),
      background.hc.syncHealthConnect(NOW),
    ]);

    for (const report of [...fromApp, ...fromBackground]) expect(report.state).toBe('ok');
    expect(mockReads).toHaveLength(16); // deux vraies synchros
    expect(mockStore.maxWriting).toBe(1);
    expect(mockStore.tables.get('hc_sleep')?.size).toBe(1);
    expect(mockStore.tables.get('hc_hrv')?.size).toBe(2);
    expect(mockStore.tables.get('hc_resting_hr')?.size).toBe(1);
    expect(mockStore.tables.get('hc_steps')?.size).toBe(1);
    expect(mockStore.tables.get('sync_state')?.size).toBe(8);
  });

  it('témoin : sans délai de patience, la base occupée échoue avec « database is locked »', async () => {
    const sqlite = jest.requireMock('expo-sqlite');
    const holder = await sqlite.openDatabaseAsync();
    await holder.runAsync('UPDATE x'); // libère tout de suite
    const busy = await sqlite.openDatabaseAsync();
    await busy.execAsync('UPDATE y'); // prend le verrou et le garde
    const other = await sqlite.openDatabaseAsync();
    await expect(other.runAsync('UPDATE z')).rejects.toThrow('database is locked');
  });
});

describe('file d’attente des écritures', () => {
  it('passe les écritures une par une, même si l’une échoue', async () => {
    const { db } = loadEngine();
    const log: string[] = [];
    const step = (name: string, fail = false) =>
      db.runExclusive(async () => {
        log.push(`début ${name}`);
        await new Promise((resolve) => setTimeout(resolve, 2));
        log.push(`fin ${name}`);
        if (fail) throw new Error('échec simulé');
      });

    const results = await Promise.allSettled([step('A'), step('B', true), step('C')]);

    expect(log).toEqual(['début A', 'fin A', 'début B', 'fin B', 'début C', 'fin C']);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });
});
