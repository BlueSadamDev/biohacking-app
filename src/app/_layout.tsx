import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

// Déclare la tâche de fond dès le démarrage (obligatoire pour qu'Android puisse la lancer).
import { setupBackground } from '@/background/syncTask';
import { colors, fontFiles } from '@/components/theme';

// L'écran de démarrage reste affiché tant que les polices (locales) ne sont pas chargées.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(fontFiles);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // Tâche de fond, autorisation des notifications et programmation du récap du matin.
  useEffect(() => {
    setupBackground().catch(() => undefined);
  }, []);

  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}
