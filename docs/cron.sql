-- =====================================================================
-- cron.sql — jadwal otomatis Vsikolog (Supabase pg_cron + pg_net)
-- =====================================================================
-- Menggantikan sweep "lazy" di /api/companion sebagai jalur utama:
--   1) /api/cron/sweep  → tiap menit: alert pending > SLA → escalated + email
--   2) /api/cron/daily  → harian: analisis sentimen pasien yang aktif hari ini
--
-- Prasyarat:
--   - ekstensi pg_cron & pg_net. Aktifkan lewat Dashboard Supabase →
--     Database → Extensions bila belum (beberapa proyek mengaktifkannya
--     lewat dashboard, bukan SQL).
--   - app web sudah ter-deploy dan punya env CRON_SECRET (sama dengan di sini).
-- Ganti <WEB_BASE_URL> (mis. https://vsikolog.example.com) dan <CRON_SECRET>.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Sweep SLA krisis — tiap menit.
select cron.schedule(
  'vsikolog-crisis-sweep',
  '* * * * *',
  $$
  select net.http_get(
    url := '<WEB_BASE_URL>/api/cron/sweep',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);

-- Sentimen harian — 23:30 UTC (≈ 06:30 WIB).
select cron.schedule(
  'vsikolog-daily-sentiment',
  '30 23 * * *',
  $$
  select net.http_get(
    url := '<WEB_BASE_URL>/api/cron/daily',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);

-- Cek jadwal   : select jobid, schedule, jobname from cron.job;
-- Cek riwayat  : select * from cron.job_run_details order by start_time desc limit 20;
-- Hapus jadwal : select cron.unschedule('vsikolog-crisis-sweep');

-- ---------------------------------------------------------------------
-- ALTERNATIF tanpa pg_cron (systemd timer, Vercel Cron, GitHub Actions):
--   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<WEB_BASE_URL>/api/cron/sweep
--   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<WEB_BASE_URL>/api/cron/daily
-- Endpoint juga menerima header `x-cron-secret`. Tanpa CRON_SECRET, endpoint
-- mengembalikan 503; dengan secret salah, 401.
-- ---------------------------------------------------------------------
