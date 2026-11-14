// Texte de l'app : une variante par rôle typographique de DESIGN.md.

import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from './theme';

export const textStyles = StyleSheet.create({
  score: { fontFamily: fonts.display700, fontSize: 56, color: colors.text },
  detailValue: { fontFamily: fonts.display700, fontSize: 48, color: colors.text },
  title: { fontFamily: fonts.display600, fontSize: 22, color: colors.text },
  tileValue: { fontFamily: fonts.display600, fontSize: 22, color: colors.text },
  unit: { fontFamily: fonts.body400, fontSize: 13, color: colors.textMuted },
  strong: { fontFamily: fonts.body600, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.body400, fontSize: 15, color: colors.text },
  bodySmall: { fontFamily: fonts.body400, fontSize: 13, color: colors.text },
  label: {
    fontFamily: fonts.body500,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 12 * 0.08,
  },
  small: { fontFamily: fonts.body400, fontSize: 12, color: colors.textMuted },
});

export type TextVariant = keyof typeof textStyles;

export function AppText({ variant = 'body', style, ...props }: TextProps & { variant?: TextVariant }) {
  return <Text {...props} style={[textStyles[variant], style]} />;
}
