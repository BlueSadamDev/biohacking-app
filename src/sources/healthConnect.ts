// Connecteur Health Connect (lecture seule, jamais d'écriture).
// - Inventaire (écran de diagnostic) : types reçus par app d'origine, sans valeurs.
// - Synchronisation : copie dans la base locale du sommeil, des séances, de la HRV,
//   de la FC au repos, de la FC (pendant le sommeil et les séances), des pas,
//   du poids (lot 1) et des repas (lot 2).
// Aucune valeur de santé n'est écrite dans les logs.

import {
  getChanges,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type BackgroundAccessPermission,
  type Permission,
  type ReadHealthDataHistoryPermission,
  type RecordType,
} from 'react-native-health-connect';

import {
  countExerciseHeartRate,
  deleteHeartRateRecords,
  deleteRowsById,
  getChangesToken,
  getLastSync,
  heartRateRecordIds,
  loadBackfillAttempts,
  loadLocalRows,
  loadRawExercises,
  loadSleeps,
  oldestByOrigin,
  oldestLocalTime,
  recordBackfillAttempt,
  saveSyncState,
  setLastSync,
  upsertRows,
  WEIGHT_FROM_HEALTH_CONNECT,
} from '@/db/healthData';
import { countTableRows, currentRecorder } from '@/db/syncRuns';
import { heartRateBackfillTargets } from '@/domain/load';
import { historyChunks, insideRanges, mergeRanges, rowsToDelete, type TimeRange } from '@/domain/syncPlan';
import { SETTINGS } from '@/domain/settings';

/**
 * Types lus par l'app (les seuls dont la permission est demandée).
 * Ordre important : sommeil et séances avant la FC continue, qui est filtrée sur eux.
 */
export const SYNC_TYPES = [
  { type: 'SleepSession', label: 'Sommeil' },
  { type: 'ExerciseSession', label: 'Séances d’exercice' },
  { type: 'HeartRateVariabilityRmssd', label: 'HRV (rMSSD)' },
  { type: 'RestingHeartRate', label: 'FC au repos' },
  { type: 'HeartRate', label: 'Fréquence cardiaque' },
  { type: 'Steps', label: 'Pas' },
  { type: 'Weight', label: 'Poids' },
  { type: 'Nutrition', label: 'Nutrition (repas)' },
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
  { type: 'ExerciseSession', label: 'Séances d’exercice' },
  { type: 'ElevationGained', label: 'Dénivelé' },
  { type: 'OxygenSaturation', label: 'SpO2' },
  { type: 'Vo2Max', label: 'VO2max' },
  { type: 'Weight', label: 'Poids' },
  { type: 'Nutrition', label: 'Nutrition (repas)' },
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

/**
 * Permissions demandées : lecture des types synchronisés, lecture de l'historique
 * (plus de 30 jours) et lecture en arrière-plan (synchro quand l'app est fermée).
 */
const READ_PERMISSIONS: (Permission | ReadHealthDataHistoryPermission | BackgroundAccessPermission)[] = [
  ...SYNC_TYPES.map(({ type }): Permission => ({ accessType: 'read', recordType: type })),
  { accessType: 'read', recordType: 'ReadHealthDataHistory' },
  { accessType: 'read', recordType: 'BackgroundAccessPermission' },
];

/** La synchro en arrière-plan est-elle autorisée ? */
export async function hasBackgroundAccess(): Promise<boolean> {
  return (await getGrantedReadTypes()).has('BackgroundAccessPermission');
}

/** Health Connect déjà mis en route pendant cette session de l'app (lot 5b : une seule fois). */
let initialized = false;

/**
 * Vérifie si Health Connect est présent et à jour sur le téléphone. Une fois mis en route, il n'est
 * plus revérifié ni réinitialisé jusqu'à la fermeture de l'app.
 */
export async function getStatus(): Promise<HealthConnectStatus> {
  if (initialized) return 'available';
  currentRecorder()?.countAccessCall();
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
    currentRecorder()?.countAccessCall();
    initialized = await initialize();
    return initialized ? 'available' : 'unavailable';
  }
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return 'update-required';
  }
  return 'unavailable';
}

