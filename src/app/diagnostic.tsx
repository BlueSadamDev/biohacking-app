// Écran de diagnostic (accessible depuis l'accueil et les réglages) :
// inventaire des données Health Connect (30 derniers jours) et synchronisation
// vers la base locale. Des comptages ; seule exception, les points de charge par séance (carte
// « Charge : séances des 28 derniers jours »), jamais les valeurs de fréquence cardiaque elles-mêmes.
// Interface volontairement simple.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Button, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/AppText';
import { BackHeader, Screen } from '@/components/Screen';
import { colors, fonts } from '@/components/theme';

import { formatDuration } from '@/components/format';
import { useHealthData } from '@/components/useHealthData';
import { countRows, loadExercises, loadNightInputs } from '@/db/healthData';
import { loadSessionChecks } from '@/db/loadData';
import { activeRunStartedMs, beginSyncRun, endSyncRun, loadSyncRuns, syncRunSaveError } from '@/db/syncRuns';
import { exerciseTypeLabel } from '@/domain/exerciseTypes';
import type { SessionCheck } from '@/domain/load';
import { LOAD_CHECK } from '@/domain/texts/sport';
import { sessionTypeCounts, summarizeNights, type NightsSummary, type SessionTypeCount } from '@/domain/diagnostic';
import { computeNights } from '@/domain/nightly';
import { SETTINGS } from '@/domain/settings';
import { runTotals, type SyncRun } from '@/domain/syncRuns';
import { SOURCES, SYNC_RUNS } from '@/domain/texts/reglages';
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
  const { recorder, owner } = beginSyncRun('button');
  try {
    const reports = await syncHealthConnect();
    const since = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const t0 = Date.now();
    const inputs = await loadNightInputs(since);
    const t1 = Date.now();
    const nights = summarizeNights(computeNights(inputs));
    recorder.addNights(t1 - t0, Date.now() - t1);
    return { kind: 'done', at: new Date(), reports, rows: await countRows(), nights };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  } finally {
    if (owner) await endSyncRun(recorder);
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
  const router = useRouter();
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

  // Dernières synchros mesurées (lot 5b) : relues après chaque synchro (bouton ou accueil).
  const { nights, syncing } = useHealthData();
  const [runs, setRuns] = useState<SyncRun[] | null>(null);
  useEffect(() => {
    if (syncing) return;
    loadSyncRuns()
      .then(setRuns)
      .catch(() => setRuns(null));
  }, [sync, syncing]);

  // Séances par type (base locale, 90 jours) : relu après chaque synchro.
  const [types, setTypes] = useState<SessionTypeCount[] | null>(null);
  useEffect(() => {
    loadExercises(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .then((s) => setTypes(sessionTypeCounts(s)))
      .catch(() => setTypes(null));
  }, [sync]);

  // Séances des 28 derniers jours et ce que le calcul de charge en fait (relu après chaque synchro).
  const [checks, setChecks] = useState<SessionCheck[] | null | undefined>(undefined);
  useEffect(() => {
    loadSessionChecks(nights, new Date())
      .then(setChecks)
      .catch(() => setChecks(undefined));
  }, [nights, sync]);

  return (
    <Screen bottomInset>
      <BackHeader title={SOURCES.dataCheck} onBack={() => router.back()} />
      <Text style={styles.subtitle}>Données reçues sur les {DAYS} derniers jours</Text>
      {state.kind === 'loading' && <ActivityIndicator size="large" color={colors.text} style={styles.block} />}

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
          <SyncRunsSection runs={runs} />
          <SessionTypesSection types={types} />
          <LoadCheckSection checks={checks} />
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
    </Screen>
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
  hc_heart_rate: 'Mesures FC (sommeil et séances)',
  hc_steps: 'Enregistrements de pas',
  weight: 'Pesées',
  hc_exercise: "Séances d'exercice",
  hc_nutrition: 'Repas',
  strength_set: 'Séries de musculation saisies',
};

/**
 * Charge : séances des 28 derniers jours, comptées (avec leurs points) ou non, et pourquoi.
 * Les séances de moins de 20 min sont seulement comptées dans le résumé (elles sont nombreuses).
 */
function LoadCheckSection({ checks }: { checks: SessionCheck[] | null | undefined }) {
  if (checks === undefined) return null;
  const listed = checks?.filter((c) => c.reason !== 'short') ?? [];
  const count = (r: SessionCheck['reason']) => checks?.filter((c) => c.reason === r).length ?? 0;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{LOAD_CHECK.title}</Text>
      <Text style={styles.muted}>{LOAD_CHECK.help}</Text>
      {checks === null && <Text style={styles.block}>{LOAD_CHECK.profileMissing}</Text>}
      {checks !== null && checks.length === 0 && <Text style={styles.block}>{LOAD_CHECK.none}</Text>}
      {checks !== null && checks.length > 0 && (
        <>
          <Text style={styles.block}>
            {LOAD_CHECK.summary(count(null), count('short'), count('no-heart-rate'), count('no-resting-hr'))}
          </Text>
          {listed.map((c) => (
            <View key={c.id} style={styles.origin}>
              <Text style={styles.originName}>
                {new Date(c.start).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                {exerciseTypeLabel(c.exerciseType)} · {formatDuration(Math.round(c.durationMinutes))}
              </Text>
              <Text style={styles.muted}>
                {LOAD_CHECK.coverage(Math.round(c.coverage * 100), c.samples)} ·{' '}
                {c.reason === null ? LOAD_CHECK.points(Math.round(c.trimp ?? 0)) : LOAD_CHECK.rejected[c.reason as 'no-heart-rate' | 'no-resting-hr']}
              </Text>
            </View>
          ))}
          {count('short') > 0 && <Text style={[styles.muted, styles.block]}>{LOAD_CHECK.shortHidden(count('short'))}</Text>}
        </>
      )}
    </View>
  );
}

const TYPE_LABELS: Record<string, string> = Object.fromEntries(SYNC_TYPES.map(({ type, label }) => [type, label]));

/** Dernières synchros : durées et comptages (jamais de valeurs), détail par type à l'appui. */
function SyncRunsSection({ runs }: { runs: SyncRun[] | null }) {
  const [open, setOpen] = useState<number | null>(null);
  if (runs === null) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{SYNC_RUNS.title}</Text>
      <Text style={styles.muted}>{SYNC_RUNS.help(SETTINGS.sync.runsKept)}</Text>
      {activeRunStartedMs() !== null && (
        <Text style={styles.block}>{SYNC_RUNS.running(formatDate(new Date(activeRunStartedMs()!)))}</Text>
      )}
      {syncRunSaveError() !== null && (
        <Text style={styles.warning}>{SYNC_RUNS.saveError(syncRunSaveError()!)}</Text>
      )}
      {runs.length === 0 && <Text style={styles.block}>{SYNC_RUNS.none}</Text>}
      {runs.map((run) => {
        const totals = runTotals(run);
        const expanded = open === run.startedMs;
        return (
          <Pressable
            key={run.startedMs}
            onPress={() => setOpen(expanded ? null : run.startedMs)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            style={styles.origin}
          >
            <Text style={styles.originName}>
              {formatDate(new Date(run.startedMs))} · {SYNC_RUNS.line(SYNC_RUNS.origin[run.origin], run.totalMs, run.homeReadyMs)}
            </Text>
            <Text style={styles.muted}>{SYNC_RUNS.totals(totals.calls, totals.read, totals.written, totals.inserted)}</Text>
            {expanded && (
              <View style={styles.block}>
                <Text style={styles.muted}>{SYNC_RUNS.access(run.accessCalls)}</Text>
                {run.types.map((t) => {
                  const label = TYPE_LABELS[t.type] ?? t.type;
                  return (
                    <Text key={t.type} style={styles.muted}>
                      {t.state === 'ok'
                        ? SYNC_RUNS.type(label, t.durationMs, t.calls, t.read, t.written, t.inserted)
                        : t.state === 'denied'
                          ? SYNC_RUNS.denied(label)
                          : SYNC_RUNS.error(label)}
                    </Text>
                  );
                })}
                <Text style={styles.muted}>{SYNC_RUNS.nights(run.nightsRuns, run.nightsReadMs, run.nightsComputeMs)}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Séances par type : sert à vérifier sous quel type Zepp enregistre chaque sport. */
function SessionTypesSection({ types }: { types: SessionTypeCount[] | null }) {
  if (types === null) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Séances par type (90 jours)</Text>
      <Text style={styles.muted}>
        Les types marqués « saisie » proposent la saisie de musculation. Un type manquant se règle dans
        src/domain/settings.ts.
      </Text>
      {types.length === 0 && <Text>Aucune séance dans la base.</Text>}
      {types.map((t) => (
        <Text key={t.type}>
          {t.label} ({t.type}) : {t.count}
          {t.strength ? ' · saisie' : ''}
        </Text>
      ))}
    </View>
  );
}

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
      {state.kind === 'running' && <ActivityIndicator color={colors.text} style={styles.block} />}
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
  section: { fontSize: 18, fontFamily: fonts.body600, marginTop: 20, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textMuted },
  block: { marginTop: 8 },
  spacer: { height: 8 },
  meta: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  message: { fontSize: 15, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginTop: 12 },
  cardTitle: { fontSize: 17, fontFamily: fonts.body600, marginBottom: 4 },
  origin: { marginTop: 6 },
  originName: { fontFamily: fonts.body600, marginTop: 6 },
  muted: { fontSize: 12, color: colors.textMuted },
  warning: { color: colors.low },
});
