import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { FONT, SHADOW } from '@/constants/theme';
import { HomeIcon, ProfileIcon, SparkleIcon } from './Icon';

export function BottomNav() {
  const pathname = usePathname();
  const tabs = [{ label: 'Beranda', href: '/beranda', icon: (active: boolean) => <HomeIcon color={active ? COLORS.white : 'rgba(59,46,74,0.5)'} /> }, { label: 'Misi', href: '/misi', icon: (active: boolean) => <SparkleIcon color={active ? COLORS.white : 'rgba(59,46,74,0.5)'} size={23} /> }];
  return <View style={styles.wrap}><View style={styles.nav}>{tabs.map((tab) => { const active = pathname === tab.href; return <Pressable key={tab.href} onPress={() => router.replace(tab.href as never)} style={styles.item}><View style={[styles.icon, active && styles.active]}>{tab.icon(active)}</View><Text style={[styles.text, active && styles.activeText]}>{tab.label}</Text></Pressable>; })}<Pressable onPress={() => {}} style={styles.item}><View style={styles.icon}><ProfileIcon color="rgba(59,46,74,0.5)" /></View><Text style={styles.text}>Profil</Text></Pressable></View></View>;
}
const styles = StyleSheet.create({ wrap: { position: 'absolute', left: 16, right: 16, bottom: 12, zIndex: 10 }, nav: { minHeight: 72, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.94)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, ...SHADOW.float }, item: { alignItems: 'center', minWidth: 72 }, icon: { width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, active: { backgroundColor: COLORS.cta, ...SHADOW.cta }, text: { fontFamily: FONT, fontSize: 9, color: 'rgba(59,46,74,0.5)', marginTop: 2 }, activeText: { color: COLORS.cta } });
