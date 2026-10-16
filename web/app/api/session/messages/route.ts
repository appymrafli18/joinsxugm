import { resolvePortalRole } from '@/lib/roles';
import { createServiceClient, requireUser } from '@/lib/serverAuth';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * /api/session/messages — chat teks sesi pasien <-> psikolog.
 *
 * Ditangani di SERVER (service role) agar tidak bergantung pada policy RLS
 * `session_messages` yang mungkin belum lengkap di DB. Akses tetap dibatasi:
 * hanya pasien/psikolog pemilik booking (admin boleh baca).
 *
 *   GET  ?bookingId=  → daftar pesan
 *   POST { bookingId, content } → kirim pesan (peran ditentukan server)
 */

type BookingRef = { id: string; patient_id: string; psychologist_id: string };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

/** Deteksi tabel/kolom belum ada — Supabase bisa balas 42P01 (Postgres) atau PGRST205 (PostgREST). */
function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    /does not exist|could not find the table|schema cache/i.test(err.message ?? '')
  );
}

async function resolveMembership(
  service: SupabaseClient,
  user: User,
  bookingId: string,
): Promise<
  | { error: Response }
  | { booking: BookingRef; role: 'patient' | 'psychologist' | 'admin' }
> {
  const { data: booking, error } = await service
    .from('bookings')
    .select('id, patient_id, psychologist_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) return { error: json({ error: 'Gagal memuat sesi.' }, 500) };
  if (!booking) return { error: json({ error: 'Sesi tidak ditemukan.' }, 404) };

  const portalRole = await resolvePortalRole(user.id, user.email);
  const isPatient = portalRole === 'patient' && booking.patient_id === user.id;
  const isPsychologist = portalRole === 'psychologist' && booking.psychologist_id === user.id;
  const isAdmin = portalRole === 'admin';
  if (!isPatient && !isPsychologist && !isAdmin) {
    return { error: json({ error: 'Kamu bukan bagian dari sesi ini.' }, 403) };
  }
  return { booking, role: isPsychologist ? 'psychologist' : isPatient ? 'patient' : 'admin' };
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const bookingId = new URL(request.url).searchParams.get('bookingId');
  if (!bookingId) return json({ error: 'bookingId wajib diisi.' }, 400);

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const membership = await resolveMembership(service, auth.user, bookingId);
  if ('error' in membership) return membership.error;

  const { data: messages, error: listError } = await service
    .from('session_messages')
    .select('id, sender_id, sender_role, content, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (listError) {
    if (isMissingTable(listError)) {
      return json(
        { error: 'Chat sesi belum aktif: tabel session_messages belum ada. Jalankan SQL di docs/session.sql.' },
        503,
      );
    }
    console.error('[session/messages] gagal muat:', listError);
    return json({ error: 'Gagal memuat pesan.' }, 500);
  }

  return json({ messages: messages ?? [] });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  let body: { bookingId?: unknown; content?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Body tidak valid.' }, 400);
  }
  const bookingId = typeof body.bookingId === 'string' ? body.bookingId : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!bookingId || !content || content.length > 2000) {
    return json({ error: 'Pesan tidak valid.' }, 400);
  }

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const membership = await resolveMembership(service, auth.user, bookingId);
  if ('error' in membership) return membership.error;
  if (membership.role === 'admin') {
    return json({ error: 'Admin tidak mengirim pesan sesi.' }, 403);
  }

  const { data: message, error } = await service
    .from('session_messages')
    .insert({
      booking_id: bookingId,
      sender_id: auth.user.id,
      sender_role: membership.role,
      content: content.slice(0, 2000),
    })
    .select('id, sender_id, sender_role, content, created_at')
    .single();
  if (error || !message) {
    console.error('[session/messages] gagal kirim:', error);
    if (isMissingTable(error)) {
      return json(
        { error: 'Chat sesi belum aktif: tabel session_messages belum ada. Jalankan SQL di docs/session.sql.' },
        503,
      );
    }
    return json({ error: 'Gagal mengirim pesan.' }, 500);
  }

  return json({ message }, 201);
}
