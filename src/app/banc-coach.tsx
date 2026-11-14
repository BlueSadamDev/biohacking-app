// Banc d'essai du coach (lot 4, étape C0) : TEMPORAIRE, retiré après le choix du modèle.
// Ouvert depuis l'écran de diagnostic. Importe des fichiers de modèle dans l'espace privé
// de l'app, les charge avec llama.rn (.gguf) ou ExecuTorch (.pte), puis mesure mémoire,
// temps de chargement et vitesse sur 3 demandes types. Données FICTIVES uniquement.

import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Share, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/AppText';
import { BackHeader, Screen } from '@/components/Screen';
import { colors, fonts } from '@/components/theme';
import type { BenchEngine, GenResult } from '@/coach/benchEngines';
import {
  BENCH_PROMPTS,
  BENCH_SYSTEM_PROMPT,
  buildUserMessage,
  countWords,
  unknownNumbers,
  wordsPerSecond,
  type BenchPrompt,
} from '@/coach/benchPrompts';

const MAX_TOKENS = 300;
const TOKENIZER = 'tokenizer.json';
const TOKENIZER_CONFIG = 'tokenizer_config.json';

function benchDir(): Directory {
  const dir = new Directory(Paths.document, 'coach-bench');
  if (!dir.exists) dir.create();
  return dir;
}

