// Saisie du matin (DESIGN.md, écran 3) : poids + énergie, courbatures, humeur (1 à 5), note.
// Le poids saisi fait foi : il remplace la pesée Zepp du jour.

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/Buttons';
import { RatingSelector } from '@/components/Controls';
import { formatDecimal, formatLongDate } from '@/components/format';
import { BackHeader, Screen } from '@/components/Screen';
import { colors, fonts, radius } from '@/components/theme';
import { reloadFromDb } from '@/components/useHealthData';
import { parseWeight } from '@/domain/daily';
import { dayKey } from '@/domain/dates';
import { SETTINGS } from '@/domain/settings';
import { loadMorningEntry, saveMorningEntry } from '@/sources/manualEntry';

type Ratings = { energy: number | null; soreness: number | null; mood: number | null };

const FEELINGS: { key: keyof Ratings; label: string; hint: string }[] = [
  { key: 'energy', label: 'Énergie', hint: '1 = très basse · 5 = excellente' },
  { key: 'soreness', label: 'Courbatures', hint: '1 = aucune · 5 = très fortes' },
  { key: 'mood', label: 'Humeur', hint: '1 = mauvaise · 5 = excellente' },
];

export default function MorningEntryScreen() {
  const router = useRouter();
  const date = dayKey(new Date());
  const [weight, setWeight] = useState('');
  const [ratings, setRatings] = useState<Ratings>({ energy: null, soreness: null, mood: null });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si une saisie existe déjà aujourd'hui, on la reprend pour la corriger.
  useEffect(() => {
    loadMorningEntry(date).then((e) => {
      if (e.weightKg !== null) setWeight(formatDecimal(e.weightKg));
      setRatings({ energy: e.energy, soreness: e.soreness, mood: e.mood });
      setNote(e.note);
    });
  }, [date]);

  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setSaved(false);
    setter(v);
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
      await saveMorningEntry({ date, weightKg: kg, ...ratings, note });
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
      <BackHeader title="Saisie du matin" onBack={() => router.back()} />
      <AppText variant="small">{formatLongDate(new Date())}</AppText>

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
        <AppText variant="label">Note (facultatif)</AppText>
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
