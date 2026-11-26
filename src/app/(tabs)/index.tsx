// Accueil – récap du matin (DESIGN.md, écran 1 et accueil du lot 2).

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { scheduleMorningNotifications } from '@/background/morningNotification';
import { AccessBanner } from '@/components/AccessBanner';
import { AppText } from '@/components/AppText';
import { AlertsButton, TodayAlertCard } from '@/components/AlertViews';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { PeriodBanner, PeriodButton, PeriodSheet } from '@/components/PeriodViews';
import { newPeriodId, savePeriod } from '@/db/periods';
import { dayKey } from '@/domain/dates';
import { validatePeriod, type Period, type PeriodType } from '@/domain/periods';
import { Card, Pill } from '@/components/Card';
import { RichText } from '@/components/RichText';
import { formatLongDate } from '@/components/format';
import { LoadCard } from '@/components/LoadCard';
import { NutritionCard } from '@/components/NutritionCard';
import { OpenZeppCard } from '@/components/OpenZeppCard';
import { MetricTile } from '@/components/MetricTile';
import { metricView } from '@/components/metricView';
import { RecommendationCard } from '@/components/RecommendationCard';
import { RecoveryRing } from '@/components/RecoveryRing';
import { Screen } from '@/components/Screen';
import { Logo } from '@/components/Logo';
import { colors, fonts, space, zoneColor } from '@/components/theme';
import { useHealthData } from '@/components/useHealthData';
import type { Metric, MorningRecap } from '@/domain/recap';
import { ERRORS } from '@/domain/texts/common';
import { HOME } from '@/domain/texts/today';

const METRICS: Metric[] = ['hrv', 'restingHr', 'sleep'];

/**
 * Calibration : progression n / 28 (même sans nuit du jour). Sinon le score, ou « — » s'il manque.
 * Pendant une période (lot 5a) : le score reste affiché, en gris, sans jugement de couleur.
 */
function ringOf(recap: MorningRecap | null): ComponentProps<typeof RecoveryRing> {
  if (!recap) return { kind: 'empty' };
  const { calibration, recovery, recommendation } = recap;
  if (recap.period && recovery.score !== null) return { kind: 'score', score: recovery.score, color: colors.paused };
  if (!calibration.done) return { kind: 'calibration', nights: calibration.nights, required: calibration.required };
  if (recovery.score === null) return { kind: 'empty' };
  return { kind: 'score', score: recovery.score, color: zoneColor(recommendation.zone) };
}

export default function HomeScreen() {
  const router = useRouter();
  const { loading, syncing, access, recap, nights, periods, load, alerts, nutrition, journalFilled, error, sync, syncOnReturn, reload } =
    useHealthData();
  const [sheetOpen, setSheetOpen] = useState(false);
  const today = dayKey(new Date());
  const period = recap?.period ?? null;

  /** Nouvelle période : contrôlée (chevauchement, 14 jours au plus), enregistrée, puis tout est recalculé. */
  async function startPeriod(type: PeriodType, start: string): Promise<string | null> {
    const candidate = { id: newPeriodId(), type, start, end: null };
    const error = validatePeriod(candidate, periods, today, { isNew: true });
    if (error) return error;
    try {
      await savePeriod(candidate);
    } catch {
      return ERRORS.save;
    }
    setSheetOpen(false);
    await afterPeriodChange();
    return null;
  }

  /** « Terminer la période » : la fin est aujourd'hui ; les alertes reprennent demain. */
  async function endPeriod(p: Period) {
    await savePeriod({ ...p, end: today }).catch(() => undefined);
    await afterPeriodChange();
  }

  async function afterPeriodChange() {
    await reload();
    // Le texte des notifications du matin à venir change (en pause ou non).
    scheduleMorningNotifications().catch(() => undefined);
  }

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
          <View style={styles.brand}>
            <Logo size={18} />
            <AppText style={styles.wordmark}>aube</AppText>
            <AppText variant="small" style={styles.date} numberOfLines={1}>
              · {formatLongDate(new Date())}
            </AppText>
          </View>
          <AppText variant="title">{HOME.title}</AppText>
        </View>
        <View style={styles.headerButtons}>
          <PeriodButton onPress={() => setSheetOpen(true)} />
          <AlertsButton
            unread={alerts?.unread ?? 0}
            level={alerts?.unreadLevel ?? null}
            onPress={() => router.push('/alertes')}
          />
        </View>
      </View>
      <PeriodSheet visible={sheetOpen} today={today} onStart={startPeriod} onClose={() => setSheetOpen(false)} />

      <AccessBanner access={access} />
      {/* Le détail technique de l'erreur reste réservé à l'écran de diagnostic. */}
      {error && <RichText variant="bodySmall" text={HOME.loadError} style={{ color: colors.low }} />}

      {/* Nuit d'aujourd'hui absente de Health Connect : proposer d'ouvrir Zepp (si installée). */}
      {!loading && (access === 'ok' || access === 'partial') && !recap?.night && <OpenZeppCard onReturn={syncOnReturn} />}

      {loading ? (
        <ActivityIndicator color={colors.text} style={styles.loading} />
      ) : nights.length === 0 ? (
        <Card style={styles.emptyCard}>
          <AppText variant="strong">{HOME.noNights}</AppText>
          <AppText variant="bodySmall" style={{ color: colors.textSoft }}>
            {HOME.noNightsHelp}
          </AppText>
        </Card>
      ) : (
        <>
          <View style={styles.ringBlock}>
            <RecoveryRing {...ringOf(recap)} />
            {/* Pendant une période, le bandeau dit déjà « en pause » : pas de pastille en double. */}
            {recommendation && !period && (
              <Pill
                text={recommendation.status}
                color={recommendation.zone === 'neutral' || recommendation.zone === 'paused' ? undefined : zoneColor(recommendation.zone)}
              />
            )}
          </View>

          {/* Période en cours : le bandeau remplace la recommandation, et la carte alerte est masquée. */}
          {period ? (
            <PeriodBanner period={period} today={today} onEnd={() => endPeriod(period)} />
          ) : (
            recommendation && <RecommendationCard recommendation={recommendation} />
          )}

          {/* Alerte du jour : seulement s'il y en a une, jamais pendant la calibration ni pendant une période. */}
          {!period && alerts?.today && recap?.calibration.done && (
            <TodayAlertCard alert={alerts.today} onPress={() => router.push('/alertes')} />
          )}

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
                  context={view.context}
                  tone={view.tone}
                  onPress={() => router.push({ pathname: '/detail/[metric]', params: { metric: m } })}
                />
              );
            })}
          </View>

          <LoadCard load={load} />

          <NutritionCard view={nutrition} />
        </>
      )}

      {/* Journal du matin : une fois enregistré, bouton secondaire qui permet de le modifier. */}
      {journalFilled ? (
        <SecondaryButton title={HOME.journalFilled} onPress={() => router.push('/saisie')} />
      ) : (
        <PrimaryButton title={HOME.journal} onPress={() => router.push('/saisie')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  headerButtons: { flexDirection: 'row', gap: 8 },
  headerText: { flex: 1, gap: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark: { fontFamily: fonts.display600, fontSize: 15, letterSpacing: 15 * 0.04, color: colors.text },
  date: { flexShrink: 1, fontSize: 13 },
  loading: { marginVertical: 60 },
  emptyCard: { gap: 8 },
  ringBlock: { alignItems: 'center', gap: 12, marginVertical: 4 },
  tiles: { flexDirection: 'row', gap: space.grid },
});
