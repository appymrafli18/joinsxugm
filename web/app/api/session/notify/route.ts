import { resolvePortalRole } from '@/lib/roles';
import { createServiceClient, requireUser } from '@/lib/serverAuth';
import { portalUrl, resolveUserEmails, sendEmail, sessionWaitingEmail } from '@/lib/notify';

/**
 * POST /api/session/notify — pasien memberi tahu psikolog bahwa ia membuka ruang sesi.
 *
 * Dipanggil layar sesi mobile saat pasien membuka `/sesi/<bookingId>`
 * (best-effort, tidak memblokir UI). Email hanya dikirim SEKALI per booking
 * (dijaga kolom `bookings.patient_joined_at`); sisanya cukup indikator di
 * dashboard psikolog.
 */

type Body = { bookingId?: unknown };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

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
  const bookingId = typeof body.bookingId === 'string' ? body.bookingId : '';
  if (!bookingId) return json({ error: 'bookingId wajib diisi.' }, 400);

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const { data: booking, error } = await service
    .from('bookings')
    .select('id, patient_id, psychologist_id, status, session_mode, scheduled_at')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) return json({ error: 'Gagal memuat sesi.' }, 500);
  if (!booking) return json({ error: 'Sesi tidak ditemukan.' }, 404);

  const role = await resolvePortalRole(user.id, user.email);
  if (role !== 'patient' || booking.patient_id !== user.id) {
    return json({ error: 'Hanya pasien pemilik sesi yang bisa mengirim notifikasi.' }, 403);
  }
  if (booking.status === 'cancelled' || booking.status === 'completed') {
    return json({ ok: true, notified: false });
  }

  /* Klaim "open pertama" secara atomik; bila kolom belum ada, tetap kirim. */
  const { data: claimed, error: claimError } = await service
    .from('bookings')
    .update({ patient_joined_at: new Date().toISOString() })
    .eq('id', bookingId)
    .is('patient_joined_at', null)
    .select('id');
  const firstOpen = claimError ? true : (claimed?.length ?? 0) > 0;
  if (!firstOpen) return json({ ok: true, notified: false });

  /* Email ke psikolog (best-effort, tidak pernah memutus alur). */
  let notified = false;
  try {
    const [{ data: patient }, { data: psychologist }] = await Promise.all([
      service.from('patients').select('nickname').eq('id', user.id).maybeSingle(),
      service.from('psychologists').select('nickname').eq('id', booking.psychologist_id).maybeSingle(),
    ]);
    const emails = await resolveUserEmails(service, [booking.psychologist_id]);
    const to = emails.get(booking.psychologist_id);
    if (to) {
      const email = sessionWaitingEmail({
        patientNickname: patient?.nickname ?? null,
        scheduledAt: booking.scheduled_at,
        mode: booking.session_mode === 'voice' ? 'voice' : 'video',
        link: `${portalUrl()}/portal/sesi/${booking.id}`,
      });
      notified = await sendEmail({ ...email, to: [to] });
      if (!notified) {
        console.info('[session/notify] email dilewati/gagal — cukup indikator dashboard.', psychologist?.nickname);
      }
    }
  } catch (error) {
    console.warn('[session/notify] gagal mengirim email:', error);
  }

  return json({ ok: true, notified });
}
