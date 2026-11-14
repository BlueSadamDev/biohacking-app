// Composants des alertes (DESIGN.md, « Écrans du lot 2 ») : bouton Alertes de l'en-tête,
// carte alerte du jour (accueil), carte alerte de l'historique.
// Niveaux : « À surveiller » = `mid`, « Important » = `low`, toujours écrits en toutes lettres.

import { Pressable, StyleSheet, View } from 'react-native';

import type { StoredAlert } from '@/db/alerts';
import { LEVEL_LABEL, THEME_LABEL, type AlertLevel } from '@/domain/alerts';

import { AppText } from './AppText';
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

/** Carte alerte du jour : toute la carte ouvre l'historique. */
export function TodayAlertCard({ alert, onPress }: { alert: StoredAlert; onPress: () => void }) {
  const color = levelColor(alert.level);
  return (
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
          {alert.finding}
        </AppText>
      </View>
      <ChevronIcon size={20} color={colors.textMuted} />
    </Pressable>
  );
}

/** Carte de l'historique : niveau · thème et date, titre, constat, cause probable, action. */
export function AlertHistoryCard({ alert }: { alert: StoredAlert }) {
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
      <AppText style={styles.detail}>
        <AppText style={styles.detailLabel}>Constat · </AppText>
        {alert.finding}
      </AppText>
      <AppText style={styles.detail}>
        <AppText style={styles.detailLabel}>Cause probable · </AppText>
        {alert.cause}
      </AppText>
      <AppText style={styles.action}>{alert.action}</AppText>
      {alert.persistent && (
        <AppText variant="small">
          Cette alerte revient souvent : si ça dure, parles-en à un professionnel de santé.
        </AppText>
      )}
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
  today: {
    backgroundColor: colors.surface,
    borderRadius: radius.tile,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  point: { width: 8, height: 8, borderRadius: 4 },
  todayText: { flex: 1, gap: 2 },
  kicker: { fontFamily: fonts.body600, fontSize: 12 },
  todayTitle: { fontFamily: fonts.body600, fontSize: 14, color: colors.text },
  oneLine: { fontFamily: fonts.body400, fontSize: 13, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  cardTitle: { fontFamily: fonts.body600, fontSize: 15, color: colors.text },
  detail: { fontFamily: fonts.body400, fontSize: 13, color: colors.textSoft },
  detailLabel: { fontFamily: fonts.body400, fontSize: 13, color: colors.textMuted },
  action: { fontFamily: fonts.body600, fontSize: 13, color: colors.text },
});
