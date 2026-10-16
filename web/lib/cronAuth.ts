/**
 * Otorisasi endpoint cron (server-to-server).
 *
 * Scheduler (pg_cron/pg_net, systemd timer, Vercel Cron, dst.) memanggil
 * `/api/cron/*` dengan header `Authorization: Bearer <CRON_SECRET>` —
 * alternatifnya `x-cron-secret`. Return Response bila ditolak (401/503),
 * atau null bila lolos.
 */
export function authorizeCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET belum diatur di server.' }, { status: 503 });
  }

  const header = request.headers.get('authorization');
  const bearer = header?.replace(/^Bearer\s+/i, '').trim();
  const token = bearer || request.headers.get('x-cron-secret')?.trim();
  if (token !== secret) {
    return Response.json({ error: 'Tidak terautentikasi.' }, { status: 401 });
  }
  return null;
}
