import { AccessToken } from 'livekit-server-sdk';

import { resolvePortalRole } from '@/lib/roles';
import { createServiceClient, requireUser } from '@/lib/serverAuth';

/**
 * POST /api/calls/link — tautan panggilan LiveKit yang dibuka di BROWSER.
 *
 * Dipakai bila klien tidak punya modul native WebRTC (mis. aplikasi pasien
 * berjalan di Expo Go). Server membuat token LiveKit berumur pendek lalu
 * mengembalikan URL halaman `/call/<bookingId>` yang sudah membawa token.
 *
 * Keamanan: token hanya untuk room booking tsb, TTL singkat, dan hanya
 * dibuat untuk peserta booking (pasien/psikolog/admin). Room tanpa PII.
 *
 * Request:  { bookingId }
 * Response: { joinUrl, mode }
 */

type Body = { bookingId?: unknown };

const LINK_TTL = '20m';

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !livekitUrl) {
    return json({ error: 'Layanan panggilan belum dikonfigurasi (LIVEKIT_* belum diisi admin).' }, 503);
  }

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

  const { data: booking, error: bookingError } = await service
    .from('bookings')
    .select('id, patient_id, psychologist_id, status, session_mode')
    .eq('id', bookingId)
    .maybeSingle();
  if (bookingError) return json({ error: 'Gagal memuat sesi.' }, 500);
  if (!booking) return json({ error: 'Sesi tidak ditemukan.' }, 404);
  if (booking.status === 'cancelled') return json({ error: 'Sesi sudah dibatalkan.' }, 400);

  const role = await resolvePortalRole(user.id, user.email);
  const isPatient = role === 'patient' && booking.patient_id === user.id;
  const isPsychologist = role === 'psychologist' && booking.psychologist_id === user.id;
  const isAdmin = role === 'admin';
  if (!isPatient && !isPsychologist && !isAdmin) {
    return json({ error: 'Kamu bukan bagian dari sesi ini.' }, 403);
  }

  /* Nama tampilan (nickname pasien / psikolog) — tanpa email. */
  let displayName = 'Peserta';
  if (isPatient) {
    const { data: patient } = await service.from('patients').select('nickname').eq('id', user.id).maybeSingle();
    displayName = patient?.nickname ?? 'Pasien';
  } else {
    const { data: psychologist } = await service
      .from('psychologists')
      .select('nickname')
      .eq('id', user.id)
      .maybeSingle();
    displayName = psychologist?.nickname ?? 'Psikolog';
  }

  const roomName = `sesi-${booking.id}`;
  const accessToken = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: displayName,
    ttl: LINK_TTL,
  });
  accessToken.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
  const token = await accessToken.toJwt();

  const origin = new URL(request.url).origin;
  const mode = booking.session_mode === 'voice' ? 'voice' : 'video';
  const query = new URLSearchParams({ t: token, s: livekitUrl, n: displayName, mode });
  const joinUrl = `${origin}/call/${booking.id}?${query.toString()}`;

  return json({ joinUrl, mode });
}
