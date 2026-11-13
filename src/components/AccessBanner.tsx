// Bandeau affiché quand Health Connect n'est pas utilisable :
// message clair + action proposée (DESIGN.md, « États à toujours prévoir »).

import { StyleSheet, View } from 'react-native';

import { askReadPermissions, openSettings, type AccessState } from '@/sources/healthConnect';

import { AppText } from './AppText';
import { SecondaryButton } from './Buttons';
import { colors, radius, tint } from './theme';
import { syncNow } from './useHealthData';

const MESSAGES: Record<Exclude<AccessState, 'ok'>, string> = {
  unavailable: 'Health Connect n’est pas disponible sur ce téléphone. Il est intégré à Android 14 et plus récent.',
  'update-required': 'Health Connect doit être mis à jour depuis le Play Store, puis relance l’app.',
  'no-permission':
    'L’app n’a pas encore le droit de lire tes données Health Connect. Elle demande uniquement la lecture, jamais l’écriture.',
  partial: 'Certaines données ne sont pas autorisées : ton récap risque d’être incomplet.',
};

async function allow() {
  await askReadPermissions();
  await syncNow();
}

export function AccessBanner({ access }: { access: AccessState | null }) {
  if (access === null || access === 'ok') return null;
  const canAsk = access === 'no-permission' || access === 'partial';
  return (
    <View style={styles.banner}>
      <AppText variant="bodySmall">{MESSAGES[access]}</AppText>
      {canAsk && <SecondaryButton title="Autoriser la lecture" onPress={allow} />}
      {canAsk && <SecondaryButton title="Ouvrir les réglages Health Connect" onPress={openSettings} />}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: tint(colors.mid),
    borderColor: colors.mid,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 16,
    gap: 10,
  },
});
