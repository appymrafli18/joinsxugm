import { router, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
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

import {
  CheckIcon,
  ChevronLeftIcon,
  SparkleIcon,
  StarIcon,
} from '@/components/common/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { QUEST_THEMES } from '@/constants/questThemes';
import { COLORS } from '@/constants/colors';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';
import {
  completeQuest,
  getQuest,
  updateQuestProgress,
  QUEST_TEMPLATES,
  type QuestRow,
} from '@/lib/quests';
import { supabase } from '@/lib/supabase';

const FEELINGS = ['lega', 'senang', 'cemas', 'biasa saja', 'lelah'] as const;

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, Math.floor(totalSeconds % 60));
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function questKind(quest: QuestRow): 'timer' | 'report' | 'gps' | 'blocked' {
  if (quest.category === 'sosial') return 'report';
  if (quest.unit === 'meter' || quest.category === 'outdoor_ringan') return 'gps';
  if (quest.unit === 'menit' || quest.category === 'indoor_ringan') return 'timer';
  return 'blocked'; // outdoor sedang — butuh visualisasi rute (Fase 2)
}

/** Jarak dua koordinat (meter) — formula haversine. */
function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default function QuestExecutionScreen() {
  const { questId } = useLocalSearchParams<{ questId: string }>();
  const insets = useSafeAreaInsets();
  useKeepAwake(); // layar tetap menyala selama misi berjalan

  const [quest, setQuest] = useState<QuestRow | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ pointsAwarded: number; totalPoints: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  /* Form laporan diri (misi sosial) */
  const [who, setWho] = useState('');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('');
  const [feeling, setFeeling] = useState<string | null>(null);

  /* Tick detik untuk countdown */
  const [now, setNow] = useState(() => Date.now());
  const lastProgressMinute = useRef(0);

  /* GPS (misi outdoor ringan) */
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const lastGpsProgress = useRef(0);

  /* Guard sesi + muat quest */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace('/login');
        return;
      }
      const row = await getQuest(String(questId ?? ''));
      if (cancelled) return;
      if (!row) {
        setLoadFailed(true);
        return;
      }
      setQuest(row);
      if (row.status === 'completed') {
        setDone({ pointsAwarded: 0, totalPoints: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questId]);

  /* Interval countdown (hanya saat timer berjalan) */
  const kind = quest ? questKind(quest) : null;
  const isTimerRunning = Boolean(
    quest && kind === 'timer' && quest.status === 'active' && !done,
  );
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const startedAtMs = quest?.route_data?.startedAt ? Date.parse(quest.route_data.startedAt) : NaN;
  const targetSeconds = ((quest?.target_value ?? 10) as number) * 60;
  const elapsedSeconds = Number.isFinite(startedAtMs) ? Math.max(0, (now - startedAtMs) / 1000) : 0;
  const remainingSeconds = Math.max(0, targetSeconds - elapsedSeconds);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  /* Simpan progres tiap berganti menit (untuk tampilan Beranda) */
  useEffect(() => {
    if (!isTimerRunning || elapsedMinutes <= 0) return;
    if (elapsedMinutes === lastProgressMinute.current) return;
    lastProgressMinute.current = elapsedMinutes;
    void updateQuestProgress(String(questId), Math.min(elapsedMinutes, quest?.target_value ?? 0));
  }, [elapsedMinutes, isTimerRunning, questId, quest?.target_value]);

  /* Pelacakan GPS — aktif selama misi outdoor ringan berjalan */
  useEffect(() => {
    if (kind !== 'gps' || quest?.status !== 'active' || done) return;
    let mounted = true;
    let subscription: Location.LocationSubscription | null = null;
    let last: { lat: number; lon: number } | null = null;
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        if (status !== 'granted') {
          setGpsError('Izin lokasi dibutuhkan untuk misi ini. Aktifkan di pengaturan aplikasi.');
          return;
        }
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5 },
          (position) => {
            if (!mounted) return;
            const current = { lat: position.coords.latitude, lon: position.coords.longitude };
            if (last) {
              setDistanceMeters((value) => value + haversineMeters(last!, current));
            }
            last = current;
          },
        );
      } catch {
        if (mounted) setGpsError('Gagal mengakses GPS. Coba lagi ya.');
      }
    })();
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [kind, quest?.status, done]);

  /* Simpan progres GPS tiap kelipatan 50 m (untuk tampilan Beranda/Perjalanan) */
  useEffect(() => {
    if (kind !== 'gps' || quest?.status !== 'active') return;
    const floored = Math.floor(distanceMeters / 50) * 50;
    if (floored > 0 && floored > lastGpsProgress.current) {
      lastGpsProgress.current = floored;
      void updateQuestProgress(String(questId), Math.min(floored, quest?.target_value ?? 0));
    }
  }, [distanceMeters, kind, quest?.status, quest?.target_value, questId]);

  const handleComplete = useCallback(
    async (patch?: { socialReport?: string; feelingInput?: string; distanceMeters?: number }) => {
      if (busy) return;
      setBusy(true);
      setFormError(null);
      const result = await completeQuest(String(questId), patch);
      setBusy(false);
      if (!result.ok) {
        if (result.message.includes('Sesi')) router.replace('/login');
        else setFormError(result.message);
        return;
      }
      setDone(result.data);
      setQuest((current) => (current ? { ...current, status: 'completed' } : current));
    },
    [busy, questId],
  );

  const handleTimerComplete = useCallback(() => {
    void handleComplete();
  }, [handleComplete]);

  const handleGpsComplete = useCallback(
    (simulate = false) => {
      const target = (quest?.target_value ?? 500) as number;
      void handleComplete({ distanceMeters: simulate ? target : Math.round(distanceMeters) });
    },
    [handleComplete, distanceMeters, quest?.target_value],
  );

  const handleReportSubmit = () => {
    if (!who.trim() || !topic.trim() || !duration.trim() || !feeling) {
      setFormError('Isi semua kolom dulu ya — siapa, topik, durasi, dan perasaanmu.');
      return;
    }
    const minutes = Number(duration.replace(/\D/g, '')) || 0;
    const socialReport = `Dengan ${who.trim()} — topik: ${topic.trim()} (${minutes} menit)`;
    void handleComplete({ socialReport, feelingInput: feeling });
  };

  /* ---------- Loading / gagal muat ---------- */
  if (!quest && !loadFailed) {
    return <View style={styles.centerRoot}><Spinner /></View>;
  }
  if (loadFailed || !quest) {
    return (
      <View style={styles.centerRoot}>
        <Text style={styles.loadErrorText}>Misi tidak ditemukan atau sudah dihapus.</Text>
        <Pressable onPress={() => router.replace('/misi')} style={styles.backLink}>
          <Text style={styles.backLinkText}>Kembali ke Misi</Text>
        </Pressable>
      </View>
    );
  }

  const theme = QUEST_THEMES[quest.category];
  const template = QUEST_TEMPLATES.find((t) => t.id === quest.route_data?.templateId);
  const questDescription = template?.description ?? 'Selesaikan sesuai instruksi misi.';

  /* ---------- Tampilan selesai ---------- */
  if (done) {
    return (
      <View style={[styles.root, { paddingTop: Math.max(24, insets.top), paddingBottom: Math.max(24, insets.bottom + 16) }]}>
        <View style={styles.doneWrap}>
          <View style={styles.doneCircle}>
            <CheckIcon size={44} color={COLORS.white} />
          </View>
          <Text style={styles.doneTitle}>Misi selesai!</Text>
          <Text style={styles.doneQuest}>{quest.title}</Text>
          {done.pointsAwarded > 0 ? (
            <View style={styles.donePoints}>
              <StarIcon size={16} />
              <Text style={styles.donePointsText}>+{done.pointsAwarded} poin</Text>
            </View>
          ) : (
            <Text style={styles.donePointsMuted}>Misi ini sudah pernah diselesaikan</Text>
          )}
          <View style={styles.sparkleRow} pointerEvents="none">
            <SparkleIcon size={18} />
            <SparkleIcon size={13} />
          </View>
        </View>
        <Pressable onPress={() => router.replace('/misi')} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Kembali ke Misi</Text>
        </Pressable>
      </View>
    );
  }

  /* ---------- Header bersama ---------- */
  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Kembali">
        <ChevronLeftIcon />
      </Pressable>
      <View style={[styles.categoryChip, { backgroundColor: theme.chip }]}>
        <Text style={[styles.categoryChipText, { color: theme.chipText }]}>{quest.category.replace('_', ' ')}</Text>
      </View>
      <View style={styles.headerBtn} />
    </View>
  );

  /* ---------- Misi outdoor (GPS) — belum tersedia ---------- */
  if (kind === 'blocked') {
    return (
      <View style={[styles.root, { paddingTop: Math.max(12, insets.top) }]}>
        {header}
        <View style={styles.centerRoot}>
          <Text style={styles.title}>{quest.title}</Text>
          <Text style={styles.blockedText}>
            Misi outdoor sedang dengan visualisasi rute (ala Strava) segera
            hadir. Nantikan update berikutnya ya.
          </Text>
          <Pressable onPress={() => router.replace('/misi')} style={styles.backLink}>
            <Text style={styles.backLinkText}>Kembali ke Misi</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ---------- Timer (indoor ringan) ---------- */
  if (kind === 'timer') {
    const progressPercent = Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100));
    const finished = remainingSeconds <= 0;
    return (
      <View style={[styles.root, { paddingTop: Math.max(12, insets.top), paddingBottom: Math.max(20, insets.bottom + 12) }]}>
        {header}
        <ScrollView contentContainerStyle={styles.timerContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={styles.title}>{quest.title}</Text>
            <Text style={styles.description}>{questDescription}</Text>
            <View style={styles.pointsRow}>
              <StarIcon size={14} />
              <Text style={styles.pointsText}>+{quest.points} poin</Text>
            </View>
          </View>

          <View style={styles.timerWrap}>
            <Text style={[styles.timerText, finished && { color: COLORS.sage }]}>
              {finished ? 'Selesai!' : formatTime(remainingSeconds)}
            </Text>
            <Text style={styles.timerHint}>
              {finished
                ? 'Waktu habis — tandai misi selesai untuk mendapat poin.'
                : 'Sisa waktu · layar akan tetap menyala'}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: theme.fill }]} />
          </View>
          <Text style={styles.progressMeta}>
            {Math.min(elapsedMinutes, quest.target_value ?? 0)} / {quest.target_value ?? 10} menit
          </Text>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <Pressable
            onPress={handleTimerComplete}
            disabled={!finished || busy}
            style={[
              styles.primaryButton,
              { backgroundColor: theme.button },
              (!finished || busy) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>{busy ? 'Menyimpan...' : 'Tandai Misi Selesai'}</Text>
          </Pressable>

          {/* Tombol demo HANYA di dev build — produksi menunggu waktu sungguhan. */}
          {__DEV__ && !finished ? (
            <Pressable onPress={handleTimerComplete} disabled={busy} style={styles.demoSkip} hitSlop={8}>
              <Text style={styles.demoSkipText}>Lewati waktu (demo)</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  /* ---------- Misi outdoor (GPS jarak) ---------- */
  if (kind === 'gps') {
    const targetMeters = quest.target_value ?? 500;
    const reached = distanceMeters >= targetMeters;
    const progressPercent = Math.min(100, Math.round((distanceMeters / targetMeters) * 100));
    return (
      <View style={[styles.root, { paddingTop: Math.max(12, insets.top), paddingBottom: Math.max(20, insets.bottom + 12) }]}>
        {header}
        <ScrollView contentContainerStyle={styles.timerContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={styles.title}>{quest.title}</Text>
            <Text style={styles.description}>{questDescription}</Text>
            <View style={styles.pointsRow}>
              <StarIcon size={14} />
              <Text style={styles.pointsText}>+{quest.points} poin</Text>
            </View>
          </View>

          <View style={styles.timerWrap}>
            <Text style={[styles.timerText, reached && { color: COLORS.sage }]}>
              {Math.round(distanceMeters)} m
            </Text>
            <Text style={styles.timerHint}>
              {reached
                ? 'Target tercapai — tandai misi selesai untuk mendapat poin.'
                : `dari ${targetMeters} meter · jalan santai, kami melacak jarakmu`}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: theme.fill }]} />
          </View>
          <Text style={styles.progressMeta}>{progressPercent}%</Text>

          {gpsError ? <Text style={styles.formError}>{gpsError}</Text> : null}
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <Pressable
            onPress={() => handleGpsComplete(false)}
            disabled={!reached || busy}
            style={[
              styles.primaryButton,
              { backgroundColor: theme.button },
              (!reached || busy) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>{busy ? 'Menyimpan...' : 'Tandai Misi Selesai'}</Text>
          </Pressable>

          {__DEV__ && !reached ? (
            <Pressable onPress={() => handleGpsComplete(true)} disabled={busy} style={styles.demoSkip} hitSlop={8}>
              <Text style={styles.demoSkipText}>Simulasi target tercapai (demo)</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  /* ---------- Laporan diri (sosial) ---------- */
  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: Math.max(12, insets.top) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {header}
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={styles.title}>{quest.title}</Text>
          <Text style={styles.description}>
            {questDescription} — verifikasi lewat laporan dirimu sendiri, tanpa
            foto atau rekaman orang lain.
          </Text>
          <View style={styles.pointsRow}>
            <StarIcon size={14} />
            <Text style={styles.pointsText}>+{quest.points} poin</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Dengan siapa kamu ngobrol?</Text>
        <TextInput
          style={styles.field}
          value={who}
          onChangeText={setWho}
          placeholder="mis. teman kuliah, adik"
          placeholderTextColor="rgba(59,46,74,0.35)"
          maxLength={60}
        />

        <Text style={styles.fieldLabel}>Topik obrolan (singkat)</Text>
        <TextInput
          style={styles.field}
          value={topic}
          onChangeText={setTopic}
          placeholder="mis. tugas minggu ini"
          placeholderTextColor="rgba(59,46,74,0.35)"
          maxLength={120}
        />

        <Text style={styles.fieldLabel}>Durasi (menit)</Text>
        <TextInput
          style={styles.field}
          value={duration}
          onChangeText={(text) => setDuration(text.replace(/\D/g, ''))}
          placeholder="mis. 5"
          placeholderTextColor="rgba(59,46,74,0.35)"
          keyboardType="number-pad"
          maxLength={3}
        />

        <Text style={styles.fieldLabel}>Perasaanmu setelahnya</Text>
        <View style={styles.feelingRow}>
          {FEELINGS.map((option) => {
            const active = feeling === option;
            return (
              <Pressable
                key={option}
                onPress={() => setFeeling(option)}
                style={[
                  styles.feelingChip,
                  { backgroundColor: active ? theme.button : theme.chip },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Text style={[styles.feelingChipText, { color: active ? COLORS.white : theme.chipText }]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <Pressable
          onPress={handleReportSubmit}
          disabled={busy}
          style={[styles.primaryButton, { backgroundColor: theme.button }, busy && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>
            {busy ? 'Menyimpan...' : 'Selesaikan Misi'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.base },
  centerRoot: { flex: 1, backgroundColor: COLORS.base, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 4 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.pill },
  categoryChipText: { fontFamily: FONT, fontSize: 10 },
  card: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 6, ...SHADOW.float },
  title: { fontFamily: FONT, fontSize: 20, color: COLORS.text },
  description: { fontFamily: FONT, fontSize: 12, lineHeight: 18, color: 'rgba(59,46,74,0.75)' },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  pointsText: { fontFamily: FONT, fontSize: 12, color: '#DD6B55' },
  /* Timer */
  timerContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 16 },
  timerWrap: { alignItems: 'center', gap: 6, marginTop: 8 },
  timerText: { fontFamily: FONT, fontSize: 56, color: COLORS.text, letterSpacing: 2 },
  timerHint: { fontFamily: FONT, fontSize: 11, color: 'rgba(59,46,74,0.55)', textAlign: 'center' },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(155,130,196,0.15)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  progressMeta: { fontFamily: FONT, fontSize: 11, color: 'rgba(59,46,74,0.6)', textAlign: 'center' },
  demoSkip: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  demoSkipText: { fontFamily: FONT, fontSize: 11, color: 'rgba(59,46,74,0.45)', textDecorationLine: 'underline' },
  /* Form */
  formContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 8 },
  fieldLabel: { fontFamily: FONT, fontSize: 12, color: COLORS.text, marginTop: 8 },
  field: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.field,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.text,
    ...SHADOW.float,
  },
  feelingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  feelingChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.pill },
  feelingChipText: { fontFamily: FONT, fontSize: 11 },
  formError: { fontFamily: FONT, fontSize: 11, lineHeight: 16, color: COLORS.errorRing, textAlign: 'center', marginTop: 8 },
  /* Tombol */
  primaryButton: {
    height: 54,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.cta,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    ...SHADOW.cta,
  },
  primaryButtonText: { fontFamily: FONT, fontSize: 15, color: COLORS.white },
  buttonDisabled: { opacity: 0.4 },
  backLink: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: RADIUS.pill, backgroundColor: COLORS.guardianCard },
  backLinkText: { fontFamily: FONT, fontSize: 13, color: COLORS.guardian },
  loadErrorText: { fontFamily: FONT, fontSize: 13, color: 'rgba(59,46,74,0.7)', textAlign: 'center' },
  blockedText: { fontFamily: FONT, fontSize: 12, lineHeight: 19, color: 'rgba(59,46,74,0.7)', textAlign: 'center' },
  /* Selesai */
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  doneCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.sage, alignItems: 'center', justifyContent: 'center', ...SHADOW.float },
  doneTitle: { fontFamily: FONT, fontSize: 24, color: COLORS.text, marginTop: 8 },
  doneQuest: { fontFamily: FONT, fontSize: 13, color: 'rgba(59,46,74,0.65)' },
  donePoints: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FBE3B0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.pill, marginTop: 8 },
  donePointsText: { fontFamily: FONT, fontSize: 14, color: '#DD6B55' },
  donePointsMuted: { fontFamily: FONT, fontSize: 11, color: 'rgba(59,46,74,0.5)', marginTop: 8 },
  sparkleRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
});
