create extension if not exists "pgcrypto";

create table psychologists (
  id uuid primary key references auth.users(id),
  full_name text not null,
  license_number text not null,
  license_document_url text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),

  nickname text,
  avatar_url text,
  education text,
  specialization text,
  price_per_session numeric,
  is_on_call boolean not null default false,
  created_at timestamptz not null default now()
);

create table patients (
  id uuid primary key references auth.users(id),
  archetype_id text not null check (archetype_id in ('guardian', 'healer', 'scholar', 'companion')),
  tier text not null default 'low' check (tier in ('low', 'medium', 'high')),
  assigned_psychologist_id uuid references psychologists(id),
  total_points int not null default 0,
  data_sharing_consent boolean not null default false,
  consent_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table screening_scores (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  instrument text not null default 'custom' check (instrument in ('gad7', 'phq9', 'custom')),
  total_score numeric not null,
  raw_answers jsonb,
  created_at timestamptz not null default now()
);

create table chat_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  expression text check (expression in ('netral', 'senang', 'khawatir')),
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

create table sentiment_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  date date not null,
  stabil_score numeric not null check (stabil_score >= 0 and stabil_score <= 100),
  cemas_score numeric not null check (cemas_score >= 0 and cemas_score <= 100),
  created_at timestamptz not null default now(),
  unique (patient_id, date)
);

create table crisis_alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  chat_log_id uuid not null references chat_logs(id),
  status text not null default 'pending'
    check (status in ('pending', 'acknowledged', 'escalated', 'resolved')),
  acknowledged_by uuid references psychologists(id),
  escalated_at timestamptz,
  notified_psychologist_ids uuid[],
  created_at timestamptz not null default now()
);

create table quests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  category text not null
    check (category in ('indoor_ringan', 'outdoor_ringan', 'outdoor_sedang', 'sosial')),
  level int not null default 1,
  title text not null,
  points int not null default 10,
  status text not null default 'active' check (status in ('active', 'completed', 'skipped')),
  route_data jsonb,
  social_report text,
  feeling_input text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  progress_value int not null default 0,
  target_value int not null default 1,
  unit text
);

-- CATATAN (ditemukan dari DB cloud, tidak ada di file ini sebelumnya):
-- 1. DB produksi punya constraint `quests_feeling_input_check` yang SANGAT
--    ketat — dari 58 kandidat kata hanya 'biasa' yang diterima (sisa
--    placeholder). Server /api/quests sudah fallback menyimpan perasaan ke
--    social_report. Untuk memakai kolom feeling_input sesuai desain chips
--    (lega/senang/cemas/biasa saja/lelah), jalankan di Supabase SQL Editor:
--
--      alter table quests drop constraint quests_feeling_input_check;
--      alter table quests add constraint quests_feeling_input_check
--        check (feeling_input is null
--               or feeling_input in ('lega', 'senang', 'cemas', 'biasa saja', 'lelah'));
--
-- 2. Hak akses DB cloud (di luar RLS): role `authenticated` hanya punya
--    GRANT SELECT pada quests; INSERT/UPDATE quests serta update patients
--    .total_points / .data_sharing_consent HANYA lewat server (service
--    role) sebagai anti-cheat poin. Klien boleh update patients: nickname,
--    archetype_id, emergency_contact_*.
-- 3. Kolom nyata vs file ini sebelumnya: patients punya nickname (NOT NULL)
--    + emergency_contact_name/phone; bookings pakai paid_with (bukan
--    payment_method) + points_used, duration_minutes, session_mode,
--    payment_status, meeting_url, patient_note.

-- CATATAN: kolom & constraint nyata di DB cloud (hasil probe):
--   status          : 'pending_payment' (default) | 'confirmed' | 'completed' | 'cancelled'
--   paid_with       : 'money' (default) | 'points'
--   payment_status  : 'unpaid' (default) | 'paid' | 'failed'
--   session_mode    : 'voice' (default) | 'video'
--   duration_minutes: default 50
--   payment_method/payment_order_id/paid_at/meeting_url/patient_note/points_used
--   juga ada. Booking dibuat lewat server (/api/bookings) karena klien tidak
--   punya GRANT INSERT; gate consent wajib sebelum booking.
create table bookings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  psychologist_id uuid not null references psychologists(id),
  scheduled_at timestamptz not null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'confirmed', 'completed', 'cancelled')),
  paid_with text default 'money' check (paid_with in ('money', 'points')),
  payment_status text default 'unpaid' check (payment_status in ('unpaid', 'paid', 'failed')),
  session_mode text default 'voice' check (session_mode in ('voice', 'video')),
  duration_minutes int default 50,
  price int default 0,
  points_used int default 0,
  payment_order_id text,
  paid_at timestamptz,
  meeting_url text,
  patient_note text,
  created_at timestamptz not null default now()
);

alter table patients enable row level security;
alter table psychologists enable row level security;
alter table screening_scores enable row level security;
alter table chat_logs enable row level security;
alter table sentiment_logs enable row level security;
alter table crisis_alerts enable row level security;

create policy "patients_select_own" on patients for select using (auth.uid() = id);
create policy "patients_update_own" on patients for update using (auth.uid() = id);
create policy "patients_insert_own" on patients for insert with check (auth.uid() = id);
create policy "patients_select_by_assigned_psychologist" on patients
  for select using (auth.uid() = assigned_psychologist_id);


