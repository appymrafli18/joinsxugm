import { resolvePortalRole } from '@/lib/roles';
import { createServiceClient, requireUser } from '@/lib/serverAuth';

/**
 * GET /api/session?bookingId= — bootstrap layar sesi pasien <-> psikolog.
 *
 * Mengembalikan data booking + peran pemanggil + lawan bicara (untuk header
 * chat & profil pendamping) + apakah panggilan LiveKit boleh dimulai.
 *
 * Dipakai mobile (`mobile/src/lib/session.ts`) dan portal
 * (`web/app/portal/sesi/[bookingId]`). Chat teks sendiri ditulis langsung ke
 * Supabase (RLS `session_messages`); endpoint ini hanya untuk bootstrap.
 *
 * Aturan akses: hanya pasien/psikolog pemilik booking (admin boleh memantau).
 * Aturan panggilan (`canCall`): booking belum selesai/dibatalkan DAN (sudah
 * dikonfirmasi/dibayar, atau pemanggil psikolog/admin).
 */

const BOOKING_FIELDS =
  'id, patient_id, psychologist_id, scheduled_at, status, paid_with, payment_status, price, points_used, duration_minutes, session_mode, patient_note, created_at';

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  const bookingId = new URL(request.url).searchParams.get('bookingId');
  if (!bookingId) return json({ error: 'bookingId wajib diisi.' }, 400);

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const { data: booking, error } = await service
    .from('bookings')
    .select(BOOKING_FIELDS)
    .eq('id', bookingId)
    .maybeSingle();
  if (error) return json({ error: 'Gagal memuat sesi.' }, 500);
  if (!booking) return json({ error: 'Sesi tidak ditemukan.' }, 404);

  const role = await resolvePortalRole(user.id, user.email);
  const isPatient = role === 'patient' && booking.patient_id === user.id;
  const isPsychologist = role === 'psychologist' && booking.psychologist_id === user.id;
  const isAdmin = role === 'admin';
  if (!isPatient && !isPsychologist && !isAdmin) {
    return json({ error: 'Kamu bukan bagian dari sesi ini.' }, 403);
  }

  /* Lawan bicara + identitas tampilan. */
  const [{ data: patient }, { data: psychologist }] = await Promise.all([
    service.from('patients').select('id, nickname').eq('id', booking.patient_id).maybeSingle(),
    service
      .from('psychologists')
      .select('id, nickname, avatar_url')
      .eq('id', booking.psychologist_id)
      .maybeSingle(),
  ]);

  const counterpart = isPsychologist
    ? { id: booking.patient_id, name: patient?.nickname ?? 'Pasien', avatar_url: psychologist?.avatar_url ?? null }
    : {
        id: booking.psychologist_id,
        name: psychologist?.nickname ?? 'Psikolog',
        avatar_url: psychologist?.avatar_url ?? null,
      };

  const me = isPsychologist
    ? { id: user.id, name: psychologist?.nickname ?? 'Psikolog' }
    : isPatient
      ? { id: user.id, name: patient?.nickname ?? 'Pasien' }
      : { id: user.id, name: user.email ?? 'Admin' };

  const joinable = booking.status === 'confirmed' || booking.payment_status === 'paid';
  const canCall =
    booking.status !== 'cancelled' &&
    booking.status !== 'completed' &&
    (joinable || isPsychologist || isAdmin);

  return json({
    booking,
    role: isPsychologist ? 'psychologist' : isPatient ? 'patient' : 'admin',
    me,
    counterpart,
    canCall,
    callMode: booking.session_mode === 'voice' ? 'voice' : 'video',
    /** Chat teks boleh kapan saja selama sesi belum dibatalkan. */
    canChat: booking.status !== 'cancelled',
  });
}
