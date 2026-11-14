// Jauge, sélecteur 1 à 5 et onglets de période.

import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, fonts, radius, TOUCH } from './theme';

/** Jauge : 8 px, piste `track`, remplissage `info`, bornes en 11 px. */
export function Gauge({ value, max, minLabel, maxLabel }: { value: number; max: number; minLabel: string; maxLabel: string }) {
  const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View accessible accessibilityLabel={`${value} sur ${max}`}>
      <View style={styles.gaugeTrack}>
        <View style={[styles.gaugeFill, { width: `${fraction * 100}%` }]} />
      </View>
      <View style={styles.gaugeLabels}>
        <AppText variant="small" style={styles.gaugeLabel}>
          {minLabel}
        </AppText>
        <AppText variant="small" style={styles.gaugeLabel}>
          {maxLabel}
        </AppText>
      </View>
    </View>
  );
}

/** Sélecteur 1 à 5 : 5 boutons égaux de 44 px. Toucher la note choisie l'efface. */
export function RatingSelector({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
}) {
  return (
    <View style={styles.ratingRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = value === n;
        return (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label} ${n}`}
            onPress={() => onChange(selected ? null : n)}
            style={[styles.rating, selected ? styles.ratingSelected : styles.ratingIdle]}>
            <AppText style={[styles.ratingText, { color: selected ? colors.bg : colors.text }]}>{n}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Onglets de période (7 j / 30 j / 90 j). */
export function PeriodTabs<T extends number>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o)}
            style={[styles.tab, active && { backgroundColor: colors.track }]}>
            <AppText style={[styles.tabText, { color: active ? colors.text : colors.textMuted }]}>{o} j</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gaugeTrack: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  gaugeFill: { height: 8, borderRadius: 4, backgroundColor: colors.info },
  gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  gaugeLabel: { fontSize: 11 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  rating: { flex: 1, height: TOUCH, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  ratingSelected: { backgroundColor: colors.text },
  ratingIdle: { borderWidth: 1, borderColor: colors.border },
  ratingText: { fontFamily: fonts.body600, fontSize: 15 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.control, padding: 4 },
  tab: { flex: 1, height: TOUCH, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: fonts.body600, fontSize: 14 },
});
