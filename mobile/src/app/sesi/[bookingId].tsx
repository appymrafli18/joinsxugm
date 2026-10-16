import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  KeyboardAvoidingView,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowIcon, ChevronLeftIcon, SpeakerIcon, VideoIcon } from '@/components/common/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/constants/colors';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';
import { fetchCallLink, fetchCallToken, type CallSession } from '@/lib/calls';
import {
  fetchSession,
  fetchSessionMessages,
  notifySessionOpen,
  sendSessionMessage,
  subscribeSessionMessages,
  type SessionBootstrap,
  type SessionMessage,
} from '@/lib/session';
import { supabase } from '@/lib/supabase';

/**
 * Layar sesi konsultasi pasien <-> psikolog:
 * - Chat teks (jalan di Expo Go).
 * - Panggilan suara/video LiveKit (butuh development build; di Expo Go
 *   menampilkan penjelasan tanpa crash).
 *
 * Data sesi dari `/api/session`; pesan dari Supabase (`session_messages`).
 */

type CallRoomProps = {
  url: string;
  token: string;
  mode: 'voice' | 'video';
  psychologist: { nickname: string | null; avatar_url: string | null };
  onLeave: () => void;
};

let CallRoomComponent: ComponentType<CallRoomProps> | null = null;
const hasNativeWebRTC = Boolean(NativeModules?.WebRTCModule);
if (hasNativeWebRTC) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    CallRoomComponent = (require('@/components/call/CallRoom') as { CallRoom: ComponentType<CallRoomProps> }).CallRoom;
  } catch {
    CallRoomComponent = null;
  }
}

