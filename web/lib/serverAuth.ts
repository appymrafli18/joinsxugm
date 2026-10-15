import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabaseClient';

/**
 * Helper server-side untuk route handlers patient API.
 * Verifikasi Authorization: Bearer <supabase access token>.
 */

export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type RequireUserResult =
  | { user: User; response?: undefined }
  | { user?: undefined; response: Response };

export async function requireUser(request: Request): Promise<RequireUserResult> {
  const authorization = request.headers.get('Authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { response: Response.json({ error: 'Tidak terautentikasi.' }, { status: 401 }) };
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { response: Response.json({ error: 'Sesi tidak valid.' }, { status: 401 }) };
  }
  return { user };
}
