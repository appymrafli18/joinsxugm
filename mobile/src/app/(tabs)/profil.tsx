import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, ChevronIcon, LockIcon } from '@/components/common/Icon';
import { BottomNav } from '@/components/common/BottomNav';
import { Spinner } from '@/components/ui/Spinner';
import { ARCHETYPE_COLORS, COLORS, type ArchetypeId } from '@/constants/colors';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/**
 * Halaman Profil (PRD Bagian 6 fitur pelengkap: "profil & kontak darurat").
 * Nickname & kontak darurat boleh diupdate klien (kolom diizinkan GRANT DB);
 * status consent dikelola lewat layar /consent.
 */

const ARCHETYPE_IMAGES: Record<ArchetypeId, number> = {
  guardian: require('@/assets/images/raster/arkatipe_guardian.png'),
  healer: require('@/assets/images/raster/arkatipe_healer.png'),
  scholar: require('@/assets/images/raster/arkatipe_scholar.png'),
  companion: require('@/assets/images/raster/arkatipe_companion.png'),
};

const ARCHETYPE_LABEL: Record<ArchetypeId, string> = {
  guardian: 'The Guardian',
  healer: 'The Healer',
  scholar: 'The Scholar',
  companion: 'The Companion',
};

type ProfileData = {
  nickname: string;
  archetypeId: ArchetypeId;
  emergencyName: string;
  emergencyPhone: string;
  consentActive: boolean;
};