/** Autorisations lues récemment (lot 5b : une seule lecture par synchro, au lieu de deux ou plus). */
let grantedCache: { at: number; types: Set<string> } | null = null;

/**
 * Types pour lesquels l'utilisateur a donné la permission de lecture. Relues au plus une fois toutes
 * les `permissionsCacheSeconds` secondes, et toujours après une demande d'autorisation.
 */
export async function getGrantedReadTypes(): Promise<Set<string>> {
  const now = Date.now();
  if (grantedCache && now - grantedCache.at < SETTINGS.sync.permissionsCacheSeconds * 1000) return grantedCache.types;
  currentRecorder()?.countAccessCall();
  const granted = await getGrantedPermissions();
  const types = new Set(granted.filter((p) => p.accessType === 'read').map((p) => p.recordType as string));
  grantedCache = { at: now, types };
  return types;
}

/** Ouvre la fenêtre Health Connect de demande de permissions (lecture seule). */
export async function askReadPermissions(): Promise<void> {
  grantedCache = null;
  try {
    await requestPermission(READ_PERMISSIONS);
  } finally {
    grantedCache = null;
  }
}

export function openSettings(): void {
  // Les autorisations peuvent changer dans les réglages Health Connect : relues au retour.
  grantedCache = null;
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

/**
 * Lit tous les enregistrements d'un type entre deux instants (toutes les pages).
 * Pendant une synchro, chaque page compte pour un appel dans le relevé (lot 5b).
 */
async function readAll<T extends SyncType>(type: T, since: number, until: number) {
  const records = [];
  let pageToken: string | undefined;
  do {
    currentRecorder()?.countCall();
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
    currentRecorder()?.addRead(result.records.length);
    pageToken = result.pageToken || undefined;
  } while (pageToken);
  return records;
}

/** Table de la base où chaque type est enregistré (comptage des lignes nouvelles). */
const TABLE_OF: Record<SyncType, string> = {
  SleepSession: 'hc_sleep',
  ExerciseSession: 'hc_exercise',
  HeartRateVariabilityRmssd: 'hc_hrv',
  RestingHeartRate: 'hc_resting_hr',
  HeartRate: 'hc_heart_rate',
  Steps: 'hc_steps',
  Weight: 'weight',
  Nutrition: 'hc_nutrition',
};

/** Lignes d'une table, ou null si le comptage échoue (le relevé dira alors 0 ligne nouvelle). */
const rowsOf = (type: SyncType) => countTableRows(TABLE_OF[type]).catch(() => null);

const ms = (iso: string) => new Date(iso).getTime();

function idOf(record: { metadata?: { id?: string } }, fallback: string): string {
  return record.metadata?.id || fallback;
}

function originOf(record: { metadata?: { dataOrigin?: string } }): string {
  return record.metadata?.dataOrigin ?? 'inconnue';
}

const grams = (mass?: { inGrams: number }) => (mass && Number.isFinite(mass.inGrams) ? mass.inGrams : null);

/**
 * Rattrapage de la FC des séances : la FC continue n'est gardée que pendant les séances connues au
 * moment de la synchro. Une séance arrivée plus tard (ou une synchro manquée) restait donc sans mesure.
 * Chaque séance comptée récente sans aucune mesure est relue sur sa propre durée. Renvoie le nombre
 * d'enregistrements lus. Une séance que Health Connect ne peut pas relire est laissée de côté.
 */
async function backfillExerciseHeartRate(now: number): Promise<number> {
  const s = SETTINGS.sync;
  const since = now - s.heartRateBackfillDays * DAY_MS;
  const [sessions, counts, attempts] = await Promise.all([
    loadRawExercises(since),
    countExerciseHeartRate(since),
    loadBackfillAttempts(),
  ]);
  let read = 0;
  const targets = heartRateBackfillTargets(sessions, counts, since, s.heartRateBackfillMax, SETTINGS, attempts);
  for (const session of targets) {
    // Lot 5b : chaque essai est retenu ; au-delà de 3, la séance n'est plus relue.
    await recordBackfillAttempt(session.id, now).catch(() => undefined);
    try {
      const records = await readAll('HeartRate', session.start, session.end);
      read += records.length;
      const rows = records.flatMap((r) => {
        const id = idOf(r, `hr-${r.startTime}`);
        const origin = originOf(r);
        return r.samples
          .map((x) => ({ time: ms(x.time), bpm: x.beatsPerMinute }))
          .filter((x) => x.time >= session.start && x.time <= session.end)
          .map((x) => [id, x.time, x.bpm, origin]);
      });
      await upsertRows('hc_heart_rate', ['record_id', 'time_ms', 'bpm', 'origin'], rows);
    } catch {
      // Séance suivante : elle sera retentée à la prochaine synchro.
    }
  }
  return read;
}

// ---------------------------------------------------------------------------
// Lecture par type (lot 5b) : suivi des modifications quand un jeton existe, sinon lecture par période
// suivie d'une réconciliation. La fréquence cardiaque est à part : lue seulement sur les plages de
// sommeil et de séance (voir `syncHeartRate`).
// ---------------------------------------------------------------------------

type Row = (string | number | null)[];
type AnyRecord = Record<string, unknown> & { metadata?: { id?: string; dataOrigin?: string } };

/** Comment un type est rangé dans la base (hors fréquence cardiaque). */
type TableSpec = {
  table: string;
  columns: string[];
  /** Colonnes qui bornent un enregistrement dans le temps (les mêmes pour une mesure ponctuelle). */
  startColumn: string;
  endColumn: string;
  /** Lignes venues de Health Connect seulement (le poids saisi à la main n'est jamais touché). */
  where?: string;
  /** Identifiant local d'un enregistrement Health Connect. */
  localId: (hcId: string) => string;
  toRow: (r: AnyRecord) => Row;
};

const sleepStages = (r: AnyRecord) =>
  JSON.stringify(
    ((r.stages as { startTime: string; endTime: string; stage: number }[] | undefined) ?? []).map((x) => ({
      start: ms(x.startTime),
      end: ms(x.endTime),
      stage: x.stage,
    })),
  );
const kcal = (energy: unknown) => {
  const e = energy as { inKilocalories?: number } | undefined;
  return e && Number.isFinite(e.inKilocalories) ? (e.inKilocalories as number) : null;
};
const recordId = (r: AnyRecord, prefix: string) => idOf(r, `${prefix}-${String(r.startTime ?? r.time)}`);

const SPECS: Record<Exclude<SyncType, 'HeartRate'>, TableSpec> = {
  SleepSession: {
    table: 'hc_sleep',
    columns: ['id', 'start_ms', 'end_ms', 'stages_json', 'origin'],
    startColumn: 'start_ms',
    endColumn: 'end_ms',
    localId: (id) => id,
    toRow: (r) => [recordId(r, 'sleep'), ms(r.startTime as string), ms(r.endTime as string), sleepStages(r), originOf(r)],
  },
  ExerciseSession: {
    table: 'hc_exercise',
    columns: ['id', 'start_ms', 'end_ms', 'exercise_type', 'origin'],
    startColumn: 'start_ms',
    endColumn: 'end_ms',
    localId: (id) => id,
    toRow: (r) => [recordId(r, 'exercise'), ms(r.startTime as string), ms(r.endTime as string), r.exerciseType as number, originOf(r)],
  },
  Nutrition: {
    table: 'hc_nutrition',
    columns: ['id', 'start_ms', 'end_ms', 'energy_kcal', 'protein_g', 'carbs_g', 'fat_g', 'meal_type', 'origin'],
    startColumn: 'start_ms',
    endColumn: 'end_ms',
    localId: (id) => id,
    toRow: (r) => [
      recordId(r, 'meal'),
      ms(r.startTime as string),
      ms(r.endTime as string),
      kcal(r.energy),
      grams(r.protein as { inGrams: number } | undefined),
      grams(r.totalCarbohydrate as { inGrams: number } | undefined),
      grams(r.totalFat as { inGrams: number } | undefined),
      (r.mealType as number | undefined) ?? null,
      originOf(r),
    ],
  },
  HeartRateVariabilityRmssd: {
    table: 'hc_hrv',
    columns: ['id', 'time_ms', 'rmssd_ms', 'origin'],
    startColumn: 'time_ms',
    endColumn: 'time_ms',
    localId: (id) => id,
    toRow: (r) => [recordId(r, 'hrv'), ms(r.time as string), r.heartRateVariabilityMillis as number, originOf(r)],
  },
  RestingHeartRate: {
    table: 'hc_resting_hr',
    columns: ['id', 'time_ms', 'bpm', 'origin'],
    startColumn: 'time_ms',
    endColumn: 'time_ms',
    localId: (id) => id,
    toRow: (r) => [recordId(r, 'rhr'), ms(r.time as string), r.beatsPerMinute as number, originOf(r)],
  },
  Steps: {
    table: 'hc_steps',
    columns: ['id', 'start_ms', 'end_ms', 'count', 'origin'],
    startColumn: 'start_ms',
    endColumn: 'end_ms',
    localId: (id) => id,
    toRow: (r) => [recordId(r, 'steps'), ms(r.startTime as string), ms(r.endTime as string), r.count as number, originOf(r)],
  },
  Weight: {
    table: 'weight',
    columns: ['id', 'time_ms', 'kg', 'source', 'origin'],
    startColumn: 'time_ms',
    endColumn: 'time_ms',
    where: WEIGHT_FROM_HEALTH_CONNECT,
    localId: (id) => `hc-${id}`,
    toRow: (r) => [
      `hc-${idOf(r, String(r.time))}`,
      ms(r.time as string),
      (r.weight as { inKilograms: number }).inKilograms,
      'health_connect',
      originOf(r),
    ],
  },
};

/** Résultat de la lecture d'un type : enregistrements traités et jeton à garder pour la prochaine fois. */
type TypeResult = { count: number; token: string | null };

/** Nouveau jeton de suivi des modifications d'un type (null si Health Connect le refuse). */
async function freshChangesToken(type: SyncType): Promise<string | null> {
  try {
    currentRecorder()?.countCall();
    const result = await getChanges({ recordTypes: [type] });
    return result.nextChangesToken || null;
  } catch {
    return null;
  }
}

/**
 * Lecture par période puis réconciliation : dans [since, until], les lignes venues de Health Connect
 * qu'il ne renvoie plus sont supprimées. Le jeton est demandé avant la lecture, pour ne rien manquer de
 * ce qui changerait pendant celle-ci.
 */
async function syncByPeriod(type: Exclude<SyncType, 'HeartRate'>, since: number, until: number): Promise<TypeResult> {
  const spec = SPECS[type];
  const token = await freshChangesToken(type);
  const records = (await readAll(type, since, until)) as unknown as AnyRecord[];
  const rows = records.map(spec.toRow);
  await upsertRows(spec.table, spec.columns, rows);
  const returned = new Set(rows.map((row) => String(row[0])));
  const local = await loadLocalRows(spec.table, 'id', spec.startColumn, spec.endColumn, since, until, spec.where);
  await deleteRowsById(spec.table, 'id', rowsToDelete(local, returned, since, until));
  return { count: records.length, token };
}

/** Suivi des modifications : ajouts, modifications et suppressions depuis le jeton. null = jeton expiré. */
async function syncByChanges(type: Exclude<SyncType, 'HeartRate'>, token: string): Promise<TypeResult | null> {
  const spec = SPECS[type];
  let next = token;
  let count = 0;
  let hasMore = true;
  while (hasMore) {
    currentRecorder()?.countCall();
    const result = await getChanges({ changesToken: next });
    if (result.changesTokenExpired) return null;
    const rows = result.upsertionChanges.map((c) => spec.toRow(c.record as unknown as AnyRecord));
    const deleted = result.deletionChanges.map((c) => spec.localId(c.recordId));
    currentRecorder()?.addRead(rows.length + deleted.length);
    await upsertRows(spec.table, spec.columns, rows);
    await deleteRowsById(spec.table, 'id', spec.where ? deleted.filter((id) => id.startsWith('hc-')) : deleted);
    count += rows.length + deleted.length;
    next = result.nextChangesToken;
    hasMore = result.hasMore;
  }
  return { count, token: next };
}

/** Lit un type (hors fréquence cardiaque) : par les modifications si possible, sinon par période. */
async function syncRecordType(type: Exclude<SyncType, 'HeartRate'>, since: number, until: number): Promise<TypeResult> {
  const token = await getChangesToken(type);
  if (token) {
    const changed = await syncByChanges(type, token);
    if (changed) return changed;
  }
  return syncByPeriod(type, since, until);
}

/**
 * Fréquence cardiaque : quelles plages lire. `last-night` : le dernier sommeil seulement (ouverture,
 * phase 1) ; `rest` : tout sauf ce dernier sommeil, déjà lu (ouverture, phase 2) ; `all` : tout.
 */
export type HeartRateScope = 'all' | 'last-night' | 'rest';

/**
 * Fréquence cardiaque (lot 5b) : lue seulement pendant les sommeils et les séances terminés après
 * `since` (plages proches réunies : peu d'appels), au lieu de toute la période. Les mesures gardées sont
 * celles des plages exactes. Dans chaque plage relue, les enregistrements que Health Connect ne renvoie
 * plus sont supprimés. `last-night` : seulement le dernier sommeil (ouverture de l'app, l'essentiel d'abord).
 */
async function syncHeartRate(since: number, until: number, scope: HeartRateScope, interactive: boolean): Promise<number> {
  const sleeps = await loadSleeps(since);
  const lastNight = (x: TimeRange) => x.end >= until - SETTINGS.sync.lastNightHours * 3600_000;
  const plages: TimeRange[] =
    scope === 'last-night'
      ? sleeps.filter(lastNight)
      : [...(scope === 'rest' ? sleeps.filter((x) => !lastNight(x)) : sleeps), ...(await loadRawExercises(since))];
  const exact = mergeRanges(plages, 0);
  let read = 0;
  for (const range of mergeRanges(plages, SETTINGS.sync.heartRateMergeGapMinutes * 60_000)) {
    const records = await readAll('HeartRate', range.start, range.end);
    read += records.length;
    const rows = records.flatMap((r) => {
      const id = idOf(r, `hr-${r.startTime}`);
      const origin = originOf(r);
      return r.samples
        .map((x) => ({ time: ms(x.time), bpm: x.beatsPerMinute }))
        .filter((x) => insideRanges(x.time, exact))
        .map((x) => [id, x.time, x.bpm, origin]);
    });
    await upsertRows('hc_heart_rate', ['record_id', 'time_ms', 'bpm', 'origin'], rows);
    const returned = new Set(records.map((r) => idOf(r, `hr-${r.startTime}`)));
    const gone = (await heartRateRecordIds(range.start, range.end)).filter((id) => !returned.has(id));
    await deleteHeartRateRecords(gone, range.start, range.end);
  }
  // Rattrapage des séances sans mesure : seulement avec l'app ouverte (jamais en tâche de fond).
  if (interactive && scope !== 'last-night') read += await backfillExerciseHeartRate(until);
  return read;
}

/** Options d'une synchro. */
export type SyncOptions = {
  /** Types à lire (tous par défaut), dans l'ordre de SYNC_TYPES. */
  types?: readonly SyncType[];
  /** Fréquence cardiaque : toutes les plages, ou la dernière nuit seulement. */
  heartRateScope?: HeartRateScope;
  /** App ouverte (vrai par défaut) ; faux dans la tâche de fond : pas de rattrapage de la FC des séances. */
  interactive?: boolean;
};

/** Ouverture de l'app (lot 5b) : l'essentiel de la nuit d'abord, puis le reste. */
export const ESSENTIAL_SYNC_TYPES: readonly SyncType[] = [
  'SleepSession',
  'HeartRateVariabilityRmssd',
  'RestingHeartRate',
  'HeartRate',
];
export const OTHER_SYNC_TYPES: readonly SyncType[] = ['ExerciseSession', 'HeartRate', 'Steps', 'Weight', 'Nutrition'];

/** Synchro en cours (une seule à la fois), ou null. */
let runningSync: Promise<SyncTypeReport[]> | null = null;

/**
 * Synchronise les types lus depuis Health Connect vers la base locale.
 * Première fois : `firstSyncDays` jours d'historique. Ensuite : par le suivi des modifications (jeton par
 * type), ou, sans jeton valable, depuis la dernière synchro réussie moins `overlapDays` jours.
 * Le sommeil et les séances passent avant la FC continue, lue sur leurs plages.
 *
 * Une seule synchro à la fois : si une synchro est déjà en cours (lancement, tâche de
 * fond, bouton du diagnostic), la nouvelle demande attend la fin de celle-ci et reçoit
 * son résultat, au lieu d'en lancer une seconde en parallèle.
 */
export function syncHealthConnect(now: number = Date.now(), options: SyncOptions = {}): Promise<SyncTypeReport[]> {
  if (!runningSync) {
    runningSync = runSync(now, options).finally(() => {
      runningSync = null;
    });
  }
  return runningSync;
}

async function runSync(now: number, options: SyncOptions): Promise<SyncTypeReport[]> {
  const granted = await getGrantedReadTypes();
  const reports: SyncTypeReport[] = [];
  const recorder = currentRecorder();
  const wanted = new Set(options.types ?? SYNC_TYPES.map(({ type }) => type));
  const scope = options.heartRateScope ?? 'all';
  for (const { type, label } of SYNC_TYPES) {
    if (!wanted.has(type)) continue;
    const metricKey = type === 'HeartRate' && scope === 'last-night' ? 'HeartRate:night' : type;
    if (!granted.has(type)) {
      recorder?.beginType(metricKey);
      recorder?.endType('denied', 0);
      reports.push({ type, label, state: 'denied', count: 0 });
      continue;
    }
    const last = await getLastSync(type);
    const since =
      last === null ? now - SETTINGS.sync.firstSyncDays * DAY_MS : last - SETTINGS.sync.overlapDays * DAY_MS;
    const before = recorder ? await rowsOf(type) : null;
    recorder?.beginType(metricKey);
    try {
      let count: number;
      if (type === 'HeartRate') {
        count = await syncHeartRate(since, now, scope, options.interactive ?? true);
        // La dernière nuit seule ne vaut pas synchro complète de la FC.
        if (scope !== 'last-night') await setLastSync(type, now);
      } else {
        const result = await syncRecordType(type, since, now);
        count = result.count;
        await saveSyncState(type, now, result.token);
      }
      const after = recorder ? await rowsOf(type) : null;
      recorder?.endType('ok', before !== null && after !== null ? after - before : 0);
      reports.push({ type, label, state: 'ok', count });
    } catch (e) {
      recorder?.endType('error', 0);
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

// ---------------------------------------------------------------------------
// Rattrapage de l'historique (lot 5b) : bouton de Contrôle des données, app ouverte seulement.
// ---------------------------------------------------------------------------

export type HistoryProgress = { done: number; total: number };

/** Plus ancien enregistrement local, par type et par app d'origine (dates, jamais de valeurs). */
export type OldestRecord = { label: string; origin: string; oldest: number };

/**
 * `movedBack` : nombre de types dont le plus ancien enregistrement local a reculé. Zéro alors qu'il reste
 * des données plus anciennes dans Health Connect : autorisation « Accéder aux anciennes données » absente
 * (la bibliothèque ne signale pas cette autorisation : on ne peut que constater le résultat).
 */
export type HistoryResult = { state: 'done'; oldest: OldestRecord[]; failedReads: number; movedBack: number };

/**
 * Lit dans Health Connect les données plus anciennes que le plus ancien enregistrement local de chaque
 * type, jusqu'à `historyDays` jours, par tranches (progression à chaque lecture). La fréquence cardiaque
 * est lue ensuite, seulement sur les plages de sommeil et de séance retrouvées. Rien n'est supprimé.
 */
export async function backfillHistory(
  onProgress: (p: HistoryProgress) => void,
  now: number = Date.now(),
): Promise<HistoryResult> {
  // Jamais en même temps qu'une synchro de l'app.
  if (runningSync) await runningSync.catch(() => undefined);
  const granted = await getGrantedReadTypes();

  const s = SETTINGS.sync;
  const limit = now - s.historyDays * DAY_MS;
  const chunkMs = s.historyChunkDays * DAY_MS;
  const types = SYNC_TYPES.map(({ type }) => type).filter(
    (t): t is Exclude<SyncType, 'HeartRate'> => t !== 'HeartRate' && granted.has(t),
  );
  const plan: { type: Exclude<SyncType, 'HeartRate'>; range: TimeRange }[] = [];
  const before = new Map<string, number | null>();
  for (const type of types) {
    const spec = SPECS[type];
    const local = await oldestLocalTime(spec.table, spec.startColumn, spec.where);
    before.set(type, local);
    const oldest = local ?? now - s.firstSyncDays * DAY_MS;
    for (const range of historyChunks(oldest, limit, chunkMs)) plan.push({ type, range });
  }

  let done = 0;
  let failedReads = 0;
  let total = plan.length;
  onProgress({ done, total });
  for (const { type, range } of plan) {
    const spec = SPECS[type];
    try {
      const records = (await readAll(type, range.start, range.end)) as unknown as AnyRecord[];
      await upsertRows(spec.table, spec.columns, records.map(spec.toRow));
    } catch {
      failedReads += 1;
    }
    onProgress({ done: ++done, total });
  }

  // Fréquence cardiaque : plages de sommeil et de séance plus anciennes que la plus ancienne mesure locale.
  if (granted.has('HeartRate')) {
    const oldestHr = (await oldestLocalTime('hc_heart_rate', 'time_ms')) ?? now;
    const plages = [...(await loadSleeps(limit)), ...(await loadRawExercises(limit))].filter((p) => p.start < oldestHr);
    const exact = mergeRanges(plages, 0);
    const ranges = mergeRanges(plages, s.heartRateMergeGapMinutes * 60_000);
    total += ranges.length;
    for (const range of ranges) {
      try {
        const records = await readAll('HeartRate', range.start, range.end);
        const rows = records.flatMap((r) => {
          const id = idOf(r, `hr-${r.startTime}`);
          const origin = originOf(r);
          return r.samples
            .map((x) => ({ time: ms(x.time), bpm: x.beatsPerMinute }))
            .filter((x) => insideRanges(x.time, exact))
            .map((x) => [id, x.time, x.bpm, origin]);
        });
        await upsertRows('hc_heart_rate', ['record_id', 'time_ms', 'bpm', 'origin'], rows);
      } catch {
        failedReads += 1;
      }
      onProgress({ done: ++done, total });
    }
  }

  let movedBack = 0;
  for (const type of types) {
    const spec = SPECS[type];
    const after = await oldestLocalTime(spec.table, spec.startColumn, spec.where);
    const prior = before.get(type) ?? null;
    if (after !== null && (prior === null || after < prior)) movedBack += 1;
  }

  const oldest: OldestRecord[] = [];
  for (const { type, label } of SYNC_TYPES) {
    const table = type === 'HeartRate' ? 'hc_heart_rate' : SPECS[type].table;
    const column = type === 'HeartRate' ? 'time_ms' : SPECS[type].startColumn;
    const where = type === 'HeartRate' ? undefined : SPECS[type].where;
    for (const row of await oldestByOrigin(table, column, where)) oldest.push({ label, origin: row.origin, oldest: row.oldest });
  }
  return { state: 'done', oldest, failedReads, movedBack };
}

/**
 * Accès à Health Connect, pour l'affichage :
 * 'ok' (tout est autorisé), 'partial' (certains types refusés), 'no-permission',
 * 'unavailable' (Health Connect absent), 'update-required'.
 */
export type AccessState = 'ok' | 'partial' | 'no-permission' | 'unavailable' | 'update-required';

export async function checkAccess(): Promise<AccessState> {
  const status = await getStatus();
  if (status !== 'available') return status;
  const granted = await getGrantedReadTypes();
  const count = SYNC_TYPES.filter(({ type }) => granted.has(type)).length;
  if (count === 0) return 'no-permission';
  return count === SYNC_TYPES.length ? 'ok' : 'partial';
}
