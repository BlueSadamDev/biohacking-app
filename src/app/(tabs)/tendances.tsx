// Onglet Tendances (DESIGN.md, « Écrans du lot 3 »).
// « Calculé sur tes 90 derniers jours » + « Ce que tes données disent », pastilles vers les détails
// (HRV, FC au repos, Sommeil, Poids), « Liens observés » (3 au plus, du plus fort au plus faible),
// puis les mentions en bas. Sans lien fiable : « Pas encore assez de données… ».

import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { LinkCard } from '@/components/LinkCard';
import { Screen } from '@/components/Screen';
import { colors, fonts, radius } from '@/components/theme';
import { useHealthData } from '@/components/useHealthData';
import { loadCorrelations } from '@/db/trendsData';
import type { CorrelationReport } from '@/domain/correlations';
import { SETTINGS } from '@/domain/settings';

const DETAILS: { label: string; href: Href }[] = [
  { label: 'HRV', href: '/detail/hrv' },
  { label: 'FC au repos', href: '/detail/restingHr' },
  { label: 'Sommeil', href: '/detail/sleep' },
  { label: 'Poids', href: '/detail/poids' },
];

export default function TrendsScreen() {
  const router = useRouter();
  const { nights, syncing, sync } = useHealthData();
  const [report, setReport] = useState<CorrelationReport | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    loadCorrelations()
      .then((r) => {
        setReport(r);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);
  useFocusEffect(refresh);
  // Après une synchro (nouvelles nuits), on recalcule.
  useEffect(refresh, [nights, refresh]);

  const c = SETTINGS.correlations;

  return (
    <Screen refreshing={syncing} onRefresh={sync}>
      <View>
        <AppText variant="small">Calculé sur tes {c.windowDays} derniers jours</AppText>
        <AppText variant="title">Ce que tes données disent</AppText>
      </View>

      <View style={styles.pills}>
        {DETAILS.map((d) => (
          <Pressable
            key={d.label}
            accessibilityRole="button"
            accessibilityHint={`Ouvre le détail ${d.label}`}
            onPress={() => router.push(d.href)}
            hitSlop={4}
            style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}>
            <AppText style={styles.pillText}>{d.label}</AppText>
          </Pressable>
        ))}
      </View>

      <AppText variant="label">Liens observés</AppText>
      {error ? (
        <AppText variant="bodySmall">Impossible de calculer les liens. Tire vers le bas pour réessayer.</AppText>
      ) : report === null ? (
        <ActivityIndicator color={colors.text} />
      ) : report.links.length === 0 ? (
        <AppText variant="bodySmall" style={styles.soft}>
          Pas encore assez de données pour repérer des liens fiables.
        </AppText>
      ) : (
        report.links.map((link) => <LinkCard key={link.id} link={link} />)
      )}

      <View style={styles.footer}>
        <AppText variant="small" style={styles.center}>
          Un lien observé n’est pas une preuve de cause.
        </AppText>
        <AppText variant="small" style={styles.center}>
          Seuls les liens assez réguliers sur au moins {c.minDays} jours sont affichés.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.body500, fontSize: 13, color: colors.textSoft },
  soft: { color: colors.textSoft },
  footer: { gap: 4, marginTop: 8 },
  center: { textAlign: 'center' },
});
