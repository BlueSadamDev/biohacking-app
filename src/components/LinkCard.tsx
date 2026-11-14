// Carte lien observé (DESIGN.md, « Écrans du lot 3 ») : fond `surface`, rayon 16.
// Ligne 1 : « Lien fort | modéré | faible » (12/600) et « <n> jours comparés » (12, `textMuted`).
// Couleur : `good` si favorable, `mid` si défavorable, `info` si le lien est faible.
// Puis la phrase (15/600), deux barres de comparaison (référence en #5C6B7E, situation étudiée
// dans la couleur du lien, valeurs à droite), puis l'action conseillée (13, `textSoft`).

import { StyleSheet, View } from 'react-native';

import type { Link, ValueKind } from '@/domain/correlations';

import { AppText } from './AppText';
import { formatDuration } from './format';
import { colors, fonts, radius } from './theme';

const STRENGTH_LABEL = { strong: 'Lien fort', moderate: 'Lien modéré', weak: 'Lien faible' } as const;

function formatValue(kind: ValueKind, value: number): string {
  if (kind === 'ms') return `${Math.round(value)} ms`;
  if (kind === 'minutes') return formatDuration(value);
  return `${Math.round(value)} / 100`;
}

export function linkColor(link: Link): string {
  if (link.strength === 'weak') return colors.info;
  return link.favorable ? colors.good : colors.mid;
}

function Bar({ label, value, max, color, kind }: { label: string; value: number; max: number; color: string; kind: ValueKind }) {
  return (
    <View style={styles.barBlock} accessible accessibilityLabel={`${label} : ${formatValue(kind, value)}`}>
      <AppText variant="small">{label}</AppText>
      <View style={styles.barRow}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(4, (value / max) * 100)}%`, backgroundColor: color }]} />
        </View>
        <AppText style={styles.barValue}>{formatValue(kind, value)}</AppText>
      </View>
    </View>
  );
}

export function LinkCard({ link }: { link: Link }) {
  const color = linkColor(link);
  const max = Math.max(link.study.mean, link.reference.mean) || 1;
  const sense = link.strength === 'weak' ? '' : link.favorable ? ' · favorable' : ' · défavorable';
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText style={[styles.strength, { color }]}>
          {STRENGTH_LABEL[link.strength]}
          {sense}
        </AppText>
        <AppText variant="small">{link.days} jours comparés</AppText>
      </View>
      <AppText style={styles.sentence}>{link.sentence}</AppText>
      <Bar label={link.reference.label} value={link.reference.mean} max={max} color={colors.bar} kind={link.kind} />
      <Bar label={link.study.label} value={link.study.mean} max={max} color={color} kind={link.kind} />
      <AppText style={styles.action}>{link.action}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  strength: { fontFamily: fonts.body600, fontSize: 12, flexShrink: 1 },
  sentence: { fontFamily: fonts.body600, fontSize: 15, color: colors.text },
  barBlock: { gap: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  barValue: { minWidth: 64, textAlign: 'right', fontFamily: fonts.display600, fontSize: 13, color: colors.text },
  action: { fontFamily: fonts.body400, fontSize: 13, color: colors.textSoft },
});
