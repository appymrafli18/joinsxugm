import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { FONT } from '@/constants/theme';
import { resolveStartRoute } from '@/lib/profile';

export default function SplashRoute() {
  const insets = useSafeAreaInsets();
  const navigated = useRef(false);
  useEffect(() => { const timer = setTimeout(() => { if (!navigated.current) { navigated.current = true; void resolveStartRoute().then((route) => router.replace(route as never)); } }, 2500); return () => clearTimeout(timer); }, []);
  const continueNow = () => { if (!navigated.current) { navigated.current = true; void resolveStartRoute().then((route) => router.replace(route as never)); } };
  return <Pressable onPress={continueNow} style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}><View style={styles.center}><Image source={require('@/assets/images/raster/Logo-Splashcreen.png')} contentFit="contain" style={styles.logo} /><Text style={styles.tagline}>Ruang aman untuk ceritamu.</Text><View style={styles.dots}>{[0, 1, 2].map((dot) => <View key={dot} style={styles.dot} />)}</View></View></Pressable>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: COLORS.base }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }, logo: { width: 240, height: 81 }, tagline: { fontFamily: FONT, fontSize: 13, color: 'rgba(59,46,74,0.6)' }, dots: { flexDirection: 'row', gap: 8 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.guardian, opacity: 0.7 } });
