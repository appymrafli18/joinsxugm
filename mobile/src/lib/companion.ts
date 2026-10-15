/**
 * Client untuk POST /api/companion + pembaca riwayat chat_logs.
 */
import { API_URL } from '@/constants/config';
import { supabase } from './supabase';

export type Expression = 'netral' | 'senang' | 'khawatir';

export type CrisisContact = { id: string; nickname: string | null };

export type CompanionReply = {
  reply: string;
  flagged: boolean;
  expression: Expression;
  /** Ada psikolog terverifikasi berstatus on-call saat ini. */
  onCall: boolean;
  /** Alert krisis lama baru saja dieskalasi (SLA terlampaui). */
  escalated: boolean;
  /** Psikolog yang dihubungkan langsung saat krisis (acak, on-call diutamakan). */
  crisisContact: CrisisContact | null;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  expression?: Expression | null;
  flagged?: boolean;
};

export type SendResult =
  | { ok: true; data: CompanionReply }
  | { ok: false; message: string };

const NETWORK_MESSAGE = 'Koneksi sedang bermasalah. Coba lagi sebentar lagi.';

/** Riwayat 50 pesan terakhir (RLS: pasien hanya baca chat_logs miliknya). */
export async function fetchChatHistory(limit = 50): Promise<ChatMessage[]> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return [];
    const { data } = await supabase
      .from('chat_logs')
      .select('id, role, content, expression, flagged, created_at')
      .eq('patient_id', userData.user.id)
      .order('created_at', { ascending: true })
      .limit(limit);
    return (data ?? []).map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      expression: (row.expression as Expression | null) ?? null,
      flagged: Boolean(row.flagged),
    }));
  } catch {
    return [];
  }
}

export async function sendCompanionMessage(
  archetypeId: string,
  message: string,
): Promise<SendResult> {
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

    const response = await fetch(`${API_URL}/api/companion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ archetypeId, message }),
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: 'Sesi kamu tidak valid. Masuk lagi ya.' };
    }
    const body = (await response.json().catch(() => null)) as {
      reply?: string;
      flagged?: boolean;
      expression?: Expression;
      onCall?: boolean;
      escalated?: boolean;
      crisisContact?: { id?: string; nickname?: string | null } | null;
      error?: string;
    } | null;
    if (!response.ok || !body?.reply) {
      return { ok: false, message: body?.error ?? 'Companion sedang tidak bisa dihubungi. Coba lagi ya.' };
    }
    const contact = body.crisisContact;
    return {
      ok: true,
      data: {
        reply: body.reply,
        flagged: Boolean(body.flagged),
        expression: body.expression ?? 'netral',
        onCall: Boolean(body.onCall),
        escalated: Boolean(body.escalated),
        crisisContact:
          contact && typeof contact.id === 'string'
            ? { id: contact.id, nickname: contact.nickname ?? null }
            : null,
      },
    };
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
}
