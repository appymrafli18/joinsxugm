import { supabase } from './supabaseClient';

/**
 * Helper client portal (browser): fetch terautentikasi + sign in/out.
 * Sesi disimpan supabase-js; server memverifikasi Bearer token.
 */

export type PortalFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status?: number };

export async function portalFetch<T>(
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: unknown },
): Promise<PortalFetchResult<T>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, message: 'Belum masuk.', status: 401 };

  try {
    const response = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const parsed = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok || !parsed || 'error' in parsed) {
      return { ok: false, message: parsed?.error ?? 'Terjadi kesalahan.', status: response.status };
    }
    return { ok: true, data: parsed as T };
  } catch {
    return { ok: false, message: 'Koneksi bermasalah. Coba lagi.' };
  }
}

export async function portalSignIn(email: string, password: string): Promise<PortalFetchResult<null>> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes('invalid login credentials')) return { ok: false, message: 'Email atau kata sandi salah.' };
      if (message.includes('email not confirmed')) return { ok: false, message: 'Email belum dikonfirmasi.' };
      if (message.includes('rate limit') || message.includes('too many')) return { ok: false, message: 'Terlalu banyak percobaan. Tunggu sebentar.' };
      return { ok: false, message: 'Gagal masuk. Coba lagi.' };
    }
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: 'Koneksi bermasalah. Coba lagi.' };
  }
}

export async function portalSignOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // abaikan
  }
}
