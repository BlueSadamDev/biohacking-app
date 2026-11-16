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
import { BackHeader, Screen } from '@/components/Screen';
import { colors, fonts, radius } from '@/components/theme';
import { reloadFromDb } from '@/components/useHealthData';
import { loadBehaviors } from '@/db/behaviors';
import { parseWeight } from '@/domain/daily';
import { addDays, dayKey } from '@/domain/dates';
import { behaviorDayOf, editableJournalDates, type Behavior } from '@/domain/journal';
import { SETTINGS } from '@/domain/settings';
import { loadJournal, saveJournal } from '@/sources/manualEntry';

type Ratings = { energy: number | null; soreness: number | null; mood: number | null };

const FEELINGS: { key: keyof Ratings; label: string; hint: string }[] = [
  { key: 'energy', label: 'Énergie', hint: '1 = très basse · 5 = excellente' },
  { key: 'soreness', label: 'Courbatures', hint: '1 = aucune · 5 = très fortes' },
  { key: 'mood', label: 'Humeur', hint: '1 = mauvaise · 5 = excellente' },
];

export default function JournalScreen() {
  const router = useRouter();
  const today = dayKey(new Date());
  const [date, setDate] = useState(today);
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
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
      setError(`Poids non reconnu : tape un nombre entre ${SETTINGS.entry.weightMinKg} et ${SETTINGS.entry.weightMaxKg} kg (ex. 78,4).`);
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
    } catch (e) {
      setError(`L’enregistrement a échoué : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  const visible = behaviors.filter((b) => b.visible);
  const yesterday = addDays(today, -1);
  const eve = behaviorDayOf(date);
  const eveLabel =
    date === today
      ? 'Hier, tu as…'
      : `Le ${dateFromKey(eve).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}, tu as…`;

  return (
    <Screen bottomInset>
      <BackHeader title="Journal du matin" onBack={() => router.back()} />
      <AppText variant="bodySmall" style={styles.muted}>
        15 secondes pour comprendre ta nuit
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
            <AppText style={styles.link}>Gérer la liste</AppText>
          </Pressable>
        </View>
        {visible.length > 0 ? (
          <BehaviorChips items={visible} checked={checked} onToggle={toggle} />
        ) : (
          <AppText variant="bodySmall" style={styles.muted}>
            Aucun comportement affiché : ajoute-en depuis « Gérer la liste ».
          </AppText>
        )}
        <AppText variant="small">Rien coché = rien de particulier.</AppText>
      </View>

      <View style={styles.field}>
        <AppText variant="label">Poids (kg)</AppText>
        <TextInput
          value={weight}
          onChangeText={edit(setWeight)}
          keyboardType="decimal-pad"
          placeholder="ex. 78,4"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel="Poids en kilos"
        />
        <AppText variant="small">Le matin à jeun. Ta saisie remplace la pesée Zepp du jour.</AppText>
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
        <AppText variant="label">Autre chose à noter ?</AppText>
        <TextInput
          value={note}
          onChangeText={edit(setNote)}
          multiline
          placeholder="Mal dormi, séance tardive…"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.note]}
          accessibilityLabel="Note libre"
        />
      </View>

      {error && (
        <AppText variant="bodySmall" style={{ color: colors.low }}>
          {error}
        </AppText>
      )}

      <PrimaryButton title={saved ? 'Enregistré ✓' : 'Enregistrer'} done={saved} busy={saving} onPress={save} />
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
