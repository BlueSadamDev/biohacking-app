// Barre de navigation : 72 px, 4 onglets (Aujourd'hui, Tendances, Sport, Réglages).

import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsIcon, SportIcon, TodayIcon, TrendsIcon } from '@/components/Icons';
import { colors, fonts } from '@/components/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.surfaceAlt,
          height: 72 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.body500, fontSize: 11 },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Aujourd’hui', tabBarIcon: ({ color }) => <TodayIcon color={color} /> }}
      />
      <Tabs.Screen
        name="tendances"
        options={{ title: 'Tendances', tabBarIcon: ({ color }) => <TrendsIcon color={color} /> }}
      />
      <Tabs.Screen
        name="sport"
        options={{ title: 'Sport', tabBarIcon: ({ color }) => <SportIcon color={color} /> }}
      />
      <Tabs.Screen
        name="reglages"
        options={{ title: 'Réglages', tabBarIcon: ({ color }) => <SettingsIcon color={color} /> }}
      />
    </Tabs>
  );
}
