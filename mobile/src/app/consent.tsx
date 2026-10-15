import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CheckIcon,
  ChevronLeftIcon,
  LockIcon,
  SparkleIcon,
  XIcon,
} from '@/components/common/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/constants/colors';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';
import { setDataSharingConsent } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

/**
 * Layar Consent (PRD Bagian 6 poin 4 & Bagian 10):
 * data sensitif TIDAK PERNAH dibagikan ke psikolog tanpa persetujuan
 * eksplisit pasien. Persetujuan disimpan di patients.data_sharing_consent
 * + consent_updated_at, dan bisa dicabut kapan saja.
 */

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function InfoItem({ kind, children }: { kind: 'share' | 'dont'; children: string }) {
  return (
    <View style={styles.infoItem}>
      <View style={[styles.infoIcon, kind === 'share' ? styles.infoIconShare : styles.infoIconBlock]}>
        {kind === 'share' ? <CheckIcon size={13} color={COLORS.white} /> : <XIcon size={13} color={COLORS.white} />}
      </View>
      <Text style={styles.infoText}>{children}</Text>
    </View>
  );
}

export default function ConsentScreen() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [draft, setDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Guard sesi + muat status persetujuan saat ini */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace('/login');
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace('/login');
        return;
      }
      const { data: patient } = await supabase
        .from('patients')
        .select('data_sharing_consent, consent_updated_at')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (cancelled) return;
      const active = Boolean(patient?.data_sharing_consent);
      setConsent(active);
      setDraft(active);
      setUpdatedAt(patient?.consent_updated_at ?? null);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (savedTimer.current !== null) clearTimeout(savedTimer.current);
    };
  }, []);

  async function handleSave() {
    if (saving || draft === consent) return;
    setSaving(true);
    setError(null);
    try {
      // Tulis lewat server (column-level grant DB memblokir update klien langsung).
      const result = await setDataSharingConsent(draft);
      if (!result.ok) throw new Error(result.message);
      setConsent(draft);
      setUpdatedAt(result.updatedAt);
      setSaved(true);
      if (savedTimer.current !== null) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan. Coba lagi ya.');
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <View style={styles.loadingRoot}>
        <Spinner />
      </View>
    );
  }

  const hasChanges = draft !== consent;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: Math.max(12, insets.top),
        paddingBottom: Math.max(24, insets.bottom + 24),
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Kembali">
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Berbagi Data</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Status saat ini */}
      <View style={[styles.statusCard, consent ? styles.statusActive : styles.statusInactive]}>
        <View style={[styles.statusDot, { backgroundColor: consent ? COLORS.sage : 'rgba(59,46,74,0.35)' }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>
            Persetujuan {consent ? 'aktif' : 'belum aktif'}
          </Text>
          <Text style={styles.statusMeta}>
            {consent
              ? `Aktif sejak ${formatDate(updatedAt) ?? '—'} — ringkasan AI akan dibagikan saat kamu booking sesi.`
              : updatedAt
                ? `Dicabut pada ${formatDate(updatedAt)} — datamu tidak dibagikan ke siapapun.`
                : 'Belum pernah disetujui — datamu tidak dibagikan ke siapapun.'}
          </Text>
        </View>
      </View>

      {/* Penjelasan */}
      <View style={styles.section}>
        <Text style={styles.sectionLead}>
          Sebelum kami membagikan apapun ke psikolog, kami butuh izinmu secara
          eksplisit. Tanpa persetujuan ini, data kamu TIDAK akan dibagikan.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Yang dibagikan</Text>
        <InfoItem kind="share">
          Ringkasan AI dari percakapanmu — konteks, pola yang berulang, dan nada emosimu.
        </InfoItem>
        <InfoItem kind="share">
          Berstatus “catatan AI sebagai referensi awal” — psikolog tetap wajib melakukan asesmen sendiri.
        </InfoItem>
        <InfoItem kind="share">
          Hanya kepada psikolog terverifikasi yang sedang menanganimu.
        </InfoItem>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Yang TIDAK dibagikan</Text>
        <InfoItem kind="dont">Transkrip mentah percakapanmu dengan Companion.</InfoItem>
        <InfoItem kind="dont">
          Identitas aslimu tanpa izinmu — data pasien dipisahkan dari profil publik dan mendukung mode anonim.
        </InfoItem>
      </View>

      {/* Pernyataan persetujuan eksplisit */}
      <Pressable
        onPress={() => setDraft((value) => !value)}
        style={styles.consentRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: draft }}
      >
        <View style={[styles.checkbox, draft && styles.checkboxChecked]}>
          {draft ? <CheckIcon size={14} color={COLORS.white} /> : null}
        </View>
        <Text style={styles.consentText}>
          Aku setuju membagikan ringkasan AI-ku kepada psikolog. Aku bisa
          mencabut persetujuan ini kapan saja.
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? (
        <View style={styles.savedRow}>
          <CheckIcon size={14} color={COLORS.sage} />
          <Text style={styles.savedText}>Tersimpan</Text>
        </View>
      ) : null}

      {/* CTA */}
      <Pressable
        onPress={handleSave}
        disabled={!hasChanges || saving}
        style={[styles.button, (!hasChanges || saving) && styles.buttonDisabled]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>
          {saving
            ? 'Menyimpan...'
            : draft
              ? 'Simpan Persetujuan'
              : 'Cabut Persetujuan'}
        </Text>
      </Pressable>

      {/* Catatan privasi */}
      <View style={styles.privacy}>
        <LockIcon size={16} />
        <Text style={styles.privacyText}>
          Persetujuanmu tersimpan. Kamu bisa memilih psikolog kapan saja lewat
          kartu “Bicara dengan Psikolog” di Beranda.
        </Text>
      </View>
      <View style={styles.sparkleDecor} pointerEvents="none">
        <SparkleIcon size={18} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.base },
  loadingRoot: { flex: 1, backgroundColor: COLORS.base, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 8 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONT, fontSize: 17, color: COLORS.text },
  /* Status */
  statusCard: {
    marginHorizontal: 20,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: RADIUS.card,
    ...SHADOW.float,
  },
  statusActive: { backgroundColor: 'rgba(156,175,136,0.14)' },
  statusInactive: { backgroundColor: COLORS.white },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  statusTitle: { fontFamily: FONT, fontSize: 13, color: COLORS.text },
  statusMeta: { fontFamily: FONT, fontSize: 10, lineHeight: 15, color: 'rgba(59,46,74,0.65)', marginTop: 3 },
  /* Bagian info */
  section: { marginHorizontal: 20, marginTop: 16 },
  sectionLead: { fontFamily: FONT, fontSize: 12, lineHeight: 19, color: 'rgba(59,46,74,0.85)' },
  sectionTitle: { fontFamily: FONT, fontSize: 13, color: COLORS.text, marginBottom: 8 },
  infoItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  infoIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  infoIconShare: { backgroundColor: COLORS.sage },
  infoIconBlock: { backgroundColor: COLORS.terracotta },
  infoText: { flex: 1, fontFamily: FONT, fontSize: 11, lineHeight: 17, color: 'rgba(59,46,74,0.8)' },
  /* Checkbox persetujuan */
  consentRow: {
    marginHorizontal: 20,
    marginTop: 20,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.white,
    ...SHADOW.float,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(155,130,196,0.3)',
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.cta, borderColor: COLORS.cta },
  consentText: { flex: 1, fontFamily: FONT, fontSize: 11, lineHeight: 17, color: 'rgba(59,46,74,0.85)' },
  error: {
    marginHorizontal: 20,
    marginTop: 12,
    fontFamily: FONT,
    fontSize: 11,
    color: COLORS.errorRing,
    textAlign: 'center',
  },
  savedRow: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  savedText: { fontFamily: FONT, fontSize: 11, color: COLORS.sage },
  /* CTA */
  button: {
    marginHorizontal: 20,
    marginTop: 16,
    height: 54,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.cta,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.cta,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: FONT, fontSize: 15, color: COLORS.white },
  /* Catatan */
  privacy: { marginHorizontal: 20, marginTop: 20, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  privacyText: { flex: 1, fontFamily: FONT, fontSize: 10, lineHeight: 16, color: 'rgba(59,46,74,0.6)' },
  sparkleDecor: { alignSelf: 'flex-end', marginRight: 28, marginTop: 8 },
});
