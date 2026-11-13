// Tuile d'indicateur : libellé, valeur, écart à la norme. Cliquable → écran détail.

import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, radius } from './theme';

export type Tone = 'good' | 'neutral' | 'bad';

const TONE_COLOR: Record<Tone, string> = { good: colors.good, neutral: colors.textMuted, bad: colors.mid };

type Props = {
  label: string;
  value: string;
  unit?: string;
  note: string;
  tone: Tone;
  onPress?: () => void;
};

export function MetricTile({ label, value, unit, note, tone, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value} ${unit ?? ''}. ${note}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}>
      <AppText variant="small">{label}</AppText>
      <View style={styles.valueRow}>
        <AppText variant="tileValue" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </AppText>
        {unit ? <AppText variant="unit"> {unit}</AppText> : null}
      </View>
      <AppText variant="small" style={{ color: TONE_COLOR[tone] }}>
        {note}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 96,
    backgroundColor: colors.surface,
    borderRadius: radius.tile,
    padding: 12,
    gap: 4,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
});
