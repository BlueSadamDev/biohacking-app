// Données partagées par les écrans : nuits calculées, récap du jour,
// accès à Health Connect et synchronisation.
// Un seul état pour toute l'app : une synchro lancée depuis un écran
// met à jour tous les autres.

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { scheduleMorningNotifications } from '@/background/morningNotification';
import { getUserSettings } from '@/db/appSettings';
import { loadExerciseHeartRate, loadExercises, loadNights } from '@/db/healthData';
import { dayKey } from '@/domain/dates';
import { buildLoadSummary, type LoadSummary } from '@/domain/load';
import type { NightValue } from '@/domain/nightly';
import { effectiveHrMax, trimpCoefficient } from '@/domain/profile';
import { buildRecap, type MorningRecap } from '@/domain/recap';
import { SETTINGS } from '@/domain/settings';
import { checkAccess, syncHealthConnect, type AccessState } from '@/sources/healthConnect';

export type HealthData = {
  loading: boolean;
  syncing: boolean;
  access: AccessState | null;
  nights: NightValue[];
  recap: MorningRecap | null;
  /** Charge d'entraînement du jour ; null tant qu'elle n'a pas été calculée. */
  load: LoadSummary | null;
  error: string | null;
  /** Première synchro du lancement terminée (l'écran Aube peut disparaître). */
  launched: boolean;
};

let state: HealthData = {
  loading: true,
  syncing: false,
  access: null,
  nights: [],
  recap: null,
  load: null,
  error: null,
  launched: false,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<HealthData>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const DAY_MS = 24 * 60 * 60 * 1000;

/** Charge d'entraînement du jour (séances et FC lues dans la base, profil cardiaque des Réglages). */
async function computeLoad(nights: NightValue[], today: string): Promise<LoadSummary> {
  const since = Date.now() - (SETTINGS.load.chronicDays + 1) * DAY_MS;
  const [sessions, samples, user] = await Promise.all([
    loadExercises(since),
    loadExerciseHeartRate(since),
    getUserSettings(),
  ]);
  return buildLoadSummary({
    sessions,
    samples,
    nights,
    hrMax: effectiveHrMax(user, new Date())?.bpm ?? null,
    coefficient: trimpCoefficient(user.sex),
    historyStart: nights.length ? nights.reduce((min, n) => (n.date < min ? n.date : min), nights[0].date) : null,
    today,
  });
}

/** Relit la base locale et recalcule le récap du jour (rapide, sans Health Connect). */
export async function reloadFromDb(): Promise<void> {
  try {
    const nights = await loadNights();
    const today = dayKey(new Date());
    const load = await computeLoad(nights, today).catch(() => null);
    setState({ nights, recap: buildRecap(nights, today), load, loading: false });
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
