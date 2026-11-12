// Connecteur Health Connect (lecture seule).
// Lot 0 : inventaire des données reçues sur les N derniers jours,
// par type de donnée et par app d'origine (dataOrigin).
// Aucune valeur de santé n'est conservée ni écrite dans les logs :
// on ne garde que l'app d'origine et la date de chaque enregistrement.

import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
  type RecordType,
} from 'react-native-health-connect';

/** Types lus au lot 0, avec leur nom affiché à l'écran. */
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
  /** 'ok' : lu ; 'denied' : permission refusée ; 'error' : lecture impossible. */
  state: 'ok' | 'denied' | 'error';
  origins: OriginSummary[];
  errorMessage?: string;
};

const READ_PERMISSIONS: Permission[] = INVENTORY_TYPES.map(({ type }) => ({
  accessType: 'read',
  recordType: type,
}));

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
      results.push({ type, label, state: 'denied', origins: [] });
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
