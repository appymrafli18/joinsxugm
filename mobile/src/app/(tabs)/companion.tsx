import { Image } from 'expo-image';
import { router } from 'expo-router';
import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
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

import {
  ArrowIcon,
  ChevronLeftIcon,
  MicIcon,
  SparkleIcon,
  SpeakerIcon,
  SpeakerOffIcon,
} from '@/components/common/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS, ARCHETYPE_COLORS, type ArchetypeId } from '@/constants/colors';
import { EXPRESSION_POSES } from '@/constants/poses';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';
import {
  fetchChatHistory,
  sendCompanionMessage,
  type ChatMessage,
  type Expression,
} from '@/lib/companion';
import { ensureSttPermission, getSpeechRecognition } from '@/lib/stt';
import { supabase } from '@/lib/supabase';

const ARCHETYPE_IMAGES: Record<ArchetypeId, number> = {
  guardian: require('@/assets/images/raster/arkatipe_guardian.png'),
  healer: require('@/assets/images/raster/arkatipe_healer.png'),
  scholar: require('@/assets/images/raster/arkatipe_scholar.png'),
  companion: require('@/assets/images/raster/arkatipe_companion.png'),
};

const EXPRESSION_META: Record<Expression, { label: string; color: string }> = {
  netral: { label: 'netral', color: COLORS.guardian },
  senang: { label: 'senang', color: COLORS.sage },
  khawatir: { label: 'khawatir', color: COLORS.terracotta },
};

/** Tiga titik beranimasi saat Companion menyusun balasan. */
function TypingIndicator() {
  const [dots] = useState(() => [
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
  ]);

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - index) * 160),
        ]),
      ),
    );
    animations.forEach((animation) => animation.start());
    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [dots]);

  return (
    <View style={styles.typingRow} accessibilityLabel="Companion sedang mengetik">
      {dots.map((dot, index) => (
        <Animated.View key={index} style={[styles.typingDot, { opacity: dot }]} />
      ))}
    </View>
  );
}

