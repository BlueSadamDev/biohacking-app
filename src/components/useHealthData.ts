// Données partagées par les écrans : nuits calculées, récap du jour,
// accès à Health Connect et synchronisation.
// Un seul état pour toute l'app : une synchro lancée depuis un écran
// met à jour tous les autres.

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { scheduleMorningNotifications } from '@/background/morningNotification';
import { runAlertEngine } from '@/background/alertEngine';
import { runPeriodReminder } from '@/background/periodReminder';
import { runStrengthReminder } from '@/background/strengthReminder';
import { loadAlertsOverview, type AlertsOverview } from '@/db/alerts';
import { loadNights } from '@/db/healthData';
import { loadLoadInputs } from '@/db/loadData';
import { loadYesterdayNutrition } from '@/db/nutritionData';
import { loadPeriods } from '@/db/periods';
import { beginSyncRun, endSyncRun, settleWithin } from '@/db/syncRuns';
import type { Period } from '@/domain/periods';
import { SETTINGS } from '@/domain/settings';
import type { SyncOrigin } from '@/domain/syncRuns';
import type { NutritionDayView } from '@/domain/nutrition';
import { dayKey } from '@/domain/dates';
import { buildLoadSummary, type LoadSummary } from '@/domain/load';
import type { NightValue } from '@/domain/nightly';
import { buildRecap, type MorningRecap } from '@/domain/recap';
import {
  checkAccess,
  ESSENTIAL_SYNC_TYPES,
  OTHER_SYNC_TYPES,
  syncHealthConnect,
  type AccessState,
} from '@/sources/healthConnect';
import { filledJournalDates } from '@/sources/manualEntry';

export type HealthData = {
  loading: boolean;
  syncing: boolean;
  access: AccessState | null;
  nights: NightValue[];
  /** Périodes (lot 5a), de la plus récente à la plus ancienne. */
  periods: Period[];
  recap: MorningRecap | null;
  /** Charge d'entraînement du jour ; null tant qu'elle n'a pas été calculée. */
  load: LoadSummary | null;
  /** Alerte du jour et alertes non lues (bouton Alertes de l'accueil). */
  alerts: AlertsOverview | null;
  /** Nutrition d'hier par rapport aux cibles. */
  nutrition: NutritionDayView | null;
  /** Journal du matin du jour déjà enregistré (lot 5a). */
  journalFilled: boolean;
  error: string | null;
  /** Première synchro du lancement terminée (l'écran Aube peut disparaître). */
  launched: boolean;
};

let state: HealthData = {
  loading: true,
  syncing: false,
  access: null,
  nights: [],
  periods: [],
  recap: null,
  load: null,
  alerts: null,
  nutrition: null,
  journalFilled: false,
  error: null,
  launched: false,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<HealthData>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Relit la base locale et recalcule le récap du jour (rapide, sans Health Connect). */
export async function reloadFromDb(): Promise<void> {
  try {
    const [nights, periods] = await Promise.all([loadNights(), loadPeriods()]);
    const now = new Date();
    const today = dayKey(now);
    const [load, alerts, nutrition, filled] = await Promise.all([
      loadLoadInputs(nights, today, now)
        .then(buildLoadSummary)
        .catch(() => null),
      loadAlertsOverview(today).catch(() => null),
      loadYesterdayNutrition(today, now).catch(() => null),
      filledJournalDates([today]).catch(() => new Set<string>()),
    ]);
    setState({
      nights,
      periods,
      recap: buildRecap(nights, today, SETTINGS, periods),
      load,
      alerts,
      nutrition,
      journalFilled: filled.has(today),
      loading: false,
    });
  } catch (e) {
    setState({ loading: false, error: message(e) });
  }
}

/**
 * Vérifie l'accès à Health Connect, synchronise si possible, puis recalcule.
 * `origin` : ouverture de l'app (ou retour depuis Zepp) ou bouton, pour la mesure de la synchro (lot 5b).
 */
export async function syncNow(origin: SyncOrigin = 'button'): Promise<void> {
  if (state.syncing) return;
  setState({ syncing: true, error: null });
  const { recorder, owner } = beginSyncRun(origin);
  try {
    const access = await checkAccess();
    setState({ access });
    if (access === 'ok' || access === 'partial') {
      if (origin === 'launch') {
        // Lot 5b : à l'ouverture, la dernière nuit d'abord (accueil à jour au plus vite), puis le reste.
        await syncHealthConnect(Date.now(), { types: ESSENTIAL_SYNC_TYPES, heartRateScope: 'last-night' });
        await reloadFromDb();
        setState({ launched: true });
        recorder.markHomeReady();
        await syncHealthConnect(Date.now(), { types: OTHER_SYNC_TYPES, heartRateScope: 'rest' });
      } else {
        await syncHealthConnect();
      }
    }
  } catch (e) {
    setState({ error: message(e) });
  } finally {
    // Alertes calculées sur les données fraîches (sans effet pendant la calibration).
    await runAlertEngine().catch(() => undefined);
    await runStrengthReminder().catch(() => undefined);
    await runPeriodReminder().catch(() => undefined);
    await reloadFromDb();
    setState({ syncing: false, launched: true });
    recorder.markHomeReady();
    // Le texte de la notification du matin suit les dernières données. Le relevé l'attend au plus
    // quelques secondes : il est toujours enregistré, même si cette étape ne répond pas.
    await settleWithin(scheduleMorningNotifications(), SETTINGS.sync.runFinishWaitSeconds);
    if (owner) await endSyncRun(recorder);
  }
}

let started = false;

export function useHealthData(): HealthData & {
  sync: () => Promise<void>;
  /** Synchro au retour depuis Zepp (comptée comme une ouverture dans la mesure de la synchro). */
  syncOnReturn: () => Promise<void>;
  reload: () => Promise<void>;
} {
  const snapshot = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );

  useEffect(() => {
    // Au premier affichage : on montre tout de suite la base, puis on synchronise.
    if (started) return;
    started = true;
    reloadFromDb().then(() => syncNow('launch'));
  }, []);

  const sync = useCallback(() => syncNow('button'), []);
  const syncOnReturn = useCallback(() => syncNow('launch'), []);
  const reload = useCallback(() => reloadFromDb(), []);
  return { ...snapshot, sync, syncOnReturn, reload };
}
