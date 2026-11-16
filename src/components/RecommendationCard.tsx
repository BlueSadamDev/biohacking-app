// Carte « Recommandation du jour » : fond teinté et bordure de la couleur d'état.
// Ordre de la charte des textes (lot 5a.1) : le pourquoi, puis l'action en dernière ligne, en relief.

import { StyleSheet, View } from 'react-native';

import type { Recommendation } from '@/domain/recommendation';
import { HOME } from '@/domain/texts/today';

import { AppText } from './AppText';
import { RichText } from './RichText';
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
        {HOME.recommendationLabel}
      </AppText>
      {recommendation.reason !== '' && (
        <AppText variant="bodySmall" style={{ color: colors.textSoft }}>
          {recommendation.reason}
        </AppText>
      )}
      <RichText variant="constat" text={recommendation.action} style={styles.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, padding: 16, gap: 6 },
  action: { marginTop: 2 },
});
