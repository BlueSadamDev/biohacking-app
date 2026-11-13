// Connecteur Health Connect (lecture seule, jamais d'écriture).
// - Inventaire (écran de diagnostic) : types reçus par app d'origine, sans valeurs.
// - Synchronisation (lot 1) : copie dans la base locale du sommeil, de la HRV,
//   de la FC au repos, de la FC (pendant le sommeil), des pas et du poids.
// Aucune valeur de santé n'est écrite dans les logs.

import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
  type ReadHealthDataHistoryPermission,
  type RecordType,
} from 'react-native-health-connect';

import { getLastSync, loadSleeps, setLastSync, upsertRows } from '@/db/healthData';
import type { SleepSession } from '@/domain/nightly';
import { SETTINGS } from '@/domain/settings';

/** Types lus par l'app au lot 1 (les seuls dont la permission est demandée). */
export const SYNC_TYPES = [
  { type: 'SleepSession', label: 'Sommeil' },
  { type: 'HeartRateVariabilityRmssd', label: 'HRV (rMSSD)' },
  { type: 'RestingHeartRate', label: 'FC au repos' },
  { type: 'HeartRate', label: 'Fréquence cardiaque' },
  { type: 'Steps', label: 'Pas' },
  { type: 'Weight', label: 'Poids' },
] as const satisfies readonly { type: RecordType; label: string }[];

type SyncType = (typeof SYNC_TYPES)[number]['type'];

/** Types affichés dans l'inventaire du diagnostic (ceux du lot 0). */
export const INVENTORY_TYPES: { type: RecordType; label: string }[] = [
  { type: 'Steps', label: 'Pas' },
  { type: 'Distance', label: 'Distance' },
  { type: 'ActiveCaloriesBurned', label: 'Calories actives' },
  { type: 'TotalCaloriesBurned', label: 'Calories totales' },
  { type: 'HeartRate', label: 'Fréquence cardiaque' },
  { type: 'RestingHeartRate', label: 'FC au repos' },
  { type: 'HeartRateVariabilityRmssd', label: 'HRV (rMSSD)' },
  { type: 'SleepSession', label: 'Sommeil' },
  { type: 'ExerciseSession', label: "Séances d'exercice" },
  { type: 'ElevationGained', label: 'Dénivelé' },
  { type: 'OxygenSaturation', label: 'SpO2' },
  { type: 'Vo2Max', label: 'VO2max' },
  { type: 'Weight', label: 'Poids' },
];

/** Noms lisibles des apps d'origine connues (sinon on affiche le nom technique). */
const KNOWN_ORIGINS: Record<string, string> = {
  'com.stt.android.suunto': 'Suunto',
  'com.huami.watch.hmwatchmanager': 'Zepp (Helio Strap)',
  'com.google.android.apps.healthdata': 'Health Connect',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.sec.android.app.shealth': 'Samsung Health',
};

export function originLabel(packageName: string): string {
  return KNOWN_ORIGINS[packageName] ?? packageName;
}

export type HealthConnectStatus = 'available' | 'update-required' | 'unavailable';

export type OriginSummary = {
  origin: string;
  count: number;
  first: Date;
  last: Date;
};

export type TypeInventory = {
  type: RecordType;
  label: string;
  /**
   * 'ok' : lu ; 'denied' : permission refusée ; 'not-requested' : type non utilisé
   * au lot en cours (permission non demandée) ; 'error' : lecture impossible.
   */
  state: 'ok' | 'denied' | 'not-requested' | 'error';
  origins: OriginSummary[];
  errorMessage?: string;
};

const SYNC_TYPE_SET = new Set<string>(SYNC_TYPES.map(({ type }) => type));

/** Permissions demandées : lecture des types du lot 1 + lecture de l'historique (plus de 30 jours). */
const READ_PERMISSIONS: (Permission | ReadHealthDataHistoryPermission)[] = [
  ...SYNC_TYPES.map(({ type }): Permission => ({ accessType: 'read', recordType: type })),
  { accessType: 'read', recordType: 'ReadHealthDataHistory' },
];

/** Vérifie si Health Connect est présent et à jour sur le téléphone. */
export async function getStatus(): Promise<HealthConnectStatus> {
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
    const ok = await initialize();
    return ok ? 'available' : 'unavailable';
  }
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return 'update-required';
  }
  return 'unavailable';
}

