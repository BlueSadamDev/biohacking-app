// Sources de données (DESIGN.md, écran 4), ouvert depuis Réglages : calibration,
// Helio Strap, Suunto (hors périmètre jusqu'au lot 3), poids et Suivi macro,
// autorisations, synchronisation manuelle.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import {
  getNotificationPermission,
  requestNotificationPermission,
  scheduleMorningNotifications,
  type NotificationPermission,
} from '@/background/morningNotification';
import { AccessBanner } from '@/components/AccessBanner';
import { AppText } from '@/components/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card, Pill } from '@/components/Card';
import { Gauge } from '@/components/Controls';
import { formatDateTime } from '@/components/format';
import { BackHeader, Screen } from '@/components/Screen';
import { colors } from '@/components/theme';
import { useHealthData } from '@/components/useHealthData';
import { loadSourcesStatus, type SourcesStatus } from '@/db/healthData';
import { SETTINGS } from '@/domain/settings';
import { askReadPermissions, hasBackgroundAccess } from '@/sources/healthConnect';

/** Types lus pour le Helio Strap et la table où ils sont rangés. */
const HELIO_TYPES: { label: string; table: string }[] = [
  { label: 'Sommeil', table: 'hc_sleep' },
  { label: 'HRV', table: 'hc_hrv' },
  { label: 'FC au repos', table: 'hc_resting_hr' },
  { label: 'FC (sommeil et séances)', table: 'hc_heart_rate' },
  { label: 'Séances', table: 'hc_exercise' },
  { label: 'Pas', table: 'hc_steps' },
  { label: 'Poids', table: 'weight' },
];

export default function SourcesScreen() {
  const router = useRouter();
  const { recap, access, syncing, sync } = useHealthData();
  const [status, setStatus] = useState<SourcesStatus | null>(null);

  const refresh = useCallback(() => {
    loadSourcesStatus().then(setStatus).catch(() => setStatus(null));
  }, []);
  useFocusEffect(refresh);

  const syncAndRefresh = useCallback(async () => {
    await sync();
    refresh();
  }, [sync, refresh]);

  const required = SETTINGS.calibration.requiredNights;
  const calibrated = Math.min(recap?.calibration.nights ?? 0, required);
  const remaining = required - calibrated;
  const meals = status?.rows.hc_nutrition ?? 0;

  return (
    <Screen refreshing={syncing} onRefresh={syncAndRefresh} bottomInset>
      <BackHeader title="Sources de données" onBack={() => router.back()} />
      <AccessBanner access={access} />

      <Card style={styles.card}>
        <AppText variant="label">Calibration des normes</AppText>
        <AppText variant="strong">
          {calibrated} / {required} jours
        </AppText>
        <Gauge value={calibrated} max={required} minLabel="0" maxLabel={`${required} jours`} />
        <AppText variant="small">
          {remaining > 0
            ? `Encore ${remaining} nuit(s) complète(s) (HRV et FC au repos) avant le score coloré.`
            : 'Terminée : ton score se compare à ta propre norme.'}
        </AppText>
      </Card>

      <Card style={styles.card}>
        <AppText variant="strong">Amazfit Helio Strap</AppText>
        <AppText variant="small">
          Via Health Connect (app Zepp) · Dernière synchro :{' '}
          {status?.lastSync ? formatDateTime(status.lastSync) : 'jamais'}
        </AppText>
        {HELIO_TYPES.map((t) => {
          const received = (status?.rows[t.table] ?? 0) > 0;
          return (
            <View key={t.table} style={styles.row}>
              <AppText variant="bodySmall" style={styles.rowLabel}>
                {t.label}
              </AppText>
              <Pill text={received ? 'reçue' : 'absente'} color={received ? colors.good : colors.low} />
            </View>
          );
        })}
      </Card>

      <Card style={styles.card}>
        <AppText variant="strong">Suunto 9 Peak Pro</AppText>
        <AppText variant="small">Hors périmètre jusqu’au lot 3 (GPS, distance, allure).</AppText>
      </Card>

      <Card style={styles.card}>
        <AppText variant="strong">Poids et nutrition</AppText>
        <AppText variant="small">
          Poids : ta saisie fait foi, Zepp sert les jours sans saisie.{'\n'}
          Dernière pesée :{' '}
          {status?.lastWeight
            ? `${formatDateTime(status.lastWeight.time)} (${status.lastWeight.source === 'manual' ? 'saisie' : 'Zepp'})`
            : 'aucune'}
        </AppText>
        <View style={styles.row}>
          <AppText variant="bodySmall" style={styles.rowLabel}>
            Repas (Suivi macro, via Health Connect)
          </AppText>
          <Pill text={meals > 0 ? 'reçus' : 'absents'} color={meals > 0 ? colors.good : colors.low} />
        </View>
      </Card>

      <PermissionsCard />

      <PrimaryButton title="Synchroniser maintenant" busy={syncing} onPress={syncAndRefresh} />
      <SecondaryButton title="Diagnostic des données" onPress={() => router.push('/diagnostic')} />
    </Screen>
  );
}

/** Autorisations : notifications et lecture en arrière-plan. */
function PermissionsCard() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [background, setBackground] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    getNotificationPermission().then(setPermission).catch(() => setPermission(null));
    hasBackgroundAccess().then(setBackground).catch(() => setBackground(null));
  }, []);
  useFocusEffect(refresh);

  async function allowNotifications() {
    // Après un refus, Android ne redemande plus : on ouvre les réglages de l'app.
    const result = permission === 'denied' ? 'denied' : await requestNotificationPermission();
    if (result === 'denied') await Linking.openSettings();
    else await scheduleMorningNotifications().catch(() => undefined);
    refresh();
  }

  async function allowBackground() {
    await askReadPermissions();
    refresh();
  }

  return (
    <Card style={styles.card}>
      <AppText variant="label">Autorisations</AppText>
      <View style={styles.row}>
        <AppText variant="bodySmall" style={styles.rowLabel}>
          Notifications
        </AppText>
        <Pill
          text={permission === 'granted' ? 'autorisées' : 'non autorisées'}
          color={permission === 'granted' ? colors.good : colors.low}
        />
      </View>
      {permission !== null && permission !== 'granted' && (
        <SecondaryButton title="Autoriser les notifications" onPress={allowNotifications} />
      )}
      <View style={styles.row}>
        <AppText variant="bodySmall" style={styles.rowLabel}>
          Synchro en arrière-plan
        </AppText>
        <Pill text={background ? 'autorisée' : 'non autorisée'} color={background ? colors.good : colors.low} />
      </View>
      {background === false && <SecondaryButton title="Autoriser la lecture en arrière-plan" onPress={allowBackground} />}
      <AppText variant="small">
        Sans lecture en arrière-plan, la nuit se synchronise seulement quand tu ouvres l’app : la notification
        t’invite alors à l’ouvrir.
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { flex: 1 },
});
