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
