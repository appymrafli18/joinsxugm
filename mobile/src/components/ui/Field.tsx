import { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from '@/constants/colors';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';

export function Field({ label, icon, value, onChangeText, placeholder, error, hint, secureTextEntry, right }: { label: string; icon: ReactNode; value: string; onChangeText: (value: string) => void; placeholder: string; error?: string; hint?: string; secureTextEntry?: boolean; right?: ReactNode }) {
  return <View><Text style={styles.label}>{label}</Text><View style={[styles.box, error ? styles.errorRing : styles.ring]}><View style={styles.icon}>{icon}</View><TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(59,46,74,0.35)" secureTextEntry={secureTextEntry} autoCapitalize="none" autoCorrect={false} /><View>{right}</View></View>{error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}</View>;
}
const styles = StyleSheet.create({ label: { fontFamily: FONT, fontSize: 13, color: 'rgba(59,46,74,0.8)', marginBottom: 8, paddingLeft: 4 }, box: { height: 54, backgroundColor: COLORS.white, borderRadius: RADIUS.field, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, ...SHADOW.float }, ring: { borderWidth: 1, borderColor: 'rgba(155,130,196,0.2)' }, errorRing: { borderWidth: 1, borderColor: 'rgba(176,74,106,0.6)' }, icon: { width: 22 }, input: { flex: 1, color: COLORS.text, fontFamily: FONT, fontSize: 14, paddingVertical: 0 }, error: { marginTop: 8, paddingLeft: 4, color: COLORS.errorRing, fontFamily: FONT, fontSize: 11 }, hint: { marginTop: 8, paddingLeft: 4, color: 'rgba(59,46,74,0.6)', fontFamily: FONT, fontSize: 11 } });
