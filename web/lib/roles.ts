import type { User } from '@supabase/supabase-js';

import { createServiceClient, requireUser } from './serverAuth';

/**
 * Peran portal web: Admin / Psikolog / Pasien.
 *
 * - Admin: allowlist server-side via env ADMIN_EMAILS (dipisah koma) —
 *   tidak ada data role di klien yang bisa diubah pengguna.
 * - Psikolog: punya baris di tabel psychologists.
 * - Pasien: punya baris di tabel patients (tetap dikenali untuk memblokir
 *   akses portal, bukan untuk UI pasien web).
 */
export type PortalRole = 'admin' | 'psychologist' | 'patient';

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function resolvePortalRole(
  userId: string,
  email: string | null | undefined,
): Promise<PortalRole | null> {
  if (isAdminEmail(email)) return 'admin';
  const service = createServiceClient();
  if (!service) return null;
  const [{ data: psychologist }, { data: patient }] = await Promise.all([
    service.from('psychologists').select('id').eq('id', userId).maybeSingle(),
    service.from('patients').select('id').eq('id', userId).maybeSingle(),
  ]);
  if (psychologist) return 'psychologist';
  if (patient) return 'patient';
  return null;
}

export type RequireRoleResult =
  | { user: User; role: PortalRole; response?: undefined }
  | { user?: undefined; role?: undefined; response: Response };

/** Verifikasi Bearer token + pastikan role termasuk yang diizinkan. */
export async function requirePortalRole(
  request: Request,
  allowed: PortalRole[],
): Promise<RequireRoleResult> {
  const auth = await requireUser(request);
  if (auth.response) return { response: auth.response };

  const role = await resolvePortalRole(auth.user.id, auth.user.email);
  if (!role || !allowed.includes(role)) {
    return { response: Response.json({ error: 'Akses ditolak.' }, { status: 403 }) };
  }
  return { user: auth.user, role };
}
