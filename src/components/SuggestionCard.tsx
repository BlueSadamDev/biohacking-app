// Carte suggestion (DESIGN.md, « Écrans du lot 3 ») : fond `info` à 10 %, bordure 1 px `info`, rayon 16.
// « À essayer cette semaine » (12/600, #7DB8FF, majuscules), proposition en 16/600,
// manque comblé et où le faire à Paris (13, `textSoft`), puis éventuellement un second manque (12, `textMuted`).

import { StyleSheet, View } from 'react-native';

import { GAP_LABEL } from '@/domain/sportCatalog';
import type { Suggestion } from '@/domain/suggestions';

import { AppText } from './AppText';
import { colors, fonts, radius, tint } from './theme';

export function SuggestionCard({ primary, secondary }: { primary: Suggestion; secondary: Suggestion | null }) {
  return (
    <View style={styles.card}>
      <AppText style={styles.label}>À essayer cette semaine</AppText>
      <AppText variant="strong">{primary.activity.title}</AppText>
      <AppText style={styles.soft}>
        {primary.activity.benefit} {primary.activity.where}
      </AppText>
      <AppText variant="small">{primary.reason}</AppText>
      {secondary && (
        <AppText variant="small">
          Autre manque · {GAP_LABEL[secondary.gap]} : {secondary.activity.title.charAt(0).toLowerCase()}
          {secondary.activity.title.slice(1)}. {secondary.reason}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tint(colors.info, 0.1),
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: radius.card,
    padding: 16,
    gap: 6,
  },
  label: {
    fontFamily: fonts.body600,
    fontSize: 12,
    color: colors.infoText,
    textTransform: 'uppercase',
    letterSpacing: 12 * 0.08,
  },
  soft: { fontFamily: fonts.body400, fontSize: 13, color: colors.textSoft },
});
