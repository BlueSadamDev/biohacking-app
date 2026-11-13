// Accueil – récap du matin (DESIGN.md, écran 1).
// La jauge de charge 7 j / 28 j arrivera au lot 2.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, type ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AccessBanner } from '@/components/AccessBanner';
import { AppText } from '@/components/AppText';
import { PrimaryButton, RoundButton } from '@/components/Buttons';
import { Card, Pill } from '@/components/Card';
import { formatLongDate } from '@/components/format';
import { PulseIcon } from '@/components/Icons';
import { MetricTile } from '@/components/MetricTile';
import { metricView } from '@/components/metricView';
import { RecommendationCard } from '@/components/RecommendationCard';
import { RecoveryRing } from '@/components/RecoveryRing';
import { Screen } from '@/components/Screen';
import { colors, space, zoneColor } from '@/components/theme';
import { useHealthData } from '@/components/useHealthData';
import type { Metric, MorningRecap } from '@/domain/recap';

const METRICS: Metric[] = ['hrv', 'restingHr', 'sleep'];

/** Calibration : progression n / 28 (même sans nuit du jour). Sinon le score, ou « — » s'il manque. */
function ringOf(recap: MorningRecap | null): ComponentProps<typeof RecoveryRing> {
  if (!recap) return { kind: 'empty' };
  const { calibration, recovery, recommendation } = recap;
  if (!calibration.done) return { kind: 'calibration', nights: calibration.nights, required: calibration.required };
  if (recovery.score === null) return { kind: 'empty' };
  return { kind: 'score', score: recovery.score, color: zoneColor(recommendation.zone) };
}

export default function HomeScreen() {
  const router = useRouter();
  const { loading, syncing, access, recap, nights, error, sync, reload } = useHealthData();

  // En revenant sur l'accueil (après une saisie par exemple), on relit la base.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const recommendation = recap?.recommendation;

  return (
    <Screen refreshing={syncing} onRefresh={sync}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="small">{formatLongDate(new Date())}</AppText>
          <AppText variant="title">Récap du matin</AppText>
        </View>
        <RoundButton label="Diagnostic des données" onPress={() => router.push('/diagnostic')}>
          <PulseIcon />
        </RoundButton>
      </View>

      <AccessBanner access={access} />
      {error && (
        <AppText variant="bodySmall" style={{ color: colors.low }}>
          Erreur : {error}
        </AppText>
      )}

      {loading ? (
        <ActivityIndicator color={colors.text} style={styles.loading} />
      ) : nights.length === 0 ? (
        <Card style={styles.emptyCard}>
          <AppText variant="strong">Aucune nuit enregistrée pour l’instant</AppText>
          <AppText variant="bodySmall" style={{ color: colors.textSoft }}>
            Porte ton Helio Strap cette nuit et vérifie que l’app Zepp synchronise vers Health Connect. Tire
            l’écran vers le bas pour synchroniser.
          </AppText>
        </Card>
      ) : (
        <>
          <View style={styles.ringBlock}>
            <RecoveryRing {...ringOf(recap)} />
            {recommendation && (
              <Pill
                text={recommendation.status}
                color={recommendation.zone === 'neutral' ? undefined : zoneColor(recommendation.zone)}
              />
            )}
          </View>

          {recommendation && <RecommendationCard recommendation={recommendation} />}

          <View style={styles.tiles}>
            {METRICS.map((m) => {
              const view = metricView(recap, m);
              return (
                <MetricTile
                  key={m}
                  label={view.label}
                  value={view.value}
                  unit={view.unit}
                  note={view.note}
                  tone={view.tone}
                  onPress={() => router.push({ pathname: '/detail/[metric]', params: { metric: m } })}
                />
              );
            })}
          </View>
        </>
      )}

      <PrimaryButton title="Saisir poids et ressenti" onPress={() => router.push('/saisie')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1, gap: 2 },
  loading: { marginVertical: 60 },
  emptyCard: { gap: 8 },
  ringBlock: { alignItems: 'center', gap: 12, marginVertical: 4 },
  tiles: { flexDirection: 'row', gap: space.grid },
});
