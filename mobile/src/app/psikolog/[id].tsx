import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

import { CheckIcon, ChevronLeftIcon, HeartHandIcon, LockIcon, StarIcon } from '@/components/common/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/constants/colors';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';
import {
  createBooking,
  fetchPsychologist,
  formatJadwal,
  formatRupiah,
  FREE_SESSION_POINTS,
  SESSION_DURATION_MINUTES,
  type Booking,
  type PaymentMethod,
  type Psychologist,
} from '@/lib/psychologists';
import { supabase } from '@/lib/supabase';

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const TIME_SLOTS = ['10:00', '13:00', '16:00', '19:00'];

function buildDateOptions() {
  const options: { key: string; label: string; iso: string }[] = [];
  const base = new Date();
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const label = i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : `${DAY_LABELS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    options.push({ key: iso, label, iso });
  }
  return options;
}

export default function PsychologistDetailScreen() {
  const { id, krisis } = useLocalSearchParams<{ id: string; krisis?: string }>();
  const crisisMode = krisis === '1';
  const insets = useSafeAreaInsets();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [psychologist, setPsychologist] = useState<Psychologist | null>(null);

  /* Gate consent + saldo poin */
  const [consentActive, setConsentActive] = useState<boolean | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);

  /* Form booking */
  const [dateOptions] = useState(buildDateOptions);
  const [dateKey, setDateKey] = useState<string>(() => buildDateOptions()[0].iso);
  const [timeKey, setTimeKey] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Booking | null>(null);

  /* Muat data sesi + psikolog */
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
      const result = await fetchPsychologist(String(id ?? ''));
      if (cancelled) return;
      if (result.ok) setPsychologist(result.data);
      else setError(result.message);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* Cek consent + poin tiap layar difokuskan (mis. setelah kembali dari /consent) */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user || !active) return;
        const { data: patient } = await supabase
          .from('patients')
          .select('data_sharing_consent, total_points')
          .eq('id', userData.user.id)
          .maybeSingle();
        if (!active) return;
        setConsentActive(Boolean(patient?.data_sharing_consent));
        setTotalPoints(Number(patient?.total_points) || 0);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const hasEnoughPoints = totalPoints >= FREE_SESSION_POINTS;

  const submit = async () => {
    if (!psychologist || submitting) return;
    if (!timeKey) {
      setFormError('Pilih jam sesi dulu ya.');
      return;
    }
    if (!method) {
      setFormError('Pilih metode pembayaran dulu ya.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const scheduledAt = new Date(`${dateKey}T${timeKey}:00`).toISOString();
    const result = await createBooking({
      psychologistId: psychologist.id,
      scheduledAt,
      paymentMethod: method,
      note: note.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      if (result.message.includes('Persetujuan')) {
        setConsentActive(false); // tampilkan gate kembali
      }
      setFormError(result.message);
      return;
    }
    setSuccess(result.booking);
  };

  if (!ready || loading) {
    return (
      <View style={styles.centerRoot}>
        <Spinner />
      </View>
    );
  }
  if (!psychologist) {
    return (
      <View style={styles.centerRoot}>
        <Text style={styles.errorText}>{error ?? 'Psikolog tidak ditemukan.'}</Text>
        <Pressable onPress={() => router.replace('/psikolog')} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Kembali ke daftar</Text>
        </Pressable>
      </View>
    );
  }

  /* ---------- Mode krisis: dihubungkan langsung, gratis, tanpa booking ---------- */
  if (crisisMode) {
    return (
      <ScrollView
        style={[styles.root, { paddingTop: Math.max(12, insets.top) }]}
        contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom + 24), paddingHorizontal: 20, gap: 12 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Kembali">
            <ChevronLeftIcon />
          </Pressable>
          <Text style={styles.headerTitle}>Bantuan Krisis</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.crisisIntro}>
          <Text style={styles.crisisTitle}>Kamu tidak sendirian.</Text>
          <Text style={styles.crisisBody}>
            {psychologist.nickname ?? 'Psikolog on-call'} sudah dihubungkan untuk
            menemanimu. Sesi krisis selalu <Text style={styles.crisisStrong}>gratis</Text> —
            tanpa booking dan tanpa pembayaran. Peringatanmu juga tercatat untuk
            tim psikolog.
          </Text>
        </View>

        {/* Kartu psikolog yang dihubungkan */}
        <View style={styles.profileCard}>
          {psychologist.avatar_url ? (
            <Image source={{ uri: psychologist.avatar_url }} contentFit="cover" style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <HeartHandIcon color={COLORS.guardian} size={30} />
            </View>
          )}
          <Text style={styles.name}>{psychologist.nickname ?? 'Psikolog on-call'}</Text>
          {psychologist.full_name ? <Text style={styles.realName}>{psychologist.full_name}</Text> : null}
          {psychologist.education ? <Text style={styles.education}>{psychologist.education}</Text> : null}
          {psychologist.specialization ? (
            <View style={styles.specChip}><Text style={styles.specChipText}>{psychologist.specialization}</Text></View>
          ) : null}
          <Text style={[styles.price, { color: COLORS.sage }]}>
            Sesi krisis · gratis
          </Text>
        </View>

        {/* Langkah darurat */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>Kalau kamu dalam bahaya saat ini:</Text>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
            <Text style={styles.stepText}>Hubungi kontak daruratmu (atur di halaman Profil).</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
            <Text style={styles.stepText}>Layanan gawat darurat: telepon 119.</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
            <Text style={styles.stepText}>Jangan tinggal sendirian — temui orang terdekat yang kamu percaya.</Text>
          </View>
        </View>

        <Pressable onPress={() => router.back()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Kembali ke Companion</Text>
        </Pressable>
      </ScrollView>
    );
  }

  /* ---------- Sukses ---------- */
  if (success) {
    const paidWithPoints = success.paid_with === 'points';
    return (
      <View style={[styles.root, { paddingTop: Math.max(24, insets.top), paddingBottom: Math.max(24, insets.bottom + 16) }]}>
        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <CheckIcon size={40} color={COLORS.white} />
          </View>
          <Text style={styles.successTitle}>
            {paidWithPoints ? 'Sesi berhasil ditukar!' : 'Booking terkirim!'}
          </Text>
          <View style={styles.successCard}>
            <Text style={styles.successRow}>
              <Text style={styles.successLabel}>Psikolog · </Text>
              {psychologist.nickname ?? 'Psikolog'}
            </Text>
            <Text style={styles.successRow}>
              <Text style={styles.successLabel}>Jadwal · </Text>
              {formatJadwal(success.scheduled_at)}
            </Text>
            <Text style={styles.successRow}>
              <Text style={styles.successLabel}>Durasi · </Text>
              {success.duration_minutes} menit (video)
            </Text>
            <Text style={styles.successRow}>
              <Text style={styles.successLabel}>Biaya · </Text>
              {paidWithPoints ? `Gratis — ${success.points_used} poin` : formatRupiah(success.price)}
            </Text>
          </View>
          <Text style={styles.successNote}>
            {paidWithPoints
              ? 'Sesi ini gratis dari poin Quest CBT-mu. Psikolog akan mengonfirmasi jadwalnya.'
              : 'Tim kami akan mengirim detail pembayaran (transfer/QRIS). Sesi dikonfirmasi setelah pembayaran diverifikasi.'}
          </Text>
        </View>
        <Pressable onPress={() => router.replace('/beranda')} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Kembali ke Beranda</Text>
        </Pressable>
      </View>
    );
  }

  /* ---------- Detail + form ---------- */
  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: Math.max(12, insets.top) }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Kembali">
          <ChevronLeftIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Profil Psikolog</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Kartu psikolog */}
        <View style={styles.profileCard}>
          {psychologist.avatar_url ? (
            <Image source={{ uri: psychologist.avatar_url }} contentFit="cover" style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <HeartHandIcon color={COLORS.guardian} size={30} />
            </View>
          )}
          <Text style={styles.name}>{psychologist.nickname ?? 'Psikolog'}</Text>
          {psychologist.full_name ? <Text style={styles.realName}>{psychologist.full_name}</Text> : null}
          {psychologist.education ? <Text style={styles.education}>{psychologist.education}</Text> : null}
          {psychologist.specialization ? (
            <View style={styles.specChip}><Text style={styles.specChipText}>{psychologist.specialization}</Text></View>
          ) : null}
          <Text style={styles.price}>
            {formatRupiah(psychologist.price_per_session)} <Text style={styles.priceUnit}>/ sesi · {SESSION_DURATION_MINUTES} menit</Text>
          </Text>
        </View>

        {/* Gate consent (PRD Bagian 10) */}
        {consentActive === false ? (
          <View style={styles.consentGate}>
            <View style={styles.gateIcon}><LockIcon size={18} color={COLORS.white} /></View>
            <Text style={styles.gateTitle}>Aktifkan persetujuan dulu</Text>
            <Text style={styles.gateText}>
              Sebelum data kamu dibagikan ke psikolog, kami butuh izin eksplisit.
              Hanya ringkasan AI (bukan transkrip mentah) yang dibagikan.
            </Text>
            <Pressable onPress={() => router.push('/consent')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Buka Layar Persetujuan</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Jadwal */}
            <Text style={styles.sectionTitle}>Pilih tanggal</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {dateOptions.map((option) => {
                const active = dateKey === option.iso;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setDateKey(option.iso)}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.sectionTitle}>Pilih jam</Text>
            <View style={styles.chipRowWrap}>
              {TIME_SLOTS.map((slot) => {
                const active = timeKey === slot;
                return (
                  <Pressable
                    key={slot}
                    onPress={() => setTimeKey(slot)}
                    style={[styles.chip, active && styles.chipActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{slot}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Pembayaran */}
            <Text style={styles.sectionTitle}>Metode pembayaran</Text>
            <View style={styles.chipRowWrap}>
              <Pressable onPress={() => setMethod('transfer')} style={[styles.chip, method === 'transfer' && styles.chipActive]}>
                <Text style={[styles.chipText, method === 'transfer' && styles.chipTextActive]}>Transfer</Text>
              </Pressable>
              <Pressable onPress={() => setMethod('qris')} style={[styles.chip, method === 'qris' && styles.chipActive]}>
                <Text style={[styles.chipText, method === 'qris' && styles.chipTextActive]}>QRIS</Text>
              </Pressable>
              <Pressable
                onPress={() => hasEnoughPoints && setMethod('points')}
                disabled={!hasEnoughPoints}
                style={[
                  styles.chip,
                  styles.pointsChip,
                  method === 'points' && styles.chipActive,
                  !hasEnoughPoints && styles.chipDisabled,
                ]}
              >
                <StarIcon size={13} color={method === 'points' ? COLORS.white : '#DD6B55'} />
                <Text style={[styles.chipText, { color: method === 'points' ? COLORS.white : '#DD6B55' }]}>
                  Poin ({totalPoints}/{FREE_SESSION_POINTS})
                </Text>
              </Pressable>
            </View>
            {!hasEnoughPoints ? (
              <Text style={styles.hintText}>
                Kumpulkan {FREE_SESSION_POINTS - totalPoints} poin lagi dari misi untuk 1 sesi gratis.
              </Text>
            ) : null}

            <Text style={styles.sectionTitle}>Catatan untuk psikolog (opsional)</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Ada yang ingin kamu sampaikan sebelumnya?"
              placeholderTextColor="rgba(59,46,74,0.35)"
              multiline
              maxLength={500}
            />

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <Pressable
              onPress={submit}
              disabled={submitting}
              style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            >
              <Text style={styles.primaryButtonText}>
                {submitting ? 'Mengirim booking...' : 'Booking Sesi Ini'}
              </Text>
            </Pressable>
            <Text style={styles.footnote}>
              Bantuan krisis selalu gratis dan tanpa booking — PRD menjamin itu.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.base },
  centerRoot: { flex: 1, backgroundColor: COLORS.base, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { fontFamily: FONT, fontSize: 13, color: 'rgba(59,46,74,0.7)', textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 4 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONT, fontSize: 16, color: COLORS.text },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 10 },
  /* Profil */
  profileCard: { alignItems: 'center', gap: 6, backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 18, ...SHADOW.float },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.guardianCard },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: FONT, fontSize: 17, color: COLORS.text, marginTop: 4 },
  realName: { fontFamily: FONT, fontSize: 11, color: 'rgba(59,46,74,0.7)' },
  education: { fontFamily: FONT, fontSize: 11, color: 'rgba(59,46,74,0.55)' },
  specChip: { backgroundColor: COLORS.guardianCard, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  specChipText: { fontFamily: FONT, fontSize: 10, color: '#6E4FB5' },
  price: { fontFamily: FONT, fontSize: 14, color: COLORS.cta, marginTop: 4 },
  priceUnit: { fontFamily: FONT, fontSize: 10, color: 'rgba(59,46,74,0.5)' },
  /* Consent gate */
  consentGate: { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 18, alignItems: 'center', gap: 8, ...SHADOW.float },
  gateIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.guardian, alignItems: 'center', justifyContent: 'center' },
  gateTitle: { fontFamily: FONT, fontSize: 14, color: COLORS.text },
  gateText: { fontFamily: FONT, fontSize: 11, lineHeight: 17, color: 'rgba(59,46,74,0.7)', textAlign: 'center' },
  /* Form */
  sectionTitle: { fontFamily: FONT, fontSize: 13, color: COLORS.text, marginTop: 10 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...SHADOW.float,
  },
  chipActive: { backgroundColor: COLORS.cta },
  chipDisabled: { opacity: 0.45 },
  chipText: { fontFamily: FONT, fontSize: 11, color: COLORS.text },
  chipTextActive: { color: COLORS.white },
  pointsChip: { backgroundColor: '#FBE3B0' },
  hintText: { fontFamily: FONT, fontSize: 10, color: 'rgba(59,46,74,0.55)', marginTop: 4 },
  noteInput: {
    minHeight: 76,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.field,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: FONT,
    fontSize: 12,
    color: COLORS.text,
    textAlignVertical: 'top',
    ...SHADOW.float,
  },
  formError: { fontFamily: FONT, fontSize: 11, lineHeight: 16, color: COLORS.errorRing, textAlign: 'center', marginTop: 6 },
  /* Tombol */
  primaryButton: { height: 54, borderRadius: RADIUS.pill, backgroundColor: COLORS.cta, alignItems: 'center', justifyContent: 'center', marginTop: 14, width: '100%', ...SHADOW.cta },
  primaryButtonText: { fontFamily: FONT, fontSize: 15, color: COLORS.white },
  buttonDisabled: { opacity: 0.5 },
  secondaryButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: COLORS.guardianCard, marginTop: 8 },
  secondaryButtonText: { fontFamily: FONT, fontSize: 12, color: COLORS.guardian },
  footnote: { fontFamily: FONT, fontSize: 9, lineHeight: 14, color: 'rgba(59,46,74,0.5)', textAlign: 'center', marginTop: 10 },
  /* Mode krisis */
  crisisIntro: {
    padding: 16,
    borderRadius: RADIUS.card,
    backgroundColor: 'rgba(193,69,59,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(193,69,59,0.35)',
    gap: 6,
  },
  crisisTitle: { fontFamily: FONT, fontSize: 17, color: '#8F322B' },
  crisisBody: { fontFamily: FONT, fontSize: 11, lineHeight: 17, color: '#8F322B' },
  crisisStrong: { color: COLORS.terracotta },
  stepsCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 16, gap: 10, ...SHADOW.float },
  stepsTitle: { fontFamily: FONT, fontSize: 13, color: COLORS.text },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.guardian,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: { fontFamily: FONT, fontSize: 11, color: COLORS.white },
  stepText: { flex: 1, fontFamily: FONT, fontSize: 11, lineHeight: 17, color: 'rgba(59,46,74,0.8)' },
  /* Sukses */
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  successCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.sage, alignItems: 'center', justifyContent: 'center', ...SHADOW.float },
  successTitle: { fontFamily: FONT, fontSize: 20, color: COLORS.text, marginTop: 8 },
  successCard: { alignSelf: 'stretch', backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 16, gap: 6, marginTop: 6, ...SHADOW.float },
  successRow: { fontFamily: FONT, fontSize: 12, lineHeight: 18, color: COLORS.text },
  successLabel: { color: 'rgba(59,46,74,0.55)' },
  successNote: { fontFamily: FONT, fontSize: 10, lineHeight: 16, color: 'rgba(59,46,74,0.6)', textAlign: 'center', marginTop: 4 },
});
