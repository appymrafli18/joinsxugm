import { Pressable, StyleSheet, Text } from 'react-native';
import { COLORS } from '@/constants/colors';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';

export function PrimaryButton({ label, onPress, disabled = false, loading = false }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, !disabled && styles.shadow, disabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.label}>{loading ? 'Memuat...' : label}</Text></Pressable>;
}
const styles = StyleSheet.create({ button: { height: 54, borderRadius: RADIUS.pill, backgroundColor: COLORS.cta, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, flexDirection: 'row' }, label: { color: COLORS.white, fontFamily: FONT, fontSize: 15 }, shadow: SHADOW.cta, disabled: { opacity: 0.45 }, pressed: { transform: [{ scale: 0.98 }] } });
