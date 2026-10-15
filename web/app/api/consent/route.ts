import { createServiceClient, requireUser } from '@/lib/serverAuth';

/**
 * POST /api/consent — simpan persetujuan berbagi data (PRD Bagian 10).
 *
 * Kolom patients.data_sharing_consent TIDAK boleh diupdate langsung dari
 * klien (column-level grant di DB) — dilayani server dengan service role.
 *
 * Request: { consent: boolean }
 * Response: { consent: boolean, updatedAt: string }
 */

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  let body: { consent?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Body tidak valid.' }, 400);
  }
  if (typeof body.consent !== 'boolean') {
    return json({ error: 'Field consent harus boolean.' }, 400);
  }

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const updatedAt = new Date().toISOString();
  const { data, error } = await service
    .from('patients')
    .update({ data_sharing_consent: body.consent, consent_updated_at: updatedAt })
    .eq('id', user.id)
    .select('data_sharing_consent, consent_updated_at')
    .maybeSingle();
  if (error || !data) {
    console.error('[consent] gagal simpan:', error);
    return json({ error: 'Gagal menyimpan persetujuan.' }, 500);
  }
  return json({ consent: Boolean(data.data_sharing_consent), updatedAt });
}
