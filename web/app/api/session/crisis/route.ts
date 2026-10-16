import { createServiceClient, requireUser } from '@/lib/serverAuth';

/**
 * POST /api/session/crisis — buka ruang bantuan krisis (gratis, tanpa booking manual).
 *
 * Saat AI Companion mendeteksi krisis, psikolog on-call sudah di-assign ke
 * `patients.assigned_psychologist_id`. Endpoint ini memastikan ada booking
 * "sesi krisis" yang bisa dibuka pasien di layar `/sesi/<bookingId>`
 * (chat + panggilan), tanpa proses bayar/booking.
 *
 * Idempotent: memakai ulang booking aktif dengan psikolog yang sama bila ada.
 */

const CRISIS_DURATION_MINUTES = 30;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const { data: patient, error: patientError } = await service
    .from('patients')
    .select('id, assigned_psychologist_id')
    .eq('id', user.id)
    .maybeSingle();
  if (patientError) return json({ error: 'Gagal memverifikasi akun.' }, 500);
  if (!patient) return json({ error: 'Akun ini bukan akun pasien.' }, 403);

  /* Psikolog: utamakan yang di-assign saat krisis, lalu on-call terverifikasi. */
  let psychologistId: string | null = patient.assigned_psychologist_id ?? null;
  if (!psychologistId) {
    const { data: onCall } = await service
      .from('psychologists')
      .select('id')
      .eq('verification_status', 'verified')
      .eq('is_on_call', true)
      .limit(1)
      .maybeSingle();
    psychologistId = onCall?.id ?? null;
  }
  if (!psychologistId) {
    return json({ error: 'Belum ada psikolog yang tersedia saat ini. Hubungi kontak daruratmu atau 119.' }, 404);
  }

  /* Pakai ulang booking aktif dengan psikolog ini (hindari duplikat). */
  const { data: existing } = await service
    .from('bookings')
    .select('id')
    .eq('patient_id', user.id)
    .eq('psychologist_id', psychologistId)
    .in('status', ['pending_payment', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return json({ bookingId: existing.id, reused: true });

  /* Buat sesi krisis: gratis, terkonfirmasi, siap dibuka (mode video default). */
  const { data: created, error } = await service
    .from('bookings')
    .insert({
      patient_id: user.id,
      psychologist_id: psychologistId,
      scheduled_at: new Date().toISOString(),
      status: 'confirmed',
      paid_with: 'money',
      payment_status: 'paid',
      session_mode: 'video',
      duration_minutes: CRISIS_DURATION_MINUTES,
      price: 0,
      points_used: 0,
      patient_note: 'Sesi bantuan krisis (otomatis)',
    })
    .select('id')
    .single();
  if (error || !created) {
    console.error('[session/crisis] gagal membuat booking:', error);
    return json({ error: 'Gagal membuka ruang bantuan. Coba lagi atau hubungi 119.' }, 500);
  }

  return json({ bookingId: created.id, reused: false }, 201);
}
