import { createServiceClient, requireUser } from '@/lib/serverAuth';
import { runDailySentimentIfNeeded } from '@/lib/sentiment';
import { recomputePatientTier } from '@/lib/tierService';

/**
 * POST /api/sentiment — jalankan analisis sentimen harian (PRD Bagian 12 poin 3).
 *
 * Body opsional: { date: "YYYY-MM-DD" } (default: hari ini, UTC).
 * Biasanya dipicu otomatis oleh /api/companion; endpoint ini berguna untuk
 * menjalankan ulang manual dari dashboard / cron job.
 * Response: { ok: true, created: boolean } — false bila sudah ada/kurang data.
 */

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  let date: string | undefined;
  try {
    const body = (await request.json()) as { date?: unknown };
    if (typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      date = body.date;
    }
  } catch {
    // body kosong → hari ini
  }

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const { data: patient } = await service
    .from('patients')
    .select('id')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!patient) return json({ error: 'Akun ini bukan akun pasien.' }, 403);

  try {
    const created = await runDailySentimentIfNeeded(service, auth.user.id, date);
    if (created) await recomputePatientTier(service, auth.user.id);
    return json({ ok: true, created });
  } catch (error) {
    console.error('[sentiment] gagal:', error);
    return json({ error: 'Gagal menganalisis sentimen.' }, 500);
  }
}
