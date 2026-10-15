import { requireUser } from '@/lib/serverAuth';
import { resolvePortalRole } from '@/lib/roles';

/**
 * GET /api/portal/me — identitas & peran untuk pengarahan portal.
 * Response: { role, name } — role null berarti akun tidak berhak masuk portal.
 */

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  const role = await resolvePortalRole(user.id, user.email);
  if (!role) return json({ role: null, name: null });

  if (role === 'admin') {
    return json({ role, name: user.email ?? 'Admin' });
  }

  /* Ambil nama tampilan sesuai peran. */
  const { createServiceClient } = await import('@/lib/serverAuth');
  const service = createServiceClient();
  if (role === 'psychologist') {
    const { data } = await service!
      .from('psychologists')
      .select('nickname, full_name, verification_status')
      .eq('id', user.id)
      .maybeSingle();
    return json({
      role,
      name: data?.nickname ?? data?.full_name ?? 'Psikolog',
      verificationStatus: data?.verification_status ?? null,
    });
  }
  const { data } = await service!
    .from('patients')
    .select('nickname')
    .eq('id', user.id)
    .maybeSingle();
  return json({ role, name: data?.nickname ?? 'Pasien' });
}
