// Historique des alertes (DESIGN.md, « Écrans du lot 2 ») : filtres par thème,
// cartes de la plus récente à la plus ancienne. Ouvrir l'écran marque les alertes comme lues.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AlertHistoryCard } from '@/components/AlertViews';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { BackHeader, Screen } from '@/components/Screen';
import { ChoiceChips } from '@/components/SettingsControls';
import { colors } from '@/components/theme';
import { reloadFromDb, useHealthData } from '@/components/useHealthData';
import { loadAlerts, markAllAlertsRead, type StoredAlert } from '@/db/alerts';
import { getUserSettings } from '@/db/appSettings';
import type { AlertTheme } from '@/domain/alerts';
import { formatTime } from '@/domain/notification';
import { SETTINGS } from '@/domain/settings';

type Filter = 'all' | AlertTheme;
const FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'recovery', label: 'Récupération' },
  { value: 'load', label: 'Charge' },
  { value: 'nutrition', label: 'Nutrition' },
] as const;

export default function AlertsScreen() {
  const router = useRouter();
  const { recap } = useHealthData();
  const [alerts, setAlerts] = useState<StoredAlert[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [quiet, setQuiet] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadAlerts()
        .then(setAlerts)
        .catch(() => setAlerts([]));
      getUserSettings()
        .then((u) => setQuiet(`${formatTime(u.quietStart)} à ${formatTime(u.quietEnd)}`))
        .catch(() => setQuiet(null));
      // L'utilisateur a vu ses alertes : la pastille du bouton disparaît.
      markAllAlertsRead()
        .then(reloadFromDb)
        .catch(() => undefined);
    }, []),
  );

  const calibration = recap?.calibration;
  const shown = (alerts ?? []).filter((a) => filter === 'all' || a.theme === filter);

  return (
    <Screen bottomInset>
      <BackHeader title="Alertes" onBack={() => router.back()} />

      {calibration && !calibration.done ? (
        <Card>
          <AppText variant="bodySmall" style={styles.soft}>
            Les alertes s’activeront après {calibration.required} jours de données (
            {Math.min(calibration.nights, calibration.required)} / {calibration.required}).
          </AppText>
        </Card>
      ) : (
        <>
          <ChoiceChips<Filter> label="Filtrer par thème" options={FILTERS} value={filter} onChange={setFilter} />
          {alerts !== null && shown.length === 0 ? (
            <Card>
              <AppText variant="bodySmall" style={styles.soft}>
                {filter === 'all' ? 'Aucune alerte pour l’instant.' : 'Aucune alerte dans ce thème.'}
              </AppText>
            </Card>
          ) : (
            shown.map((a) => <AlertHistoryCard key={a.id} alert={a} />)
          )}
        </>
      )}

      <View style={styles.footer}>
        <AppText variant="small" style={styles.center}>
          Au plus {SETTINGS.alerts.maxPerDay} alertes par jour{quiet ? ` · silence de ${quiet}` : ''}
        </AppText>
        <AppText variant="small" style={styles.center}>
          Ces alertes ne remplacent pas un avis médical.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  soft: { color: colors.textSoft },
  footer: { gap: 4, marginTop: 8 },
  center: { textAlign: 'center' },
});
