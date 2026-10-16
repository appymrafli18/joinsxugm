-- =====================================================================
-- supabase-setup.sql — Yang perlu dijalankan di Supabase (Vsikolog)
-- =====================================================================
-- CARA PAKAI: Supabase Dashboard → SQL Editor → New query → paste semua → Run.
-- Idempotent: aman dijalankan berulang.
--
-- Hasil scan schema DB (16 Okt 2026): SEMUA tabel inti sudah ada
-- (patients, psychologists, screening_scores[answers+total], chat_logs,
-- sentiment_logs, crisis_alerts, quests, bookings). Yang kurang hanya blok
-- di bawah ini.
-- =====================================================================


-- =====================================================================
-- [WAJIB] 1. Chat sesi pasien <-> psikolog
-- Tanpa ini: layar sesi error ("tabel session_messages belum ada").
-- =====================================================================
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

drop policy if exists "session_messages_select_participants" on session_messages;
create policy "session_messages_select_participants" on session_messages
  for select using (
    exists (
      select 1 from bookings b
      where b.id = session_messages.booking_id
        and (b.patient_id = auth.uid() or b.psychologist_id = auth.uid())
    )
  );

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

-- Realtime (opsional — klien punya polling fallback).
do $$ begin
  alter publication supabase_realtime add table session_messages;
exception when others then null; end $$;


-- =====================================================================
-- [WAJIB] 2. Penanda pasien membuka ruang sesi
-- Dipakai notifikasi email sekali + badge "menunggu" di dashboard psikolog.
-- =====================================================================
alter table bookings add column if not exists patient_joined_at timestamptz;


-- =====================================================================
-- [DISARANKAN] 3. Audit eskalasi krisis
-- Kode (crisisService) menulis ini best-effort; tanpa kolom, eskalasi tetap
-- jalan — hanya jejak audit yang dilewati.
-- =====================================================================
alter table crisis_alerts add column if not exists escalated_at timestamptz;
alter table crisis_alerts add column if not exists notified_psychologist_ids uuid[];


-- =====================================================================
-- [OPSIONAL] 4. Perlebar constraint perasaan misi (quests)
-- DB cloud punya constraint `quests_feeling_input_check` yang terlalu ketat
-- (hanya 'biasa'), sehingga server menyimpan perasaan ke social_report
-- sebagai fallback. Blok ini mengizinkan chips sesuai desain.
-- =====================================================================
update quests set feeling_input = null
  where feeling_input is not null
    and feeling_input not in ('lega', 'senang', 'cemas', 'biasa saja', 'lelah');

alter table quests drop constraint if exists quests_feeling_input_check;
alter table quests add constraint quests_feeling_input_check
  check (feeling_input is null
         or feeling_input in ('lega', 'senang', 'cemas', 'biasa saja', 'lelah'));


-- =====================================================================
-- CATATAN KEAMANAN (tidak wajib untuk demo, tapi penting untuk produksi)
-- =====================================================================
-- Pastikan RLS aktif + policy lengkap untuk `quests` & `bookings`. JANGAN
-- aktifkan RLS tanpa policy (bisa memblokir baca klien). Policy minimal:
--   - quests:   auth.uid() = patient_id (pasien) atau psikolog yang di-assign
--   - bookings: auth.uid() = patient_id OR auth.uid() = psychologist_id
-- Lihat docs/schema.sql (bagian RLS) untuk contoh lengkapnya.
