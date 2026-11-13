// Tuile d'indicateur, contenu centré : libellé (une ligne), valeur, écart à la norme
// (en couleur) et repère de comparaison (en gris). Cliquable → écran détail.

import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, radius } from './theme';

export type Tone = 'good' | 'neutral' | 'bad';

const TONE_COLOR: Record<Tone, string> = { good: colors.good, neutral: colors.textMuted, bad: colors.mid };

type Props = {
  label: string;
  value: string;
  unit?: string;
  /** Écart à la norme, court (« −4 bpm »). */
  note: string;
  /** Repère de comparaison (« vs moy. 30 j »). */
  context?: string;
  tone: Tone;
  onPress?: () => void;
};

export function MetricTile({ label, value, unit, note, context, tone, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value} ${unit ?? ''}. ${note} ${context ?? ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}>
      <AppText variant="small" numberOfLines={1} adjustsFontSizeToFit style={styles.center}>
        {label}
      </AppText>
      <View style={styles.valueRow}>
        <AppText variant="tileValue" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </AppText>
        {unit ? <AppText variant="unit"> {unit}</AppText> : null}
      </View>
      <View>
        <AppText variant="small" style={[styles.center, styles.note, { color: TONE_COLOR[tone] }]}>
          {note}
        </AppText>
        {context ? (
          <AppText variant="small" style={[styles.center, styles.context]}>
            {context}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 112,
    backgroundColor: colors.surface,
    borderRadius: radius.tile,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  center: { textAlign: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  note: { fontSize: 13 },
  context: { fontSize: 11 },
});