export default function CompanionScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const localIdRef = useRef(0);
  const forceRedirectRef = useRef(false);
  const keepSpeakingRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ready, setReady] = useState(false);
  const [archetypeId, setArchetypeId] = useState<ArchetypeId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [inputHint, setInputHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [expression, setExpression] = useState<Expression>('netral');
  const [crisis, setCrisis] = useState<{ onCall: boolean; escalated: boolean } | null>(null);
  const [tier, setTier] = useState<'low' | 'medium' | 'high' | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  /* Guard sesi + ambil arketipe pasien */
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
        .select('archetype_id, tier')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!patient?.archetype_id) {
        router.replace('/pilih-arketipe');
        return;
      }
      setArchetypeId(patient.archetype_id as ArchetypeId);
      // Tier TIDAK ditampilkan sebagai angka (PRD Bagian 6 poin 3) —
      // hanya dipakai untuk ajakan natural ke psikolog.
      if (patient.tier === 'medium' || patient.tier === 'high') setTier(patient.tier);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Muat riwayat percakapan */
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void fetchChatHistory().then((history) => {
      if (cancelled) return;
      setMessages(history);
      // Subtitle menampilkan balasan terakhir (tanpa TTS saat mount)
      const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant) {
        setSubtitle(lastAssistant.content);
        if (lastAssistant.expression) setExpression(lastAssistant.expression);
        if (lastAssistant.flagged) setCrisis({ onCall: false, escalated: false });
      }
      setHistoryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  /* Auto-scroll ke pesan terbaru */
  useEffect(() => {
    const timer = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      80,
    );
    return () => clearTimeout(timer);
  }, [messages.length, sending]);

  /* TTS: konfigurasi audio session agar suara tetap terdengar walaupun
     iPhone dalam mode silent (docs expo-speech: tanpa ini, silent mode
     mematikan suara pada device fisik). */
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => {
      if (redirectTimerRef.current !== null) clearTimeout(redirectTimerRef.current);
      // Saat redirect krisis, suara sengaja dibiarkan menuntun di layar berikutnya.
      if (!keepSpeakingRef.current) void Speech.stop();
    };
  }, []);

  /* STT: dengarkan hasil transkripsi untuk mengisi input (bisa diedit). */
  useEffect(() => {
    const module = getSpeechRecognition();
    if (!module) return;
    const showHint = (message: string) => {
      setInputHint(message);
      setTimeout(() => setInputHint(null), 3200);
    };
    const resultSub = module.ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const transcript = event.results?.[0]?.transcript ?? '';
      if (transcript) setInput(transcript);
    });
    const endSub = module.ExpoSpeechRecognitionModule.addListener('end', () => setListening(false));
    const errorSub = module.ExpoSpeechRecognitionModule.addListener('error', (event) => {
      setListening(false);
      showHint(`Input suara gagal: ${event.error ?? 'tidak diketahui'}.`);
    });
    return () => {
      resultSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, []);

  function toggleListening() {
    const module = getSpeechRecognition();
    if (!module) {
      setInputHint('Input suara memerlukan development build (tidak tersedia di Expo Go).');
      setTimeout(() => setInputHint(null), 3200);
      return;
    }
    if (listening) {
      module.ExpoSpeechRecognitionModule.stop();
      setListening(false);
      return;
    }
    void (async () => {
      const granted = await ensureSttPermission();
      if (!granted) {
        setInputHint('Izin mikrofon/pengenalan suara belum diberikan.');
        setTimeout(() => setInputHint(null), 3200);
        return;
      }
      setInputHint(null);
      try {
        module.ExpoSpeechRecognitionModule.start({ lang: 'id-ID', interimResults: true, continuous: false });
        setListening(true);
      } catch {
        setInputHint('Perekam suara tidak bisa dimulai di perangkat ini.');
        setTimeout(() => setInputHint(null), 3200);
      }
    })();
  }

  async function handleSend() {
    const message = input.trim();
    if (!message || sending || !archetypeId) return;

    const optimistic: ChatMessage = {
      id: `local-${(localIdRef.current += 1)}`,
      role: 'user',
      content: message,
    };
    setMessages((current) => [...current, optimistic]);
    setInput('');
    setError(null);
    setSending(true);

    const result = await sendCompanionMessage(archetypeId, message);
    setSending(false);

    if (!result.ok) {
      setError(result.message);
      setInput(message); // kembalikan pesan supaya bisa dikirim ulang
      return;
    }

    const { reply, flagged, expression: replyExpression, onCall, escalated, crisisContact } = result.data;
    setExpression(replyExpression);
    setSubtitle(reply);
    if (flagged) {
      setCrisis({ onCall, escalated });
      /* Kondisi "khawatir" → redirect paksa ke psikolog yang dipilih server
         (acak, on-call diutamakan). Jeda singkat supaya balasan & suara
         sempat menenangkan dulu; percakapan tetap tersimpan. */
      if (crisisContact && !forceRedirectRef.current) {
        forceRedirectRef.current = true;
        keepSpeakingRef.current = true;
        redirectTimerRef.current = setTimeout(() => {
          router.push(`/psikolog/${crisisContact.id}?krisis=1` as never);
        }, 1200);
      }
    }
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${(localIdRef.current += 1)}`,
        role: 'assistant',
        content: reply,
        expression: replyExpression,
        flagged,
      },
    ]);
    if (!muted) {
      speakReply(reply);
    }
  }

  /** Bacakan balasan; indikator & pesan error ditampilkan bila gagal. */
  function speakReply(text: string) {
    setSpeechError(null);
    void Speech.stop().then(() => {
      Speech.speak(text, {
        language: 'id-ID',
        onStart: () => setSpeaking(true),
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => {
          setSpeaking(false);
          setSpeechError('Suara tidak dapat diputar di perangkat ini. Teksnya tetap tampil ya.');
        },
      });
    });
  }

  function toggleMute() {
    if (!muted) {
      void Speech.stop();
      setSpeaking(false);
    }
    setMuted((value) => !value);
  }

  if (!ready || historyLoading) {
    return (
      <View style={styles.loadingRoot}>
        <Spinner />
      </View>
    );
  }

  const expressionMeta = EXPRESSION_META[expression];
  const archetypeColor = archetypeId ? ARCHETYPE_COLORS[archetypeId] : null;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(12, insets.top) }]}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/beranda' as never);
          }}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
        >
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Companion</Text>
        <Pressable
          onPress={toggleMute}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Nyalakan suara' : 'Matikan suara'}
          accessibilityState={{ checked: !muted }}
        >
          {muted ? <SpeakerOffIcon color="rgba(59,46,74,0.55)" /> : <SpeakerIcon />}
        </Pressable>
      </View>

      {/* Avatar besar — fokus utama layar */}
      <View style={styles.avatarBlock}>
        {archetypeId && (
          <Image
            source={EXPRESSION_POSES[archetypeId]?.[expression] ?? ARCHETYPE_IMAGES[archetypeId]}
            contentFit="contain"
            transition={250}
            style={styles.avatar}
            accessibilityLabel={`Avatar ${archetypeId}`}
          />
        )}

        {/* Badge ekspresi (pose 3-ekspresi menyusul — placeholder teks) */}
        <View style={[styles.expressionPill, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
          <View style={[styles.expressionDot, { backgroundColor: expressionMeta.color }]} />
          <Text style={styles.expressionText}>{expressionMeta.label}</Text>
        </View>

        {/* Subtitle melayang di bawah avatar */}
        {subtitle ? (
          <View
            style={[
              styles.subtitleBubble,
              archetypeColor ? { borderColor: `${archetypeColor.main}55` } : null,
            ]}
          >
            <Text style={styles.subtitleText} numberOfLines={4} ellipsizeMode="tail">
              {subtitle}
            </Text>
            <View style={styles.bubbleFooter}>
              {speaking ? (
                <View style={styles.speakingRow}>
                  <SpeakerIcon size={13} color={COLORS.guardian} />
                  <Text style={styles.speakingText}>sedang berbicara…</Text>
                </View>
              ) : (
                <View style={styles.flexSpacer} />
              )}
              <Pressable
                onPress={() => speakReply(subtitle)}
                style={styles.replayBtn}
                accessibilityRole="button"
                accessibilityLabel="Putar ulang suara balasan"
                hitSlop={6}
              >
                <SpeakerIcon size={14} color={COLORS.white} />
              </Pressable>
            </View>
          </View>
        ) : null}
        {speechError ? <Text style={styles.speechErrorText}>{speechError}</Text> : null}
      </View>

      {/* Ajakan natural ke psikolog saat tier medium/high (PRD Bagian 6 poin 3).
          Tier tidak pernah ditampilkan sebagai angka. */}
      {tier && !nudgeDismissed ? (
        <View style={styles.nudgeCard}>
          <Text style={styles.nudgeText}>
            Kalau kamu siap, psikolog kami bisa membantumu lebih dalam — kapan pun.
          </Text>
          <View style={styles.nudgeRow}>
            <Pressable
              onPress={() => router.push('/psikolog' as never)}
              style={styles.nudgeBtn}
              accessibilityRole="button"
            >
              <Text style={styles.nudgeBtnText}>Lihat Psikolog</Text>
            </Pressable>
            <Pressable onPress={() => setNudgeDismissed(true)} style={styles.nudgeDismiss} accessibilityRole="button">
              <Text style={styles.nudgeDismissText}>Nanti</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Riwayat chat — pendukung, lebih kecil di bawah */}
      <ScrollView
        ref={scrollRef}
        style={styles.history}
        contentContainerStyle={styles.historyContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && !sending ? (
          <View style={styles.emptyState}>
            <SparkleIcon size={22} />
            <Text style={styles.emptyText}>
              Mulai cerita, aku di sini untuk mendengarkan.
            </Text>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.bubble,
                message.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
            >
              <Text style={styles.bubbleText}>{message.content}</Text>
            </View>
          ))
        )}
        {sending ? (
          <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
            <TypingIndicator />
          </View>
        ) : null}
      </ScrollView>

      {/* Banner krisis — teks menyesuaikan apa yang BENAR-BENAR tersedia
          (on-call aktif / belum ada respons / eskalasi SLA). */}
      {crisis ? (
        <View style={styles.crisisBanner}>
          <Text style={styles.crisisText}>
            {crisis.escalated
              ? 'Kami belum mendapat konfirmasi dari psikolog on-call. Tolong hubungi kontak daruratmu atau layanan gawat darurat 119 sekarang.'
              : crisis.onCall
                ? 'Kamu tidak sendirian. Peringatan sudah masuk ke sistem psikolog on-call kami — mereka akan meninjau sesegera mungkin. Kalau darurat, hubungi kontak daruratmu atau 119.'
                : 'Kamu tidak sendirian, dan ceritamu sudah tercatat untuk ditinjau tim psikolog. Kalau kondisimu darurat, segera hubungi kontak daruratmu atau layanan gawat darurat 119.'}
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {inputHint ? <Text style={styles.inputHint}>{inputHint}</Text> : null}

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Tulis pesanmu..."
          placeholderTextColor="rgba(59,46,74,0.35)"
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={toggleListening}
          style={[styles.micBtn, listening && styles.micBtnActive]}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Hentikan input suara' : 'Input suara (bicara lalu edit teksnya)'}
        >
          <MicIcon size={19} color={listening ? COLORS.white : COLORS.guardian} />
        </Pressable>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.base },
  loadingRoot: { flex: 1, backgroundColor: COLORS.base, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONT, fontSize: 17, color: COLORS.text },
  /* Avatar */
  avatarBlock: {
    height: '38%',
    marginHorizontal: 16,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.guardianCard,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    ...SHADOW.float,
  },
  avatar: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  expressionPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  expressionDot: { width: 8, height: 8, borderRadius: 4 },
  expressionText: { fontFamily: FONT, fontSize: 10, color: COLORS.text },
  subtitleBubble: {
    margin: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.card,
    borderTopLeftRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    ...SHADOW.float,
  },
  subtitleText: { fontFamily: FONT, fontSize: 12, lineHeight: 18, color: COLORS.text },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  flexSpacer: { flex: 1 },
  speakingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  speakingText: { fontFamily: FONT, fontSize: 9, color: COLORS.guardian },
  replayBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.cta,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.cta,
  },
  speechErrorText: {
    marginHorizontal: 16,
    marginTop: 6,
    fontFamily: FONT,
    fontSize: 10,
    lineHeight: 15,
    color: COLORS.errorRing,
    textAlign: 'center',
  },
  /* Riwayat */
  history: { flex: 1, marginTop: 12 },
  historyContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  emptyState: { alignItems: 'center', gap: 8, paddingTop: 24 },
  emptyText: { fontFamily: FONT, fontSize: 12, color: 'rgba(59,46,74,0.55)', textAlign: 'center' },
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(227,119,155,0.14)',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    ...SHADOW.float,
  },
  bubbleText: { fontFamily: FONT, fontSize: 12, lineHeight: 18, color: COLORS.text },
  typingBubble: { paddingVertical: 12 },
  typingRow: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(59,46,74,0.45)' },
  /* Ajakan tier (nudge) */
  nudgeCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.guardianCard,
    gap: 8,
  },
  nudgeText: { fontFamily: FONT, fontSize: 11, lineHeight: 17, color: COLORS.text },
  nudgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nudgeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.cta,
  },
  nudgeBtnText: { fontFamily: FONT, fontSize: 10, color: COLORS.white },
  nudgeDismiss: { paddingHorizontal: 10, paddingVertical: 8 },
  nudgeDismissText: { fontFamily: FONT, fontSize: 10, color: 'rgba(59,46,74,0.55)' },
  /* Krisis */
  crisisBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: RADIUS.card,
    backgroundColor: 'rgba(193,69,59,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(193,69,59,0.35)',
  },
  crisisText: { fontFamily: FONT, fontSize: 11, lineHeight: 17, color: '#8F322B' },
  errorText: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontFamily: FONT,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.errorRing,
    textAlign: 'center',
  },
  /* Input */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(155,130,196,0.15)',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.pill,
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.text,
    ...SHADOW.float,
  },
  inputHint: {
    marginHorizontal: 16,
    marginBottom: 6,
    fontFamily: FONT,
    fontSize: 10,
    lineHeight: 15,
    color: '#7B65A8',
    textAlign: 'center',
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.float,
  },
  micBtnActive: { backgroundColor: COLORS.guardian },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.cta,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.cta,
  },
  sendDisabled: { opacity: 0.4 },
});
