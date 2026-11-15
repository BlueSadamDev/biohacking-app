// Banc d'essai du coach (lot 4) : TEMPORAIRE, retiré à la fin du lot.
// Ouvert depuis l'écran de diagnostic. Charge le modèle installé (écran « Modèle du coach »)
// et mesure temps de chargement et vitesse sur 3 demandes types, avec des données FICTIVES.
// Sert à régler le résumé et les consignes du coach (étapes C2 et C3).

import { Directory, File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Share, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/AppText';
import { BackHeader, Screen } from '@/components/Screen';
import { colors, fonts } from '@/components/theme';
import type { GenResult, LlamaRnEngine } from '@/coach/benchEngines';
import { BENCH_CONTEXT, BENCH_PROMPTS, countWords, outcomeLine, wordsPerSecond, type BenchPrompt } from '@/coach/benchPrompts';
import { getInstalledModel, type InstalledModel } from '@/coach/modelStore';
import { formatBytes } from '@/domain/coachModel';
import { runCoach, type CoachOutcome } from '@/domain/coachRun';

/** Fichiers importés pendant le test de faisabilité (étape C0), à supprimer. */
function leftoverFiles(): File[] {
  try {
    const dir = new Directory(Paths.document, 'coach-bench');
    if (!dir.exists) return [];
    return dir.list().filter((f): f is File => f instanceof File);
  } catch {
    return [];
  }
}

type Loaded = { file: string; loadMs: number };
/** Résultat du circuit du coach + mesures de la dernière génération. */
type RunResult = { outcome: CoachOutcome; last: GenResult | null };

export default function CoachBenchScreen() {
  const router = useRouter();
  const [model] = useState<InstalledModel | null>(() => getInstalledModel());
  const [leftovers, setLeftovers] = useState<File[]>(leftoverFiles);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [partial, setPartial] = useState('');
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const engineRef = useRef<LlamaRnEngine | null>(null);
  const stopAll = useRef(false);

  // Modèle libéré en quittant l'écran : rien ne reste en mémoire.
  useEffect(
    () => () => {
      engineRef.current?.release().catch(() => undefined);
      engineRef.current = null;
    },
    [],
  );

  const removeLeftovers = useCallback(() => {
    const total = leftovers.reduce((s, f) => s + (f.size ?? 0), 0);
    Alert.alert('Supprimer les fichiers du test ?', `${leftovers.length} fichier(s), ${formatBytes(total)}.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          try {
            new Directory(Paths.document, 'coach-bench').delete();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
          setLeftovers(leftoverFiles());
        },
      },
    ]);
  }, [leftovers]);

  const release = useCallback(async () => {
    await engineRef.current?.release();
    engineRef.current = null;
    setLoaded(null);
  }, []);

  const load = useCallback(async () => {
    if (!model) return;
    setError(null);
    await release();
    setResults({});
    setBusy(true);
    // Moteur chargé seulement ici, pour ne rien initialiser au démarrage de l'app.
    const { LlamaRnEngine } = await import('@/coach/benchEngines');
    const engine = new LlamaRnEngine(model.uri);
    const start = Date.now();
    try {
      await engine.load();
      engineRef.current = engine;
      setLoaded({ file: model.name, loadMs: Date.now() - start });
    } catch (e) {
      setError(`Chargement impossible : ${e instanceof Error ? e.message : String(e)}`);
      await engine.release().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }, [model, release]);

  const run = useCallback(async (prompt: BenchPrompt) => {
    const engine = engineRef.current;
    if (!engine) return;
    setRunning(prompt.id);
    setPartial('');
    try {
      const outcome = await runCoach(engine, BENCH_CONTEXT, prompt.task, setPartial);
      setResults((r) => ({ ...r, [prompt.id]: { outcome, last: engine.lastResult } }));
    } catch (e) {
      setError(`Génération impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(null);
    }
  }, []);

  const runAll = useCallback(async () => {
    stopAll.current = false;
    for (const p of BENCH_PROMPTS) {
      if (stopAll.current) break;
      await run(p);
    }
  }, [run]);

  const stop = useCallback(async () => {
    stopAll.current = true;
    await engineRef.current?.stop();
  }, []);

  const share = useCallback(() => {
    if (!loaded) return;
    Share.share({ message: report(loaded, results) }).catch(() => undefined);
  }, [loaded, results]);

  return (
    <Screen bottomInset>
      <BackHeader title="Banc d'essai du coach" onBack={() => router.back()} />
      <Text style={styles.muted}>
        Test temporaire du lot 4, sur des données fictives. Tout reste sur le téléphone.
      </Text>

      {leftovers.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fichiers du test de faisabilité</Text>
          <Text style={styles.muted}>{leftovers.map((f) => f.name).join(', ')}</Text>
          <View style={styles.spacer} />
          <Button title="Supprimer ces fichiers" color={colors.low} onPress={removeLeftovers} disabled={!!running} />
        </View>
      )}

      {!model && (
        <View style={styles.card}>
          <Text>Aucun modèle installé. Installe-le depuis Réglages, puis « Modèle du coach ».</Text>
          <View style={styles.spacer} />
          <Button title="Ouvrir Modèle du coach" onPress={() => router.push('/coach-modele')} />
        </View>
      )}

      {model && !loaded && (
        <View style={styles.block}>
          <Button title={`Charger ${model.name}`} onPress={load} disabled={busy} />
        </View>
      )}

      {busy && (
        <View style={styles.block}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.muted}>Chargement du modèle…</Text>
        </View>
      )}
      {error && <Text style={styles.warning}>{error}</Text>}

      {loaded && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{loaded.file} · llama.rn</Text>
          <Text>Chargement : {(loaded.loadMs / 1000).toFixed(1)} s</Text>
          <View style={styles.spacer} />
          {running ? (
            <Button title="Arrêter" color={colors.low} onPress={stop} />
          ) : (
            <>
              <Button title="Lancer les 3 demandes" onPress={runAll} />
              {BENCH_PROMPTS.map((p) => (
                <View key={p.id} style={styles.spacerTop}>
                  <Button title={p.label} onPress={() => run(p)} />
                </View>
              ))}
              <View style={styles.spacer} />
              <Button title="Partager les résultats" onPress={share} />
              <View style={styles.spacer} />
              <Button title="Libérer le modèle" onPress={release} />
            </>
          )}
        </View>
      )}

      {running && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>En cours : {BENCH_PROMPTS.find((p) => p.id === running)?.label}</Text>
          <Text>{partial || '…'}</Text>
        </View>
      )}

      {BENCH_PROMPTS.filter((p) => results[p.id]).map((p) => (
        <ResultCard key={p.id} prompt={p} result={results[p.id]} />
      ))}
    </Screen>
  );
}

