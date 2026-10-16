import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ringkasan AI naratif untuk psikolog (PRD Bagian 12 poin 5).
 *
 * Mengubah riwayat percakapan pasien jadi ringkasan singkat yang relevan secara
 * klinis (konteks, pola yang berulang, nada emosi) — BUKAN transkrip mentah dan
 * BUKAN diagnosis. Dipakai dashboard psikolog dengan label "catatan AI —
 * referensi awal". Memakai DeepSeek (server-side), disimpan di `ai_summaries`.
 */

const MAX_MESSAGES = 60;
const MIN_MESSAGES_FOR_SUMMARY = 3;

export async function analyzeSummary(messages: string[]): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || messages.length === 0) return null;

  const model = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
  const system = `Kamu asisten klinis yang menulis ringkasan untuk psikolog (BUKAN diagnosis).
Buat ringkasan singkat 3-4 kalimat dalam Bahasa Indonesia dari pesan-pesan pasien:
sebutkan konteks yang dibicarakan, pola yang berulang, dan nada emosi yang terasa.
Aturan: netral; JANGAN memberi diagnosis/klaim penyakit; JANGAN menyebut obat/dosis;
JANGAN menyalin mentah; akhiri dengan pengingat singkat bahwa ini catatan AI sebagai
referensi awal, bukan fakta pasti. Balas hanya teks ringkasannya.`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: messages.map((m, i) => `Pesan ${i + 1}: ${m}`).join('\n') },
      ],
      thinking: { type: 'disabled' },
      max_tokens: 320,
      temperature: 0.3,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`DeepSeek summary ${response.status}: ${detail.slice(0, 160)}`);
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = (data.choices?.[0]?.message?.content ?? '').trim();
  return text || null;
}

/**
 * Buat ringkasan harian bila belum ada (idempotent per tanggal).
 * Dipanggil best-effort dari `/api/companion` dan terjadwal via `/api/cron/daily`.
 */
export async function runDailySummaryIfNeeded(
  service: SupabaseClient,
  patientId: string,
  dateIso?: string,
): Promise<boolean> {
  const date = dateIso ?? new Date().toISOString().slice(0, 10);

  const { data: existing } = await service
    .from('ai_summaries')
    .select('id')
    .eq('patient_id', patientId)
    .eq('period_start', date)
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
  if (messages.length < MIN_MESSAGES_FOR_SUMMARY) return false;

  const summary = await analyzeSummary(messages);
  if (!summary) return false;

  const { error } = await service.from('ai_summaries').insert({
    patient_id: patientId,
    summary,
    period_start: date,
    period_end: date,
  });
  if (error) {
    console.warn('[summary] gagal simpan:', error.message);
    return false;
  }
  return true;
}

export type PatientSummary = { text: string; date: string };

/**
 * Ambil ringkasan terbaru; bila belum ada untuk hari ini, buat sekarang dari
 * pesan-pesan terakhir (dipakai tombol "Buat ringkasan sekarang" di ruang sesi
 * — tetap sekali jalan & tersimpan, bukan refresh bebas).
 */
export async function generateSummaryNow(
  service: SupabaseClient,
  patientId: string,
): Promise<PatientSummary | null> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await service
    .from('ai_summaries')
    .select('summary, period_start')
    .eq('patient_id', patientId)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.period_start === today) {
    return { text: existing.summary, date: existing.period_start };
  }

  const { data: logs } = await service
    .from('chat_logs')
    .select('content')
    .eq('patient_id', patientId)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(MAX_MESSAGES);
  const messages = (logs ?? [])
    .map((row) => row.content)
    .filter(Boolean)
    .reverse();
  if (messages.length < MIN_MESSAGES_FOR_SUMMARY) return null;

  const summary = await analyzeSummary(messages);
  if (!summary) return null;

  const { error } = await service.from('ai_summaries').insert({
    patient_id: patientId,
    summary,
    period_start: today,
    period_end: today,
  });
  if (error) console.warn('[summary] gagal simpan (now):', error.message);
  return { text: summary, date: today };
}
