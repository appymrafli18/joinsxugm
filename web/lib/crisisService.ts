import type { SupabaseClient } from '@supabase/supabase-js';

import { crisisEmail, escalationEmail, portalUrl, resolveUserEmails, sendEmail } from './notify';

/**
 * Alur eskalasi krisis (PRD Bagian 9) — dipakai bersama oleh:
 *   - `/api/cron/sweep`      (jalur utama, dijadwalkan)
 *   - `POST /api/companion`  (fallback best-effort bila cron belum dipasang)
 *   - `POST /api/portal/psikolog` action `alert-ack` (eskalasi manual)
 *
 * Aturan:
 *   - Krisis → alert `pending` + notifikasi ke psikolog on-call yang dipilih.
 *   - Alert `pending` lewat SLA → `escalated` + notifikasi ke seluruh psikolog
 *     terverifikasi.
 * Semua notifikasi best-effort (tidak pernah melempar, tidak memutus alur).
 */

const DEFAULT_SLA_MINUTES = 15;

/** Batas respons psikolog sebelum alert di-eskalasi otomatis (menit). */
export function crisisSlaMinutes(): number {
  const raw = Number(process.env.CRISIS_SLA_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_SLA_MINUTES;
}

export type CrisisAlertSummary = {
  alertId: string;
  patientId: string;
  nickname: string | null;
  excerpt: string | null;
  createdAt: string;
};

type AlertRow = {
  id: string;
  patient_id: string;
  patient_nickname?: string | null;
  trigger_excerpt?: string | null;
  created_at: string;
};

/** Id psikolog terverifikasi (kandidat notifikasi eskalasi). */
export async function listVerifiedPsychologistIds(service: SupabaseClient): Promise<string[]> {
  const { data } = await service
    .from('psychologists')
    .select('id')
    .eq('verification_status', 'verified');
  return (data ?? []).map((row) => String(row.id));
}

/* Kolom audit opsional (lihat docs/schema.sql). Bila migration belum
   dijalankan, update audit ini gagal dan dilewati — status inti tetap aman. */
let auditColumnSupported: boolean | null = null;

async function recordEscalationAudit(service: SupabaseClient, alertIds: string[]): Promise<void> {
  if (auditColumnSupported === false || alertIds.length === 0) return;
  const { error } = await service
    .from('crisis_alerts')
    .update({ escalated_at: new Date().toISOString() })
    .in('id', alertIds);
  if (error) {
    if (/escalated_at/i.test(error.message) && /column|schema/i.test(error.message)) {
      auditColumnSupported = false;
      console.warn('[crisis] kolom escalated_at belum ada — audit dilewati. Jalankan migration di docs/schema.sql.');
    } else {
      console.warn('[crisis] gagal menulis audit eskalasi:', error.message);
    }
    return;
  }
  auditColumnSupported = true;
}

/**
 * Sweep SLA: semua alert `pending` yang melewati batas → `escalated` +
 * notifikasi tim. Idempotent (hanya menyentuh baris yang masih `pending`).
 */
export async function escalateOverdueAlerts(service: SupabaseClient): Promise<CrisisAlertSummary[]> {
  const cutoff = new Date(Date.now() - crisisSlaMinutes() * 60_000).toISOString();

  let rows: AlertRow[] = [];
  try {
    const { data, error } = await service
      .from('crisis_alerts')
      .update({ status: 'escalated' })
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .select('id, patient_id, patient_nickname, trigger_excerpt, created_at');
    if (error) {
      console.error('[crisis] sweep gagal:', error.message);
      return [];
    }
    rows = (data ?? []) as AlertRow[];
  } catch (error) {
    console.error('[crisis] sweep error:', error);
    return [];
  }

  const alerts: CrisisAlertSummary[] = rows.map((row) => ({
    alertId: row.id,
    patientId: row.patient_id,
    nickname: row.patient_nickname ?? null,
    excerpt: row.trigger_excerpt ?? null,
    createdAt: row.created_at,
  }));

  if (alerts.length > 0) {
    await recordEscalationAudit(service, alerts.map((alert) => alert.alertId));
    await notifyEscalationToTeam(service, alerts);
  }
  return alerts;
}

/** Notifikasi satu psikolog saat krisis baru terdeteksi (dipilih on-call/acak). */
export async function notifyPsychologistOfCrisis(
  service: SupabaseClient,
  psychologistId: string,
  context: { patientNickname: string | null; excerpt: string | null; alertId: string },
): Promise<boolean> {
  try {
    const emails = await resolveUserEmails(service, [psychologistId]);
    const to = emails.get(psychologistId);
    if (!to) {
      console.warn('[crisis] email psikolog on-call tidak ditemukan untuk dinotifikasi:', psychologistId);
      return false;
    }
    const email = crisisEmail({
      patientNickname: context.patientNickname,
      excerpt: context.excerpt,
      createdAt: new Date().toISOString(),
      link: `${portalUrl()}/portal/psikolog`,
    });
    return await sendEmail({ ...email, to: [to] });
  } catch (error) {
    console.error('[crisis] notifikasi on-call gagal:', error);
    return false;
  }
}

/** Notifikasi seluruh psikolog terverifikasi saat alert di-eskalasi. */
export async function notifyEscalationToTeam(
  service: SupabaseClient,
  alerts: CrisisAlertSummary[],
): Promise<number> {
  try {
    if (alerts.length === 0) return 0;

    const ids = await listVerifiedPsychologistIds(service);
    if (ids.length === 0) {
      console.warn('[crisis] eskalasi tanpa psikolog terverifikasi untuk dinotifikasi.');
      return 0;
    }

    const emails = await resolveUserEmails(service, ids);
    if (emails.size === 0) {
      console.warn('[crisis] alamat email psikolog tidak ditemukan — eskalasi hanya tercatat di DB.');
      return 0;
    }

    const template = escalationEmail({
      items: alerts.map((alert) => ({
        nickname: alert.nickname,
        excerpt: alert.excerpt,
        createdAt: alert.createdAt,
      })),
      slaMinutes: crisisSlaMinutes(),
      link: `${portalUrl()}/portal/psikolog`,
    });

    const results = await Promise.allSettled(
      [...emails.values()].map((to) => sendEmail({ ...template, to: [to] })),
    );
    const sent = results.filter((result) => result.status === 'fulfilled' && result.value === true).length;
    if (sent === 0) {
      console.warn('[crisis] tidak ada email eskalasi terkirim (cek RESEND_API_KEY/NOTIFY_FROM).');
    }
    return sent;
  } catch (error) {
    console.error('[crisis] notifikasi eskalasi gagal:', error);
    return 0;
  }
}
