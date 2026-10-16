import { postJson } from './api';

/**
 * Client panggilan manusia (LiveKit) — token dibuat server, berumur pendek.
 * Sesi ini TIDAK memakai AI: suara/video berasal dari psikolog asli.
 */
export type CallSession = {
  url: string;
  token: string;
  mode: 'voice' | 'video';
  role: 'patient' | 'psychologist' | 'admin';
  psychologist: { nickname: string | null; avatar_url: string | null };
};

export async function fetchCallToken(
  bookingId: string,
): Promise<{ ok: true; data: CallSession } | { ok: false; message: string; status?: number }> {
  const result = await postJson<CallSession>('/api/calls/token', { bookingId });
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, data: result.data };
}

/**
 * Tautan panggilan yang dibuka di browser (untuk perangkat tanpa modul native
 * WebRTC — mis. Expo Go). Token dibuat server, berumur pendek.
 */
export async function fetchCallLink(
  bookingId: string,
): Promise<{ ok: true; joinUrl: string; mode: 'voice' | 'video' } | { ok: false; message: string }> {
  const result = await postJson<{ joinUrl: string; mode: 'voice' | 'video' }>('/api/calls/link', { bookingId });
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, joinUrl: result.data.joinUrl, mode: result.data.mode };
}
