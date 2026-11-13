// Écran de diagnostic : inventaire des données Health Connect (30 derniers jours)
// et synchronisation vers la base locale (lot 1). Uniquement des comptages,
// jamais de valeurs de santé. Interface minimale : il deviendra l'écran
// « diagnostic » accessible depuis l'accueil à l'étape 3.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';

import { countRows, loadNightInputs } from '@/db/healthData';
import { summarizeNights, type NightsSummary } from '@/domain/diagnostic';
import { computeNights } from '@/domain/nightly';
import {
  askReadPermissions,
  getGrantedReadTypes,
  getStatus,
  openSettings,
  originLabel,
  readInventory,
  syncHealthConnect,
  SYNC_TYPES,
  type SyncTypeReport,
  type TypeInventory,
} from '@/sources/healthConnect';

type SyncState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'error'; message: string }
  | {
      kind: 'done';
      at: Date;
      reports: SyncTypeReport[];
      rows: Record<string, number>;
      nights: NightsSummary;
    };

/** Synchronise puis calcule les nuits des 90 derniers jours (comptages uniquement). */
async function runSync(): Promise<SyncState> {
  try {
    const reports = await syncHealthConnect();
    const since = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const nights = summarizeNights(computeNights(await loadNightInputs(since)));
    return { kind: 'done', at: new Date(), reports, rows: await countRows(), nights };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

const DAYS = 30;

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'update-required' }
  | { kind: 'no-permission' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; inventory: TypeInventory[]; readAt: Date };

function formatDate(d: Date): string {
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Lit Health Connect et renvoie l'état à afficher. */
async function fetchScreenState(): Promise<ScreenState> {
  try {
    const status = await getStatus();
    if (status !== 'available') return { kind: status };
    const granted = await getGrantedReadTypes();
    if (!SYNC_TYPES.some(({ type }) => granted.has(type))) return { kind: 'no-permission' };
    const inventory = await readInventory(DAYS);
    return { kind: 'ready', inventory, readAt: new Date() };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

export default function InventoryScreen() {
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [sync, setSync] = useState<SyncState>({ kind: 'idle' });

  const startSync = useCallback(async () => {
    setSync({ kind: 'running' });
    setSync(await runSync());
  }, []);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    setState(await fetchScreenState());
  }, []);

  const requestAccess = useCallback(async () => {
    try {
      await askReadPermissions();
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      return;
    }
    await load();
  }, [load]);

  useEffect(() => {
    fetchScreenState().then(setState);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Diagnostic</Text>
      <Text style={styles.subtitle}>Données reçues sur les {DAYS} derniers jours</Text>

      {state.kind === 'loading' && <ActivityIndicator size="large" style={styles.block} />}

      {state.kind === 'unavailable' && (
        <Message text="Health Connect n'est pas disponible sur ce téléphone. Il est intégré à Android 14 et plus récent." />
      )}

      {state.kind === 'update-required' && (
        <Message text="Health Connect doit être mis à jour (Play Store), puis relance l'app." />
      )}

      {state.kind === 'no-permission' && (
        <View style={styles.block}>
          <Message text="L'app n'a pas encore le droit de lire tes données Health Connect. Elle demande uniquement la lecture, jamais l'écriture." />
          <Button title="Autoriser la lecture" onPress={requestAccess} />
          <View style={styles.spacer} />
          <Button title="Ouvrir les réglages Health Connect" onPress={openSettings} />
        </View>
      )}

      {state.kind === 'error' && (
        <View style={styles.block}>
          <Message text={`La lecture a échoué : ${state.message}`} />
          <Button title="Réessayer" onPress={load} />
        </View>
      )}

      {state.kind === 'ready' && (
        <View style={styles.block}>
          <SyncSection state={sync} onSync={startSync} />
          <Text style={styles.section}>Inventaire</Text>
          <Text style={styles.meta}>Lu le {formatDate(state.readAt)}</Text>
          <Button title="Actualiser" onPress={load} />
          <View style={styles.spacer} />
          {state.inventory.some((t) => t.state === 'denied') && (
            <>
              <Button title="Autoriser les types manquants" onPress={requestAccess} />
              <View style={styles.spacer} />
            </>
          )}
          {state.inventory.every((t) => t.origins.length === 0) && (
            <Message text="Aucune donnée trouvée. Vérifie que l'app Zepp est bien connectée à Health Connect et a synchronisé." />
          )}
          {state.inventory.map((item) => (
            <TypeCard key={item.type} item={item} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Message({ text }: { text: string }) {
  return <Text style={styles.message}>{text}</Text>;
}

function TypeCard({ item }: { item: TypeInventory }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.label}</Text>
      {item.state === 'denied' && <Text style={styles.warning}>Permission refusée</Text>}
      {item.state === 'not-requested' && (
        <Text style={styles.muted}>Non demandé (inutile au lot 1)</Text>
      )}
      {item.state === 'error' && (
        <Text style={styles.warning}>Lecture impossible : {item.errorMessage}</Text>
      )}
      {item.state === 'ok' && item.origins.length === 0 && (
        <Text style={styles.muted}>Aucune donnée</Text>
      )}
      {item.origins.map((o) => (
        <View key={o.origin} style={styles.origin}>
          <Text style={styles.originName}>{originLabel(o.origin)}</Text>
          {originLabel(o.origin) !== o.origin && <Text style={styles.muted}>{o.origin}</Text>}
          <Text>{o.count} enregistrement(s)</Text>
          <Text style={styles.muted}>
            du {formatDate(o.first)} au {formatDate(o.last)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const TABLE_LABELS: Record<string, string> = {
  hc_sleep: 'Séances de sommeil',
  hc_hrv: 'Mesures HRV',
  hc_resting_hr: 'Mesures FC au repos',
  hc_heart_rate: 'Mesures FC pendant le sommeil',
  hc_steps: 'Enregistrements de pas',
  weight: 'Pesées',
};

function SyncSection({ state, onSync }: { state: SyncState; onSync: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Synchronisation</Text>
      <Text style={styles.muted}>
        Copie les données dans la base du téléphone (90 jours la première fois), puis calcule une
        valeur par nuit.
      </Text>
      <View style={styles.spacer} />
      <Button title="Synchroniser maintenant" onPress={onSync} disabled={state.kind === 'running'} />
      {state.kind === 'running' && <ActivityIndicator style={styles.block} />}
      {state.kind === 'error' && (
        <Text style={styles.warning}>La synchronisation a échoué : {state.message}</Text>
      )}
      {state.kind === 'done' && (
        <View style={styles.block}>
          <Text style={styles.meta}>Faite le {formatDate(state.at)}</Text>
          {state.reports.map((r) => (
            <Text key={r.type}>
              {r.label} :{' '}
              {r.state === 'ok'
                ? `${r.count} enregistrement(s) lu(s)`
                : r.state === 'denied'
                  ? 'permission refusée'
                  : `erreur (${r.errorMessage})`}
            </Text>
          ))}
          <Text style={styles.originName}>Dans la base</Text>
          {Object.entries(state.rows).map(([table, n]) => (
            <Text key={table}>
              {TABLE_LABELS[table] ?? table} : {n}
            </Text>
          ))}
          <Text style={styles.originName}>Nuits calculées (90 jours)</Text>
          <Text>Nuits avec sommeil principal : {state.nights.nights}</Text>
          <Text>… avec HRV calculable : {state.nights.withHrv}</Text>
          <Text>… avec FC au repos calculable : {state.nights.withRestingHr}</Text>
          <Text style={styles.muted}>
            FC au repos tirée des mesures « FC au repos » : {state.nights.restingHrFromResting}, de
            la FC continue (secours) : {state.nights.restingHrFromHeartRate}
          </Text>
          <Text>… avec phases de sommeil : {state.nights.withStages}</Text>
          {state.nights.firstDate && (
            <Text style={styles.muted}>
              Du {state.nights.firstDate} au {state.nights.lastDate}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 4 },
  container: { padding: 16, paddingTop: 48, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  block: { marginTop: 8 },
  spacer: { height: 8 },
  meta: { fontSize: 12, color: '#666', marginBottom: 8 },
  message: { fontSize: 15, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginTop: 12 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  origin: { marginTop: 6 },
  originName: { fontWeight: '600' },
  muted: { fontSize: 12, color: '#666' },
  warning: { color: '#b00020' },
});
