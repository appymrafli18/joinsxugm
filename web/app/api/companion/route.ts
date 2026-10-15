import { detectCrisis } from '@/lib/crisisKeywords';
import {
  ARCHETYPE_IDS,
  callClaude,
  callDeepSeek,
  heuristicExpression,
  mockReply,
  type ArchetypeId,
  type Expression,
} from '@/lib/companion';
import { createServiceClient, requireUser } from '@/lib/serverAuth';
import { runDailySentimentIfNeeded } from '@/lib/sentiment';
import { recomputePatientTier, CRISIS_SLA_MINUTES } from '@/lib/tierService';

/**
 * POST /api/companion — endpoint AI Companion (docs/api-contract.md).
 *
 * Provider: DeepSeek (utama, DEEPSEEK_API_KEY di server) → Claude (legacy)
 * → mock hanya bila tidak ada key sama sekali. Balasan + ekspresi disimpan
 * ke chat_logs; deteksi krisis memicu crisis_alerts via service role.
 */

const MAX_MESSAGE_LENGTH = 2000;
const HISTORY_LIMIT = 30;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  /* 1. Verifikasi sesi Supabase dari Authorization: Bearer <access token> */
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  /* 2. Validasi body */
  let body: { archetypeId?: unknown; message?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Body tidak valid.' }, 400);
  }
  const archetypeId = body.archetypeId;
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (
    typeof archetypeId !== 'string' ||
    !ARCHETYPE_IDS.includes(archetypeId as ArchetypeId)
  ) {
    return json({ error: 'archetypeId tidak valid.' }, 400);
  }
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return json({ error: 'Pesan kosong atau terlalu panjang.' }, 400);
  }

  const service = createServiceClient();
  if (!service) {
    return json({ error: 'Konfigurasi server belum lengkap.' }, 500);
  }

  /* 3. Pastikan user adalah pasien */
  const { data: patient, error: patientError } = await service
    .from('patients')
    .select('id, nickname')
    .eq('id', user.id)
    .maybeSingle();
  if (patientError) return json({ error: 'Gagal memverifikasi akun.' }, 500);
  if (!patient) return json({ error: 'Akun ini bukan akun pasien.' }, 403);

  /* 3a. Eskalasi malas (tanpa cron): alert pending > SLA ditandai escalated,
     dan pillah apakah ada psikolog on-call untuk pesan yang jujur ke pasien. */
  const slaCutoff = new Date(Date.now() - CRISIS_SLA_MINUTES * 60 * 1000).toISOString();
  const { data: escalatedRows } = await service
    .from('crisis_alerts')
    .update({ status: 'escalated' })
    .eq('patient_id', user.id)
    .eq('status', 'pending')
    .lt('created_at', slaCutoff)
    .select('id');
  const escalated = (escalatedRows?.length ?? 0) > 0;

  const { count: onCallCount } = await service
    .from('psychologists')
    .select('id', { count: 'exact', head: true })
    .eq('verification_status', 'verified')
    .eq('is_on_call', true);
  const onCall = (onCallCount ?? 0) > 0;

  /* 4. Deteksi krisis dari teks pasien (PRD Bagian 12 poin 2) */
  const flagged = detectCrisis(message);

  /* 5. Muat riwayat percakapan (30 pesan terakhir, kronologis) */
  const { data: recentLogs, error: historyError } = await service
    .from('chat_logs')
    .select('role, content, created_at')
    .eq('patient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (historyError) return json({ error: 'Gagal memuat riwayat.' }, 500);
  const history = (recentLogs ?? [])
    .slice()
    .reverse()
    .map((log) => ({
      role: log.role as 'user' | 'assistant',
      content: log.content,
    }));

  /* 6. Balasan: DeepSeek (utama) → Claude (legacy) → mock dev.
     Kegagalan provider TIDAK disamarkan sebagai balasan mock — error terbuka. */
  const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY);
  const hasAnthropic = !hasDeepSeek && Boolean(process.env.ANTHROPIC_API_KEY);
  let reply: string;
  let expression: Expression;
  if (hasDeepSeek || hasAnthropic) {
    try {
      const result = hasDeepSeek
        ? await callDeepSeek(archetypeId as ArchetypeId, message, history)
        : await callClaude(archetypeId as ArchetypeId, message, history);
      reply = result.reply;
      expression = result.expression;
    } catch (error) {
      console.error('[companion] provider AI gagal:', error);
      if (!flagged) {
        return json({ error: 'Companion sedang tidak bisa dihubungi. Coba lagi ya.' }, 502);
      }
      /* Keselamatan: saat krisis, alur (alert + kontak psikolog + tier)
         TIDAK BOLEH putus hanya karena provider AI gagal — pakai balasan
         krisis statis yang sudah ditulis hati-hati untuk momen ini. */
      console.warn('[companion] memakai balasan krisis statis (fallback keselamatan).');
      const fallback = mockReply(archetypeId as ArchetypeId, history.length, true);
      reply = fallback.reply;
      expression = 'khawatir';
    }
  } else {
    // Mode mock hanya saat TIDAK ADA key provider sama sekali (dev/demo).
    console.warn('[companion] mode mock — tidak ada DEEPSEEK_API_KEY / ANTHROPIC_API_KEY.');
    const mock = mockReply(archetypeId as ArchetypeId, history.length, flagged);
    reply = mock.reply;
    expression = heuristicExpression(message);
  }
  if (flagged) expression = 'khawatir';

  /* 7. Simpan chat_logs (user → assistant) lalu crisis_alerts bila flagged.
     Urutan penting: crisis_alerts.chat_log_id → FK ke log pesan user. */
  const { data: userLog, error: userLogError } = await service
    .from('chat_logs')
    .insert({ patient_id: user.id, role: 'user', content: message, flagged })
    .select('id')
    .single();
  if (userLogError || !userLog) {
    console.error('[companion] gagal simpan pesan user:', userLogError);
    return json({ error: 'Gagal menyimpan percakapan.' }, 500);
  }

  const { error: assistantLogError } = await service.from('chat_logs').insert({
    patient_id: user.id,
    role: 'assistant',
    content: reply,
    expression,
    flagged: false,
  });
  if (assistantLogError) {
    console.error('[companion] gagal simpan balasan:', assistantLogError);
    return json({ error: 'Gagal menyimpan percakapan.' }, 500);
  }

  /* 7a. Krisis: pilih psikolog acak (on-call diutamakan — PRD Bagian 9),
     tugaskan langsung ke pasien, dan catat alert yang kaya konteks. */
  let crisisContact: { id: string; nickname: string | null } | null = null;
  if (flagged) {
    const { data: onCallPool } = await service
      .from('psychologists')
      .select('id, nickname')
      .eq('verification_status', 'verified')
      .eq('is_on_call', true);
    let pool = onCallPool ?? [];
    if (pool.length === 0) {
      const { data: verifiedPool } = await service
        .from('psychologists')
        .select('id, nickname')
        .eq('verification_status', 'verified');
      pool = verifiedPool ?? [];
    }
    if (pool.length > 0) {
      const picked = pool[Math.floor(Math.random() * pool.length)];
      crisisContact = { id: picked.id, nickname: picked.nickname ?? null };
      // Hubungkan langsung tanpa proses booking (krisis selalu gratis).
      await service
        .from('patients')
        .update({ assigned_psychologist_id: crisisContact.id })
        .eq('id', user.id);
    }

    const { error: alertError } = await service.from('crisis_alerts').insert({
      patient_id: user.id,
      chat_log_id: userLog.id,
      patient_nickname: patient.nickname,
      trigger_excerpt: message.slice(0, 200),
      status: 'pending',
    });
    if (alertError) {
      // Keselamatan: alert krisis wajib tercatat — gagal = error keras.
      console.error('[companion] GAGAL simpan crisis_alerts:', alertError);
      return json({ error: 'Gagal memicu peringatan krisis.' }, 500);
    }
    // Override triase: krisis aktif → tier high (PRD Bagian 8).
    await recomputePatientTier(service, user.id);
  }

  /* 8. Analisis sentimen harian best-effort (tidak memblokir balasan).
     Hasilnya dipakai dashboard psikolog + tren mesin tier. */
  void runDailySentimentIfNeeded(service, user.id)
    .then((created) => {
      if (created) return recomputePatientTier(service, user.id);
      return null;
    })
    .catch((error) => console.warn('[companion] sentimen harian gagal:', error));

  return json({ reply, flagged, expression, onCall, escalated, crisisContact });
}
