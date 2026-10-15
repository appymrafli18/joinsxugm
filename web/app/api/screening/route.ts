import { createServiceClient, requireUser } from '@/lib/serverAuth';
import { recomputePatientTier } from '@/lib/tierService';

/**
 * POST /api/screening — simpan jawaban kuis screening pasien (GAD-7)
 * lalu hitung ulang tier (PRD Bagian 8).
 *
 * Penyimpanan + perhitungan sengaja di server: kolom patients.tier tidak
 * dapat diupdate klien, dan tier sedapat mungkin tidak diubah tanpa aturan
 * yang bisa diaudit.
 *
 * Request:  { answers: number[7] }  (masing-masing 0–3)
 * Response: { ok: true }            (skor mentah TIDAK dikirim ke klien)
 */

const GAD7_ITEM_COUNT = 7;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  let body: { answers?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Body tidak valid.' }, 400);
  }
  const answers = body.answers;
  if (
    !Array.isArray(answers) ||
    answers.length !== GAD7_ITEM_COUNT ||
    !answers.every((value) => Number.isInteger(value) && value >= 0 && value <= 3)
  ) {
    return json({ error: `answers harus ${GAD7_ITEM_COUNT} bilangan bulat 0–3.` }, 400);
  }

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const { data: patient } = await service
    .from('patients')
    .select('id')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!patient) return json({ error: 'Akun ini bukan akun pasien.' }, 403);

  const map: Record<string, number> = {};
  answers.forEach((value, index) => {
    map[`q${index + 1}`] = value as number;
  });
  const total = (answers as number[]).reduce((sum, value) => sum + value, 0);

  const { error: insertError } = await service
    .from('screening_scores')
    .insert({ patient_id: auth.user.id, answers: map, total });
  if (insertError) {
    console.error('[screening] gagal simpan:', insertError);
    return json({ error: 'Gagal menyimpan jawaban screening.' }, 500);
  }

  await recomputePatientTier(service, auth.user.id);
  return json({ ok: true });
}
