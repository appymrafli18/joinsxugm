import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronIcon, StarIcon } from '@/components/common/Icon';
import { BottomNav } from '@/components/common/BottomNav';
import { Spinner } from '@/components/ui/Spinner';
import { QUEST_THEMES } from '@/constants/questThemes';
import { COLORS } from '@/constants/colors';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';
import { FREE_SESSION_POINTS, type QuestCategory, type QuestRow } from '@/lib/quests';
import { bookingStatusLabel, fetchBookings, formatJadwal, type BookingListItem } from '@/lib/psychologists';
import { supabase } from '@/lib/supabase';
import { computeStreak } from '@/utils/streak';

/**
 * Halaman Perjalanan (PRD Bagian 6 fitur pelengkap): progres pribadi pasien —
 * poin menuju sesi gratis, streak, dan riwayat misi yang diselesaikan.
 */

type JourneyData = {
  totalPoints: number;
  streak: number;
  activeQuest: QuestRow | null;
  completed: QuestRow[];
};

function formatTanggal(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

async function getJourneyData(): Promise<JourneyData | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const uid = userData.user.id;

  const { data: patient } = await supabase
    .from('patients')
    .select('total_points')
    .eq('id', uid)
    .maybeSingle();
  if (!patient) return null;

  const since = new Date();
  since.setDate(since.getDate() - 60);
  const { data: chats } = await supabase
    .from('chat_logs')
    .select('created_at')
    .eq('patient_id', uid)
    .eq('role', 'user')
    .gte('created_at', since.toISOString())
    .limit(1000);

  const { data: active } = await supabase
    .from('quests')
    .select('*')
    .eq('patient_id', uid)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: completed } = await supabase
    .from('quests')
    .select('*')
    .eq('patient_id', uid)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(30);

  return {
    totalPoints: Number(patient.total_points) || 0,
    streak: computeStreak((chats ?? []).map((row) => row.created_at)),
    activeQuest: (active as QuestRow | null) ?? null,
    completed: (completed as QuestRow[] | null) ?? [],
  };
}

