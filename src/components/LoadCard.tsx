// Jauge de charge 7 j / 28 j (DESIGN.md, accueil du lot 2).
// Texte d'état coloré : `good` équilibrée, `mid` en hausse ou sous-charge, `low` au-dessus de 1,5.
// Si la charge ne peut pas être calculée, la carte dit pourquoi (jamais de valeur inventée).

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { LoadStatus, LoadSummary } from '@/domain/load';
import { SETTINGS } from '@/domain/settings';

import { AppText } from './AppText';
import { SecondaryButton } from './Buttons';
import { Card } from './Card';
import { Gauge } from './Controls';
import { formatDecimal } from './format';
import { colors, fonts } from './theme';

/** Haut de l'échelle de la jauge (ratio). */
const GAUGE_MAX = 2;

function statusView(status: LoadStatus): { text: string; color: string } {
  switch (status) {
    case 'balanced':
      return { text: 'Charge équilibrée', color: colors.good };
    case 'rising':
      return { text: 'Charge en hausse', color: colors.mid };
    case 'under':
      return { text: 'Sous-charge', color: colors.mid };
    case 'high':
      return { text: `Pic de charge (au-dessus de ${formatDecimal(SETTINGS.load.highMin, 1)})`, color: colors.low };
  }
}

const sessionsText = (n: number) => `${n} séance${n > 1 ? 's' : ''} sur 7 jours`;

export function LoadCard({ load }: { load: LoadSummary | null }) {
  const router = useRouter();
  if (!load) return null;

  let body: React.ReactNode;
  if (load.state === 'profile-missing') {
    const what = load.missing.map((m) => (m === 'sex' ? 'ton sexe' : 'ta FC max ou ton année de naissance')).join(' et ');
    body = (
      <>
        <AppText variant="bodySmall" style={styles.soft}>
          Pour calculer ta charge, renseigne {what} dans Réglages.
        </AppText>
        <SecondaryButton title="Ouvrir les réglages" onPress={() => router.push('/reglages')} />
      </>
    );
  } else if (load.state === 'calibrating') {
    body = (
      <>
        <AppText variant="strong">
          Calibration : {load.days} / {load.required} jours
        </AppText>
        <Gauge value={load.days} max={load.required} minLabel="0" maxLabel={`${load.required} jours`} />
        <AppText variant="small">Le ratio s’affichera après {load.required} jours de données.</AppText>
      </>
    );
  } else if (load.state === 'no-load') {
    body = (
      <AppText variant="bodySmall" style={styles.soft}>
        Aucune séance avec FC sur les 28 derniers jours : pas de charge à comparer.
      </AppText>
    );
  } else {
    const view = statusView(load.status);
    body = (
      <>
        <View style={styles.valueRow}>
          <AppText variant="tileValue">{formatDecimal(load.ratio, 2)}</AppText>
          <AppText style={[styles.status, { color: view.color }]}>{view.text}</AppText>
        </View>
        <Gauge value={Math.min(load.ratio, GAUGE_MAX)} max={GAUGE_MAX} minLabel="0" maxLabel={formatDecimal(GAUGE_MAX, 1)} />
        <AppText variant="small">
          {sessionsText(load.sessions7d)} · charge 7 j {Math.round(load.acute)} / 28 j {Math.round(load.chronic)} (par jour)
          {load.sessionsWithoutHr > 0 ? `\n${load.sessionsWithoutHr} séance(s) sans FC suffisante, non comptée(s).` : ''}
        </AppText>
      </>
    );
  }

  return (
    <Card style={styles.card}>
      <AppText variant="label">Charge 7 j / 28 j</AppText>
      {body}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  soft: { color: colors.textSoft },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  status: { flex: 1, fontSize: 14, fontFamily: fonts.body600 },
});
