// Données partagées par les écrans : nuits calculées, récap du jour,
// accès à Health Connect et synchronisation.
// Un seul état pour toute l'app : une synchro lancée depuis un écran
// met à jour tous les autres.

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { scheduleMorningNotifications } from '@/background/morningNotification';
import { loadNights } from '@/db/healthData';
import { dayKey } from '@/domain/dates';
import type { NightValue } from '@/domain/nightly';
import { buildRecap, type MorningRecap } from '@/domain/recap';
import { checkAccess, syncHealthConnect, type AccessState } from '@/sources/healthConnect';

export type HealthData = {
  loading: boolean;
  syncing: boolean;
  access: AccessState | null;
  nights: NightValue[];
  recap: MorningRecap | null;
  error: string | null;
};

let state: HealthData = { loading: true, syncing: false, access: null, nights: [], recap: null, error: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<HealthData>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Relit la base locale et recalcule le récap du jour (rapide, sans Health Connect). */
export async function reloadFromDb(): Promise<void> {
  try {
    const nights = await loadNights();
    setState({ nights, recap: buildRecap(nights, dayKey(new Date())), loading: false });
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
    setState({ syncing: false });
    await reloadFromDb();
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