create policy "psychologists_select_own" on psychologists for select using (auth.uid() = id);
create policy "psychologists_update_own" on psychologists for update using (auth.uid() = id);
create policy "psychologists_insert_own" on psychologists for insert with check (auth.uid() = id);
create policy "psychologists_select_verified_public" on psychologists
  for select using (verification_status = 'verified');


create policy "screening_scores_all_own_patient" on screening_scores
  for all using (
    auth.uid() = patient_id
    or auth.uid() in (select assigned_psychologist_id from patients where id = screening_scores.patient_id)
  );


create policy "chat_logs_all_own_patient" on chat_logs
  for all using (
    auth.uid() = patient_id
    or auth.uid() in (select assigned_psychologist_id from patients where id = chat_logs.patient_id)
  );

create policy "sentiment_logs_select" on sentiment_logs
  for select using (
    auth.uid() = patient_id
    or auth.uid() in (select assigned_psychologist_id from patients where id = sentiment_logs.patient_id)
  );

create policy "quests_all_own_patient" on quests
  for all using (
    auth.uid() = patient_id
    or auth.uid() in (select assigned_psychologist_id from patients where id = quests.patient_id)
  );


create policy "crisis_alerts_select_on_call" on crisis_alerts
  for select using (
    auth.uid() in (select id from psychologists where is_on_call = true)
    or auth.uid() = patient_id
  );
create policy "crisis_alerts_update_on_call" on crisis_alerts
  for update using (auth.uid() in (select id from psychologists where is_on_call = true));

create policy "bookings_all_involved" on bookings
  for all using (auth.uid() = patient_id or auth.uid() = psychologist_id);

-- =====================================================================
-- APPENDIX — Notifikasi & audit eskalasi krisis (16 Okt 2026)
-- =====================================================================
-- Alur: krisis → alert `pending` + email ke psikolog on-call; alert yang
-- lewat SLA (CRISIS_SLA_MINUTES, default 15) → `escalated` + email ke semua
-- psikolog terverifikasi. Lihat web/lib/crisisService.ts dan docs/cron.sql.
--
-- Untuk DB yang sudah ter-provision (kolom belum ada), jalankan idempotent:
alter table crisis_alerts add column if not exists escalated_at timestamptz;
alter table crisis_alerts add column if not exists notified_psychologist_ids uuid[];

-- Catatan: kode (crisisService) menulis `escalated_at` best-effort — bila
-- kolom belum ada, eskalasi TETAP berjalan, hanya audit yang dilewati.

-- =====================================================================
-- APPENDIX — Sesi manusia pasien <-> psikolog: CHAT TEKS (16 Okt 2026)
-- =====================================================================
-- LiveKit menangani panggilan suara/video (room `sesi-<bookingId>`).
-- Tabel ini untuk chat teks per booking — dipakai mobile (pasien) & portal
-- (psikolog). Realtime opsional: tanpa Realtime, klien memakai polling.
create table if not exists session_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  sender_role text not null check (sender_role in ('patient', 'psychologist')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists session_messages_booking_idx
  on session_messages (booking_id, created_at);

alter table session_messages enable row level security;

-- Baca: hanya pasien & psikolog pemilik booking.
drop policy if exists "session_messages_select_participants" on session_messages;
create policy "session_messages_select_participants" on session_messages
  for select using (
    exists (
      select 1 from bookings b
      where b.id = session_messages.booking_id
        and (b.patient_id = auth.uid() or b.psychologist_id = auth.uid())
    )
  );

-- Kirim: pengirim = dirinya sendiri, dan perannya cocok dengan booking.
drop policy if exists "session_messages_insert_participants" on session_messages;
create policy "session_messages_insert_participants" on session_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from bookings b
      where b.id = session_messages.booking_id
        and (
          (b.patient_id = auth.uid() and sender_role = 'patient')
          or (b.psychologist_id = auth.uid() and sender_role = 'psychologist')
        )
    )
  );

-- Realtime (opsional). Diabaikan otomatis bila publikasi belum tersedia.
do $$ begin
  alter publication supabase_realtime add table session_messages;
exception when others then null; end $$;

-- Penanda pasien membuka ruang sesi (notifikasi sekali + indikator "menunggu"
-- di dashboard psikolog). Ada di DB ter-provision sekalipun belum di file ini.
alter table bookings add column if not exists patient_joined_at timestamptz;

-- =====================================================================
-- APPENDIX — Ringkasan AI naratif untuk psikolog (16 Okt 2026)
-- =====================================================================
-- PRD Bagian 12 poin 5. Sudah ada di DB cloud; diisi otomatis oleh
-- /api/cron/daily dan best-effort dari /api/companion (lib/summary.ts).
-- Ditampilkan di dashboard psikolog dengan label "catatan AI — referensi awal".
create table if not exists ai_summaries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  summary text not null,
  period_start date,
  period_end date,
  created_at timestamptz not null default now()
);
-- `notified_psychologist_ids` disiapkan untuk audit penerima notifikasi
-- (belum dipakai kode; notifikasi saat ini dicatat lewat log server).