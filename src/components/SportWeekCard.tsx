// Carte « Cette semaine » de l'onglet Sport (DESIGN.md, « Écrans du lot 3 ») :
// séances faites / cible, temps d'activité, charge de la semaine (en mots depuis le lot 5a.1),
// puis barre des zones cardiaques.
// Quand un élément n'est pas calculable, la carte dit pourquoi (jamais de valeur inventée).

import { StyleSheet, View } from 'react-native';

import type { SportWeek } from '@/db/sportData';
import type { LoadSummary } from '@/domain/load';
import { plainText } from '@/domain/texts/markup';
import { SPORT } from '@/domain/texts/sport';
import { LOAD, loadSentence } from '@/domain/texts/today';

import { AppText } from './AppText';
import { Card } from './Card';
import { formatDuration } from './format';
import { HeartZonesBar } from './HeartZonesBar';
import { statusView } from './LoadCard';
import { colors } from './theme';

function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="small">{label}</AppText>
      {/* Une seule ligne : un mot (« Équilibrée ») rétrécit au lieu d'être coupé en deux. */}
      <AppText variant="tileValue" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={color ? { color } : undefined}>
        {value}
        {unit ? <AppText variant="unit"> {unit}</AppText> : null}
      </AppText>
    </View>
  );
}

function loadValue(load: LoadSummary | null): { value: string; note: string | null; color?: string } {
  if (!load) return { value: '—', note: null };
  switch (load.state) {
    case 'ok': {
      const view = statusView(load.status);
      return { value: view.text, note: plainText(loadSentence(load.status, load.ratio)), color: view.color };
    }
    case 'calibrating':
      return { value: '—', note: SPORT.loadCalibrating(load.days, load.required) };
    case 'profile-missing':
      return { value: '—', note: SPORT.loadProfileMissing };
    case 'no-load':
      return { value: '—', note: SPORT.loadNoSession };
    case 'unreliable':
      return { value: SPORT.loadUnreliableValue, note: plainText(LOAD.unreliable(load.unmeasured, load.total)) };
  }
}

export function SportWeekCard({ week, load }: { week: SportWeek; load: LoadSummary | null }) {
  const charge = loadValue(load);
  return (
    <Card style={styles.card}>
      <AppText variant="label">Cette semaine</AppText>
      <View style={styles.stats}>
        <Stat label="Séances" value={`${week.sessions}`} unit={`/ ${week.sessionsTarget}`} />
        <Stat label="Activité" value={formatDuration(week.activeMinutes)} />
        <Stat label={SPORT.loadLabel} value={charge.value} color={charge.color} />
      </View>
      {charge.note ? (
        <AppText variant="small">{charge.note}</AppText>
      ) : null}

      {week.hrMaxMissing ? (
        <AppText variant="bodySmall" style={styles.soft}>
          {SPORT.hrMaxMissing}
        </AppText>
      ) : week.zones && week.sessions > week.sessionsWithoutHr ? (
        <HeartZonesBar zones={week.zones} zone2Target={week.zone2Target} />
      ) : (
        <AppText variant="bodySmall" style={styles.soft}>
          {week.sessions === 0 ? SPORT.noSessionThisWeek : SPORT.notEnoughHr}
        </AppText>
      )}
      {week.sessionsWithoutHr > 0 && week.sessions > week.sessionsWithoutHr ? (
        <AppText variant="small">{SPORT.sessionsWithoutHr(week.sessionsWithoutHr)}</AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, gap: 2 },
  soft: { color: colors.textSoft },
});
