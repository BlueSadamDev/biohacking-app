// Graphique de tendance : barres arrondies en haut, `bar` par défaut,
// `mid` pour les valeurs défavorables, dernière barre (aujourd'hui) en `good`.
// Plage normale : bande `info` à 10 % avec bords pointillés. Repère : ligne pointillée.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import type { ChartData } from '@/domain/recap';

import { AppText } from './AppText';
import { formatShortDate } from './format';
import { colors, tint } from './theme';

const HEIGHT = 160;

/** Rectangle aux coins supérieurs arrondis. */
function topRoundedBar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

export function TrendChart({ data, unfavorableLabel }: { data: ChartData; unfavorableLabel: string }) {
  const [width, setWidth] = useState(0);
  const values = data.points.map((p) => p.value).filter((v): v is number => v !== null);
  const refs = [
    ...values,
    ...(data.band ? [data.band.low, data.band.high] : []),
    ...(data.reference !== null ? [data.reference] : []),
  ];
  const hasData = values.length > 0;
  const max = refs.length ? Math.max(...refs) * 1.08 : 1;
  const min = refs.length ? Math.max(0, Math.min(...refs) * 0.8) : 0;
  const y = (v: number) => HEIGHT - ((v - min) / (max - min || 1)) * HEIGHT;

  const n = data.points.length;
  const slot = width / Math.max(1, n);
  const barWidth = Math.max(2, slot * 0.6);
  const last = n - 1;

  return (
    <View>
      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && hasData && (
          <Svg width={width} height={HEIGHT}>
            {data.band && (
              <>
                <Rect
                  x={0}
                  y={y(data.band.high)}
                  width={width}
                  height={Math.max(1, y(data.band.low) - y(data.band.high))}
                  fill={tint(colors.info, 0.1)}
                />
                <Line x1={0} x2={width} y1={y(data.band.high)} y2={y(data.band.high)} stroke={colors.info} strokeDasharray="4 4" />
                <Line x1={0} x2={width} y1={y(data.band.low)} y2={y(data.band.low)} stroke={colors.info} strokeDasharray="4 4" />
              </>
            )}
            {data.points.map((p, i) => {
              if (p.value === null) return null;
              const top = y(p.value);
              const fill = i === last ? colors.good : p.unfavorable ? colors.mid : colors.bar;
              return (
                <Path key={p.date} d={topRoundedBar(i * slot + (slot - barWidth) / 2, top, barWidth, HEIGHT - top)} fill={fill} />
              );
            })}
            {data.reference !== null && (
              <Line
                x1={0}
                x2={width}
                y1={y(data.reference)}
                y2={y(data.reference)}
                stroke={colors.textMuted}
                strokeDasharray="4 4"
              />
            )}
          </Svg>
        )}
        {!hasData && (
          <View style={styles.empty}>
            <AppText variant="small">Aucune nuit sur cette période</AppText>
          </View>
        )}
      </View>
      {n > 0 && (
        <View style={styles.axis}>
          <AppText variant="small" style={styles.axisText}>
            {formatShortDate(data.points[0].date)}
          </AppText>
          <AppText variant="small" style={styles.axisText}>
            Aujourd’hui
          </AppText>
        </View>
      )}
      <View style={styles.legend}>
        {data.band && <Legend color={tint(colors.info, 0.35)} text="Plage normale" />}
        {data.referenceLabel && <Legend color={colors.textMuted} text={data.referenceLabel} line />}
        <Legend color={colors.mid} text={unfavorableLabel} />
        <Legend color={colors.good} text="Aujourd’hui" />
      </View>
    </View>
  );
}

function Legend({ color, text, line }: { color: string; text: string; line?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[line ? styles.legendLine : styles.legendSwatch, { backgroundColor: color }]} />
      <AppText variant="small" style={styles.axisText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { height: HEIGHT },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontSize: 11 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendLine: { width: 12, height: 2 },
});
