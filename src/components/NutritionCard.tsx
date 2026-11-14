// Carte « Nutrition d'hier » (DESIGN.md, accueil du lot 2) : protéines puis calories avec
// leurs barres (`good` si au moins 90 % de la cible, `mid` en dessous), puis glucides,
// lipides et nombre de repas en petit ; mention « via Suivi macro » en haut à droite.

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { NutritionDayView, TargetProgress } from '@/domain/nutrition';
import { SETTINGS } from '@/domain/settings';

import { AppText } from './AppText';
import { Card } from './Card';
import { colors, fonts } from './theme';

function ProgressRow({
  label,
  unit,
  progress,
  missingTarget,
  stateBelow,
}: {
  label: string;
  unit: string;
  progress: TargetProgress;
  /** Texte quand la cible n'est pas connue. */
  missingTarget: string;
  /** Ligne d'état quand la cible n'est pas atteinte. */
  stateBelow: string;
}) {
  const { value, target, fraction, reached } = progress;
  const color = reached === null ? colors.textMuted : reached ? colors.good : colors.mid;
  const valueText = value === null ? '—' : String(Math.round(value));
  return (
    <View style={styles.progress}>
      <View style={styles.progressHead}>
        <AppText style={styles.progressLabel}>{label}</AppText>
        <AppText style={styles.progressValue}>
          {valueText}
          <AppText variant="unit">{target === null ? ` ${unit}` : ` / ${Math.round(target)} ${unit}`}</AppText>
        </AppText>
      </View>
      <View
        style={styles.track}
        accessible
        accessibilityLabel={
          fraction === null ? `${label} : ${valueText} ${unit}` : `${label} : ${Math.round(fraction * 100)} % de la cible`
        }>
        {fraction !== null && (
          <View style={[styles.fill, { width: `${Math.min(1, fraction) * 100}%`, backgroundColor: color }]} />
        )}
      </View>
      <AppText variant="small" style={reached === null ? null : { color }}>
        {target === null ? missingTarget : value === null ? 'Aucune valeur hier' : reached ? 'Dans la cible' : stateBelow}
      </AppText>
    </View>
  );
}

export function NutritionCard({ view }: { view: NutritionDayView | null }) {
  const router = useRouter();
  if (!view) return null;
  const day = view.day;
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v)} g`);

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <AppText variant="label" style={styles.flex}>
          Nutrition d’hier
        </AppText>
        <AppText variant="small">via Suivi macro</AppText>
      </View>

      {day === null ? (
        <AppText variant="bodySmall" style={styles.soft}>
          Aucun repas enregistré hier. Vérifie que Suivi macro synchronise vers Health Connect.
        </AppText>
      ) : (
        <>
          <ProgressRow
            label="Protéines"
            unit="g"
            progress={view.protein}
            missingTarget="Ajoute une pesée pour calculer ta cible."
            stateBelow={`Sous la cible · ${view.proteinDaysBelow} jour${view.proteinDaysBelow > 1 ? 's' : ''} sur ${SETTINGS.nutrition.weekDays} cette semaine`}
          />
          <ProgressRow
            label="Calories"
            unit="kcal"
            progress={view.calories}
            missingTarget="Cible à définir dans Réglages."
            stateBelow="Sous la cible"
          />
          <AppText variant="small">
            Glucides {fmt(day.carbsG)} · Lipides {fmt(day.fatG)} · {day.meals} repas
          </AppText>
        </>
      )}
      {day !== null && view.calories.target === null && (
        <AppText variant="small" style={styles.link} onPress={() => router.push('/reglages')} accessibilityRole="link">
          Définir mes cibles
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  soft: { color: colors.textSoft },
  progress: { gap: 6 },
  progressHead: { flexDirection: 'row', alignItems: 'baseline' },
  progressLabel: { flex: 1, fontFamily: fonts.body500, fontSize: 14, color: colors.text },
  progressValue: { fontFamily: fonts.display600, fontSize: 15, color: colors.text },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  link: { color: colors.infoText, paddingVertical: 8 },
});
