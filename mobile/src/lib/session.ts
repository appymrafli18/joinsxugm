/**
 * Sesi konsultasi pasien <-> psikolog (mobile): bootstrap + chat teks.
 *
 * - Bootstrap (`/api/session`) memberi data booking, lawan bicara, & izin panggilan.
 * - Chat teks ditulis/ dibaca langsung ke Supabase (RLS `session_messages`),
 *   dengan Realtime + polling fallback. Panggilan suara/video memakai LiveKit
 *   (lihat `components/call/CallRoom.tsx`) — butuh development build.
 */
import { getJson, postJson } from './api';
import { supabase } from './supabase';

export type SessionRole = 'patient' | 'psychologist' | 'admin';

export type SessionBooking = {
  id: string;
  patient_id: string;
  psychologist_id: string;
  scheduled_at: string;
  status: string;
  paid_with: string;
  payment_status: string;
  price: number;
  points_used: number;
  duration_minutes: number;
  session_mode: 'voice' | 'video';
  patient_note: string | null;
};

export type SessionBootstrap = {
  booking: SessionBooking;
  role: SessionRole;
  me: { id: string; name: string };
  counterpart: { id: string; name: string; avatar_url: string | null };
  canCall: boolean;
  callMode: 'voice' | 'video';
  canChat: boolean;
};

export type SessionMessage = {
  id: string;
  sender_id: string;
  sender_role: 'patient' | 'psychologist';
  content: string;
  created_at: string;
};

export async function fetchSession(
  bookingId: string,
): Promise<{ ok: true; data: SessionBootstrap } | { ok: false; message: string }> {
  return getJson<SessionBootstrap>(`/api/session?bookingId=${encodeURIComponent(bookingId)}`);
}

/**
 * Kabari psikolog bahwa pasien sudah membuka ruang sesi (best-effort; email
 * dikirim server sekali per booking + indikator "menunggu" di dashboard).
 */
export async function notifySessionOpen(bookingId: string): Promise<void> {
  await postJson('/api/session/notify', { bookingId });
}

export async function fetchSessionMessages(bookingId: string): Promise<SessionMessage[]> {
  const result = await getJson<{ messages: SessionMessage[] }>(
    `/api/session/messages?bookingId=${encodeURIComponent(bookingId)}`,
  );
  return result.ok ? result.data.messages ?? [] : [];
}

export async function sendSessionMessage(
  bookingId: string,
  content: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await postJson<{ message: SessionMessage }>('/api/session/messages', { bookingId, content });
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

/**
 * Dengarkan pesan baru via Realtime. Mengembalikan fungsi pembersih.
 * Bila Realtime belum diaktifkan, tidak error — pemanggil tetap punya polling.
 */
export function subscribeSessionMessages(
  bookingId: string,
  onInsert: (message: SessionMessage) => void,
): () => void {
  try {
    const channel = supabase
      .channel(`session-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_messages', filter: `booking_id=eq.${bookingId}` },
        (payload) => onInsert(payload.new as SessionMessage),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}
