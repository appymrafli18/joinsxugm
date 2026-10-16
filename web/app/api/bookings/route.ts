import { createServiceClient, requireUser } from '@/lib/serverAuth';

/**
 * POST /api/bookings — buat booking sesi psikolog (pasien).
 *
 * Aturan DB yang harus dipatuhi (ditemukan dari probe constraint cloud):
 * - status: 'pending_payment' | 'confirmed' | 'completed' | 'cancelled'
 * - paid_with: 'money' | 'points'
 * - payment_status: 'unpaid' | 'paid' | 'failed'
 * - session_mode: 'voice' | 'video'   (default 50 menit per sesi)
 *
 * Paywall hanya untuk sesi terjadwal (PRD Bagian 5). Poin Quest CBT bisa
 * ditukar 1 sesi gratis pada ambang FREE_SESSION_POINTS. Pembayaran manual
 * (transfer/QRIS) untuk MVP — status 'unpaid' menunggu konfirmasi admin.
 */

const FREE_SESSION_POINTS = 400;
const SESSION_DURATION_MINUTES = 50;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/bookings — daftar sesi konsultasi milik pasien + nama panggilan
 * psikolog (klien tidak bisa membaca tabel psychologists dari RLS).
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const { data: bookings, error } = await service
    .from('bookings')
    .select('id, psychologist_id, scheduled_at, status, paid_with, payment_status, price, points_used, duration_minutes, session_mode, patient_note')
    .eq('patient_id', auth.user.id)
    .order('scheduled_at', { ascending: false });
  if (error) return json({ error: 'Gagal memuat sesi konsultasi.' }, 500);

  const psychologistIds = [...new Set((bookings ?? []).map((b) => b.psychologist_id))];
  const names: Record<string, string | null> = {};
  if (psychologistIds.length > 0) {
    const { data: psychologists } = await service
      .from('psychologists')
      .select('id, nickname')
      .in('id', psychologistIds);
    for (const p of psychologists ?? []) {
      names[p.id] = p.nickname ?? null;
    }
  }

  return json({
    bookings: (bookings ?? []).map((b) => ({
      ...b,
      psychologist_nickname: names[b.psychologist_id] ?? null,
    })),
  });
}

type Body = {
  psychologistId?: unknown;
  scheduledAt?: unknown;
  paymentMethod?: unknown;
  sessionMode?: unknown;
  note?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: 'Body tidak valid.' }, 400);
  }

  const psychologistId = typeof body.psychologistId === 'string' ? body.psychologistId : '';
  const scheduledAt = typeof body.scheduledAt === 'string' ? body.scheduledAt : '';
  const paymentMethod = body.paymentMethod;
  const sessionMode = body.sessionMode === 'voice' ? 'voice' : 'video';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

  if (
    !psychologistId ||
    !scheduledAt ||
    Number.isNaN(Date.parse(scheduledAt)) ||
    (paymentMethod !== 'transfer' && paymentMethod !== 'qris' && paymentMethod !== 'points')
  ) {
    return json({ error: 'Data booking tidak lengkap.' }, 400);
  }

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  /* Pasien + gate consent (PRD Bagian 10) */
  const { data: patient, error: patientError } = await service
    .from('patients')
    .select('id, data_sharing_consent, total_points')
    .eq('id', user.id)
    .maybeSingle();
  if (patientError) return json({ error: 'Gagal memverifikasi akun.' }, 500);
  if (!patient) return json({ error: 'Akun ini bukan akun pasien.' }, 403);
  if (!patient.data_sharing_consent) {
    return json({ error: 'Persetujuan berbagi data belum aktif.', code: 'consent_required' }, 403);
  }

  /* Psikolog harus ada & terverifikasi (Beng PRD: verifikasi manual admin) */
  const { data: psychologist, error: psyError } = await service
    .from('psychologists')
    .select('id, nickname, price_per_session, verification_status')
    .eq('id', psychologistId)
    .eq('verification_status', 'verified')
    .maybeSingle();
  if (psyError) return json({ error: 'Gagal memuat psikolog.' }, 500);
  if (!psychologist) return json({ error: 'Psikolog tidak ditemukan.' }, 404);

  const price = Number(psychologist.price_per_session) || 0;
  const isPoints = paymentMethod === 'points';

  /* Penukaran poin: cek saldo lalu potong (sisi server — klien read-only) */
  let pointsUsed = 0;
  if (isPoints) {
    const balance = Number(patient.total_points) || 0;
    if (balance < FREE_SESSION_POINTS) {
      return json(
        {
          error: `Poinmu belum cukup (${balance}/${FREE_SESSION_POINTS}).`,
          code: 'insufficient_points',
        },
        400,
      );
    }
    pointsUsed = FREE_SESSION_POINTS;
    const { error: deductError } = await service
      .from('patients')
      .update({ total_points: balance - FREE_SESSION_POINTS })
      .eq('id', user.id);
    if (deductError) {
      console.error('[bookings] gagal potong poin:', deductError);
      return json({ error: 'Gagal menukar poin.' }, 500);
    }
  }

  /* Nilai kolom mengikuti constraint DB cloud */
  const { data: booking, error: insertError } = await service
    .from('bookings')
    .insert({
      patient_id: user.id,
      psychologist_id: psychologist.id,
      scheduled_at: scheduledAt,
      status: isPoints ? 'confirmed' : 'pending_payment',
      paid_with: isPoints ? 'points' : 'money',
      payment_status: isPoints ? 'paid' : 'unpaid',
      session_mode: sessionMode,
      duration_minutes: SESSION_DURATION_MINUTES,
      price: isPoints ? 0 : price,
      points_used: pointsUsed,
      patient_note: note || null,
    })
    .select('*')
    .single();
  if (insertError || !booking) {
    console.error('[bookings] gagal insert:', insertError);
    // Poin sudah terpotong — kembalikan supaya tidak merugikan pasien.
    if (isPoints) {
      await service
        .from('patients')
        .update({ total_points: (Number(patient.total_points) || 0) })
        .eq('id', user.id);
    }
    return json({ error: 'Gagal membuat booking.' }, 500);
  }

  return json({ booking, psychologist: { nickname: psychologist.nickname, price_per_session: price } }, 201);
}
