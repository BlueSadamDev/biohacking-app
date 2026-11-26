// Carte « Charge de la semaine » (DESIGN.md, accueil du lot 2 ; textes du lot 5a.1) : la charge des
// 7 derniers jours comparée au rythme habituel (28 jours), dite en mots (« 45 % de plus que
// d'habitude ») plutôt qu'en rapport. Pastille d'état : `good` équilibrée, `mid` en hausse ou en baisse,
// `low` trop haute. Si la charge ne peut pas être calculée, la carte dit pourquoi (jamais de valeur inventée).

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { LoadStatus, LoadSummary } from '@/domain/load';
import { LOAD, loadDetail, loadGaugeLabel, loadSentence } from '@/domain/texts/today';

import { AppText } from './AppText';
import { SecondaryButton } from './Buttons';
import { Card, Pill } from './Card';
import { Gauge } from './Controls';
import { RichText } from './RichText';
import { colors } from './theme';

/** Haut de l'échelle de la jauge (rapport 2 = deux fois le rythme habituel, soit +100 %). */
const GAUGE_MAX = 2;

export function statusView(status: LoadStatus): { text: string; color: string } {
  switch (status) {
    case 'balanced':
      return { text: LOAD.pill.balanced, color: colors.good };
    case 'rising':
      return { text: LOAD.pill.rising, color: colors.mid };
    case 'under':
      return { text: LOAD.pill.under, color: colors.mid };
    case 'high':
      return { text: LOAD.pill.high, color: colors.low };
  }
}

export function LoadCard({ load }: { load: LoadSummary | null }) {
  const router = useRouter();
  if (!load) return null;

  let pill: { text: string; color: string } | null = null;
  let body: React.ReactNode;
  if (load.state === 'profile-missing') {
    const what = load.missing.map((m) => (m === 'sex' ? LOAD.missingSex : LOAD.missingHrMax)).join(' et ');
    body = (
      <>
        <AppText variant="bodySmall" style={styles.soft}>
          {LOAD.profileMissing(what)}
        </AppText>
        <SecondaryButton title={LOAD.openSettings} onPress={() => router.push('/reglages')} />
      </>
    );
  } else if (load.state === 'calibrating') {
    body = (
      <>
        <AppText variant="strong">{LOAD.calibrating(load.days, load.required)}</AppText>
        <Gauge value={load.days} max={load.required} minLabel="0" maxLabel={`${load.required} jours`} />
        <AppText variant="small">{LOAD.calibratingNote(load.required)}</AppText>
      </>
    );
  } else if (load.state === 'no-load') {
    body = (
      <AppText variant="bodySmall" style={styles.soft}>
        {LOAD.noLoad}
      </AppText>
    );
  } else if (load.state === 'unreliable') {
    // Trop de minutes d'activité sans fréquence cardiaque : ni pourcentage ni pastille (valeur faussée).
    body = (
      <>
        <RichText variant="constat" text={LOAD.unreliable(load.unmeasured, load.total)} />
        <SecondaryButton title={LOAD.unreliableButton} onPress={() => router.push('/diagnostic')} />
      </>
    );
  } else {
    pill = statusView(load.status);
    body = (
      <>
        <RichText variant="constat" text={loadSentence(load.status, load.ratio)} />
        <Gauge
          value={Math.min(load.ratio, GAUGE_MAX)}
          max={GAUGE_MAX}
          minLabel={LOAD.gaugeMin}
          maxLabel={LOAD.gaugeMax}
          accessibilityLabel={loadGaugeLabel(load.ratio)}
        />
        <AppText variant="small">{loadDetail(load.sessions7d, load.acute, load.chronic, load.sessionsWithoutHr, load.estimated7d)}</AppText>
      </>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <AppText variant="label" style={styles.flex}>
          {LOAD.title}
        </AppText>
        {pill && <Pill text={pill.text} color={pill.color} />}
      </View>
      {body}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  soft: { color: colors.textSoft },
});
