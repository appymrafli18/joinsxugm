import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { SparkleIcon } from '@/components/common/Icon';
import { COLORS, ARCHETYPE_COLORS, type ArchetypeId } from '@/constants/colors';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';
import { Spinner } from '@/components/ui/Spinner';
import { saveArchetype, saveScreeningFromStorage } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

const archetypes: { id: ArchetypeId; name: string; tagline: string; image: number }[] = [
  { id: 'guardian', name: 'The Guardian', tagline: 'Selalu siaga, selalu ada.', image: require('@/assets/images/raster/arkatipe_guardian.png') },
  { id: 'healer', name: 'The Healer', tagline: 'Lembut, hangat, menenangkan.', image: require('@/assets/images/raster/arkatipe_healer.png') },
  { id: 'scholar', name: 'The Scholar', tagline: 'Berpikir jernih, melihat lebih jauh.', image: require('@/assets/images/raster/arkatipe_scholar.png') },
  { id: 'companion', name: 'The Companion', tagline: 'Berpikir jernih, melihat lebih jauh.', image: require('@/assets/images/raster/arkatipe_companion.png') },
];

/** Badge perisai sesuai desain: perisai penuh warna arketipe + emblem hati putih. */
function ShieldIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2.2 19.4 4.9c.35.13.6.45.6.81V11.4c0 4.9-3.15 8.55-8 10.85C7.15 19.95 4 16.3 4 11.4V5.71c0-.36.25-.68.6-.81L12 2.2z" />
      <Path
        d="M12 7.6c.9-1.6 3.2-1.5 3.9.1.6 1.4-.4 3-1.9 4.3L12 14.4l-2-2.4C8.5 10.7 7.5 9.1 8.1 7.7c.7-1.6 3-1.7 3.9-.1z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

export default function ArchetypeScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<ArchetypeId | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didSave = useRef(false);

  /* Guard: redirect ke /login kalau belum ada sesi */
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) router.replace('/login');
      else setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  /* Saat mount: coba simpan screening yang belum tersimpan */
  useEffect(() => {
    if (ready && !didSave.current) {
      didSave.current = true;
      void saveScreeningFromStorage();
    }
  }, [ready]);

  if (!ready) {
    return <View style={styles.loading}><Spinner /></View>;
  }

  const confirm = async () => {
    if (!selected || loading) return;
    setLoading(true);
    setError(null);
    const ok = await saveArchetype(selected);
    if (ok) router.replace('/beranda');
    else {
      setError('Gagal menyimpan pilihanmu. Coba lagi ya.');
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: Math.max(40, insets.top),
        paddingBottom: Math.max(24, insets.bottom + 24),
      }}
    >
      {/* Blur blobs dekoratif — ungu kiri-atas/bawah, krem/peach kanan-atas/bawah */}
      <View aria-hidden style={styles.blobTopLeft} />
      <View aria-hidden style={styles.blobTopRight} />
      <View aria-hidden style={styles.blobBottomLeft} />
      <View aria-hidden style={styles.blobBottomRight} />

      {/* Header + sparkle di kiri judul (sesuai desain) */}
      <View style={styles.headerWrap}>
        <View style={styles.sparkleTitleLeft}>
          <SparkleIcon size={22} />
        </View>
        <View style={styles.sparkleTitleLeftSmall}>
          <SparkleIcon size={14} />
        </View>
        <View style={styles.sparkleTopRight}>
          <SparkleIcon size={16} />
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>Pilih Wujud Pendampingmu</Text>
          <Text style={styles.subtitle}>Kamu bisa menggantinya kapan saja nanti</Text>
        </View>
      </View>

      {/* Grid arketipe 2×2 */}
      <View style={styles.grid}>
        {archetypes.map((arch) => {
          const active = selected === arch.id;
          const color = ARCHETYPE_COLORS[arch.id];
          return (
            <Pressable
              key={arch.id}
              onPress={() => {
                setSelected(arch.id);
                setError(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${arch.name} — ${arch.tagline}`}
              style={[
                styles.card,
                { backgroundColor: color.card },
                active && {
                  borderColor: COLORS.sparkle,
                  shadowColor: COLORS.sparkle,
                  shadowOpacity: 0.45,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                },
              ]}
            >
              <Image source={arch.image} contentFit="cover" style={styles.cardImage} />
              {/* Strip label putih */}
              <View style={styles.label}>
                <View style={styles.labelRow}>
                  <ShieldIcon color={color.main} size={20} />
                  <Text style={styles.cardName} numberOfLines={1}>{arch.name}</Text>
                </View>
                <Text style={styles.cardTagline}>{arch.tagline}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Error */}
      <View style={styles.errorWrap} accessibilityLiveRegion="polite">
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {/* CTA */}
      <Pressable
        disabled={!selected || loading}
        onPress={confirm}
        style={[styles.button, !selected && styles.buttonDisabled]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{loading ? 'Menyimpan...' : 'Lanjutkan →'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.base },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.base },
  /* Blob latar */
  blobTopLeft: { position: 'absolute', left: -70, top: -20, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(155,130,196,0.14)' },
  blobTopRight: { position: 'absolute', right: -60, top: -40, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(245,217,166,0.35)' },
  blobBottomLeft: { position: 'absolute', left: -80, bottom: 40, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(155,130,196,0.10)' },
  blobBottomRight: { position: 'absolute', right: -70, bottom: -30, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(240,168,104,0.14)' },
  /* Header */
  headerWrap: { position: 'relative' },
  sparkleTitleLeft: { position: 'absolute', left: 26, top: 2, zIndex: 2 },
  sparkleTitleLeftSmall: { position: 'absolute', left: 52, top: -8, zIndex: 2 },
  sparkleTopRight: { position: 'absolute', right: 30, top: -4, zIndex: 2 },
  header: { alignItems: 'center', paddingHorizontal: 32 },
  title: { fontFamily: FONT, fontSize: 22, lineHeight: 30, color: COLORS.text, textAlign: 'center' },
  subtitle: { fontFamily: FONT, fontSize: 11, color: 'rgba(59,46,74,0.7)', marginTop: 8, textAlign: 'center' },
  /* Grid & kartu */
  grid: { marginTop: 26, paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' },
  card: {
    width: '47.5%',
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    ...SHADOW.float,
  },
  cardImage: { width: '100%', aspectRatio: 1 },
  label: { backgroundColor: COLORS.white, paddingHorizontal: 10, paddingVertical: 10, gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardName: { fontFamily: FONT, fontSize: 12, color: COLORS.text, flexShrink: 1 },
  cardTagline: { fontFamily: FONT, fontSize: 9, lineHeight: 13, color: 'rgba(59,46,74,0.55)' },
  /* Error */
  errorWrap: { paddingHorizontal: 24 },
  error: {
    marginTop: 16,
    backgroundColor: COLORS.healerCard,
    color: COLORS.error,
    borderRadius: RADIUS.card,
    padding: 12,
    textAlign: 'center',
    fontFamily: FONT,
    fontSize: 11,
  },
  /* CTA */
  button: {
    marginHorizontal: 24,
    marginTop: 28,
    height: 54,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.cta,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.cta,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: FONT, fontSize: 16, color: COLORS.white },
});
