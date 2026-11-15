// Composants du coach (DESIGN.md, « Écrans du lot 4 ») : badge « 100 % sur ton téléphone »
// et carte « Bilan de la semaine ».

import { Pressable, StyleSheet, View } from 'react-native';

import type { WeeklyReview } from '@/domain/weeklyReview';

import { AppText } from './AppText';
import { formatShortDate } from './format';
import { LockIcon } from './Icons';
import { colors, fonts, radius } from './theme';

/** Badge : pilule de 32 px, fond surface, cadenas 14 px + texte 12 textSoft. Ouvre l'écran Modèle. */
export function PrivacyBadge({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="100 % sur ton téléphone : ouvrir le modèle du coach"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.badge, pressed && { opacity: 0.7 }]}>
      <LockIcon size={14} color={colors.textSoft} />
      <AppText style={styles.badgeText}>100 % sur ton téléphone</AppText>
    </Pressable>
  );
}

/** Carte « Bilan de la semaine ». */
export function WeeklyReviewCard({ review }: { review: WeeklyReview }) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <AppText style={styles.label}>Bilan de la semaine</AppText>
        <AppText variant="small">
          {formatShortDate(review.weekStart)} – {formatShortDate(review.weekEnd)}
        </AppText>
      </View>
      <AppText style={styles.synthesis}>{review.synthesis}</AppText>
      {review.worked.length > 0 && <Line label="Ce qui a marché" color={colors.good} text={review.worked.join(' · ')} />}
      {review.stuck.length > 0 && <Line label="Ce qui coince" color={colors.mid} text={review.stuck.join(' · ')} />}
      <View style={styles.separator} />
      <AppText variant="small">
        {review.actions.length > 1 ? `Tes ${review.actions.length} actions pour la semaine` : 'Ton action pour la semaine'}
      </AppText>
      {review.actions.map((a, i) => (
        <AppText key={i} style={styles.action}>
          {i + 1}. {a}
        </AppText>
      ))}
      {review.facts.length > 0 && <AppText style={styles.facts}>D’après : {review.facts.join(' · ')}</AppText>}
      {review.source === 'app' && (
        <AppText style={styles.facts}>Rédigé par l’app : le coach n’a pas pu formuler de conseil sûr cette fois.</AppText>
      )}
    </View>
  );
}

function Line({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <AppText style={styles.line}>
      <AppText style={[styles.lineLabel, { color }]}>{label} · </AppText>
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  badge: {
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: { fontFamily: fonts.body400, fontSize: 12, color: colors.textSoft },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    fontFamily: fonts.body600,
    fontSize: 12,
    color: colors.infoText,
    textTransform: 'uppercase',
    letterSpacing: 12 * 0.08,
  },
  synthesis: { fontFamily: fonts.body600, fontSize: 15, color: colors.text },
  line: { fontFamily: fonts.body400, fontSize: 13, color: colors.textSoft },
  lineLabel: { fontFamily: fonts.body600, fontSize: 13 },
  separator: { height: 1, backgroundColor: colors.surfaceAlt, marginVertical: 4 },
  action: { fontFamily: fonts.body600, fontSize: 14, color: colors.text },
  facts: { fontFamily: fonts.body400, fontSize: 11, color: colors.tabInactive, marginTop: 4 },
});
