import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronIcon, ChevronLeftIcon, HeartHandIcon, SparkleIcon } from '@/components/common/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/constants/colors';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';
import { fetchPsychologists, formatRupiah, type Psychologist } from '@/lib/psychologists';
import { supabase } from '@/lib/supabase';

/**
 * Daftar Konsultasi (marketplace psikolog berbayar) — PRD Bagian 6 poin 5.
 * Pasien memilih sendiri psikolog terverifikasi (bukan ditugaskan otomatis).
 */
export default function PsychologistListScreen() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Psychologist[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace('/login');
        return;
      }
      setReady(true);
      const result = await fetchPsychologists();
      if (cancelled) return;
      if (result.ok) setItems(result.data);
      else setError(result.message);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.centerRoot}>
        <Spinner />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: Math.max(12, insets.top),
        paddingBottom: Math.max(24, insets.bottom + 24),
      }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Kembali">
          <ChevronLeftIcon />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Bicara dengan Psikolog</Text>
          <Text style={styles.headerSubtitle}>Pilih sendiri pendampingmu</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <Spinner />
        </View>
      ) : error ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Gagal memuat</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <SparkleIcon size={22} />
          <Text style={styles.emptyTitle}>Belum ada psikolog terverifikasi</Text>
          <Text style={styles.emptyText}>
            Semua psikolog kami melalui verifikasi manual admin sebelum tampil di
            sini. Cek lagi nanti ya — atau lanjutkan misi dan kumpulkan poin untuk
            sesi gratis.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((psy) => (
            <Pressable
              key={psy.id}
              onPress={() => router.push(`/psikolog/${psy.id}` as never)}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`${psy.nickname ?? 'Psikolog'} — ${psy.specialization ?? ''}`}
            >
              {psy.avatar_url ? (
                <Image source={{ uri: psy.avatar_url }} contentFit="cover" style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <HeartHandIcon color={COLORS.guardian} size={24} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.name}>{psy.nickname ?? 'Psikolog'}</Text>
                {psy.full_name ? <Text style={styles.realName}>{psy.full_name}</Text> : null}
                {psy.education ? <Text style={styles.education}>{psy.education}</Text> : null}
                {psy.specialization ? (
                  <View style={styles.specChip}>
                    <Text style={styles.specChipText}>{psy.specialization}</Text>
                  </View>
                ) : null}
                <Text style={styles.price}>
                  {formatRupiah(psy.price_per_session)} <Text style={styles.priceUnit}>/ sesi</Text>
                </Text>
              </View>
              <ChevronIcon color="rgba(59,46,74,0.3)" />
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.base },
  centerRoot: { flex: 1, backgroundColor: COLORS.base, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 8 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONT, fontSize: 16, color: COLORS.text },
  headerSubtitle: { fontFamily: FONT, fontSize: 10, color: 'rgba(59,46,74,0.6)', marginTop: 2 },
  loadingBox: { paddingTop: 60, alignItems: 'center' },
  emptyBox: { marginTop: 40, marginHorizontal: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: FONT, fontSize: 14, color: COLORS.text, textAlign: 'center' },
  emptyText: { fontFamily: FONT, fontSize: 11, lineHeight: 17, color: 'rgba(59,46,74,0.65)', textAlign: 'center' },
  list: { paddingHorizontal: 20, gap: 14, marginTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.card,
    padding: 14,
    ...SHADOW.float,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.guardianCard },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: FONT, fontSize: 14, color: COLORS.text },
  realName: { fontFamily: FONT, fontSize: 10, color: 'rgba(59,46,74,0.7)' },
  education: { fontFamily: FONT, fontSize: 10, color: 'rgba(59,46,74,0.55)' },
  specChip: { alignSelf: 'flex-start', backgroundColor: COLORS.guardianCard, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3 },
  specChipText: { fontFamily: FONT, fontSize: 9, color: '#6E4FB5' },
  price: { fontFamily: FONT, fontSize: 12, color: COLORS.cta, marginTop: 3 },
  priceUnit: { fontFamily: FONT, fontSize: 9, color: 'rgba(59,46,74,0.5)' },
});
