// Détail d'un indicateur (DESIGN.md, écran 2) : HRV, FC au repos ou sommeil.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card, Pill } from '@/components/Card';
import { PeriodTabs } from '@/components/Controls';
import { formatMetric, isMetric, METRIC_LABEL, metricView } from '@/components/metricView';
import { BackHeader, Screen } from '@/components/Screen';
import { colors } from '@/components/theme';
import { TrendChart } from '@/components/TrendChart';
import { useHealthData } from '@/components/useHealthData';
import { dayKey } from '@/domain/dates';
import { chartData, shortMean, type Metric } from '@/domain/recap';
import type { Effect, Recovery } from '@/domain/recovery';

const PERIODS = [7, 30, 90] as const;

const UNFAVORABLE_LABEL: Record<Metric, string> = {
  hrv: 'Sous la plage',
  restingHr: 'Au-dessus de la moyenne',
  sleep: 'Nuit courte',
};

export default function DetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ metric: string }>();
  const metric: Metric = isMetric(params.metric) ? params.metric : 'hrv';
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(7);
  const { recap, nights } = useHealthData();

  const view = metricView(recap, metric);
  const today = recap?.date ?? dayKey(new Date());
  const avg = shortMean(nights, metric, today);
  const avgShown = avg === null ? null : formatMetric(metric, avg);
  const avgText = avgShown ? `${avgShown.value} ${avgShown.unit ?? ''}`.trim() : 'non calculable';

  return (
    <Screen bottomInset>
      <BackHeader title={METRIC_LABEL[metric]} onBack={() => router.back()} />

      <View style={styles.valueBlock}>
        <View style={styles.valueRow}>
          <AppText variant="detailValue">{view.value}</AppText>
          {view.unit && (
            <AppText variant="unit" style={styles.unit}>
              {' '}
              {view.unit}
            </AppText>
          )}
        </View>
        <Pill text={view.status} color={view.statusColor} />
        <AppText variant="small">Moyenne 7 j : {avgText}</AppText>
      </View>

      <PeriodTabs options={PERIODS} value={period} onChange={setPeriod} />

      <Card>
        <TrendChart data={chartData(nights, metric, today, period)} unfavorableLabel={UNFAVORABLE_LABEL[metric]} />
      </Card>

      {recap && <ContributionsCard recovery={recap.recovery} calibrating={!recap.calibration.done} label={recap.calibration.label} />}
    </Screen>
  );
}

const EFFECT: Record<Effect, { sign: string; color: string; text: string }> = {
  up: { sign: '+', color: colors.good, text: 'fait monter le score' },
  neutral: { sign: '=', color: colors.textMuted, text: 'sans effet' },
  down: { sign: '−', color: colors.mid, text: 'fait baisser le score' },
};

function ContributionsCard({ recovery, calibrating, label }: { recovery: Recovery; calibrating: boolean; label: string }) {
  return (
    <Card style={styles.contrib}>
      <AppText variant="label">Ce qui fait ton score de récupération</AppText>
      {calibrating && (
        <AppText variant="bodySmall" style={{ color: colors.textSoft }}>
          {label}. Le détail est indicatif tant que ta norme se construit.
        </AppText>
      )}
      {recovery.components.map((c) => {
        const e = c.effect ? EFFECT[c.effect] : null;
        return (
          <View key={c.key} style={styles.contribRow} accessible accessibilityLabel={`${c.label} : ${c.explanation}${e ? `, ${e.text}` : ''}`}>
            <AppText style={[styles.sign, { color: e?.color ?? colors.textMuted }]}>{e?.sign ?? '·'}</AppText>
            <View style={styles.contribText}>
              <AppText variant="bodySmall">
                {c.label} <AppText variant="small">({Math.round(c.weight * 100)} %)</AppText>
              </AppText>
              <AppText variant="small" style={{ color: colors.textSoft }}>
                {c.explanation}
              </AppText>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  valueBlock: { alignItems: 'center', gap: 10 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  unit: { fontSize: 18 },
  contrib: { gap: 12 },
  contribRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  sign: { width: 20, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  contribText: { flex: 1, gap: 2 },
});