function listFiles(): File[] {
  return benchDir()
    .list()
    .filter((f): f is File => f instanceof File)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mb(bytes: number | null | undefined): string {
  return bytes == null ? '?' : `${Math.round(bytes / 1024 / 1024)} Mo`;
}

/** Mémoire utilisée par l'app (Android : PSS du processus, modèle compris). */
async function usedMemory(): Promise<number | null> {
  try {
    const { default: DeviceInfo } = await import('react-native-device-info');
    return await DeviceInfo.getUsedMemory();
  } catch {
    return null;
  }
}

type Loaded = {
  engine: BenchEngine;
  file: string;
  loadMs: number;
  memBefore: number | null;
  memAfter: number | null;
};

type RunResult = GenResult & { memAfter: number | null; unknown: number[] };

export default function CoachBenchScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>(() => {
    try {
      return listFiles();
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [partial, setPartial] = useState('');
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const engineRef = useRef<BenchEngine | null>(null);
  const stopAll = useRef(false);

  const refresh = useCallback(() => {
    try {
      setFiles(listFiles());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Modèle libéré en quittant l'écran : rien ne reste en mémoire.
  useEffect(
    () => () => {
      engineRef.current?.release().catch(() => undefined);
      engineRef.current = null;
    },
    [],
  );

  const importFiles = useCallback(async () => {
    setError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: '*/*',
    });
    if (picked.canceled) return;
    setBusy('Copie dans l’espace privé de l’app…');
    try {
      for (const asset of picked.assets) {
        const target = new File(benchDir(), asset.name);
        if (target.exists) target.delete();
        await new File(asset.uri).move(target);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      refresh();
    }
  }, [refresh]);

  const remove = useCallback(
    (file: File) => {
      Alert.alert('Supprimer ce fichier ?', file.name, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            file.delete();
            refresh();
          },
        },
      ]);
    },
    [refresh],
  );

  const release = useCallback(async () => {
    await engineRef.current?.release();
    engineRef.current = null;
    setLoaded(null);
  }, []);

  const load = useCallback(
    async (file: File) => {
      setError(null);
      await release();
      setResults({});
      // Moteurs chargés seulement ici, pour ne rien initialiser au démarrage de l'app.
      const { ExecutorchEngine, LlamaRnEngine } = await import('@/coach/benchEngines');
      let engine: BenchEngine;
      if (file.name.endsWith('.pte')) {
        const tok = new File(benchDir(), TOKENIZER);
        const conf = new File(benchDir(), TOKENIZER_CONFIG);
        if (!tok.exists || !conf.exists) {
          setError(`ExecuTorch a besoin de ${TOKENIZER} et ${TOKENIZER_CONFIG} à côté du fichier .pte.`);
          return;
        }
        engine = new ExecutorchEngine(file.uri, tok.uri, conf.uri);
      } else {
        engine = new LlamaRnEngine(file.uri);
      }
      setBusy(`Chargement de ${file.name} (${engine.label})…`);
      const memBefore = await usedMemory();
      const start = Date.now();
      try {
        await engine.load(BENCH_SYSTEM_PROMPT);
        const loadMs = Date.now() - start;
        engineRef.current = engine;
        setLoaded({ engine, file: file.name, loadMs, memBefore, memAfter: await usedMemory() });
      } catch (e) {
        setError(`Chargement impossible : ${e instanceof Error ? e.message : String(e)}`);
        await engine.release().catch(() => undefined);
      } finally {
        setBusy(null);
      }
    },
    [release],
  );

  const run = useCallback(async (prompt: BenchPrompt) => {
    const engine = engineRef.current;
    if (!engine) return;
    setRunning(prompt.id);
    setPartial('');
    try {
      const res = await engine.generate(
        BENCH_SYSTEM_PROMPT,
        buildUserMessage(prompt.question),
        MAX_TOKENS,
        setPartial,
      );
      const memAfter = await usedMemory();
      setResults((r) => ({ ...r, [prompt.id]: { ...res, memAfter, unknown: unknownNumbers(res.text) } }));
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

      <Text style={styles.section}>Fichiers de modèle</Text>
      <Button title="Importer des fichiers" onPress={importFiles} disabled={!!busy || !!running} />
      {files.length === 0 && <Text style={styles.muted}>Aucun fichier importé.</Text>}
      {files.map((f) => (
        <View key={f.uri} style={styles.card}>
          <Text style={styles.cardTitle}>{f.name}</Text>
          <Text style={styles.muted}>{mb(f.size)}</Text>
          {(f.name.endsWith('.gguf') || f.name.endsWith('.pte')) && (
            <Button
              title={`Charger (${f.name.endsWith('.pte') ? 'ExecuTorch' : 'llama.rn'})`}
              onPress={() => load(f)}
              disabled={!!busy || !!running}
            />
          )}
          <View style={styles.spacer} />
          <Button title="Supprimer" color={colors.low} onPress={() => remove(f)} disabled={!!running} />
        </View>
      ))}

      {busy && (
        <View style={styles.block}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.muted}>{busy}</Text>
        </View>
      )}
      {error && <Text style={styles.warning}>{error}</Text>}

      {loaded && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {loaded.file} · {loaded.engine.label}
          </Text>
          <Text>Chargement : {(loaded.loadMs / 1000).toFixed(1)} s</Text>
          <Text>
            Mémoire de l’app : {mb(loaded.memBefore)} avant, {mb(loaded.memAfter)} après chargement
          </Text>
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

function speedLine(r: RunResult): string {
  const tps = r.decodeMs > 0 ? (r.tokens / (r.decodeMs / 1000)).toFixed(1) : '?';
  const wps = wordsPerSecond(r.text, r.decodeMs);
  return `${wps === null ? '?' : wps.toFixed(1)} mots/s · ${tps} jetons/s`;
}

function ResultCard({ prompt, result: r }: { prompt: BenchPrompt; result: RunResult }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{prompt.label}</Text>
      <Text>Vitesse : {speedLine(r)}</Text>
      <Text style={styles.muted}>
        Lecture de la demande {(r.promptMs / 1000).toFixed(1)} s · premier mot{' '}
        {r.firstTokenMs === null ? '?' : `${(r.firstTokenMs / 1000).toFixed(1)} s`} · total{' '}
        {(r.totalMs / 1000).toFixed(1)} s · {countWords(r.text)} mots · mémoire {mb(r.memAfter)}
        {r.stopped ? ' · arrêté' : ''}
      </Text>
      <Text style={r.unknown.length ? styles.warning : styles.good}>
        {r.unknown.length
          ? `Nombres absents du résumé : ${r.unknown.join(', ')}`
          : 'Aucun nombre inventé'}
      </Text>
      <View style={styles.spacer} />
      <Text>{r.text}</Text>
    </View>
  );
}

/** Texte partageable : mesures et réponses (données fictives uniquement). */
function report(loaded: Loaded, results: Record<string, RunResult>): string {
  const lines = [
    `Banc d'essai coach · ${loaded.file} · ${loaded.engine.label}`,
    `Chargement ${(loaded.loadMs / 1000).toFixed(1)} s · mémoire ${mb(loaded.memBefore)} → ${mb(loaded.memAfter)}`,
  ];
  for (const p of BENCH_PROMPTS) {
    const r = results[p.id];
    if (!r) continue;
    lines.push(
      '',
      `## ${p.label}`,
      `${speedLine(r)} · lecture ${(r.promptMs / 1000).toFixed(1)} s · premier mot ${
        r.firstTokenMs === null ? '?' : (r.firstTokenMs / 1000).toFixed(1)
      } s · total ${(r.totalMs / 1000).toFixed(1)} s · mémoire ${mb(r.memAfter)}`,
      `Nombres absents du résumé : ${r.unknown.length ? r.unknown.join(', ') : 'aucun'}`,
      r.text,
    );
  }
  return lines.join('\n');
}

const styles = StyleSheet.create({
  section: { fontSize: 18, fontFamily: fonts.body600, marginTop: 20, marginBottom: 8 },
  block: { marginTop: 8 },
  spacer: { height: 8 },
  spacerTop: { marginTop: 8 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginTop: 12 },
  cardTitle: { fontSize: 16, fontFamily: fonts.body600, marginBottom: 4 },
  muted: { fontSize: 12, color: colors.textMuted },
  warning: { color: colors.low, marginTop: 8 },
  good: { color: colors.good },
});
