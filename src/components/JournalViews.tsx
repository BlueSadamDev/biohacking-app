// Composants du journal du matin (DESIGN.md, « Écrans du lot 5a ») : pastilles de comportement
// et sélecteur du jour à corriger.

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { dateFromKey } from './format';
import { colors, fonts, radius } from './theme';

/** Pastilles de comportement : hauteur 40, pilule ; cochée fond `text`, sinon contour `border`. */
export function BehaviorChips({
  items,
  checked,
  onToggle,
}: {
  items: readonly { id: string; name: string }[];
  checked: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {items.map((b) => {
        const on = checked.has(b.id);
        return (
          <Pressable
            key={b.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={b.name}
            hitSlop={4}
            onPress={() => onToggle(b.id)}
            style={[styles.chip, on ? styles.chipOn : styles.chipOff]}>
            <AppText style={[styles.chipText, { color: on ? colors.bg : colors.textSoft }]}>{b.name}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** « Aujourd'hui », « Hier », puis « lun. 9 ». */
export function journalDayLabel(date: string, today: string, yesterday: string): string {
  if (date === today) return 'Aujourd’hui';
  if (date === yesterday) return 'Hier';
  return dateFromKey(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}

/** Sélecteur du jour : aujourd'hui et les 7 jours précédents, en ligne défilante. */
export function DayPicker({
  dates,
  value,
  label,
  onChange,
}: {
  dates: readonly string[];
  value: string;
  label: (date: string) => string;
  onChange: (date: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days} accessibilityRole="radiogroup">
      {dates.map((d) => {
        const active = d === value;
        return (
          <Pressable
            key={d}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(d)}
            style={[styles.day, active ? styles.chipOn : styles.chipOff]}>
            <AppText style={[styles.chipText, { color: active ? colors.bg : colors.textSoft }]}>{label(d)}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, borderRadius: radius.pill, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.text },
  chipOff: { borderWidth: 1, borderColor: colors.border },
  chipText: { fontFamily: fonts.body500, fontSize: 14 },
  days: { gap: 8, paddingVertical: 2 },
  day: { height: 44, borderRadius: radius.pill, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
});