/** Vitesse de la dernière génération (mesurée par le moteur). */
function speedLine(g: GenResult | null): string {
  if (!g) return 'vitesse ?';
  const tps = g.decodeMs > 0 ? (g.tokens / (g.decodeMs / 1000)).toFixed(1) : '?';
  const wps = wordsPerSecond(g.text, g.decodeMs);
  return `${wps === null ? '?' : wps.toFixed(1)} mots/s · ${tps} jetons/s`;
}

function timingLine(g: GenResult | null): string {
  if (!g) return '';
  return `lecture ${(g.promptMs / 1000).toFixed(1)} s · premier mot ${
    g.firstTokenMs === null ? '?' : (g.firstTokenMs / 1000).toFixed(1)
  } s · dernière génération ${(g.totalMs / 1000).toFixed(1)} s · ${countWords(g.text)} mots`;
}

function ResultCard({ prompt, result: r }: { prompt: BenchPrompt; result: RunResult }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{prompt.label}</Text>
      <Text>Vitesse : {speedLine(r.last)}</Text>
      <Text style={styles.muted}>{timingLine(r.last)}</Text>
      <Text style={r.outcome.kind === 'answer' && r.outcome.attempts === 1 ? styles.good : styles.warning}>
        {outcomeLine(r.outcome)}
      </Text>
      <View style={styles.spacer} />
      <Text>{r.outcome.text}</Text>
    </View>
  );
}

/** Texte partageable : mesures et réponses (données fictives uniquement). */
function report(loaded: Loaded, results: Record<string, RunResult>): string {
  const lines = [`Banc d'essai coach · ${loaded.file} · llama.rn`, `Chargement ${(loaded.loadMs / 1000).toFixed(1)} s`];
  for (const p of BENCH_PROMPTS) {
    const r = results[p.id];
    if (!r) continue;
    lines.push(
      '',
      `## ${p.label}`,
      `${speedLine(r.last)} · ${timingLine(r.last)}`,
      outcomeLine(r.outcome),
      r.outcome.text,
    );
  }
  return lines.join('\n');
}

const styles = StyleSheet.create({
  block: { marginTop: 12 },
  spacer: { height: 8 },
  spacerTop: { marginTop: 8 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginTop: 12 },
  cardTitle: { fontSize: 16, fontFamily: fonts.body600, marginBottom: 4 },
  muted: { fontSize: 12, color: colors.textMuted },
  warning: { color: colors.low, marginTop: 8 },
  good: { color: colors.good },
});
