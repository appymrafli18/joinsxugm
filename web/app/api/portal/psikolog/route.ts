import { requirePortalRole } from '@/lib/roles';
import { createServiceClient } from '@/lib/serverAuth';
import { notifyEscalationToTeam } from '@/lib/crisisService';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * /api/portal/psikolog — dashboard & pengaturan profil psikolog.
 *
 * GET  → profil + statistik + pasien yang ditangani + alert krisis + booking.
 * POST → action:
 *   - 'profile'  : update profil publik (nickname, full_name, education,
 *                  specialization, price_per_session, avatar_url)
 *   - 'oncall'   : toggle status on-call
 *   - 'alert-ack': acknowledge / escalate / resolve crisis alert
 *
 * Ringkasan AI (sentimen per pasien) hanya dikirim sebagai referensi awal,
 * bukan diagnosis — sesuai PRD Bagian 10.
 */

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

const PROFILE_FIELDS =
  'id, full_name, license_number, license_document_url, verification_status, rejection_reason, nickname, avatar_url, education, specialization, price_per_session, is_on_call, created_at';

async function loadAssignedPatients(service: SupabaseClient, psychologistId: string) {
  const { data: patients } = await service
    .from('patients')
    .select('id, nickname, archetype_id, tier, total_points, data_sharing_consent, assigned_psychologist_id, created_at')
    .eq('assigned_psychologist_id', psychologistId)
    .order('created_at', { ascending: false })
    .limit(100);
  const list = patients ?? [];

  /* Sentimen terbaru per pasien — hanya jika consent aktif (minimalisasi data). */
  const consentedIds = list.filter((p) => p.data_sharing_consent).map((p) => p.id);
  const sentimentByPatient: Record<string, { stabil: number; cemas: number; date: string }> = {};
  if (consentedIds.length > 0) {
    const { data: sentiment } = await service
      .from('sentiment_logs')
      .select('patient_id, stabil_score, cemas_score, date')
      .in('patient_id', consentedIds)
      .order('date', { ascending: false })
      .limit(300);
    for (const row of sentiment ?? []) {
      if (!sentimentByPatient[row.patient_id]) {
        sentimentByPatient[row.patient_id] = {
          stabil: Number(row.stabil_score),
          cemas: Number(row.cemas_score),
          date: row.date,
        };
      }
    }
  }

  /* Ringkasan AI naratif terbaru per pasien — juga hanya jika consent aktif. */
  const summaryByPatient: Record<string, { summary: string; date: string }> = {};
  if (consentedIds.length > 0) {
    const { data: summaries } = await service
      .from('ai_summaries')
      .select('patient_id, summary, period_start')
      .in('patient_id', consentedIds)
      .order('period_start', { ascending: false })
      .limit(300);
    for (const row of summaries ?? []) {
      if (!summaryByPatient[row.patient_id]) {
        summaryByPatient[row.patient_id] = { summary: row.summary, date: row.period_start };
      }
    }
  }

  return list.map((p) => ({
    ...p,
    latestSentiment: sentimentByPatient[p.id] ?? null,
    latestSummary: summaryByPatient[p.id] ?? null,
  }));
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requirePortalRole(request, ['psychologist']);
  if (auth.response) return auth.response;
  const user = auth.user;

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const { data: profile, error: profileError } = await service
    .from('psychologists')
    .select(PROFILE_FIELDS)
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile) return json({ error: 'Profil psikolog tidak ditemukan.' }, 404);

  const patients = await loadAssignedPatients(service, user.id);
  const patientIds = patients.map((p) => p.id);

  /* Alert krisis: untuk pasien yang ditangani; on-call juga melihat semua
     alert pending + escalated (yang belum ditangani siapa pun) agar eskalasi
     tidak macet (PRD Bagian 9). */
  let alertsQuery = service
    .from('crisis_alerts')
    .select('id, patient_id, patient_nickname, trigger_excerpt, status, acknowledged_by, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  alertsQuery = patientIds.length > 0
    ? alertsQuery.or(
        `patient_id.in.(${patientIds.join(',')})${
          profile.is_on_call ? ',status.eq.pending,status.eq.escalated' : ''
        }`,
      )
    : alertsQuery;
  if (patientIds.length === 0 && !profile.is_on_call) {
    alertsQuery = alertsQuery.eq('patient_id', '00000000-0000-0000-0000-000000000000');
  }
  const { data: alerts } = await alertsQuery;

  const { data: bookings } = await service
    .from('bookings')
    .select('*')
    .eq('psychologist_id', user.id)
    .order('scheduled_at', { ascending: false })
    .limit(50);

  const bookingPatientIds = [...new Set((bookings ?? []).map((b) => b.patient_id))];
  const aliasByPatient: Record<string, string> = {};
  if (bookingPatientIds.length > 0) {
    const { data: bookingPatients } = await service
      .from('patients')
      .select('id, nickname')
      .in('id', bookingPatientIds);
    for (const p of bookingPatients ?? []) aliasByPatient[p.id] = p.nickname;
  }

  return json({
    profile,
    patients,
    alerts: alerts ?? [],
    bookings: (bookings ?? []).map((b) => ({ ...b, patient_nickname: aliasByPatient[b.patient_id] ?? null })),
    counts: {
      patients: patients.length,
      consented: patients.filter((p) => p.data_sharing_consent).length,
      alertsPending: (alerts ?? []).filter((a) => a.status === 'pending').length,
      alertsEscalated: (alerts ?? []).filter((a) => a.status === 'escalated').length,
      bookingsUpcoming: (bookings ?? []).filter(
        (b) => b.status !== 'cancelled' && b.status !== 'completed',
      ).length,
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requirePortalRole(request, ['psychologist']);
  if (auth.response) return auth.response;
  const user = auth.user;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Body tidak valid.' }, 400);
  }

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  /* ---------- profil publik ---------- */
  if (body.action === 'profile') {
    const nickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, 40) : '';
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim().slice(0, 120) : '';
    const education = typeof body.education === 'string' ? body.education.trim().slice(0, 200) : '';
    const specialization = typeof body.specialization === 'string' ? body.specialization.trim().slice(0, 120) : '';
    const avatarUrl = typeof body.avatar_url === 'string' ? body.avatar_url.trim().slice(0, 500) : '';
    const price = Number(body.price_per_session);
    if (!nickname || !fullName || !Number.isFinite(price) || price < 0) {
      return json({ error: 'Nama samaran, nama asli, dan harga wajib diisi dengan benar.' }, 400);
    }
    const { data, error } = await service
      .from('psychologists')
      .update({
        nickname,
        full_name: fullName,
        education: education || null,
        specialization: specialization || null,
        avatar_url: avatarUrl || null,
        price_per_session: Math.round(price),
      })
      .eq('id', user.id)
      .select(PROFILE_FIELDS)
      .maybeSingle();
    if (error || !data) {
      console.error('[portal/psikolog] gagal simpan profil:', error);
      return json({ error: 'Gagal menyimpan profil.' }, 500);
    }
    return json({ profile: data });
  }

  /* ---------- toggle on-call ---------- */
  if (body.action === 'oncall') {
    if (typeof body.is_on_call !== 'boolean') return json({ error: 'is_on_call harus boolean.' }, 400);
    const { data: profile } = await service
      .from('psychologists')
      .select('verification_status')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile || profile.verification_status !== 'verified') {
      return json({ error: 'Hanya psikolog terverifikasi yang bisa on-call.' }, 403);
    }
    const { error } = await service
      .from('psychologists')
      .update({ is_on_call: body.is_on_call })
      .eq('id', user.id);
    if (error) return json({ error: 'Gagal mengubah status on-call.' }, 500);
    return json({ is_on_call: body.is_on_call });
  }

  /* ---------- konfirmasi / selesaikan booking sesi ---------- */
  if (body.action === 'booking-status') {
    const bookingId = typeof body.bookingId === 'string' ? body.bookingId : '';
    const status = body.status;
    if (!bookingId || (status !== 'confirmed' && status !== 'completed' && status !== 'cancelled')) {
      return json({ error: 'Parameter booking tidak valid.' }, 400);
    }
    const { data: booking, error } = await service
      .from('bookings')
      .update(status === 'confirmed' ? { status, payment_status: 'paid' } : { status })
      .eq('id', bookingId)
      .eq('psychologist_id', user.id)
      .select('id, patient_id, scheduled_at, status, paid_with, payment_status, price, points_used, duration_minutes, session_mode, patient_note, created_at')
      .maybeSingle();
    if (error || !booking) {
      console.error('[portal/psikolog] gagal update booking:', error);
      return json({ error: 'Gagal memperbarui sesi.' }, 404);
    }
    return json({ booking });
  }

  /* ---------- acknowledge / selesaikan alert krisis ---------- */
  if (body.action === 'alert-ack') {
    const alertId = typeof body.alertId === 'string' ? body.alertId : '';
    const status = body.status;
    if (!alertId || (status !== 'acknowledged' && status !== 'escalated' && status !== 'resolved')) {
      return json({ error: 'Parameter alert tidak valid.' }, 400);
    }
    const { data: alert } = await service
      .from('crisis_alerts')
      .select('id, patient_id, status')
      .eq('id', alertId)
      .maybeSingle();
    if (!alert) return json({ error: 'Alert tidak ditemukan.' }, 404);

    const [{ data: me }, { data: patient }] = await Promise.all([
      service.from('psychologists').select('is_on_call').eq('id', user.id).maybeSingle(),
      service.from('patients').select('assigned_psychologist_id').eq('id', alert.patient_id).maybeSingle(),
    ]);
    const allowed = patient?.assigned_psychologist_id === user.id || me?.is_on_call === true;
    if (!allowed) return json({ error: 'Kamu tidak menangani pasien ini.' }, 403);

    const { data, error } = await service
      .from('crisis_alerts')
      .update({
        status,
        acknowledged_by: user.id,
      })
      .eq('id', alertId)
      .select('id, patient_id, patient_nickname, trigger_excerpt, status, acknowledged_by, created_at')
      .maybeSingle();
    if (error || !data) {
      console.error('[portal/psikolog] gagal update alert:', error);
      return json({ error: 'Gagal memperbarui alert.' }, 500);
    }

    /* Eskalasi manual psikolog → beri tahu seluruh tim terverifikasi
       (paralel dengan jalur otomatis SLA). Hindari spam bila status sudah
       escalated sebelumnya. */
    if (status === 'escalated' && alert.status !== 'escalated') {
      await notifyEscalationToTeam(service, [
        {
          alertId: data.id,
          patientId: data.patient_id,
          nickname: data.patient_nickname ?? null,
          excerpt: data.trigger_excerpt ?? null,
          createdAt: data.created_at,
        },
      ]);
    }

    return json({ alert: data });
  }

  return json({ error: 'Action tidak dikenal.' }, 400);
}
