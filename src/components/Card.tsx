// Carte (fond surface, rayon 16) et pastille d'état.

import { StyleSheet, View, type ViewProps } from 'react-native';

import { AppText } from './AppText';
import { colors, fonts, radius, tint } from './theme';

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

/** Pastille : fond teinté, texte coloré. Sans couleur → contour neutre. */
export function Pill({ text, color }: { text: string; color?: string }) {
  return (
    <View
      style={[
        styles.pill,
        color ? { backgroundColor: tint(color) } : { borderWidth: 1, borderColor: colors.border },
      ]}>
      <AppText style={[styles.pillText, { color: color ?? colors.textMuted }]}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16 },
  pill: {
    alignSelf: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: { fontFamily: fonts.body600, fontSize: 14 },
});