/** Types pour lesquels l'utilisateur a donné la permission de lecture. */
export async function getGrantedReadTypes(): Promise<Set<string>> {
  const granted = await getGrantedPermissions();
  return new Set(
    granted.filter((p) => p.accessType === 'read').map((p) => p.recordType as string),
  );
}

/** Ouvre la fenêtre Health Connect de demande de permissions (lecture seule). */
export async function askReadPermissions(): Promise<void> {
  await requestPermission(READ_PERMISSIONS);
}

export function openSettings(): void {
  openHealthConnectSettings();
}

/** Date d'un enregistrement : instantané (time) ou intervalle (startTime). */
function recordDate(record: object): Date | null {
  const r = record as { time?: string; startTime?: string };
  const iso = r.time ?? r.startTime;
  return iso ? new Date(iso) : null;
}

/** Lit tous les enregistrements d'un type (toutes les pages) et les regroupe par app d'origine. */
async function inventoryOfType(type: RecordType, since: Date, until: Date): Promise<OriginSummary[]> {
  const byOrigin = new Map<string, OriginSummary>();
  let pageToken: string | undefined;

  do {
    const result = await readRecords(type, {
      timeRangeFilter: {
        operator: 'between',
        startTime: since.toISOString(),
        endTime: until.toISOString(),
      },
      pageSize: 5000,
      pageToken,
    });

    for (const record of result.records) {
      const origin = record.metadata?.dataOrigin ?? 'inconnue';
      const date = recordDate(record);
      if (!date) continue;
      const summary = byOrigin.get(origin);
      if (!summary) {
        byOrigin.set(origin, { origin, count: 1, first: date, last: date });
      } else {
        summary.count += 1;
        if (date < summary.first) summary.first = date;
        if (date > summary.last) summary.last = date;
      }
    }

    pageToken = result.pageToken || undefined;
  } while (pageToken);

  return [...byOrigin.values()].sort((a, b) => b.count - a.count);
}

