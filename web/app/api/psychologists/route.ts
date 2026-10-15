import { createServiceClient, requireUser } from '@/lib/serverAuth';

/**
 * GET /api/psychologists — daftar psikolog terverifikasi untuk pasien.
 *
 * DB tidak mengizinkan klien membaca daftar psikolog (policy menyaring semua
 * baris), jadi dibaca server-side dengan service role. Wajib Bearer token.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const LIST_FIELDS = 'id, nickname, full_name, education, specialization, price_per_session, avatar_url, is_on_call';

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const id = new URL(request.url).searchParams.get('id');

  if (id) {
    const { data, error } = await service
      .from('psychologists')
      .select(LIST_FIELDS)
      .eq('id', id)
      .eq('verification_status', 'verified')
      .maybeSingle();
    if (error) return json({ error: 'Gagal memuat psikolog.' }, 500);
    if (!data) return json({ error: 'Psikolog tidak ditemukan.' }, 404);
    return json({ psychologist: data });
  }

  const { data, error } = await service
    .from('psychologists')
    .select(LIST_FIELDS)
    .eq('verification_status', 'verified')
    .order('created_at', { ascending: false });
  if (error) return json({ error: 'Gagal memuat daftar psikolog.' }, 500);
  return json({ psychologists: data ?? [] });
}
