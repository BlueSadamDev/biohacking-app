// Phrase avec un passage en relief (DESIGN.md, « Textes » > « Relief ») : « Tu t’entraînes *45 % de
// plus* que d’habitude ». Chiffre en Space Grotesk 600, action en Inter 600, dans la couleur du texte
// principal. Les lecteurs d'écran lisent la phrase d'un seul tenant, sans les astérisques.

import { StyleSheet, Text, type TextProps } from 'react-native';

import { parseEmphasis, plainText } from '@/domain/texts/markup';

import { AppText, type TextVariant } from './AppText';
import { colors, fonts } from './theme';

export function RichText({ text, variant = 'body', ...props }: TextProps & { text: string; variant?: TextVariant }) {
  return (
    <AppText variant={variant} accessibilityLabel={plainText(text)} {...props}>
      {parseEmphasis(text).map((p, i) =>
        p.emphasis === null ? (
          p.text
        ) : (
          <Text key={i} style={p.emphasis === 'number' ? styles.number : styles.action}>
            {p.text}
          </Text>
        ),
      )}
    </AppText>
  );
}

const styles = StyleSheet.create({
  number: { fontFamily: fonts.display600, color: colors.text },
  action: { fontFamily: fonts.body600, color: colors.text },
});
