// Sources de données (DESIGN.md, écran 4) : calibration, Helio Strap, Suunto,
// poids et Suivi macro, synchronisation manuelle.
// Import FIT Suunto : lot 3 (pas de bouton) ; Suivi macro : lot 2.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccessBanner } from '@/components/AccessBanner';
import { AppText } from '@/components/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card, Pill } from '@/components/Card';
import { Gauge } from '@/components/Controls';
import { formatDateTime } from '@/components/format';
import { Screen } from '@/components/Screen';
import { colors } from '@/components/theme';
import { useHealthData } from '@/components/useHealthData';
import { loadSourcesStatus, type SourcesStatus } from '@/db/healthData';
import { SETTINGS } from '@/domain/settings';

/** Types lus pour le Helio Strap et la table où ils sont rangés. */
const HELIO_TYPES: { label: string; table: string }[] = [
  { label: 'Sommeil', table: 'hc_sleep' },
  { label: 'HRV', table: 'hc_hrv' },
  { label: 'FC au repos', table: 'hc_resting_hr' },
  { label: 'FC pendant le sommeil', table: 'hc_heart_rate' },
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

  return (
    <Screen refreshing={syncing} onRefresh={syncAndRefresh}>
      <AppText variant="title">Sources de données</AppText>
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
        <AppText variant="small">
          Import mensuel des fichiers FIT (GPS, distance, allure) : prévu dans une prochaine version.
        </AppText>
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
        <AppText variant="small">Suivi macro (calories, protéines) : import prévu dans une prochaine version.</AppText>
      </Card>

      <PrimaryButton title="Synchroniser maintenant" busy={syncing} onPress={syncAndRefresh} />
      <SecondaryButton title="Diagnostic des données" onPress={() => router.push('/diagnostic')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { flex: 1 },
});
