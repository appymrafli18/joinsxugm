import { AccessToken } from 'livekit-server-sdk';

import { resolvePortalRole } from '@/lib/roles';
import { createServiceClient, requireUser } from '@/lib/serverAuth';

/**
 * POST /api/calls/token — token panggilan LiveKit untuk satu booking.
 *
 * Aturan:
 * - Sesi manusia (psikolog asli), bukan AI. Pasien memanggil dari mobile,
 *   psikolog dari portal web.
 * - Token berumur pendek, hanya untuk room booking tsb (nama room tanpa PII).
 * - Kredensial LiveKit hanya di server (LIVEKIT_*), tidak pernah ke klien.
 *
 * Request:  { bookingId }
 * Response: { url, token, mode: 'voice'|'video',
 *             psychologist: { nickname, avatar_url } }
 */

type Body = { bookingId?: unknown };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) {
    return json({ error: 'Layanan panggilan belum dikonfigurasi (LIVEKIT_URL/API key belum diisi admin).' }, 503);
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

  const { data: psychologist } = await service
    .from('psychologists')
    .select('nickname, full_name, avatar_url')
    .eq('id', booking.psychologist_id)
    .maybeSingle();

  /* Nama room tanpa PII — pakai id booking (opaque). */
  const roomName = `sesi-${booking.id}`;
  const displayName = isPsychologist || isAdmin
    ? (psychologist?.nickname ?? 'Psikolog')
    : 'Pasien';

  const accessToken = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: displayName,
    ttl: '1h',
  });
  accessToken.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await accessToken.toJwt();

  return json({
    url,
    token,
    mode: booking.session_mode === 'voice' ? 'voice' : 'video',
    role: isPatient ? 'patient' : isPsychologist ? 'psychologist' : 'admin',
    psychologist: {
      nickname: psychologist?.nickname ?? null,
      avatar_url: psychologist?.avatar_url ?? null,
    },
  });
}
