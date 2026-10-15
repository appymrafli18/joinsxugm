import { requirePortalRole } from '@/lib/roles';
import { createServiceClient } from '@/lib/serverAuth';
import { isStoragePath, signLicensePath } from '@/lib/licenseStorage';

/**
 * /api/portal/admin — manajemen pengguna & psikolog untuk Admin.
 *
 * GET  → ringkasan: psikolog (semua status), pasien (dengan email), hitungan krisis.
 * POST → action 'set-verification': verifikasi/tolak psikolog (manual, sesuai PRD).
 *
 * Akses admin ditentukan allowlist server (env ADMIN_EMAILS) — bukan data klien.
 */

const PSY_FIELDS =
  'id, full_name, license_number, license_document_url, verification_status, rejection_reason, nickname, education, specialization, price_per_session, is_on_call, created_at';

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requirePortalRole(request, ['admin']);
  if (auth.response) return auth.response;

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const [{ data: psychologists }, { data: patients }, { data: alerts }] = await Promise.all([
    service.from('psychologists').select(PSY_FIELDS).order('created_at', { ascending: false }),
    service
      .from('patients')
      .select('id, nickname, archetype_id, tier, total_points, data_sharing_consent, assigned_psychologist_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    service.from('crisis_alerts').select('id, status, created_at').order('created_at', { ascending: false }).limit(200),
  ]);

  /* Email pengguna (auth) untuk manajemen users. */
  const { data: authUsers } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
  const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? null]));

  const crisisPending = (alerts ?? []).filter((a) => a.status === 'pending').length;
  const crisisEscalated = (alerts ?? []).filter((a) => a.status === 'escalated').length;

  /* Dokumen lisensi disimpan sebagai path di bucket privat — sediakan signed URL
     berumur pendek untuk admin. */
  const psychologistsOut = await Promise.all(
    (psychologists ?? []).map(async (p) => {
      const signed = isStoragePath(p.license_document_url)
        ? await signLicensePath(service, p.license_document_url)
        : null;
      return {
        ...p,
        email: emailById.get(p.id) ?? null,
        license_document_signed_url: signed ?? (isStoragePath(p.license_document_url) ? null : p.license_document_url),
      };
    }),
  );

  return json({
    psychologists: psychologistsOut,
    patients: (patients ?? []).map((p) => ({
      ...p,
      email: emailById.get(p.id) ?? null,
    })),
    counts: {
      psychologists: psychologists?.length ?? 0,
      verified: (psychologists ?? []).filter((p) => p.verification_status === 'verified').length,
      pending: (psychologists ?? []).filter((p) => p.verification_status === 'pending').length,
      rejected: (psychologists ?? []).filter((p) => p.verification_status === 'rejected').length,
      patients: patients?.length ?? 0,
      crisisPending,
      crisisEscalated,
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requirePortalRole(request, ['admin']);
  if (auth.response) return auth.response;

  let body: { action?: unknown; psychologistId?: unknown; status?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Body tidak valid.' }, 400);
  }

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  if (body.action === 'set-verification') {
    const psychologistId = typeof body.psychologistId === 'string' ? body.psychologistId : '';
    const status = body.status;
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : null;
    if (!psychologistId || (status !== 'verified' && status !== 'rejected' && status !== 'pending')) {
      return json({ error: 'Parameter verifikasi tidak valid.' }, 400);
    }
    const { data, error } = await service
      .from('psychologists')
      .update({
        verification_status: status,
        rejection_reason: status === 'rejected' ? (reason ?? 'Dokumen tidak memenuhi syarat.') : null,
      })
      .eq('id', psychologistId)
      .select(PSY_FIELDS)
      .maybeSingle();
    if (error || !data) {
      console.error('[portal/admin] gagal verifikasi:', error);
      return json({ error: 'Gagal menyimpan status verifikasi.' }, 500);
    }
    return json({ psychologist: data });
  }

  return json({ error: 'Action tidak dikenal.' }, 400);
}
