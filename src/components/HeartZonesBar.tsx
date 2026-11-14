// Barre des zones cardiaques (DESIGN.md, « Écrans du lot 3 ») :
// barre empilée de 12 px, rayon 6, 2 px entre les segments, largeur = part du temps.
// Légende sur 4 colonnes, puis ligne d'état de la zone 2 (`good` si cible atteinte, sinon `mid`).

import { StyleSheet, View } from 'react-native';

import type { ZoneMinutes } from '@/domain/zones';

import { AppText } from './AppText';
import { colors, fonts } from './theme';

const GROUPS = [
  { label: 'Z1', color: colors.bar, text: colors.textMuted },
  { label: 'Z2', color: colors.info, text: colors.infoText },
  { label: 'Z3', color: colors.mid, text: colors.textMuted },
  { label: 'Z4-5', color: colors.low, text: colors.textMuted },
] as const;

type Props = { zones: ZoneMinutes; zone2Target: number };

export function HeartZonesBar({ zones, zone2Target }: Props) {
  const minutes = [zones[0], zones[1], zones[2], zones[3] + zones[4]];
  const total = minutes.reduce((a, b) => a + b, 0);
  const zone2 = Math.round(zones[1]);
  const reached = zones[1] >= zone2Target;
  const summary = GROUPS.map((g, i) => `${g.label} ${Math.round(minutes[i])} min`).join(', ');

  return (
    <View style={styles.wrap}>
      <View style={styles.bar} accessible accessibilityLabel={`Zones cardiaques : ${summary}`}>
        {total === 0 ? (
          <View style={[styles.segment, { flex: 1, backgroundColor: colors.track }]} />
        ) : (
          GROUPS.map((g, i) =>
            minutes[i] > 0 ? <View key={g.label} style={[styles.segment, { flex: minutes[i], backgroundColor: g.color }]} /> : null,
          )
        )}
      </View>
      <View style={styles.legend}>
        {GROUPS.map((g, i) => (
          <AppText key={g.label} style={[styles.legendItem, { color: g.text }]}>
            {g.label} · {Math.round(minutes[i])} min
          </AppText>
        ))}
      </View>
      <AppText style={[styles.status, { color: reached ? colors.good : colors.mid }]}>
        Zone 2 : {zone2} min sur {zone2Target} min visées
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  bar: { flexDirection: 'row', height: 12, gap: 2, borderRadius: 6, overflow: 'hidden' },
  segment: { height: 12 },
  legend: { flexDirection: 'row' },
  legendItem: { flex: 1, fontSize: 11, fontFamily: fonts.body400 },
  status: { fontSize: 13, fontFamily: fonts.body600 },
});
