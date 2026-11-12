import { Stack } from "expo-router";

export default function RootLayout() {
  // L'écran affiche son propre titre : pas de barre de titre au lot 0.
  return <Stack screenOptions={{ headerShown: false }} />;
}
