// Composants musculation (DESIGN.md, « Écrans du lot 3 ») :
// - Sélecteur − / + : champ 48 px, contour `border`, fond `bg`, rayon 12, boutons 44 × 44.
// - Ligne d'exercice (force) : nom + tendance, mini-barres des 12 dernières semaines, 1RM estimé.

import { Pressable, StyleSheet, View } from 'react-native';

import { EXERCISE_LABEL, type ExerciseProgress, type StrengthTrend } from '@/domain/strength';

import { AppText } from './AppText';
import { formatDecimal } from './format';
import { colors, fonts, radius, TOUCH } from './theme';

type StepperProps = {
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
  /** Nom lu par le lecteur d'écran (« charge », « répétitions »). */
  label: string;
  /** Texte de l'unité dans les aria-labels (« kg », « répétition »). */
  spokenUnit: string;
  decimals?: number;
  onChange: (value: number) => void;
};

export function Stepper({ value, unit, step, min, max, label, spokenUnit, decimals = 0, onChange }: StepperProps) {
  const stepText = formatDecimal(step, step % 1 === 0 ? 0 : 1);
  const change = (delta: number) => {
    const next = Math.round((value + delta) * 100) / 100;
    if (next >= min && next <= max) onChange(next);
  };
  return (
    <View style={styles.stepper}>
      <StepButton text="−" label={`Moins ${stepText} ${spokenUnit}`} onPress={() => change(-step)} disabled={value - step < min} />
      <View style={styles.stepValue} accessible accessibilityLabel={`${label} : ${formatDecimal(value, decimals)} ${spokenUnit}`}>
        <AppText style={styles.stepNumber}>{formatDecimal(value, decimals)}</AppText>
        <AppText style={styles.stepUnit}> {unit}</AppText>
      </View>
      <StepButton text="+" label={`Plus ${stepText} ${spokenUnit}`} onPress={() => change(step)} disabled={value + step > max} />
    </View>
  );
}

function StepButton({ text, label, onPress, disabled }: { text: string; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.stepButton, (pressed || disabled) && { opacity: 0.4 }]}>
      <AppText style={styles.stepButtonText}>{text}</AppText>
    </Pressable>
  );
}

export const TREND_VIEW: Record<StrengthTrend, { text: string; color: string }> = {
  rising: { text: 'En hausse', color: colors.good },
  stagnant: { text: 'Stable depuis 6 semaines', color: colors.mid },
  steady: { text: 'Stable', color: colors.textMuted },
  falling: { text: 'En baisse', color: colors.textMuted },
  insufficient: { text: 'Pas encore assez de séances', color: colors.textMuted },
};

const BAR_MIN = 8;
const BAR_MAX = 32;

export function StrengthRow({ progress }: { progress: ExerciseProgress }) {
  const trend = TREND_VIEW[progress.trend];
  const values = progress.weekly.filter((v): v is number => v !== null);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 0;
  const height = (v: number) => (high === low ? (BAR_MIN + BAR_MAX) / 2 : BAR_MIN + ((v - low) / (high - low)) * (BAR_MAX - BAR_MIN));
  const lastIndex = progress.weekly.length - 1;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${EXERCISE_LABEL[progress.exercise]} : ${
        progress.current === null ? 'pas de 1RM récent' : `1RM estimé ${Math.round(progress.current)} kilos`
      }, ${trend.text}`}>
      <View style={styles.rowName}>
        <AppText style={styles.name}>{EXERCISE_LABEL[progress.exercise]}</AppText>
        <AppText style={[styles.trend, { color: trend.color }]}>{trend.text}</AppText>
      </View>
      <View style={styles.bars}>
        {progress.weekly.map((v, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              v === null
                ? { height: 2, backgroundColor: colors.surfaceAlt }
                : { height: height(v), backgroundColor: i === lastIndex ? trend.color : colors.bar },
            ]}
          />
        ))}
      </View>
      <View style={styles.value}>
        <AppText style={styles.oneRm}>{progress.current === null ? '—' : Math.round(progress.current)}</AppText>
        <AppText variant="unit"> kg</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
  },
  stepButton: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  stepButtonText: { fontFamily: fonts.body600, fontSize: 20, color: colors.text },
  stepValue: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  stepNumber: { fontFamily: fonts.display600, fontSize: 17, color: colors.text },
  stepUnit: { fontFamily: fonts.body400, fontSize: 12, color: colors.textMuted },

  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
    paddingVertical: 8,
  },
  rowName: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.body600, fontSize: 14, color: colors.text },
  trend: { fontFamily: fonts.body400, fontSize: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: BAR_MAX },
  bar: { width: 5, borderRadius: 2 },
  value: { flexDirection: 'row', alignItems: 'baseline', minWidth: 64, justifyContent: 'flex-end' },
  oneRm: { fontFamily: fonts.display600, fontSize: 20, color: colors.text },
});
