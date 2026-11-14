// Saisie de séance de musculation (DESIGN.md, « Écrans du lot 3 »).
// Retour + « Ta séance » + « Meilleure série de chaque exercice ». Carte de la séance détectée,
// puis une carte par exercice clé (« Pas fait », charge, répétitions, 1RM estimé et écart à ton niveau).
// Séance retenue : la séance de musculation du jour pas encore saisie, sinon la dernière du jour
// (pour corriger), sinon aucune (saisie datée d'aujourd'hui).

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/Buttons';
import { Card } from '@/components/Card';
import { formatDecimal, formatDuration, formatLongDate } from '@/components/format';
import { BackHeader, Screen } from '@/components/Screen';
import { Stepper } from '@/components/StrengthControls';
import { colors, fonts, radius } from '@/components/theme';
import { reloadFromDb } from '@/components/useHealthData';
import { loadExerciseHeartRate, loadExercises } from '@/db/healthData';
import { loadStrengthHistory, saveStrengthSession, type SetInput } from '@/db/strength';
import { dayKey } from '@/domain/dates';
import { exerciseTypeLabel } from '@/domain/exerciseTypes';
import type { ExerciseSession } from '@/domain/load';
import { SETTINGS } from '@/domain/settings';
import {
  compareSet,
  EXERCISE_LABEL,
  EXERCISES,
  isStrengthSession,
  lastSet,
  pendingStrengthSession,
  sessionKeyOf,
  type Exercise,
  type StrengthEntry,
} from '@/domain/strength';
import { originLabel } from '@/sources/healthConnect';

type Draft = { loadKg: number; reps: number; skipped: boolean };
type Detected = { session: ExerciseSession; avgHr: number | null } | null;

const DAY_MS = 24 * 60 * 60 * 1000;
const s = SETTINGS.strength;

function sourceText(origin: string): string {
  return origin === 'com.huami.watch.hmwatchmanager' ? 'détectée par le Helio Strap' : `détectée par ${originLabel(origin)}`;
}

