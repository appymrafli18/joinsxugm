import type { SupabaseClient } from '@supabase/supabase-js';

import { computeTier, signalWindowStartIso, type Tier } from './tier';

/**
 * Hitung ulang tier pasien dari data nyata lalu simpan (server-side —
 * kolom patients.tier tidak boleh diupdate klien).
 * Dipakai oleh /api/screening dan /api/companion (saat krisis terdeteksi).
 */
export async function recomputePatientTier(
  service: SupabaseClient,
  patientId: string,
): Promise<Tier | null> {
  const { data: latest } = await service
    .from('screening_scores')
    .select('total')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: flaggedCount } = await service
    .from('chat_logs')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('role', 'user')
    .eq('flagged', true)
    .gte('created_at', signalWindowStartIso());

  const { count: activeCrisisCount } = await service
    .from('crisis_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .in('status', ['pending', 'acknowledged', 'escalated']);

  /* Tren sentimen: 3 hari terakhir dari sentiment_logs (PRD Bagian 8 poin 2). */
  const { data: sentimentRows } = await service
    .from('sentiment_logs')
    .select('cemas_score, date')
    .eq('patient_id', patientId)
    .order('date', { ascending: false })
    .limit(3);
  const rows = sentimentRows ?? [];
  const latestCemasScore = rows[0] ? Number(rows[0].cemas_score) : null;
  const sentimentRising =
    rows.length === 3 &&
    Number(rows[0].cemas_score) > Number(rows[1].cemas_score) &&
    Number(rows[1].cemas_score) > Number(rows[2].cemas_score);

  const tier = computeTier({
    screeningTotal: latest ? Number(latest.total) : null,
    recentFlaggedCount: flaggedCount ?? 0,
    hasActiveCrisis: (activeCrisisCount ?? 0) > 0,
    sentimentRising,
    latestCemasScore,
  });

  const { error } = await service.from('patients').update({ tier }).eq('id', patientId);
  if (error) {
    console.error('[tier] gagal menyimpan tier:', error);
    return null;
  }
  return tier;
}
