// Composants des alertes (DESIGN.md, « Écrans du lot 2 ») : bouton Alertes de l'en-tête,
// carte alerte du jour (accueil), carte alerte de l'historique.
// Niveaux : « À surveiller » = `mid`, « Important » = `low`, toujours écrits en toutes lettres.

import { Pressable, StyleSheet, View } from 'react-native';

import type { StoredAlert } from '@/db/alerts';
import { ALERT_FEEDBACKS, LEVEL_LABEL, THEME_LABEL, type AlertFeedback, type AlertLevel } from '@/domain/alerts';
import { ALERT_UI } from '@/domain/texts/alerts';
import { plainText } from '@/domain/texts/markup';

import { AppText } from './AppText';
import { RichText } from './RichText';
import { WhyLink } from './CoachViews';
import { formatShortDate } from './format';
import { BellIcon, ChevronIcon } from './Icons';
import { colors, fonts, radius, TOUCH } from './theme';

export function levelColor(level: AlertLevel): string {
  return level === 'important' ? colors.low : colors.mid;
}

/** Bouton rond 44 × 44 avec une pastille de 9 px (couleur de la dernière alerte non lue). */
export function AlertsButton({ unread, level, onPress }: { unread: number; level: AlertLevel | null; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Alertes : ${unread} nouvelle${unread > 1 ? 's' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}>
      <BellIcon size={22} />
      {unread > 0 && level && <View style={[styles.dot, { backgroundColor: levelColor(level) }]} />}
    </Pressable>
  );
}

/**
 * Avis sur une alerte (lot 5b) : trois pastilles discrètes ; le choix fait reste en surbrillance.
 * Toucher le choix déjà fait le retire (l'avis reste modifiable).
 */
export function FeedbackChips({ value, onChange }: { value: AlertFeedback | null; onChange: (v: AlertFeedback | null) => void }) {
  return (
    <View style={styles.feedback} accessibilityRole="radiogroup" accessibilityLabel={ALERT_UI.feedbackGroup}>
      {ALERT_FEEDBACKS.map((f) => {
        const on = value === f;
        return (
          <Pressable
            key={f}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={ALERT_UI.feedback[f]}
            hitSlop={8}
            onPress={() => onChange(on ? null : f)}
            style={[styles.feedbackChip, on ? styles.feedbackOn : styles.feedbackOff]}>
            <AppText style={[styles.feedbackText, { color: on ? colors.bg : colors.textSoft }]}>{ALERT_UI.feedback[f]}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Carte alerte du jour : le haut de la carte ouvre l'historique ; dessous, l'avis (lot 5b). */
export function TodayAlertCard({
  alert,
  onPress,
  onFeedback,
}: {
  alert: StoredAlert;
  onPress: () => void;
  onFeedback?: (v: AlertFeedback | null) => void;
}) {
  const color = levelColor(alert.level);
  return (
    <View style={styles.todayCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${LEVEL_LABEL[alert.level]}, ${alert.title}. Ouvrir les alertes`}
        onPress={onPress}
        style={({ pressed }) => [styles.today, pressed && { opacity: 0.7 }]}>
        <View style={[styles.point, { backgroundColor: color }]} />
        <View style={styles.todayText}>
          <AppText style={[styles.kicker, { color }]}>
            Alerte · {THEME_LABEL[alert.theme]} · {LEVEL_LABEL[alert.level]}
          </AppText>
          <AppText style={styles.todayTitle}>{alert.title}</AppText>
          <AppText style={styles.oneLine} numberOfLines={1}>
            {plainText(alert.finding)}
          </AppText>
        </View>
        <ChevronIcon size={20} color={colors.textMuted} />
      </Pressable>
      {onFeedback && (
        <View style={styles.todayFeedback}>
          <FeedbackChips value={alert.feedback} onChange={onFeedback} />
        </View>
      )}
    </View>
  );
}

/**
 * Carte de l'historique : niveau · thème et date, titre, puis la charte des textes (lot 5a.1) :
 * constat (chiffre en relief), pourquoi en petit, action en dernière ligne (en relief).
 * Les alertes enregistrées avant le lot 5a.1 gardent leur texte d'origine (sans relief).
 */
export function AlertHistoryCard({
  alert,
  onWhy,
  onFeedback,
}: {
  alert: StoredAlert;
  onWhy?: () => void;
  onFeedback?: (v: AlertFeedback | null) => void;
}) {
  const color = levelColor(alert.level);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <AppText style={[styles.kicker, styles.flex, { color }]}>
          {LEVEL_LABEL[alert.level]} · {THEME_LABEL[alert.theme]}
        </AppText>
        <AppText variant="small">{formatShortDate(alert.date)}</AppText>
      </View>
      <AppText style={styles.cardTitle}>{alert.title}</AppText>
      <RichText style={styles.finding} text={alert.finding} />
      <AppText style={styles.detail}>{alert.cause}</AppText>
      <RichText style={styles.action} text={alert.action} />
      {onFeedback && <FeedbackChips value={alert.feedback} onChange={onFeedback} />}
      {alert.persistent && <AppText variant="small">{ALERT_UI.persistent}</AppText>}
      {onWhy && <WhyLink onPress={onWhy} />}
    </View>
  );
}

const styles = StyleSheet.create({
  round: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 4.5 },
  todayCard: { backgroundColor: colors.surface, borderRadius: radius.tile },
  today: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  todayFeedback: { paddingHorizontal: 14, paddingBottom: 14, paddingLeft: 34 },
  feedback: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  feedbackChip: { height: 32, paddingHorizontal: 12, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center' },
  feedbackOn: { backgroundColor: colors.text },
  feedbackOff: { borderWidth: 1, borderColor: colors.border },
  feedbackText: { fontFamily: fonts.body500, fontSize: 12 },
  point: { width: 8, height: 8, borderRadius: 4 },
  todayText: { flex: 1, gap: 2 },
  kicker: { fontFamily: fonts.body600, fontSize: 12 },
  todayTitle: { fontFamily: fonts.body600, fontSize: 14, color: colors.text },
  oneLine: { fontFamily: fonts.body400, fontSize: 13, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  cardTitle: { fontFamily: fonts.body600, fontSize: 15, color: colors.text },
  finding: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 21, color: colors.text },
  detail: { fontFamily: fonts.body400, fontSize: 13, color: colors.textSoft },
  action: { fontFamily: fonts.body500, fontSize: 14, color: colors.text, marginTop: 2 },
});