export default function StrengthEntryScreen() {
  const router = useRouter();
  const today = dayKey(new Date());
  const [detected, setDetected] = useState<Detected | undefined>(undefined);
  const [history, setHistory] = useState<StrengthEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<Exercise, Draft> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const now = Date.now();
      const [sessions, entries, samples] = await Promise.all([
        loadExercises(now - DAY_MS),
        loadStrengthHistory(),
        loadExerciseHeartRate(now - DAY_MS),
      ]);
      const ofToday = sessions.filter((x) => isStrengthSession(x) && dayKey(x.start) === today).sort((a, b) => b.start - a.start);
      const session = pendingStrengthSession(sessions, entries, today) ?? ofToday[0] ?? null;
      let found: Detected = null;
      if (session) {
        const hr = samples.filter((p) => p.time >= session.start && p.time <= session.end).map((p) => p.value);
        found = { session, avgHr: hr.length ? hr.reduce((a, b) => a + b, 0) / hr.length : null };
      }
      // Valeurs de départ : saisie existante de cette séance, sinon la dernière série, sinon les valeurs par défaut.
      const key = sessionKeyOf(session?.id ?? null, today);
      const initial = {} as Record<Exercise, Draft>;
      for (const ex of EXERCISES) {
        const existing = entries.find((e) => e.exercise === ex && sessionKeyOf(e.sessionId, e.date) === key);
        const last = lastSet(entries, ex);
        initial[ex] = existing
          ? { loadKg: existing.loadKg ?? last?.loadKg ?? s.loadDefaultKg, reps: existing.reps ?? last?.reps ?? s.repsDefault, skipped: existing.skipped }
          : { loadKg: last?.loadKg ?? s.loadDefaultKg, reps: last?.reps ?? s.repsDefault, skipped: false };
      }
      setHistory(entries);
      setDetected(found);
      setDrafts(initial);
    })().catch(() => setError('Impossible de lire tes séances.'));
  }, [today]);

  const sessionId = detected?.session.id ?? null;
  const date = detected ? dayKey(detected.session.start) : today;

  function update(ex: Exercise, patch: Partial<Draft>) {
    setSaved(false);
    setDrafts((d) => (d ? { ...d, [ex]: { ...d[ex], ...patch } } : d));
  }

  async function save() {
    if (!drafts) return;
    setSaving(true);
    setError(null);
    try {
      const sets: SetInput[] = EXERCISES.map((ex) =>
        drafts[ex].skipped ? { exercise: ex, skipped: true } : { exercise: ex, loadKg: drafts[ex].loadKg, reps: drafts[ex].reps },
      );
      await saveStrengthSession(sessionId, date, sets);
      setHistory(await loadStrengthHistory());
      await reloadFromDb();
      setSaved(true);
    } catch (e) {
      setError(`L’enregistrement a échoué : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen bottomInset>
      <BackHeader title="Ta séance" onBack={() => router.back()} />
      <AppText variant="small">Meilleure série de chaque exercice</AppText>

      {detected === undefined ? null : detected ? (
        <Card style={styles.sessionCard}>
          <AppText variant="strong">
            {exerciseTypeLabel(detected.session.exerciseType)} · {formatDuration((detected.session.end - detected.session.start) / 60000)}
          </AppText>
          <AppText variant="bodySmall" style={styles.soft}>
            {formatLongDate(new Date(detected.session.start))} · {sourceText(detected.session.origin)}
          </AppText>
          <AppText variant="small">
            {detected.avgHr === null ? 'FC moyenne non disponible' : `FC moyenne ${Math.round(detected.avgHr)} bpm`}
          </AppText>
        </Card>
      ) : (
        <Card>
          <AppText variant="bodySmall" style={styles.soft}>
            Aucune séance de musculation détectée aujourd’hui. Ta saisie sera datée d’aujourd’hui.
          </AppText>
        </Card>
      )}

      {drafts &&
        EXERCISES.map((ex) => {
          const d = drafts[ex];
          const cmp = compareSet(history, ex, d.loadKg, d.reps, date, sessionKeyOf(sessionId, date));
          let deltaText = 'Premier repère pour cet exercice';
          let deltaColor: string = colors.textMuted;
          if (cmp.deltaToLevel !== null) {
            const delta = Math.round(cmp.deltaToLevel * 2) / 2;
            deltaText = `${delta >= 0 ? '+' : '−'}${formatDecimal(Math.abs(delta), delta % 1 === 0 ? 0 : 1)} kg par rapport à ton niveau`;
            if (cmp.deltaToLevel > 0) deltaColor = colors.good;
          }
          if (cmp.record) {
            deltaText += ' · record';
            deltaColor = colors.good;
          }
          return (
            <Card key={ex} style={[styles.exCard, d.skipped && styles.skipped]}>
              <View style={styles.exHeader}>
                <AppText variant="strong" style={styles.exName}>
                  {EXERCISE_LABEL[ex]}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: d.skipped }}
                  accessibilityLabel={d.skipped ? `${EXERCISE_LABEL[ex]} : pas fait. Toucher pour saisir` : `${EXERCISE_LABEL[ex]} : pas fait`}
                  onPress={() => update(ex, { skipped: !d.skipped })}
                  style={[styles.skipButton, d.skipped && styles.skipButtonOn]}>
                  <AppText style={[styles.skipText, d.skipped && { color: colors.bg }]}>{d.skipped ? 'Pas fait ✓' : 'Pas fait'}</AppText>
                </Pressable>
              </View>
              {!d.skipped && (
                <>
                  <View style={styles.steppers}>
                    <View style={styles.stepperCol}>
                      <AppText variant="small">Charge</AppText>
                      <Stepper
                        value={d.loadKg}
                        unit="kg"
                        step={s.loadStepKg}
                        min={s.loadMinKg}
                        max={s.loadMaxKg}
                        decimals={d.loadKg % 1 === 0 ? 0 : 1}
                        label="Charge"
                        spokenUnit="kg"
                        onChange={(v) => update(ex, { loadKg: v })}
                      />
                    </View>
                    <View style={styles.stepperCol}>
                      <AppText variant="small">Répétitions</AppText>
                      <Stepper
                        value={d.reps}
                        unit="rép."
                        step={1}
                        min={s.repsMin}
                        max={s.repsMax}
                        label="Répétitions"
                        spokenUnit="répétition"
                        onChange={(v) => update(ex, { reps: v })}
                      />
                    </View>
                  </View>
                  <AppText variant="bodySmall">
                    1RM estimé <AppText style={styles.oneRm}>{Math.round(cmp.oneRm)} kg</AppText>
                  </AppText>
                  <AppText variant="small" style={{ color: deltaColor }}>
                    {deltaText}
                  </AppText>
                </>
              )}
            </Card>
          );
        })}

      {error && (
        <AppText variant="bodySmall" style={{ color: colors.low }}>
          {error}
        </AppText>
      )}

      <PrimaryButton
        title={saved ? 'Enregistré ✓' : 'Enregistrer la séance'}
        done={saved}
        busy={saving}
        disabled={!drafts}
        onPress={save}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sessionCard: { gap: 4 },
  soft: { color: colors.textSoft },
  exCard: { gap: 10 },
  skipped: { opacity: 0.6 },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exName: { flex: 1 },
  skipButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonOn: { backgroundColor: colors.text, borderColor: colors.text },
  skipText: { fontFamily: fonts.body600, fontSize: 13, color: colors.textSoft },
  steppers: { flexDirection: 'row', gap: 10 },
  stepperCol: { flex: 1, gap: 6 },
  oneRm: { fontFamily: fonts.display600, fontSize: 15, color: colors.text },
});
