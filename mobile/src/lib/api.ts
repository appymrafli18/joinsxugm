/**
 * Helper HTTP JSON ke server web (web/app/api/*) dengan otentikasi sesi.
 */
import { API_URL } from '@/constants/config';
import { supabase } from './supabase';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

const NETWORK_MESSAGE = 'Koneksi sedang bermasalah. Coba lagi sebentar lagi.';

export async function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return requestJson<T>('POST', path, body);
}

export async function getJson<T>(path: string): Promise<ApiResult<T>> {
  return requestJson<T>('GET', path);
}

async function requestJson<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiResult<T>> {
  if (!API_URL) {
    return {
      ok: false,
      message: 'EXPO_PUBLIC_API_URL belum diatur di .env mobile (alamat server web).',
    };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { ok: false, message: 'Sesi kamu habis. Masuk lagi ya.' };

    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401) {
      return { ok: false, message: 'Sesi kamu tidak valid. Masuk lagi ya.' };
    }
    const parsed = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok || parsed === null || 'error' in parsed) {
      return { ok: false, message: parsed?.error ?? 'Server sedang bermasalah. Coba lagi ya.' };
    }
    return { ok: true, data: parsed as T };
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
}
