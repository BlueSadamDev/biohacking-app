// Journal du matin (DESIGN.md, « Écrans du lot 5a ») : remplace l'écran Saisie du matin.
// Comportements de la veille (pastilles), puis poids, ressenti et note libre.
// Sélecteur du jour : aujourd'hui et les 7 jours précédents, pour corriger un jour passé.
// Les comportements cochés sont enregistrés pour la veille du jour choisi.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { scheduleMorningNotifications } from '@/background/morningNotification';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/Buttons';
import { RatingSelector } from '@/components/Controls';
import { dateFromKey, formatDecimal } from '@/components/format';
import { BehaviorChips, DayPicker, journalDayLabel } from '@/components/JournalViews';
import { RichText } from '@/components/RichText';
import { BackHeader, Screen } from '@/components/Screen';
import { colors, fonts, radius } from '@/components/theme';
import { reloadFromDb } from '@/components/useHealthData';
import { loadBehaviors } from '@/db/behaviors';
import { parseWeight } from '@/domain/daily';
import { addDays, dayKey } from '@/domain/dates';
import { behaviorDayOf, editableJournalDates, type Behavior } from '@/domain/journal';
import { SETTINGS } from '@/domain/settings';
import { ERRORS } from '@/domain/texts/common';
import { JOURNAL } from '@/domain/texts/journal';
import { loadJournal, saveJournal } from '@/sources/manualEntry';

type Ratings = { energy: number | null; soreness: number | null; mood: number | null };

const FEELINGS: { key: keyof Ratings; label: string; hint: string }[] = [
  { key: 'energy', ...JOURNAL.feelings.energy },
  { key: 'soreness', ...JOURNAL.feelings.soreness },
  { key: 'mood', ...JOURNAL.feelings.mood },
];

export default function JournalScreen() {
  const router = useRouter();
  const today = dayKey(new Date());
  const [date, setDate] = useState(today);
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  /** Lot 5b : « repas tardif » rempli d'après Suivi macro (mention sous les pastilles). */
  const [lateMealPrefilled, setLateMealPrefilled] = useState(false);
  const [weight, setWeight] = useState('');
  const [ratings, setRatings] = useState<Ratings>({ energy: null, soreness: null, mood: null });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Liste des comportements : relue au retour de « Gérer la liste ».
  useFocusEffect(
    useCallback(() => {
      loadBehaviors()
        .then(setBehaviors)
        .catch(() => setBehaviors([]));
    }, []),
  );

  // Journal du jour choisi : on reprend ce qui est déjà enregistré pour le corriger.
  useEffect(() => {
    let active = true;
    loadJournal(date).then((j) => {
      if (!active) return;
      setWeight(j.weightKg !== null ? formatDecimal(j.weightKg) : '');
      setRatings({ energy: j.energy, soreness: j.soreness, mood: j.mood });
      setNote(j.note);
      setChecked(j.checked);
      setSaved(j.saved);
      setLateMealPrefilled(j.lateMealPrefilled);
    });
    return () => {
      active = false;
    };
  }, [date]);

  const touched = () => setSaved(false);
  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    touched();
    setter(v);
  };

  const toggle = (id: string) => {
    touched();
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function save() {
    const kg = parseWeight(weight);
    if (kg === 'invalid') {
      setError(JOURNAL.weightInvalid(SETTINGS.entry.weightMinKg, SETTINGS.entry.weightMaxKg));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const visible = behaviors.filter((b) => b.visible);
      await saveJournal({ date, weightKg: kg, ...ratings, note }, visible, checked);
      await reloadFromDb();
      setSaved(true);
      // Le rappel « Pense à ton journal » disparaît de la notification du matin.
      scheduleMorningNotifications().catch(() => undefined);
    } catch {
      setError(ERRORS.save);
    } finally {
      setSaving(false);
    }
  }

  const visible = behaviors.filter((b) => b.visible);
  const yesterday = addDays(today, -1);
  const eve = behaviorDayOf(date);
  const eveLabel =
    date === today
      ? JOURNAL.eveToday
      : JOURNAL.eveOther(dateFromKey(eve).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));

  return (
    <Screen bottomInset>
      <BackHeader title={JOURNAL.title} onBack={() => router.back()} />
      <AppText variant="bodySmall" style={styles.muted}>
        {JOURNAL.subtitle}
      </AppText>

      <DayPicker
        dates={editableJournalDates(today)}
        value={date}
        label={(d) => journalDayLabel(d, today, yesterday)}
        onChange={setDate}
      />

      <View style={styles.field}>
        <View style={styles.rowBetween}>
          <AppText style={styles.question}>{eveLabel}</AppText>
          <Pressable accessibilityRole="link" hitSlop={10} onPress={() => router.push('/comportements')}>
            <AppText style={styles.link}>{JOURNAL.manageList}</AppText>
          </Pressable>
        </View>
        {visible.length > 0 ? (
          <BehaviorChips items={visible} checked={checked} onToggle={toggle} />
        ) : (
          <AppText variant="bodySmall" style={styles.muted}>
            {JOURNAL.noBehavior}
          </AppText>
        )}
        <AppText variant="small">{JOURNAL.nothingChecked}</AppText>
        {lateMealPrefilled && visible.some((b) => b.id === SETTINGS.journal.lateMealBehaviorId) ? (
          <AppText variant="small">{JOURNAL.lateMealPrefilled}</AppText>
        ) : null}
      </View>

      <View style={styles.field}>
        <AppText variant="label">{JOURNAL.weightLabel}</AppText>
        <TextInput
          value={weight}
          onChangeText={edit(setWeight)}
          keyboardType="decimal-pad"
          placeholder={JOURNAL.weightPlaceholder}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={JOURNAL.weightA11y}
        />
        <AppText variant="small">{JOURNAL.weightHelp}</AppText>
      </View>

      {FEELINGS.map((f) => (
        <View key={f.key} style={styles.field}>
          <AppText variant="label">{f.label}</AppText>
          <RatingSelector
            label={f.label}
            value={ratings[f.key]}
            onChange={edit((v: number | null) => setRatings((r) => ({ ...r, [f.key]: v })))}
          />
          <AppText variant="small">{f.hint}</AppText>
        </View>
      ))}

      <View style={styles.field}>
        <AppText variant="label">{JOURNAL.noteLabel}</AppText>
        <TextInput
          value={note}
          onChangeText={edit(setNote)}
          multiline
          placeholder={JOURNAL.notePlaceholder}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.note]}
          accessibilityLabel={JOURNAL.noteA11y}
        />
      </View>

      {error && <RichText variant="bodySmall" text={error} style={{ color: colors.low }} />}

      <PrimaryButton title={saved ? JOURNAL.saved : JOURNAL.save} done={saved} busy={saving} onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  muted: { color: colors.textMuted },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  question: { fontFamily: fonts.body600, fontSize: 16, color: colors.text, flex: 1 },
  link: { fontFamily: fonts.body600, fontSize: 13, color: colors.infoText },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: fonts.body400,
    fontSize: 16,
    backgroundColor: colors.surface,
  },
  note: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
});
