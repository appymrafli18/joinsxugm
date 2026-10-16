-- =====================================================================
-- session.sql — Aktifkan sesi konsultasi (chat + notifikasi) Vsikolog
-- =====================================================================
-- CARA PAKAI: buka Supabase Dashboard → SQL Editor → New query → paste
-- SELURUH isi file ini → Run. Aman dijalankan berulang (idempotent).
--
-- Tanpa ini: chat sesi pasien <-> psikolog akan gagal
-- ("Chat sesi belum aktif: tabel session_messages belum ada").
-- =====================================================================

-- 1) Tabel chat per sesi (booking).
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

-- 2) RLS: hanya pasien & psikolog pemilik booking.
--    (Chat tetap difungsikan lewat server /api/session/messages, jadi policy
--     ini opsional untuk fungsional — tapi tetap baik untuk akses langsung.)
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

-- 3) Penanda pasien membuka ruang sesi (email notifikasi + badge "menunggu").
alter table bookings add column if not exists patient_joined_at timestamptz;

-- 4) Realtime (opsional — klien punya polling fallback). Diabaikan bila
--    publikasi belum tersedia.
do $$ begin
  alter publication supabase_realtime add table session_messages;
exception when others then null; end $$;
