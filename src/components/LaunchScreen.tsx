// Écran Aube du lancement (DESIGN.md, « Identité ») : logo, « aube », « Ton récap du matin »
// et, en bas, une barre fine animée pendant la synchronisation Health Connect.

import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Logo } from './Logo';
import { colors, fonts } from './theme';

const BAR_WIDTH = 160;
const BAR_HEIGHT = 4;
const SEGMENT = 56;

export function LaunchScreen() {
  // Petit segment qui glisse de gauche à droite en boucle (durée de la synchro inconnue).
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-SEGMENT, BAR_WIDTH] });

  return (
    <View style={styles.screen} accessibilityLabel="Aube, synchronisation de ta nuit en cours">
      <View style={styles.center}>
        <Logo size={132} />
        <AppText style={styles.wordmark}>aube</AppText>
        <AppText style={styles.tagline}>Ton récap du matin</AppText>
      </View>
      <View style={styles.bottom}>
        <View style={styles.bar}>
          <Animated.View style={[styles.segment, { transform: [{ translateX }] }]} />
        </View>
        <AppText variant="small">Synchronisation de ta nuit…</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  wordmark: {
    fontFamily: fonts.display600,
    fontSize: 44,
    letterSpacing: 44 * 0.04,
    color: colors.text,
    marginTop: 16,
  },
  tagline: { fontFamily: fonts.body400, fontSize: 15, color: colors.textMuted },
  bottom: { alignItems: 'center', gap: 12, paddingBottom: 64 },
  bar: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  segment: { width: SEGMENT, height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, backgroundColor: colors.text },
});
