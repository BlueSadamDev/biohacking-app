// Lot 0 : écran d'inventaire des données Health Connect (30 derniers jours).
// Interface volontairement minimale (pas de DESIGN.md au lot 0).

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  askReadPermissions,
  getGrantedReadTypes,
  getStatus,
  INVENTORY_TYPES,
  openSettings,
  originLabel,
  readInventory,
  type TypeInventory,
} from '@/sources/healthConnect';

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
    if (!INVENTORY_TYPES.some(({ type }) => granted.has(type))) return { kind: 'no-permission' };
    const inventory = await readInventory(DAYS);
    return { kind: 'ready', inventory, readAt: new Date() };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

export default function InventoryScreen() {
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });

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
      <Text style={styles.title}>Inventaire Health Connect</Text>
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
            <Message text="Aucune donnée trouvée. Vérifie que les apps Suunto et Zepp sont bien connectées à Health Connect et ont synchronisé." />
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

const styles = StyleSheet.create({
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
