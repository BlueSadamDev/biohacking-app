// Gérer la liste des comportements (DESIGN.md, « Écrans du lot 5a ») : lignes de réglage avec
// le nom (touchable pour renommer) et l'interrupteur « Affiché ». Bouton « Ajouter un comportement ».
// Pas de suppression : un comportement masqué garde son historique.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { BackHeader, Screen } from '@/components/Screen';
import { SettingsGroup, Switch } from '@/components/SettingsControls';
import { colors, fonts, radius } from '@/components/theme';
import { addBehavior, loadBehaviors, renameBehavior, setBehaviorVisible } from '@/db/behaviors';
import { newBehaviorId, validateBehaviorName, type Behavior } from '@/domain/journal';
import { SETTINGS } from '@/domain/settings';

/** Champ de nom (ajout ou renommage) : 40 caractères au plus. */
function NameField({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const e = await onSubmit(name);
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
      {error && (
        <AppText variant="bodySmall" style={{ color: colors.low }}>
          {error}
        </AppText>
      )}
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

  async function rename(b: Behavior, name: string): Promise<string | null> {
    const error = validateBehaviorName(name, behaviors, b.id);
    if (error) return error;
    await renameBehavior(b.id, name);
    setEditing(null);
    reload();
    return null;
  }

  async function add(name: string): Promise<string | null> {
    const error = validateBehaviorName(name, behaviors);
    if (error) return error;
    await addBehavior(newBehaviorId(), name);
    setEditing(null);
    reload();
    return null;
  }

  return (
    <Screen bottomInset>
      <BackHeader title="Comportements" onBack={() => router.back()} />
      <AppText variant="bodySmall" style={styles.muted}>
        Touche un nom pour le renommer. Un comportement masqué n’apparaît plus dans le journal, mais garde son historique.
      </AppText>

      <SettingsGroup title="Ta liste">
        {behaviors.map((b) =>
          editing === b.id ? (
            <NameField key={b.id} initial={b.name} submitLabel="Renommer" onSubmit={(n) => rename(b, n)} onCancel={() => setEditing(null)} />
          ) : (
            <View key={b.id} style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Renommer ${b.name}`}
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
          <NameField initial="" submitLabel="Ajouter" onSubmit={add} onCancel={() => setEditing(null)} />
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