export default function ProfilScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<ProfileData | null>(null);
  const [nickname, setNickname] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!userData.user) {
        router.replace('/login');
        return;
      }
      const { data: patient } = await supabase
        .from('patients')
        .select('nickname, archetype_id, emergency_contact_name, emergency_contact_phone, data_sharing_consent')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!patient?.archetype_id) {
        router.replace('/pilih-arketipe');
        return;
      }
      const profile: ProfileData = {
        nickname: patient.nickname ?? '',
        archetypeId: patient.archetype_id as ArchetypeId,
        emergencyName: patient.emergency_contact_name ?? '',
        emergencyPhone: patient.emergency_contact_phone ?? '',
        consentActive: Boolean(patient.data_sharing_consent),
      };
      setData(profile);
      setNickname(profile.nickname);
      setEmergencyName(profile.emergencyName);
      setEmergencyPhone(profile.emergencyPhone);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty =
    data !== null &&
    (nickname.trim() !== data.nickname ||
      emergencyName.trim() !== data.emergencyName ||
      emergencyPhone.trim() !== data.emergencyPhone);

  async function handleSave() {
    if (!data || saving || !dirty) return;
    if (!nickname.trim()) {
      setError('Nama panggilan tidak boleh kosong.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Sesi habis. Masuk lagi ya.');
      const { error: updateError } = await supabase
        .from('patients')
        .update({
          nickname: nickname.trim(),
          emergency_contact_name: emergencyName.trim() || null,
          emergency_contact_phone: emergencyPhone.trim() || null,
        })
        .eq('id', userData.user.id);
      if (updateError) throw new Error('Gagal menyimpan perubahan. Coba lagi ya.');
      setData({
        ...data,
        nickname: nickname.trim(),
        emergencyName: emergencyName.trim(),
        emergencyPhone: emergencyPhone.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan perubahan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await signOut();
    router.replace('/login');
  }

  if (!data) {
    return (
      <View style={styles.loading}>
        <Spinner />
      </View>
    );
  }

  const color = ARCHETYPE_COLORS[data.archetypeId];

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Math.max(24, insets.top), paddingBottom: Math.max(12, insets.bottom) + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
          <Text style={styles.subtitle}>Kenali dirimu dan jaga keamananmu</Text>
        </View>

        {/* Kartu identitas */}
        <View style={styles.identityCard}>
          <Image source={ARCHETYPE_IMAGES[data.archetypeId]} contentFit="cover" style={[styles.avatar, { backgroundColor: color.card }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.identityName}>{data.nickname}</Text>
            <Text style={styles.identityArchetype}>Pendamping: {ARCHETYPE_LABEL[data.archetypeId]}</Text>
          </View>
        </View>

        {/* Nama panggilan */}
        <Text style={styles.fieldLabel}>Nama panggilan</Text>
        <TextInput
          style={styles.field}
          value={nickname}
          onChangeText={setNickname}
          placeholder="Nama panggilanmu"
          placeholderTextColor="rgba(59,46,74,0.35)"
          maxLength={20}
        />

        {/* Kontak darurat */}
        <Text style={styles.sectionTitle}>Kontak darurat</Text>
        <Text style={styles.sectionHint}>
          Dipakai tim krisis untuk menghubungi orang terdekatmu bila kamu dalam
          bahaya. Data ini bersifat pribadi.
        </Text>
        <Text style={styles.fieldLabel}>Nama kontak</Text>
        <TextInput
          style={styles.field}
          value={emergencyName}
          onChangeText={setEmergencyName}
          placeholder="mis. Ibu, kakak"
          placeholderTextColor="rgba(59,46,74,0.35)"
          maxLength={60}
        />
        <Text style={styles.fieldLabel}>Nomor telepon</Text>
        <TextInput
          style={styles.field}
          value={emergencyPhone}
          onChangeText={(text) => setEmergencyPhone(text.replace(/[^0-9+ -]/g, ''))}
          placeholder="mis. 08xxxxxxxxxx"
          placeholderTextColor="rgba(59,46,74,0.35)"
          keyboardType="phone-pad"
          maxLength={20}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {saved ? (
          <View style={styles.savedRow}>
            <CheckIcon size={14} color={COLORS.sage} />
            <Text style={styles.savedText}>Tersimpan</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSave}
          disabled={!dirty || saving}
          style={[styles.primaryButton, (!dirty || saving) && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</Text>
        </Pressable>

        {/* Consent */}
        <Pressable onPress={() => router.push('/consent' as never)} style={styles.rowCard}>
          <View style={styles.rowIcon}>
            <LockIcon size={18} color={COLORS.guardian} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Berbagi data dengan psikolog</Text>
            <Text style={[styles.rowMeta, { color: data.consentActive ? COLORS.sage : 'rgba(59,46,74,0.6)' }]}>
              {data.consentActive ? 'Persetujuan aktif — kelola di sini' : 'Belum aktif — atur di sini'}
            </Text>
          </View>
          <ChevronIcon color="rgba(59,46,74,0.3)" />
        </Pressable>

        {/* Logout */}
        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Keluar dari Akun</Text>
        </Pressable>
      </ScrollView>
      <BottomNav />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.base },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.base },
  header: { paddingHorizontal: 20 },
  title: { fontFamily: FONT, fontSize: 24, color: COLORS.text },
  subtitle: { fontFamily: FONT, fontSize: 11, color: 'rgba(59,46,74,0.6)', marginTop: 4 },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18, marginHorizontal: 20, backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 16, ...SHADOW.float },
  avatar: { width: 64, height: 64, borderRadius: 18 },
  identityName: { fontFamily: FONT, fontSize: 16, color: COLORS.text },
  identityArchetype: { fontFamily: FONT, fontSize: 10, color: 'rgba(59,46,74,0.6)', marginTop: 4 },
  sectionTitle: { fontFamily: FONT, fontSize: 14, color: COLORS.text, marginTop: 22, marginHorizontal: 20 },
  sectionHint: { fontFamily: FONT, fontSize: 10, lineHeight: 15, color: 'rgba(59,46,74,0.6)', marginTop: 4, marginHorizontal: 20 },
  fieldLabel: { fontFamily: FONT, fontSize: 12, color: COLORS.text, marginTop: 14, marginHorizontal: 20 },
  field: {
    marginHorizontal: 20,
    marginTop: 6,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.field,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.text,
    ...SHADOW.float,
  },
  errorText: { fontFamily: FONT, fontSize: 11, color: COLORS.errorRing, textAlign: 'center', marginTop: 12, marginHorizontal: 20 },
  savedRow: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  savedText: { fontFamily: FONT, fontSize: 11, color: COLORS.sage },
  primaryButton: { marginHorizontal: 20, marginTop: 16, height: 54, borderRadius: RADIUS.pill, backgroundColor: COLORS.cta, alignItems: 'center', justifyContent: 'center', ...SHADOW.cta },
  primaryButtonText: { fontFamily: FONT, fontSize: 15, color: COLORS.white },
  buttonDisabled: { opacity: 0.4 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 22, backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 16, ...SHADOW.float },
  rowIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: COLORS.guardianCard, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: FONT, fontSize: 12, color: COLORS.text },
  rowMeta: { fontFamily: FONT, fontSize: 10, marginTop: 3 },
  logoutButton: { marginHorizontal: 20, marginTop: 22, height: 50, borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: 'rgba(193,69,59,0.35)', alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontFamily: FONT, fontSize: 13, color: COLORS.terracotta },
});
