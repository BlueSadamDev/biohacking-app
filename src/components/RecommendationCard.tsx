// Carte « Recommandation du jour » : fond teinté et bordure de la couleur d'état.

import { StyleSheet, View } from 'react-native';

import type { Recommendation } from '@/domain/recommendation';

import { AppText } from './AppText';
import { colors, radius, tint, zoneColor } from './theme';

export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const neutral = recommendation.zone === 'neutral';
  const color = zoneColor(recommendation.zone);
  return (
    <View
      style={[
        styles.card,
        neutral
          ? { backgroundColor: colors.surface, borderColor: colors.border }
          : { backgroundColor: tint(color), borderColor: color },
      ]}>
      <AppText variant="label" style={{ color }}>
        Recommandation du jour
      </AppText>
      <AppText variant="strong" style={styles.action}>
        {recommendation.action}
      </AppText>
      {recommendation.reason !== '' && (
        <AppText variant="bodySmall" style={{ color: colors.textSoft }}>
          {recommendation.reason}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, padding: 16, gap: 6 },
  action: { marginTop: 2 },
});
