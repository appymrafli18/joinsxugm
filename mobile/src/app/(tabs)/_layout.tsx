import { Tabs } from 'expo-router';
import { COLORS } from '@/constants/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        sceneStyle: { backgroundColor: COLORS.base },
      }}
    >
      <Tabs.Screen name="beranda" />
      <Tabs.Screen name="companion" />
      <Tabs.Screen name="perjalanan" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}
