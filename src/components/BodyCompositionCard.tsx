// Carte « Composition corporelle » de l'onglet Sport (DESIGN.md, « Écrans du lot 3 ») :
// poids moyen 7 j (Space Grotesk 28/600), tendance en kg/semaine, courbe du poids lissé
// avec la cible en pointillé, puis la phrase d'interprétation. Toucher la carte ouvre le détail du poids.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import type { BodyComposition } from '@/domain/bodyComposition';

import { AppText } from './AppText';
import { Card } from './Card';
import { formatDecimal } from './format';
import { ChevronIcon } from './Icons';
import { colors, fonts } from './theme';

const CURVE_HEIGHT = 72;

export function formatTrend(kgPerWeek: number): string {
  const r = Math.round(kgPerWeek * 100) / 100;
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${formatDecimal(Math.abs(r), 2)} kg / semaine`;
}

export function targetText(c: BodyComposition): string | null {
  if (c.targetKg === null) return 'Cible de poids à définir dans Réglages';
  if (c.gapToTarget === null) return null;
  const cible = `${formatDecimal(c.targetKg, 1)} kg`;
  if (c.targetReached) return `Cible de ${cible} atteinte`;
  return c.gapToTarget < 0
    ? `${formatDecimal(-c.gapToTarget, 1)} kg sous ta cible (${cible})`
    : `${formatDecimal(c.gapToTarget, 1)} kg au-dessus de ta cible (${cible})`;
}

export const TONE_COLOR = { good: colors.good, mid: colors.mid, neutral: colors.textSoft } as const;

/** Courbe du poids lissé, avec la cible en pointillé si elle est dans l'échelle utile. */
export function WeightCurve({ points, target }: { points: { value: number | null }[]; target: number | null }) {
  const [width, setWidth] = useState(0);
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const refs = target !== null ? [...values, target] : values;
  const min = Math.min(...refs) - 0.3;
  const max = Math.max(...refs) + 0.3;
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * width : 0);
  const y = (v: number) => CURVE_HEIGHT - ((v - min) / (max - min || 1)) * CURVE_HEIGHT;

  let d = '';
  let drawing = false;
  points.forEach((p, i) => {
    if (p.value === null) {
      drawing = false;
      return;
    }
    d += `${drawing ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)} `;
    drawing = true;
  });

  return (
    <View style={{ height: CURVE_HEIGHT }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && values.length > 0 && (
        <Svg width={width} height={CURVE_HEIGHT}>
          {target !== null && (
            <Line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke={colors.textMuted} strokeDasharray="4 4" />
          )}
          <Path d={d} stroke={colors.text} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}

export function BodyCompositionCard({ data }: { data: BodyComposition }) {
  const router = useRouter();
  const target = targetText(data);
  const hasCurve = data.curve.some((p) => p.value !== null);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Ouvre le détail du poids"
      onPress={() => router.push('/detail/poids')}
      style={({ pressed }) => pressed && { opacity: 0.8 }}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <AppText variant="label">Composition corporelle</AppText>
          <ChevronIcon size={18} color={colors.textMuted} />
        </View>
        {data.average7d === null ? (
          <AppText variant="bodySmall" style={styles.soft}>
            Aucune pesée sur les 7 derniers jours. Pèse-toi le matin à jeun (saisie du matin ou balance Zepp).
          </AppText>
        ) : (
          <>
            <View style={styles.valueRow}>
              <AppText style={styles.value}>{formatDecimal(data.average7d, 1)}</AppText>
              <AppText variant="unit"> kg · moyenne 7 j</AppText>
            </View>
            <AppText variant="small">
              {data.trendKgPerWeek === null ? 'Tendance non calculable' : `${formatTrend(data.trendKgPerWeek)} (28 j)`}
              {target ? ` · ${target}` : ''}
            </AppText>
          </>
        )}
        {hasCurve && (
          <View style={styles.curve}>
            <WeightCurve points={data.curve} target={data.targetKg} />
            <View style={styles.legend}>
              <AppText variant="small" style={styles.legendText}>
                Poids lissé · 8 semaines
              </AppText>
              {data.targetKg !== null && (
                <AppText variant="small" style={styles.legendText}>
                  - - Cible
                </AppText>
              )}
            </View>
          </View>
        )}
        <AppText variant="bodySmall" style={{ color: TONE_COLOR[data.tone] }}>
          {data.sentence}
        </AppText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  soft: { color: colors.textSoft },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: { fontFamily: fonts.display600, fontSize: 28, color: colors.text },
  curve: { gap: 4, marginVertical: 4 },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendText: { fontSize: 11 },
});