export default function PerjalananScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<JourneyData | null>(null);
  const [bookings, setBookings] = useState<BookingListItem[]>([]);

  useEffect(() => {
    let active = true;
    void getJourneyData().then((result) => {
      if (!active) return;
      if (!result) router.replace('/login');
      else setData(result);
    });
    void fetchBookings().then((result) => {
      if (active && result.ok) setBookings(result.data);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!data) {
    return (
      <View style={styles.loading}>
        <Spinner />
      </View>
    );
  }

  const percent = Math.min(100, Math.round((data.totalPoints / FREE_SESSION_POINTS) * 100));
  const remaining = Math.max(0, FREE_SESSION_POINTS - data.totalPoints);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(24, insets.top), paddingBottom: Math.max(12, insets.bottom) + 100 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Perjalananmu</Text>
          <Text style={styles.subtitle}>Setiap langkah kecil juga berarti</Text>
        </View>

        {/* Progres menuju sesi gratis */}
        <View style={styles.progressCard}>
          <View style={styles.progressHead}>
            <Text style={styles.progressLabel}>
              {remaining === 0 ? 'Poinmu cukup untuk menukar!' : `${remaining} poin lagi menuju`}
            </Text>
            <Text style={styles.pointsPill}>
              <StarIcon size={14} /> {data.totalPoints} poin
            </Text>
          </View>
          <Text style={styles.progressTitle}>1 Sesi Konsultasi Gratis</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.progressMeta}>{data.totalPoints} / {FREE_SESSION_POINTS} poin · {percent}%</Text>
        </View>

        {/* Statistik singkat */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.streak}</Text>
            <Text style={styles.statLabel}>hari beruntun</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.completed.length}</Text>
            <Text style={styles.statLabel}>misi selesai</Text>
          </View>
        </View>

        {/* Misi aktif */}
        {data.activeQuest ? (
          <Pressable
            onPress={() => router.push(`/misi/${data.activeQuest!.id}` as never)}
            style={styles.activeCard}
            accessibilityRole="button"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>Misi aktif</Text>
              <Text style={styles.activeTitle}>{data.activeQuest.title}</Text>
              <Text style={styles.activeMeta}>
                {data.activeQuest.progress_value ?? 0} / {data.activeQuest.target_value ?? 0} {data.activeQuest.unit ?? ''}
              </Text>
            </View>
            <ChevronIcon color="rgba(59,46,74,0.3)" />
          </Pressable>
        ) : null}

        {/* Riwayat misi */}
        <Text style={styles.sectionTitle}>Riwayat misi</Text>
        {data.completed.length === 0 ? (
          <Text style={styles.emptyText}>
            Belum ada misi yang selesai. Mulai dari kartu “Misi Hari Ini” di Beranda ya.
          </Text>
        ) : (
          <View style={styles.historyList}>
            {data.completed.map((quest) => {
              const theme = QUEST_THEMES[quest.category as QuestCategory] ?? QUEST_THEMES.sosial;
              return (
                <View key={quest.id} style={styles.historyCard}>
                  <View style={[styles.historyIcon, { backgroundColor: theme.chip }]}>
                    <StarIcon size={14} color={theme.chipText} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.historyTitle}>{quest.title}</Text>
                    <Text style={styles.historyMeta}>
                      {formatTanggal(quest.completed_at)}
                      {quest.feeling_input ? ` · perasaan: ${quest.feeling_input}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.historyPoints}>+{quest.points}</Text>
                </View>
              );
            })}
          </View>
        )}
        {/* Sesi konsultasi */}
        <Text style={styles.sectionTitle}>Sesi konsultasi</Text>
        {bookings.length === 0 ? (
          <Text style={styles.emptyText}>
            Belum ada sesi. Kamu bisa memilih psikolog lewat kartu “Bicara dengan
            Psikolog” di Beranda.
          </Text>
        ) : (
          <View style={styles.historyList}>
            {bookings.map((booking) => {
              const status = bookingStatusLabel(booking);
              const toneColor =
                status.tone === 'ok' ? COLORS.sage : status.tone === 'pending' ? '#DD6B55' : 'rgba(59,46,74,0.55)';
              const canJoin =
                booking.status !== 'cancelled' &&
                booking.status !== 'completed' &&
                (booking.status === 'confirmed' || booking.payment_status === 'paid');
              return (
                <View key={booking.id} style={styles.historyCard}>
                  <View style={[styles.historyIcon, { backgroundColor: 'rgba(155,130,196,0.15)' }]}>
                    <StarIcon size={14} color={COLORS.guardian} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.historyTitle}>{booking.psychologist_nickname ?? 'Psikolog'}</Text>
                    <Text style={styles.historyMeta}>
                      {formatJadwal(booking.scheduled_at)} · {booking.duration_minutes} menit
                      {booking.session_mode === 'voice' ? ' · suara' : ' · video'}
                    </Text>
                  </View>
                  <View style={styles.bookingRight}>
                    <Text style={[styles.historyPoints, { color: toneColor }]}>{status.label}</Text>
                    {canJoin ? (
                      <Pressable
                        onPress={() => router.push(`/sesi/${booking.id}` as never)}
                        style={styles.joinBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Masuk sesi dengan ${booking.psychologist_nickname ?? 'psikolog'}`}
                      >
                        <Text style={styles.joinBtnText}>Masuk Sesi</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.base },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.base },
  header: { paddingHorizontal: 20 },
  title: { fontFamily: FONT, fontSize: 24, color: COLORS.text },
  subtitle: { fontFamily: FONT, fontSize: 11, color: 'rgba(59,46,74,0.6)', marginTop: 4 },
  progressCard: { marginTop: 18, marginHorizontal: 20, backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 16, gap: 6, ...SHADOW.float },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  progressLabel: { fontFamily: FONT, fontSize: 11, color: '#7B65A8', flex: 1 },
  pointsPill: { fontFamily: FONT, fontSize: 11, color: '#DD6B55', backgroundColor: '#FBE3B0', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' },
  progressTitle: { fontFamily: FONT, fontSize: 14, color: COLORS.text },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: '#E4DAF5', overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#A98BE8' },
  progressMeta: { fontFamily: FONT, fontSize: 10, color: 'rgba(59,46,74,0.6)' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 14, paddingHorizontal: 20 },
  statCard: { flex: 1, backgroundColor: COLORS.guardianCard, borderRadius: RADIUS.card, paddingVertical: 14, alignItems: 'center', gap: 2, ...SHADOW.float },
  statValue: { fontFamily: FONT, fontSize: 20, color: COLORS.text },
  statLabel: { fontFamily: FONT, fontSize: 10, color: 'rgba(59,46,74,0.6)' },
  activeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginHorizontal: 20, backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 16, ...SHADOW.float },
  sectionLabel: { fontFamily: FONT, fontSize: 9, color: COLORS.cta },
  activeTitle: { fontFamily: FONT, fontSize: 14, color: COLORS.text, marginTop: 3 },
  activeMeta: { fontFamily: FONT, fontSize: 10, color: 'rgba(59,46,74,0.6)', marginTop: 2 },
  sectionTitle: { fontFamily: FONT, fontSize: 14, color: COLORS.text, marginTop: 22, marginHorizontal: 20 },
  emptyText: { fontFamily: FONT, fontSize: 11, lineHeight: 17, color: 'rgba(59,46,74,0.6)', marginTop: 8, marginHorizontal: 20 },
  historyList: { marginTop: 10, paddingHorizontal: 20, gap: 10 },
  historyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 14, ...SHADOW.float },
  historyIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontFamily: FONT, fontSize: 12, color: COLORS.text },
  historyMeta: { fontFamily: FONT, fontSize: 9, color: 'rgba(59,46,74,0.55)', marginTop: 2 },
  historyPoints: { fontFamily: FONT, fontSize: 12, color: '#DD6B55' },
  bookingRight: { alignItems: 'flex-end', gap: 6 },
  joinBtn: {
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...SHADOW.cta,
  },
  joinBtnText: { fontFamily: FONT, fontSize: 9, color: COLORS.white },
});