/** Inventaire complet des types du lot 0 sur les `days` derniers jours. */
export async function readInventory(days: number): Promise<TypeInventory[]> {
  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  const granted = await getGrantedReadTypes();

  const results: TypeInventory[] = [];
  for (const { type, label } of INVENTORY_TYPES) {
    if (!granted.has(type)) {
      const state = SYNC_TYPE_SET.has(type) ? 'denied' : 'not-requested';
      results.push({ type, label, state, origins: [] });
      continue;
    }
    try {
      const origins = await inventoryOfType(type, since, until);
      results.push({ type, label, state: 'ok', origins });
    } catch (e) {
      results.push({
        type,
        label,
        state: 'error',
        origins: [],
        errorMessage: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Synchronisation vers la base locale (lot 1)
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

export type SyncTypeReport = {
  type: SyncType;
  label: string;
  /** 'ok' : synchronisé ; 'denied' : permission refusée ; 'error' : lecture impossible. */
  state: 'ok' | 'denied' | 'error';
  /** Nombre d'enregistrements lus (jamais de valeurs). */
  count: number;
  errorMessage?: string;
};

/** Lit tous les enregistrements d'un type entre deux instants (toutes les pages). */
async function readAll<T extends SyncType>(type: T, since: number, until: number) {
  const records = [];
  let pageToken: string | undefined;
  do {
    const result = await readRecords(type, {
      timeRangeFilter: {
        operator: 'between',
        startTime: new Date(since).toISOString(),
        endTime: new Date(until).toISOString(),
      },
      pageSize: 5000,
      pageToken,
    });
    records.push(...result.records);
    pageToken = result.pageToken || undefined;
  } while (pageToken);
  return records;
}

const ms = (iso: string) => new Date(iso).getTime();

function idOf(record: { metadata?: { id?: string } }, fallback: string): string {
  return record.metadata?.id || fallback;
}

function originOf(record: { metadata?: { dataOrigin?: string } }): string {
  return record.metadata?.dataOrigin ?? 'inconnue';
}

function insideAnySleep(time: number, sleeps: SleepSession[]): boolean {
  return sleeps.some((s) => time >= s.start && time <= s.end);
}

/** Lit un type dans Health Connect et l'enregistre dans la base. Renvoie le nombre lu. */
async function syncType(type: SyncType, since: number, until: number): Promise<number> {
  switch (type) {
    case 'SleepSession': {
      const records = await readAll('SleepSession', since, until);
      await upsertRows(
        'hc_sleep',
        ['id', 'start_ms', 'end_ms', 'stages_json', 'origin'],
        records.map((r) => [
          idOf(r, `sleep-${r.startTime}`),
          ms(r.startTime),
          ms(r.endTime),
          JSON.stringify((r.stages ?? []).map((s) => ({ start: ms(s.startTime), end: ms(s.endTime), stage: s.stage }))),
          originOf(r),
        ]),
      );
      return records.length;
    }
    case 'HeartRateVariabilityRmssd': {
      const records = await readAll('HeartRateVariabilityRmssd', since, until);
      await upsertRows(
        'hc_hrv',
        ['id', 'time_ms', 'rmssd_ms', 'origin'],
        records.map((r) => [idOf(r, `hrv-${r.time}`), ms(r.time), r.heartRateVariabilityMillis, originOf(r)]),
      );
      return records.length;
    }
    case 'RestingHeartRate': {
      const records = await readAll('RestingHeartRate', since, until);
      await upsertRows(
        'hc_resting_hr',
        ['id', 'time_ms', 'bpm', 'origin'],
        records.map((r) => [idOf(r, `rhr-${r.time}`), ms(r.time), r.beatsPerMinute, originOf(r)]),
      );
      return records.length;
    }
    case 'HeartRate': {
      // FC continue : on ne garde que les mesures prises pendant un sommeil déjà synchronisé.
      const records = await readAll('HeartRate', since, until);
      const sleeps = await loadSleeps(since - DAY_MS);
      const rows = records.flatMap((r) => {
        const id = idOf(r, `hr-${r.startTime}`);
        const origin = originOf(r);
        return r.samples
          .map((s) => ({ time: ms(s.time), bpm: s.beatsPerMinute }))
          .filter((s) => insideAnySleep(s.time, sleeps))
          .map((s) => [id, s.time, s.bpm, origin]);
      });
      await upsertRows('hc_heart_rate', ['record_id', 'time_ms', 'bpm', 'origin'], rows);
      return records.length;
    }
    case 'Steps': {
      const records = await readAll('Steps', since, until);
      await upsertRows(
        'hc_steps',
        ['id', 'start_ms', 'end_ms', 'count', 'origin'],
        records.map((r) => [idOf(r, `steps-${r.startTime}`), ms(r.startTime), ms(r.endTime), r.count, originOf(r)]),
      );
      return records.length;
    }
    case 'Weight': {
      const records = await readAll('Weight', since, until);
      await upsertRows(
        'weight',
        ['id', 'time_ms', 'kg', 'source', 'origin'],
        records.map((r) => [
          `hc-${idOf(r, r.time)}`,
          ms(r.time),
          r.weight.inKilograms,
          'health_connect',
          originOf(r),
        ]),
      );
      return records.length;
    }
  }
}

/**
 * Synchronise les types du lot 1 depuis Health Connect vers la base locale.
 * Première fois : `firstSyncDays` jours d'historique. Ensuite : depuis la dernière
 * synchro réussie, moins `overlapDays` jours (données arrivées en retard).
 * Le sommeil passe en premier : la FC continue est filtrée sur les sommeils connus.
 */
export async function syncHealthConnect(now: number = Date.now()): Promise<SyncTypeReport[]> {
  const granted = await getGrantedReadTypes();
  const reports: SyncTypeReport[] = [];
  for (const { type, label } of SYNC_TYPES) {
    if (!granted.has(type)) {
      reports.push({ type, label, state: 'denied', count: 0 });
      continue;
    }
    const last = await getLastSync(type);
    const since =
      last === null ? now - SETTINGS.sync.firstSyncDays * DAY_MS : last - SETTINGS.sync.overlapDays * DAY_MS;
    try {
      const count = await syncType(type, since, now);
      await setLastSync(type, now);
      reports.push({ type, label, state: 'ok', count });
    } catch (e) {
      reports.push({
        type,
        label,
        state: 'error',
        count: 0,
        errorMessage: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return reports;
}
