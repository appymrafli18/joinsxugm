import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ComponentType } from 'react';
import { NativeModules, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon } from '@/components/common/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/constants/colors';
import { FONT, RADIUS } from '@/constants/theme';
import { fetchCallToken, type CallSession } from '@/lib/calls';
import { supabase } from '@/lib/supabase';

/**
 * Layar sesi psikolog manusia (LiveKit):
 * - mode 'voice' → avatar 2D statis psikolog (gambar), audio dari psikolog asli
 * - mode 'video' → video psikolog asli (tanpa avatar)
 *
 * Modul LiveKit butuh development build; di Expo Go layar ini menampilkan
 * penjelasan singkat tanpa membuat aplikasi crash.
 */

type CallRoomProps = {
  url: string;
  token: string;
  mode: 'voice' | 'video';
  psychologist: { nickname: string | null; avatar_url: string | null };
  onLeave: () => void;
};

let CallRoomComponent: ComponentType<CallRoomProps> | null = null;
/* Cek modul native WebRTC dulu — paket LiveKit melempar error saat import
   bila modul tidak ada (Expo Go), dan error itu tercatat besar di Metro. */
const hasNativeWebRTC = Boolean(NativeModules?.WebRTCModule);
if (hasNativeWebRTC) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    CallRoomComponent = (require('@/components/call/CallRoom') as { CallRoom: ComponentType<CallRoomProps> }).CallRoom;
  } catch {
    CallRoomComponent = null;
  }
}

export default function SesiScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported' | 'error'>(
    CallRoomComponent ? 'loading' : 'unsupported',
  );
  const [call, setCall] = useState<CallSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!CallRoomComponent) return;
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        router.replace('/login');
        return;
      }
      const result = await fetchCallToken(String(bookingId ?? ''));
      if (!active) return;
      if (!result.ok) {
        setError(result.message);
        setState('error');
        return;
      }
      setCall(result.data);
      setState('ready');
    })();
    return () => {
      active = false;
    };
  }, [bookingId]);

  function leave() {
    router.back();
  }

  if (state === 'ready' && call && CallRoomComponent) {
    const Room = CallRoomComponent;
    return (
      <View style={{ flex: 1 }}>
        <Room
          url={call.url}
          token={call.token}
          mode={call.mode}
          psychologist={call.psychologist}
          onLeave={leave}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: Math.max(12, insets.top) }]}>
      <View style={styles.header}>
        <Pressable onPress={leave} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Kembali">
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Sesi Konsultasi</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.center}>
        {state === 'loading' ? <Spinner /> : null}
        {state === 'unsupported' ? (
          <>
            <Text style={styles.title}>Butuh development build</Text>
            <Text style={styles.body}>
              Panggilan suara/video memakai modul native dan tidak berjalan di
              Expo Go. Buat development build (mis. `npx expo run:ios` atau EAS
              build) untuk memakai fitur ini — sisa aplikasi tetap berjalan biasa.
            </Text>
          </>
        ) : null}
        {state === 'error' ? (
          <>
            <Text style={styles.title}>Belum bisa menyambung</Text>
            <Text style={styles.body}>{error}</Text>
            <Pressable onPress={leave} style={styles.backLink}>
              <Text style={styles.backLinkText}>Kembali</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.base },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONT, fontSize: 16, color: COLORS.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  title: { fontFamily: FONT, fontSize: 18, color: COLORS.text, textAlign: 'center' },
  body: { fontFamily: FONT, fontSize: 12, lineHeight: 19, color: 'rgba(59,46,74,0.7)', textAlign: 'center' },
  backLink: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: COLORS.guardianCard },
  backLinkText: { fontFamily: FONT, fontSize: 12, color: COLORS.guardian },
});
