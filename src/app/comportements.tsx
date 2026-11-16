// Gérer la liste des comportements (DESIGN.md, « Écrans du lot 5a ») : lignes de réglage avec
// le nom (touchable pour le modifier, avec sa forme « en phrase » depuis le lot 5a.1) et l'interrupteur
// « Affiché ». Bouton « Ajouter un comportement ».
// Pas de suppression : un comportement masqué garde son historique.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { BackHeader, Screen } from '@/components/Screen';
import { SettingsGroup, Switch } from '@/components/SettingsControls';
import { colors, fonts, radius } from '@/components/theme';
import { RichText } from '@/components/RichText';
import { addBehavior, loadBehaviors, renameBehavior, setBehaviorPhrase, setBehaviorVisible } from '@/db/behaviors';
import { newBehaviorId, validateBehaviorName, type Behavior } from '@/domain/journal';
import { SETTINGS } from '@/domain/settings';
import { ERRORS } from '@/domain/texts/common';
import { BEHAVIOR_LIST, behaviorPhrase } from '@/domain/texts/journal';

/**
 * Champ de nom (ajout ou renommage) : 40 caractères au plus. Lot 5a.1 : forme « en phrase »
 * facultative, utilisée par les liens observés (vide = phrase par défaut ou tournure générique).
 */
function NameField({
  initial,
  initialPhrase,
  phraseHint,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: string;
  initialPhrase: string;
  /** Phrase utilisée aujourd'hui si le champ reste vide (affichée en exemple). */
  phraseHint: string;
  submitLabel: string;
  onSubmit: (name: string, phrase: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const [phrase, setPhrase] = useState(initialPhrase);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const e = await onSubmit(name, phrase).catch(() => ERRORS.save);
    setBusy(false);
    setError(e);
  }
  return (
    <View style={styles.form}>
      <TextInput
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
        }}
        maxLength={SETTINGS.journal.maxNameLength}
        autoFocus
        placeholder="ex. Lecture le soir"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        accessibilityLabel="Nom du comportement"
      />
      <AppText variant="small">
        {name.trim().length} / {SETTINGS.journal.maxNameLength} caractères
      </AppText>
      <AppText variant="label">{BEHAVIOR_LIST.phraseLabel}</AppText>
      <TextInput
        value={phrase}
        onChangeText={(t) => {
          setPhrase(t);
          setError(null);
        }}
        maxLength={SETTINGS.journal.maxPhraseLength}
        placeholder={phraseHint}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        accessibilityLabel={BEHAVIOR_LIST.phraseA11y(name.trim() || initial)}
      />
      <AppText variant="small">{BEHAVIOR_LIST.phraseHelp}</AppText>
      {error && <RichText variant="bodySmall" text={error} style={{ color: colors.low }} />}
      <PrimaryButton title={submitLabel} busy={busy} onPress={submit} />
      <SecondaryButton title="Annuler" onPress={onCancel} />
    </View>
  );
}

export default function BehaviorsScreen() {
  const router = useRouter();
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  /** Ligne en cours de renommage, ou 'new' pour un ajout. */
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  const reload = useCallback(() => {
    loadBehaviors()
      .then(setBehaviors)
      .catch(() => setBehaviors([]));
  }, []);
  useEffect(reload, [reload]);

  async function toggle(b: Behavior, visible: boolean) {
    setBehaviors((list) => list.map((x) => (x.id === b.id ? { ...x, visible } : x)));
    await setBehaviorVisible(b.id, visible).catch(reload);
  }

  async function rename(b: Behavior, name: string, phrase: string): Promise<string | null> {
    const error = validateBehaviorName(name, behaviors, b.id);
    if (error) return error;
    await renameBehavior(b.id, name);
    await setBehaviorPhrase(b.id, phrase);
    setEditing(null);
    reload();
    return null;
  }

  async function add(name: string, phrase: string): Promise<string | null> {
    const error = validateBehaviorName(name, behaviors);
    if (error) return error;
    const id = newBehaviorId();
    await addBehavior(id, name);
    await setBehaviorPhrase(id, phrase);
    setEditing(null);
    reload();
    return null;
  }

  return (
    <Screen bottomInset>
      <BackHeader title="Comportements" onBack={() => router.back()} />
      <AppText variant="bodySmall" style={styles.muted}>
        Touche un nom pour le modifier. Un comportement masqué n’apparaît plus dans le journal, mais garde son historique.
      </AppText>

      <SettingsGroup title="Ta liste">
        {behaviors.map((b) =>
          editing === b.id ? (
            <NameField
              key={b.id}
              initial={b.name}
              initialPhrase={b.phrase ?? ''}
              phraseHint={behaviorPhrase({ ...b, phrase: null })}
              submitLabel="Enregistrer"
              onSubmit={(n, p) => rename(b, n, p)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <View key={b.id} style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Modifier ${b.name}`}
                onPress={() => setEditing(b.id)}
                style={styles.name}>
                <AppText style={[styles.nameText, !b.visible && styles.hidden]}>{b.name}</AppText>
                <AppText variant="small">{b.visible ? 'Affiché' : 'Masqué'}</AppText>
              </Pressable>
              <Switch value={b.visible} onChange={(v) => toggle(b, v)} label={`Afficher ${b.name}`} />
            </View>
          ),
        )}
      </SettingsGroup>

      {editing === 'new' ? (
        <View style={styles.card}>
          <NameField
            initial=""
            initialPhrase=""
            phraseHint={BEHAVIOR_LIST.phrasePlaceholder}
            submitLabel="Ajouter"
            onSubmit={add}
            onCancel={() => setEditing(null)}
          />
        </View>
      ) : (
        <SecondaryButton title="Ajouter un comportement" onPress={() => setEditing('new')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  name: { flex: 1, minHeight: 44, justifyContent: 'center' },
  nameText: { fontFamily: fonts.body400, fontSize: 14, color: colors.text },
  hidden: { color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16 },
  form: { gap: 8, paddingVertical: 12 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: fonts.body400,
    fontSize: 15,
    backgroundColor: colors.bg,
  },
});
