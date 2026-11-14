// Carte « Cette semaine » de l'onglet Sport (DESIGN.md, « Écrans du lot 3 ») :
// séances faites / cible, temps d'activité, charge 7 j / 28 j, puis barre des zones cardiaques.
// Quand un élément n'est pas calculable, la carte dit pourquoi (jamais de valeur inventée).

import { StyleSheet, View } from 'react-native';

import type { SportWeek } from '@/db/sportData';
import type { LoadSummary } from '@/domain/load';

import { AppText } from './AppText';
import { Card } from './Card';
import { formatDecimal, formatDuration } from './format';
import { HeartZonesBar } from './HeartZonesBar';
import { statusView } from './LoadCard';
import { colors } from './theme';

function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="small">{label}</AppText>
      <AppText variant="tileValue" style={color ? { color } : undefined}>
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
      return { value: formatDecimal(load.ratio, 2), note: view.text, color: view.color };
    }
    case 'calibrating':
      return { value: '—', note: `Calibration : ${load.days} / ${load.required} jours` };
    case 'profile-missing':
      return { value: '—', note: 'Profil cardiaque à compléter dans Réglages' };
    case 'no-load':
      return { value: '—', note: 'Aucune séance avec FC sur 28 jours' };
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
        <Stat label="Charge 7 j / 28 j" value={charge.value} color={charge.color} />
      </View>
      {charge.note ? (
        <AppText variant="small" style={charge.color ? { color: charge.color } : undefined}>
          {charge.note}
        </AppText>
      ) : null}

      {week.hrMaxMissing ? (
        <AppText variant="bodySmall" style={styles.soft}>
          Renseigne ta FC max ou ton année de naissance dans Réglages pour voir tes zones cardiaques.
        </AppText>
      ) : week.zones && week.sessions > week.sessionsWithoutHr ? (
        <HeartZonesBar zones={week.zones} zone2Target={week.zone2Target} />
      ) : (
        <AppText variant="bodySmall" style={styles.soft}>
          {week.sessions === 0
            ? 'Aucune séance cette semaine : pas encore de zones cardiaques.'
            : 'Pas assez de FC enregistrée pendant tes séances pour calculer les zones.'}
        </AppText>
      )}
      {week.sessionsWithoutHr > 0 && week.sessions > week.sessionsWithoutHr ? (
        <AppText variant="small">{week.sessionsWithoutHr} séance(s) sans FC suffisante, non comptée(s) dans les zones.</AppText>
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
