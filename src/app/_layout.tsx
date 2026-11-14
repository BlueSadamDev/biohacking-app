import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';

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
  const router = useRouter();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // Tâche de fond, autorisation des notifications et programmation du récap du matin.
  useEffect(() => {
    setupBackground().catch(() => undefined);
  }, []);

  // Notification touchée : ouvrir l'écran qu'elle indique (rappel de saisie → /seance).
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response || !loaded) return;
    const id = response.notification.request.identifier;
    const url = response.notification.request.content.data?.url;
    if (handled.current === id || typeof url !== 'string') return;
    handled.current = id;
    router.push(url as Href);
  }, [response, loaded, router]);

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
