// Détail du poids (même gabarit que le détail d'un indicateur, DESIGN.md écran 2) :
// poids moyen 7 j, tendance sur 28 jours, écart à la cible, onglets 7 / 30 / 90 j,
// une barre par pesée avec la cible en pointillé, puis la phrase d'interprétation.
// La valeur retenue chaque jour : la saisie manuelle, sinon la pesée Zepp (jamais de moyenne des deux).

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { formatTrend, targetText, TONE_COLOR } from '@/components/BodyCompositionCard';
import { Card, Pill } from '@/components/Card';
import { PeriodTabs } from '@/components/Controls';
import { formatDecimal } from '@/components/format';
import { BackHeader, Screen } from '@/components/Screen';
import { TrendChart } from '@/components/TrendChart';
import { loadWeights } from '@/db/healthData';
import { loadBodyComposition } from '@/db/sportData';
import { loadStrengthHistory } from '@/db/strength';
import { weightChartData, type BodyComposition, type WeightTrend } from '@/domain/bodyComposition';
import { weightByDay, type DailyWeight } from '@/domain/daily';
import { dayKey } from '@/domain/dates';
import { strengthProgress } from '@/domain/strength';

const PERIODS = [7, 30, 90] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const TREND_LABEL: Record<WeightTrend, string> = {
  loss: 'En baisse',
  stable: 'Stable',
  'slow-gain': 'Prise lente',
  'fast-gain': 'Prise rapide',
};

export default function WeightDetailScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(30);
  const [data, setData] = useState<{ body: BodyComposition; weights: Map<string, DailyWeight> } | null>(null);
  const [error, setError] = useState(false);
  const today = dayKey(new Date());

  const refresh = useCallback(() => {
    const now = new Date();
    (async () => {
      const entries = await loadStrengthHistory(now);
      const [body, raw] = await Promise.all([
        loadBodyComposition(strengthProgress(entries, dayKey(now)), now),
        loadWeights(now.getTime() - (PERIODS[PERIODS.length - 1] + 1) * DAY_MS),
      ]);
      setData({ body, weights: weightByDay(raw) });
      setError(false);
    })().catch(() => setError(true));
  }, []);
  useFocusEffect(refresh);

  const body = data?.body;
  const target = body ? targetText(body) : null;

  return (
    <Screen bottomInset>
      <BackHeader title="Poids" onBack={() => router.back()} />

      {error && <AppText variant="bodySmall">Impossible de lire tes pesées.</AppText>}

      {body && (
        <View style={styles.valueBlock}>
          <View style={styles.valueRow}>
            <AppText variant="detailValue">{body.average7d === null ? '—' : formatDecimal(body.average7d, 1)}</AppText>
            <AppText variant="unit" style={styles.unit}>
              {' '}
              kg
            </AppText>
          </View>
          <Pill text={body.trend === null ? 'Tendance non calculable' : TREND_LABEL[body.trend]} />
          <AppText variant="small">
            Moyenne 7 j
            {body.trendKgPerWeek === null ? '' : ` · ${formatTrend(body.trendKgPerWeek)} (28 j)`}
          </AppText>
          {target && <AppText variant="small">{target}</AppText>}
        </View>
      )}

      <PeriodTabs options={PERIODS} value={period} onChange={setPeriod} />

      {data && (
        <Card>
          <TrendChart
            data={weightChartData(data.weights, today, period, data.body.targetKg)}
            emptyText="Aucune pesée sur cette période"
          />
        </Card>
      )}

      {body && (
        <Card style={styles.sentence}>
          <AppText variant="label">Ce que dit ta tendance</AppText>
          <AppText variant="bodySmall" style={{ color: TONE_COLOR[body.tone] }}>
            {body.sentence}
          </AppText>
          <AppText variant="small">
            Croise la tendance du poids (28 j), celle de ta force (squat, développé couché, soulevé de terre) et tes
            protéines (28 j).
          </AppText>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  valueBlock: { alignItems: 'center', gap: 10 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  unit: { fontSize: 18 },
  sentence: { gap: 8 },
});
