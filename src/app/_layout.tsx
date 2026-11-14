import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

// Déclare la tâche de fond dès le démarrage (obligatoire pour qu'Android puisse la lancer).
import { setupBackground } from '@/background/syncTask';
import { LaunchScreen } from '@/components/LaunchScreen';
import { colors, fontFiles } from '@/components/theme';
import { useHealthData } from '@/components/useHealthData';
import { SETTINGS } from '@/domain/settings';

// L'écran de démarrage d'Android reste affiché tant que les polices (locales) ne sont pas chargées.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(fontFiles);
  const { launched } = useHealthData();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // Tâche de fond, autorisation des notifications et programmation du récap du matin.
  useEffect(() => {
    setupBackground().catch(() => undefined);
  }, []);

  // Sécurité : l'écran Aube ne reste jamais plus de quelques secondes.
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), SETTINGS.sync.launchScreenMaxSeconds * 1000);
    return () => clearTimeout(t);
  }, []);

  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      {/* Écran Aube par-dessus l'accueil, pendant la synchro Health Connect du lancement. */}
      {!launched && !timedOut && <LaunchScreen />}
    </>
  );
}
