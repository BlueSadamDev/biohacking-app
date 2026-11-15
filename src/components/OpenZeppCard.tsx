// Carte « Ouvrir Zepp » de l'accueil : la nuit n'est pas encore arrivée dans Health Connect.
// Zepp n'envoie pas toujours ses données à Health Connect tant qu'on ne l'ouvre pas :
// le bouton ouvre Zepp (aucun appel réseau), et Aube se resynchronise au retour.
// Si Zepp n'est pas installée, la carte n'apparaît pas.

import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';

import { isZeppInstalled, openZepp } from '../../modules/zepp-launcher';

import { AppText } from './AppText';
import { SecondaryButton } from './Buttons';
import { Card } from './Card';
import { colors } from './theme';

export function OpenZeppCard({ onReturn }: { onReturn: () => void }) {
  const [installed, setInstalled] = useState(isZeppInstalled);
  /** Zepp a été ouverte depuis cette carte : synchro à relancer au retour dans Aube. */
  const opened = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setInstalled(isZeppInstalled()); // Zepp a pu être installée ou désinstallée entre-temps
      if (opened.current) {
        opened.current = false;
        onReturn();
      }
    });
    return () => subscription.remove();
  }, [onReturn]);

  if (!installed) return null;

  const open = () => {
    opened.current = openZepp();
    if (!opened.current) setInstalled(false);
  };

  return (
    <Card style={styles.card}>
      <AppText variant="strong">Ta nuit n’est pas encore arrivée</AppText>
      <AppText variant="bodySmall" style={{ color: colors.textSoft }}>
        Zepp ne l’a pas encore envoyée à Health Connect. Ouvre Zepp pour lancer l’envoi : Aube se
        resynchronise à ton retour.
      </AppText>
      <SecondaryButton title="Ouvrir Zepp" onPress={open} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
});
