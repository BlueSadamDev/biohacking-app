// Boutons : principal, secondaire et rond (44 × 44).

import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppText } from './AppText';
import { colors, fonts, radius, TOUCH } from './theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Bouton principal après validation : fond vert. */
  done?: boolean;
};

export function PrimaryButton({ title, onPress, disabled, busy, done }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.primary,
        done && { backgroundColor: colors.good },
        (pressed || disabled) && { opacity: 0.7 },
      ]}>
      {busy ? <ActivityIndicator color={colors.bg} /> : <AppText style={styles.primaryText}>{title}</AppText>}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, disabled, busy }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.secondary, (pressed || disabled) && { opacity: 0.7 }]}>
      {busy ? <ActivityIndicator color={colors.text} /> : <AppText style={styles.secondaryText}>{title}</AppText>}
    </Pressable>
  );
}

export function RoundButton({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  /** Description lue par le lecteur d'écran. */
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 52,
    borderRadius: radius.control,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: fonts.body600, fontSize: 15, color: colors.bg },
  secondary: {
    height: 52,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontFamily: fonts.body600, fontSize: 15, color: colors.text },
  round: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