const POLL_MS = 5000;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function SesiScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<'chat' | 'call'>('chat');
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [call, setCall] = useState<CallSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [openingLink, setOpeningLink] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [notified, setNotified] = useState(false);

  /* Bootstrap sesi */
  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        router.replace('/login');
        return;
      }
      const result = await fetchSession(String(bookingId));
      if (!active) return;
      if (!result.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }
      setSession(result.data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [bookingId]);

  /* Kabari psikolog saat pasien membuka ruang sesi (sekali per kunjungan). */
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!session || session.role !== 'patient' || notifiedRef.current) return;
    notifiedRef.current = true;
    void notifySessionOpen(String(bookingId)).then(() => setNotified(true));
  }, [session, bookingId]);

  /* Chat: muat + realtime + polling */
  useEffect(() => {
    if (!session || !bookingId) return;
    let active = true;
    const reload = () => {
      void fetchSessionMessages(String(bookingId)).then((list) => {
        if (active) setMessages(list);
      });
    };
    reload();
    const unsubscribe = subscribeSessionMessages(String(bookingId), (message) => {
      if (!active) return;
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
    });
    const poll = setInterval(reload, POLL_MS);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(poll);
    };
  }, [session, bookingId]);

  useEffect(() => {
    if (tab !== 'chat') return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages.length, tab, sending]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setChatError(null);
    const result = await sendSessionMessage(String(bookingId), content);
    setSending(false);
    if (!result.ok) {
      setChatError(result.message);
      return;
    }
    setInput('');
    const list = await fetchSessionMessages(String(bookingId));
    setMessages(list);
  }

  async function startCall() {
    if (connecting || call) return;
    setConnecting(true);
    setCallError(null);
    const result = await fetchCallToken(String(bookingId));
    setConnecting(false);
    if (!result.ok) {
      setCallError(result.message);
      return;
    }
    setCall(result.data);
  }

  /* Buka panggilan di browser — jalur yang berfungsi di Expo Go. */
  async function openInBrowser() {
    if (openingLink) return;
    setOpeningLink(true);
    setCallError(null);
    const result = await fetchCallLink(String(bookingId));
    setOpeningLink(false);
    if (!result.ok) {
      setCallError(result.message);
      return;
    }
    await WebBrowser.openBrowserAsync(result.joinUrl);
  }

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <Spinner />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(12, insets.top) }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Kembali">
            <ChevronLeftIcon />
          </Pressable>
          <Text style={styles.headerTitle}>Sesi</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Belum bisa menyambung</Text>
          <Text style={styles.errorBody}>{error ?? 'Sesi tidak ditemukan.'}</Text>
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Kembali</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* Panggilan aktif → tampilkan CallRoom penuh layar */
  if (call && CallRoomComponent) {
    const Room = CallRoomComponent;
    return (
      <View style={{ flex: 1 }}>
        <Room
          url={call.url}
          token={call.token}
          mode={call.mode}
          psychologist={call.psychologist}
          onLeave={() => setCall(null)}
        />
      </View>
    );
  }

  const { counterpart, canCall, callMode, canChat } = session;
  const isVoice = callMode === 'voice';
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(12, insets.top) }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Kembali">
          <ChevronLeftIcon />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{counterpart.name}</Text>
          <Text style={styles.headerMeta}>
            {isVoice ? 'Sesi suara' : 'Sesi video'} · {session.role === 'patient' ? 'psikolog asli' : 'pasien'}
          </Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Tab */}
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab('chat')} style={[styles.tab, tab === 'chat' && styles.tabActive]}>
          <Text style={[styles.tabText, tab === 'chat' && styles.tabTextActive]}>Chat</Text>
        </Pressable>
        <Pressable onPress={() => setTab('call')} style={[styles.tab, tab === 'call' && styles.tabActive]}>
          <Text style={[styles.tabText, tab === 'call' && styles.tabTextActive]}>Panggilan</Text>
        </Pressable>
      </View>

      {tab === 'chat' ? (
        <>
          {notified ? (
            <Text style={styles.notifiedHint}>
              {counterpart.name} sudah diberi tahu bahwa kamu ada di ruang sesi.
            </Text>
          ) : null}
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              <Text style={styles.emptyText}>
                Belum ada pesan. Mulai dengan sapaan — pesan ini hanya antara kamu
                dan {counterpart.name}.
              </Text>
            ) : (
              messages.map((m) => {
                const mine = m.sender_role === 'patient';
                return (
                  <View key={m.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.content}</Text>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{formatTime(m.created_at)}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          {chatError ? <Text style={styles.chatError}>{chatError}</Text> : null}

          {canChat ? (
            <View style={[styles.inputBar, { paddingBottom: Math.max(10, insets.bottom) }]}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder={`Tulis pesan untuk ${counterpart.name}...`}
                placeholderTextColor="rgba(59,46,74,0.35)"
                multiline
                maxLength={2000}
              />
              <Pressable
                onPress={handleSend}
                disabled={!input.trim() || sending}
                style={[styles.sendBtn, (!input.trim() || sending) && styles.sendDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Kirim pesan"
              >
                <ArrowIcon />
              </Pressable>
            </View>
          ) : (
            <Text style={styles.closedNote}>Sesi ini sudah dibatalkan.</Text>
          )}
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.callTab}>
          <View style={styles.callCard}>
            {counterpart.avatar_url ? (
              <Image source={{ uri: counterpart.avatar_url }} contentFit="cover" style={styles.callAvatar} />
            ) : (
              <View style={styles.callAvatarWrap}>
                <Text style={styles.callAvatarInitial}>{counterpart.name.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.callName}>{counterpart.name}</Text>
            <Text style={styles.callHint}>
              {isVoice
                ? 'Panggilan suara — kamu mendengar suara psikolog asli, menemani lewat avatarnya.'
                : 'Panggilan video — kamu melihat psikolog asli secara langsung.'}
            </Text>

            {!canCall ? (
              <Text style={styles.callUnsupported}>
                Sesi belum dikonfirmasi psikolog. Chat tetap bisa dipakai; panggilan
                aktif setelah sesi dikonfirmasi.
              </Text>
            ) : (
              <>
                {CallRoomComponent ? (
                  <Pressable onPress={startCall} disabled={connecting} style={[styles.callBtn, connecting && styles.sendDisabled]}>
                    {isVoice ? <SpeakerIcon color={COLORS.white} /> : <VideoIcon color={COLORS.white} />}
                    <Text style={styles.callBtnText}>
                      {connecting ? 'Menyambungkan...' : isVoice ? 'Mulai Panggilan Suara' : 'Mulai Panggilan Video'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.callUnsupported}>
                    Panggilan dalam aplikasi butuh development build (modul native
                    WebRTC tidak tersedia di Expo Go). Sebagai gantinya, buka
                    panggilan lewat browser di bawah ini.
                  </Text>
                )}
                <Pressable
                  onPress={openInBrowser}
                  disabled={openingLink}
                  style={[styles.callBtnAlt, openingLink && styles.sendDisabled]}
                >
                  <Text style={styles.callBtnAltText}>
                    {openingLink ? 'Menyiapkan tautan...' : 'Buka Panggilan di Browser'}
                  </Text>
                </Pressable>
              </>
            )}

            {callError ? <Text style={styles.callError}>{callError}</Text> : null}
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.base },
  loadingRoot: { flex: 1, backgroundColor: COLORS.base, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 6 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontFamily: FONT, fontSize: 16, color: COLORS.text },
  headerMeta: { fontFamily: FONT, fontSize: 10, color: 'rgba(59,46,74,0.55)', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  errorTitle: { fontFamily: FONT, fontSize: 18, color: COLORS.text, textAlign: 'center' },
  errorBody: { fontFamily: FONT, fontSize: 12, lineHeight: 19, color: 'rgba(59,46,74,0.7)', textAlign: 'center' },
  backLink: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: COLORS.guardianCard },
  backLinkText: { fontFamily: FONT, fontSize: 12, color: COLORS.guardian },
  /* Tabs */
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tab: { flex: 1, height: 40, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, ...SHADOW.float },
  tabActive: { backgroundColor: COLORS.cta },
  tabText: { fontFamily: FONT, fontSize: 12, color: COLORS.text },
  tabTextActive: { color: COLORS.white },
  /* Chat */
  chatScroll: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  notifiedHint: {
    fontFamily: FONT,
    fontSize: 10,
    lineHeight: 15,
    color: '#4F7A57',
    backgroundColor: 'rgba(156,175,136,0.16)',
    borderRadius: RADIUS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: { fontFamily: FONT, fontSize: 11, lineHeight: 17, color: 'rgba(59,46,74,0.55)', textAlign: 'center', marginTop: 24, paddingHorizontal: 12 },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: COLORS.cta, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: COLORS.white, borderBottomLeftRadius: 4, ...SHADOW.float },
  bubbleText: { fontFamily: FONT, fontSize: 12, lineHeight: 18, color: COLORS.text },
  bubbleTextMine: { color: COLORS.white },
  bubbleTime: { fontFamily: FONT, fontSize: 8, color: 'rgba(59,46,74,0.4)', marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  chatError: { fontFamily: FONT, fontSize: 10, lineHeight: 15, color: COLORS.errorRing, textAlign: 'center', marginHorizontal: 16, marginBottom: 6 },
  closedNote: { fontFamily: FONT, fontSize: 11, color: 'rgba(59,46,74,0.6)', textAlign: 'center', padding: 16 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(155,130,196,0.15)' },
  input: { flex: 1, minHeight: 46, maxHeight: 120, paddingHorizontal: 18, paddingVertical: 13, backgroundColor: COLORS.white, borderRadius: RADIUS.pill, fontFamily: FONT, fontSize: 13, color: COLORS.text, ...SHADOW.float },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.cta, alignItems: 'center', justifyContent: 'center', ...SHADOW.cta },
  sendDisabled: { opacity: 0.4 },
  /* Call tab */
  callTab: { padding: 20, alignItems: 'center' },
  callCard: { width: '100%', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 22, ...SHADOW.float },
  callAvatarWrap: { width: 112, height: 112, borderRadius: 56, backgroundColor: COLORS.guardianCard, alignItems: 'center', justifyContent: 'center' },
  callAvatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: COLORS.guardianCard },
  callAvatarInitial: { fontFamily: FONT, fontSize: 44, color: COLORS.guardian },
  callName: { fontFamily: FONT, fontSize: 18, color: COLORS.text },
  callHint: { fontFamily: FONT, fontSize: 11, lineHeight: 17, color: 'rgba(59,46,74,0.7)', textAlign: 'center' },
  callUnsupported: { fontFamily: FONT, fontSize: 11, lineHeight: 17, color: '#8A6D2F', backgroundColor: 'rgba(245,217,166,0.35)', borderRadius: RADIUS.card, padding: 12, textAlign: 'center', marginTop: 4 },
  callBtn: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: 24, borderRadius: RADIUS.pill, backgroundColor: COLORS.cta, ...SHADOW.cta },
  callBtnText: { fontFamily: FONT, fontSize: 14, color: COLORS.white },
  callBtnAlt: { marginTop: 10, height: 48, paddingHorizontal: 22, borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: 'rgba(155,130,196,0.5)', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  callBtnAltText: { fontFamily: FONT, fontSize: 13, color: COLORS.guardian },
  callError: { fontFamily: FONT, fontSize: 11, color: COLORS.errorRing, textAlign: 'center', marginTop: 4 },
});
