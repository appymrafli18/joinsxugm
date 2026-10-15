import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Analisis sentimen harian dari transkrip chat pasien (PRD Bagian 12 poin 3).
 * Memakai DeepSeek (server-side) → skor stabil/cemas 0–100 → sentiment_logs.
 * Hasilnya menjadi tren yang dipakai dashboard psikolog dan mesin tier.
 */

export type SentimentScores = { stabilScore: number; cemasScore: number };

const MAX_MESSAGES = 50;
const MIN_MESSAGES_FOR_ANALYSIS = 3;

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseScores(text: string): SentimentScores | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as { stabil_score?: unknown; cemas_score?: unknown };
    if (typeof parsed.stabil_score === 'number' && typeof parsed.cemas_score === 'number') {
      return { stabilScore: clampScore(parsed.stabil_score), cemasScore: clampScore(parsed.cemas_score) };
    }
  } catch {
    // jatuh ke null
  }
  return null;
}

export async function analyzeSentiment(messages: string[]): Promise<SentimentScores | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || messages.length === 0) return null;

  const model = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
  const system = `Kamu membantu sistem kesehatan mental (bukan diagnosis). Nilai kumpulan pesan pasien ini dalam dua skor 0-100:
- stabil_score: seberapa stabil/tenang kondisi yang tampak dari pesan
- cemas_score: seberapa besar kecemasan/distres yang tampak dari pesan
Balas HANYA JSON valid: {"stabil_score": <0-100>, "cemas_score": <0-100>}`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: messages.map((m, i) => `Pesan ${i + 1}: ${m}`).join('\n') },
      ],
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      max_tokens: 200,
      temperature: 0.2,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`DeepSeek sentiment ${response.status}: ${detail.slice(0, 160)}`);
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseScores(data.choices?.[0]?.message?.content ?? '');
}

/**
 * Jalankan analisis harian bila belum ada (idempotent per tanggal).
 * Dipanggil best-effort dari /api/companion dan bisa juga manual via
 * POST /api/sentiment. Cocok untuk MVP tanpa cron; produksi sebaiknya
 * memakai scheduled job (Supabase Edge Function / cron).
 */
export async function runDailySentimentIfNeeded(
  service: SupabaseClient,
  patientId: string,
  dateIso?: string,
): Promise<boolean> {
  const date = dateIso ?? new Date().toISOString().slice(0, 10);

  const { data: existing } = await service
    .from('sentiment_logs')
    .select('id')
    .eq('patient_id', patientId)
    .eq('date', date)
    .maybeSingle();
  if (existing) return false;

  const { data: logs } = await service
    .from('chat_logs')
    .select('content')
    .eq('patient_id', patientId)
    .eq('role', 'user')
    .gte('created_at', `${date}T00:00:00.000Z`)
    .lte('created_at', `${date}T23:59:59.999Z`)
    .order('created_at', { ascending: true })
    .limit(MAX_MESSAGES);
  const messages = (logs ?? []).map((row) => row.content).filter(Boolean);
  if (messages.length < MIN_MESSAGES_FOR_ANALYSIS) return false;

  const scores = await analyzeSentiment(messages);
  if (!scores) return false;

  const { error } = await service.from('sentiment_logs').insert({
    patient_id: patientId,
    date,
    stabil_score: scores.stabilScore,
    cemas_score: scores.cemasScore,
  });
  if (error) {
    console.warn('[sentiment] gagal simpan:', error.message);
    return false;
  }
  return true;
}
