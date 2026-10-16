import type { SupabaseClient } from '@supabase/supabase-js';

import { authorizeCron } from '@/lib/cronAuth';
import { runDailySentimentIfNeeded } from '@/lib/sentiment';
import { runDailySummaryIfNeeded } from '@/lib/summary';
import { createServiceClient } from '@/lib/serverAuth';
import { recomputePatientTier } from '@/lib/tierService';

/**
 * /api/cron/daily — analisis sentimen harian (dijadwalkan, lihat docs/cron.sql).
 *
 * Memindahkan beban "lazy" dari /api/companion: untuk setiap pasien yang
 * punya aktivitas chat hari ini, hitung sentimen (idempotent per tanggal) lalu
 * perbarui tier. Hasilnya jadi tren di dashboard psikolog & mesin triase.
 */

export const dynamic = 'force-dynamic';

const MAX_ACTIVE_LOGS = 2000;

async function activePatientIds(service: SupabaseClient, dateIso: string): Promise<string[]> {
  const { data } = await service
    .from('chat_logs')
    .select('patient_id')
    .gte('created_at', `${dateIso}T00:00:00.000Z`)
    .lte('created_at', `${dateIso}T23:59:59.999Z`)
    .limit(MAX_ACTIVE_LOGS);
  return [...new Set((data ?? []).map((row) => String(row.patient_id)))];
}

async function handle(request: Request): Promise<Response> {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const service = createServiceClient();
  if (!service) return Response.json({ error: 'Konfigurasi server belum lengkap.' }, { status: 500 });

  const date = new Date().toISOString().slice(0, 10);
  const patientIds = await activePatientIds(service, date);

  let created = 0;
  let summaries = 0;
  for (const patientId of patientIds) {
    const ok = await runDailySentimentIfNeeded(service, patientId, date).catch((error) => {
      console.warn('[cron/daily] sentimen gagal:', error);
      return false;
    });
    if (ok) {
      created += 1;
      await recomputePatientTier(service, patientId);
    }
    const summarized = await runDailySummaryIfNeeded(service, patientId, date).catch((error) => {
      console.warn('[cron/daily] ringkasan gagal:', error);
      return false;
    });
    if (summarized) summaries += 1;
  }

  return Response.json({ ok: true, date, patients: patientIds.length, created, summaries });
}

export const GET = handle;
export const POST = handle;
