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
import type { Period } from '@/domain/periods';
import { SETTINGS } from '@/domain/settings';
import type { NutritionDayView } from '@/domain/nutrition';
import { dayKey } from '@/domain/dates';
import { buildLoadSummary, type LoadSummary } from '@/domain/load';
import type { NightValue } from '@/domain/nightly';
import { buildRecap, type MorningRecap } from '@/domain/recap';
import { checkAccess, syncHealthConnect, type AccessState } from '@/sources/healthConnect';
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

/** Vérifie l'accès à Health Connect, synchronise si possible, puis recalcule. */
export async function syncNow(): Promise<void> {
  if (state.syncing) return;
  setState({ syncing: true, error: null });
  try {
    const access = await checkAccess();
    setState({ access });
    if (access === 'ok' || access === 'partial') await syncHealthConnect();
  } catch (e) {
    setState({ error: message(e) });
  } finally {
    // Alertes calculées sur les données fraîches (sans effet pendant la calibration).
    await runAlertEngine().catch(() => undefined);
    await runStrengthReminder().catch(() => undefined);
    await runPeriodReminder().catch(() => undefined);
    await reloadFromDb();
    setState({ syncing: false, launched: true });
    // Le texte de la notification du matin suit les dernières données.
    await scheduleMorningNotifications().catch(() => undefined);
  }
}

let started = false;

export function useHealthData(): HealthData & { sync: () => Promise<void>; reload: () => Promise<void> } {
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
    reloadFromDb().then(syncNow);
  }, []);

  const sync = useCallback(() => syncNow(), []);
  const reload = useCallback(() => reloadFromDb(), []);
  return { ...snapshot, sync, reload };
}
