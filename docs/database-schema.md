# Database Schema — Vsikolog (Supabase/Postgres)

Skema ini dipakai bersama oleh aplikasi pasien `mobile/` (**React Native +
Expo**, berjalan di Expo Go) dan portal `web/` (Next.js — UI Admin/Psikolog +
API server). Satu project Supabase untuk keduanya.

> Sumber kebenaran = `docs/schema.sql`. Perbarui kedua file bersamaan.

> Status: rancangan awal untuk MVP hackathon. Kolom bisa bertambah seiring
> fitur berkembang — update file ini setiap ada perubahan skema.

## Ringkasan Tabel

| Tabel | Fungsi |
|---|---|
| `patients` | Data pasien: arketipe avatar, status anonim |
| `psychologists` | Data psikolog terverifikasi |
| `chat_logs` | Riwayat percakapan pasien dengan AI Companion |
| `sentiment_logs` | Hasil analisis sentimen per sesi/hari |
| `crisis_alerts` | Catatan saat indikasi risiko terdeteksi |
| `quests` | Progres misi Game-CBT Quest Engine |
| `bookings` | Booking sesi konsultasi dengan psikolog |
| `session_messages` | Chat teks per sesi konsultasi (pasien ↔ psikolog) |

---

## `patients`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | Sama dengan `auth.users.id` dari Supabase Auth (anonim) |
| `archetype_id` | `text` | `guardian` / `healer` / `scholar` / `companion` |
| `tier` | `text` | Hasil triase: `low` / `medium` / `high` (lihat PRD bagian Sistem Triase) |
| `assigned_psychologist_id` | `uuid` (FK → `psychologists.id`) | Nullable, diisi setelah pasien masuk Tier 2/3 |
| `created_at` | `timestamptz` | Default `now()` |

## `psychologists`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | Sama dengan `auth.users.id` (psikolog login non-anonim) |
| `full_name` | `text` | Nama psikolog |
| `license_number` | `text` | Nomor lisensi/STR — **jangan expose ke client pasien** |
| `is_on_call` | `boolean` | Status ketersediaan untuk eskalasi krisis |
| `created_at` | `timestamptz` | Default `now()` |

## `chat_logs`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | Default `gen_random_uuid()` |
| `patient_id` | `uuid` (FK → `patients.id`) | |
| `role` | `text` | `user` / `assistant` |
| `content` | `text` | Isi pesan |
| `flagged` | `boolean` | `true` kalau lolos deteksi kata kunci krisis (lihat `/api/companion`) |
| `created_at` | `timestamptz` | Default `now()` |

## `sentiment_logs`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | Default `gen_random_uuid()` |
| `patient_id` | `uuid` (FK → `patients.id`) | |
| `date` | `date` | Tanggal agregasi (satu baris per hari per pasien) |
| `stabil_score` | `numeric` | 0–100, dari analisis LLM terhadap `chat_logs` hari itu |
| `cemas_score` | `numeric` | 0–100 |
| `created_at` | `timestamptz` | Default `now()` |

## `crisis_alerts`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | Default `gen_random_uuid()` |
| `patient_id` | `uuid` (FK → `patients.id`) | |
| `chat_log_id` | `uuid` (FK → `chat_logs.id`) | Pesan yang memicu alert |
| `status` | `text` | `pending` / `acknowledged` / `escalated` / `resolved` |
| `acknowledged_by` | `uuid` (FK → `psychologists.id`) | Nullable |
| `created_at` | `timestamptz` | Default `now()` |

## `quests`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | Default `gen_random_uuid()` |
| `patient_id` | `uuid` (FK → `patients.id`) | |
| `level` | `int` | Level misi saat ini |
| `title` | `text` | Judul misi, mis. "Buka tirai kamar 10 menit" |
| `status` | `text` | `active` / `completed` / `skipped` |
| `completed_at` | `timestamptz` | Nullable |

---

## `session_messages`

Chat teks per sesi konsultasi (pasien ↔ psikolog manusia). Panggilan
suara/video ditangani LiveKit, bukan tabel ini.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | |
| `booking_id` | `uuid` (FK → `bookings.id`, on delete cascade) | Sesi terkait |
| `sender_id` | `uuid` (FK → `auth.users.id`) | Pengirim |
| `sender_role` | `text` | `patient` / `psychologist` |
| `content` | `text` | Isi pesan |
| `created_at` | `timestamptz` | Default `now()` |

Realtime opsional (klien punya polling fallback). Lihat `docs/schema.sql`
(appendix sesi).

Notifikasi "pasien menunggu" memakai kolom `bookings.patient_joined_at`
(`timestamptz`, nullable) — diisi saat pasien membuka ruang sesi.

## Row Level Security (RLS) — wajib diaktifkan

Karena data ini kategori kesehatan/sensitif, **RLS harus aktif di semua
tabel** sebelum project ini dianggap siap didemokan sebagai "aman":

- `patients`: pasien hanya bisa baca/tulis baris miliknya sendiri
  (`auth.uid() = id`); psikolog hanya bisa baca pasien yang di-assign ke
  mereka (`assigned_psychologist_id = auth.uid()`).
- `chat_logs`, `sentiment_logs`, `quests`: sama, dibatasi lewat
  `patient_id` yang terhubung ke pasien pemilik sesi / psikolog yang
  di-assign.
- `crisis_alerts`: bisa dibaca oleh psikolog yang berstatus `is_on_call =
  true`, tidak hanya yang di-assign — supaya eskalasi tetap jalan kalau
  psikolog utama sedang tidak online.

## Yang belum diputuskan (perlu didiskusikan lebih lanjut)

- Mekanisme penugasan psikolog ke pasien Tier 2/3 (manual oleh admin,
  atau otomatis round-robin?)
- Berapa lama data `chat_logs` disimpan (kebijakan retensi data untuk
  privasi)
- Struktur tabel tambahan untuk mekanisme "graduasi" (progres pasien
  menuju sesi psikolog manusia) — belum ada tabel khusus untuk ini