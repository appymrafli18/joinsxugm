import { authorizeCron } from '@/lib/cronAuth';
import { crisisSlaMinutes, escalateOverdueAlerts } from '@/lib/crisisService';
import { createServiceClient } from '@/lib/serverAuth';

/**
 * /api/cron/sweep — sweep SLA krisis (dijadwalkan, lihat docs/cron.sql).
 *
 * Semua alert krisis `pending` yang melewati CRISIS_SLA_MINUTES menit tanpa
 * ditanggapi → `escalated` + notifikasi email ke seluruh psikolog terverifikasi.
 * Idempotent: aman dipanggil sesering apa pun.
 */

export const dynamic = 'force-dynamic';

async function handle(request: Request): Promise<Response> {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const service = createServiceClient();
  if (!service) return Response.json({ error: 'Konfigurasi server belum lengkap.' }, { status: 500 });

  const escalated = await escalateOverdueAlerts(service);
  return Response.json({
    ok: true,
    slaMinutes: crisisSlaMinutes(),
    escalated: escalated.length,
    alerts: escalated.map((alert) => ({
      alertId: alert.alertId,
      patientId: alert.patientId,
      createdAt: alert.createdAt,
    })),
  });
}

export const GET = handle;
export const POST = handle;
