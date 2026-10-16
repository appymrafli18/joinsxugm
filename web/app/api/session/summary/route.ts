import { resolvePortalRole } from '@/lib/roles';
import { createServiceClient, requireUser } from '@/lib/serverAuth';
import { generateSummaryNow } from '@/lib/summary';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * /api/session/summary — ringkasan AI untuk ruang sesi psikolog (PRD §7.4, §12.5).
 *
 *   GET  ?bookingId=  → { consent, summary, sentiment } (hanya bila consent aktif)
 *   POST { bookingId } → "generate if missing": buat ringkasan SEKALI bila belum
 *                        ada lalu kembalikan (bukan refresh bebas — tetap
 *                        tersimpan & auditable). Hanya psikolog pemilik sesi.
 *
 * Data dibatasi: tanpa `patients.data_sharing_consent` aktif, ringkasan &
 * sentimen TIDAK dibagikan.
 */

type BookingRef = { id: string; patient_id: string; psychologist_id: string };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

async function resolveMembership(
  service: SupabaseClient,
  user: User,
  bookingId: string,
): Promise<{ error: Response } | { booking: BookingRef; role: 'patient' | 'psychologist' | 'admin' }> {
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

async function loadBrief(service: SupabaseClient, patientId: string) {
  const { data: patient } = await service
    .from('patients')
    .select('data_sharing_consent')
    .eq('id', patientId)
    .maybeSingle();
  const consent = Boolean(patient?.data_sharing_consent);
  if (!consent) return { consent: false, summary: null, sentiment: null };

  const [{ data: summaryRow }, { data: sentimentRow }] = await Promise.all([
    service
      .from('ai_summaries')
      .select('summary, period_start')
      .eq('patient_id', patientId)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from('sentiment_logs')
      .select('stabil_score, cemas_score, date')
      .eq('patient_id', patientId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    consent: true,
    summary: summaryRow ? { text: summaryRow.summary, date: summaryRow.period_start } : null,
    sentiment: sentimentRow
      ? { stabil: Number(sentimentRow.stabil_score), cemas: Number(sentimentRow.cemas_score), date: sentimentRow.date }
      : null,
  };
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

  return json(await loadBrief(service, membership.booking.patient_id));
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  let body: { bookingId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Body tidak valid.' }, 400);
  }
  const bookingId = typeof body.bookingId === 'string' ? body.bookingId : '';
  if (!bookingId) return json({ error: 'bookingId wajib diisi.' }, 400);

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const membership = await resolveMembership(service, auth.user, bookingId);
  if ('error' in membership) return membership.error;
  if (membership.role !== 'psychologist') {
    return json({ error: 'Hanya psikolog pemilik sesi yang bisa membuat ringkasan.' }, 403);
  }

  const { data: patient } = await service
    .from('patients')
    .select('data_sharing_consent')
    .eq('id', membership.booking.patient_id)
    .maybeSingle();
  if (!patient?.data_sharing_consent) {
    return json({ error: 'Pasien belum memberi consent berbagi data.' }, 403);
  }

  const summary = await generateSummaryNow(service, membership.booking.patient_id);
  if (!summary) {
    return json({ consent: true, summary: null, reason: 'Belum cukup pesan untuk dirangkum (minimal 3).' });
  }

  const { data: sentimentRow } = await service
    .from('sentiment_logs')
    .select('stabil_score, cemas_score, date')
    .eq('patient_id', membership.booking.patient_id)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  return json({
    consent: true,
    summary,
    sentiment: sentimentRow
      ? { stabil: Number(sentimentRow.stabil_score), cemas: Number(sentimentRow.cemas_score), date: sentimentRow.date }
      : null,
  });
}
