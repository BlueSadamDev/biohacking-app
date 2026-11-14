// Composants de l'écran Réglages (DESIGN.md, « Écrans du lot 2 ») :
// groupe de lignes, ligne de réglage, champ numérique, interrupteur, pastilles de choix.

import { Children, Fragment, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from './AppText';
import { colors, fonts, radius, TOUCH } from './theme';

/** Groupe : libellé de section au-dessus, lignes dans une carte `surface` de rayon 16. */
export function SettingsGroup({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      <AppText variant="label">{title}</AppText>
      <View style={styles.card}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={styles.separator} />}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <AppText variant="small">{footer}</AppText> : null}
    </View>
  );
}

/** Ligne : hauteur minimale 52, libellé à gauche (14), valeur à droite. */
export function SettingRow({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <AppText style={styles.labelText}>{label}</AppText>
        {hint ? <AppText variant="small">{hint}</AppText> : null}
      </View>
      {children}
    </View>
  );
}

/** Valeur affichée en Space Grotesk 15/600. */
export function SettingValue({ text, color }: { text: string; color?: string }) {
  return <AppText style={[styles.value, color ? { color } : null]}>{text}</AppText>;
}

/** Ligne qui ouvre un autre écran ou lance une action. */
export function SettingLink({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <AppText style={[styles.labelText, styles.rowLabel, color ? { color } : null]}>{label}</AppText>
      <AppText style={[styles.chevron, color ? { color } : null]}>›</AppText>
    </Pressable>
  );
}

/**
 * Champ numérique 96 × 40 suivi de l'unité. La valeur est lue à la sortie du champ :
 * `parse` renvoie la valeur, null (champ vide) ou 'invalid' (le champ reprend l'ancienne valeur).
 */
export function NumberField({
  value,
  placeholder,
  unit,
  label,
  parse,
  format,
  onCommit,
}: {
  value: number | null;
  placeholder?: string;
  unit: string;
  label: string;
  parse: (text: string) => number | null | 'invalid';
  format: (v: number) => string;
  onCommit: (v: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? '' : format(value));
  const [invalid, setInvalid] = useState(false);
  // Valeur changée de l'extérieur (rechargement) : on met le champ à jour.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(value === null ? '' : format(value));
  }

  function commit() {
    const parsed = parse(text);
    if (parsed === 'invalid') {
      setInvalid(true);
      setText(value === null ? '' : format(value));
      return;
    }
    setInvalid(false);
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <View style={styles.fieldWrap}>
      <TextInput
        accessibilityLabel={label}
        value={text}
        onChangeText={(t) => {
          setText(t);
          setInvalid(false);
        }}
        onEndEditing={commit}
        onSubmitEditing={commit}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        returnKeyType="done"
        style={[styles.field, invalid && { borderColor: colors.low }]}
      />
      <AppText style={styles.unit}>{unit}</AppText>
    </View>
  );
}

/** Interrupteur 52 × 32 : activé = piste `good`, bouton à droite ; désactivé = piste `border`. */
export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      hitSlop={6}
      onPress={() => onChange(!value)}
      style={[styles.switchTrack, { backgroundColor: value ? colors.good : colors.border }]}>
      <View style={[styles.switchKnob, value ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

/** Pastilles de choix (filtres) : hauteur 36, actif fond `text`, inactif contour `border`. */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            hitSlop={4}
            onPress={() => onChange(o.value)}
            style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
            <AppText style={[styles.chipText, { color: active ? colors.bg : colors.textSoft }]}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Heure réglable par pas : boutons − et + (44 px) autour de la valeur. */
export function TimeStepper({ text, onMinus, onPlus, label }: { text: string; onMinus: () => void; onPlus: () => void; label: string }) {
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} : plus tôt`} onPress={onMinus} style={styles.stepButton}>
        <AppText style={styles.stepText}>−</AppText>
      </Pressable>
      <AppText style={[styles.value, styles.stepValue]} accessibilityLiveRegion="polite">
        {text}
      </AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} : plus tard`} onPress={onPlus} style={styles.stepButton}>
        <AppText style={styles.stepText}>+</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: 16 },
  separator: { height: 1, backgroundColor: colors.surfaceAlt },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rowLabel: { flex: 1 },
  labelText: { fontFamily: fonts.body400, fontSize: 14, color: colors.text },
  value: { fontFamily: fonts.display600, fontSize: 15, color: colors.text },
  chevron: { fontFamily: fonts.body400, fontSize: 22, color: colors.textMuted },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: {
    width: 96,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 10,
    textAlign: 'right',
    color: colors.text,
    fontFamily: fonts.display600,
    fontSize: 15,
  },
  unit: { fontFamily: fonts.body400, fontSize: 13, color: colors.textMuted, minWidth: 34 },
  switchTrack: { width: 52, height: 32, borderRadius: 16, padding: 4, justifyContent: 'center' },
  switchKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.text },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 36, borderRadius: radius.pill, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.text },
  chipIdle: { borderWidth: 1, borderColor: colors.border },
  chipText: { fontFamily: fonts.body600, fontSize: 13 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepButton: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: fonts.body600, fontSize: 20, color: colors.text },
  stepValue: { minWidth: 48, textAlign: 'center' },
});
