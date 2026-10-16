# API Contract — Vsikolog

Endpoint di-host di app Next.js (`web/app/api/`) dan dipanggil oleh aplikasi
pasien (`mobile/`, React Native/Expo) lewat HTTP dengan header
`Authorization: Bearer <supabase access token>`. Base URL saat development:
`http://localhost:3000` (diatur di mobile via `EXPO_PUBLIC_API_URL`).

> Status (implementasi berjalan): `POST /api/companion` ✅, `POST /api/consent` ✅,
> `POST /api/quests` ✅, `GET /api/psychologists` ✅, `POST|GET /api/bookings` ✅,
> `POST /api/screening` ✅, `POST /api/sentiment` ✅, `POST /api/calls/token` ✅,
> `GET /api/session` ✅, `GET|POST /api/session/messages` ✅,
> `GET|POST /api/session/summary` ✅,
> `POST /api/session/crisis` ✅, `POST /api/session/notify` ✅,
> `POST /api/calls/link` ✅,
> `GET|POST /api/cron/sweep` ✅, `GET|POST /api/cron/daily` ✅,
> `GET /api/portal/me` ✅, `GET|POST /api/portal/admin` ✅,
> `GET|POST /api/portal/psikolog` ✅ (termasuk crisis-ack).
>
> Catatan arsitektur: web kini **hanya portal Admin/Psikolog** (`/portal`);
> API di bawah tetap dipakai aplikasi pasien di `mobile/`.

---

## Endpoint yang sudah berjalan (ringkas)

| Endpoint | Fungsi | Catatan |
|---|---|---|
| `POST /api/companion` | Balasan AI Companion (DeepSeek, fallback Claude/mock dev) + deteksi krisis | Response: `{reply, flagged, expression, onCall, escalated, crisisContact}`. Menulis `chat_logs`; krisis → `crisis_alerts` (+nickname & kutipan pemicu) + override tier high + **pilih psikolog on-call acak** → `crisisContact` + `patients.assigned_psychologist_id` + **email notifikasi ke psikolog tersebut** (best-effort). Alert pending > SLA juga di-`escalated` (sweep; jalur utama cron, ini fallback). Bila provider AI gagal pada pesan krisis, dipakai balasan krisis statis agar alur keselamatan tidak putus |
| `POST /api/screening` | Simpan jawaban GAD-7 (7 item, 0–3) | Server menghitung skor + tier (`lib/tier.ts`); skor tidak dikembalikan ke klien |
| `POST /api/consent` | Simpan/cabut persetujuan berbagi data | `patients.data_sharing_consent` + `consent_updated_at` (klien tidak punya grant update) |
| `POST /api/quests` | `action: start / progress / complete` | Validasi server: timer (`timer_not_done`), laporan sosial (`report_required`), jarak GPS (`distance_required`, `distance_not_reached`); poin ditambah server-side & idempotent |
| `GET /api/psychologists` | Daftar/detail psikolog terverifikasi | `?id=` untuk detail; klien tidak dapat membaca tabel psychologists langsung (RLS) |
| `POST /api/bookings` | Buat booking (gate consent, tukar poin) | Constraint DB: `status=pending_payment`, `paid_with=money/points`, `payment_status=unpaid/paid`, `session_mode=voice/video` (pilihan pasien), 50 menit |
| `GET /api/bookings` | Daftar sesi pasien + nama panggilan psikolog | Dipakai halaman Perjalanan |
| `GET /api/session` | Bootstrap layar sesi (mobile & portal) | `?bookingId=` → `{booking, role, me, counterpart, canCall, callMode, canChat}`. Hanya pasien/psikolog pemilik booking (admin boleh). Chat teks ditulis langsung ke Supabase `session_messages` (RLS), panggilan via `/api/calls/token` |
| `POST /api/session/notify` | Pasien memberi tahu psikolog bahwa ia membuka ruang sesi | Body `{bookingId}`. Best-effort: email ke psikolog **sekali per booking** (dijaga `bookings.patient_joined_at`) + memunculkan indikator “menunggu” di dashboard psikolog |
| `GET\|POST /api/session/messages` | Chat teks sesi (pasien ↔ psikolog) | GET `?bookingId=` daftar pesan; POST `{bookingId, content}` kirim. Diproses **server-side** (service role) + cek peserta booking, jadi tidak bergantung policy RLS `session_messages`. Peran pengirim ditentukan server |
| `GET\|POST /api/session/summary` | Ringkasan AI pra-sesi untuk psikolog (PRD §7.4, §12.5) | GET `?bookingId=` → `{consent, summary, sentiment}` — hanya bila `patients.data_sharing_consent` aktif. POST `{bookingId}` = “generate if missing” (buat sekali & simpan; hanya psikolog pemilik sesi). Ditampilkan berlabel “catatan AI — referensi awal” |
| `POST /api/sentiment` | Analisis sentimen harian dari chat_logs → `sentiment_logs` | Body opsional `{date}`. Memakai DeepSeek; dipicu otomatis oleh `/api/companion` (best-effort) atau manual/cron. Hasilnya jadi tren di dashboard & mesin tier |
| `POST /api/calls/token` | Token panggilan LiveKit untuk satu booking | Body `{bookingId}`. Hanya pasien/psikolog pemilik booking (admin boleh). Response `{url, token, mode, psychologist}`; room `sesi-<bookingId>` tanpa PII. 503 bila `LIVEKIT_*` belum diisi |
| `POST /api/calls/link` | Tautan panggilan LiveKit untuk dibuka di **browser** | Body `{bookingId}` → `{joinUrl, mode}`. Jalur untuk klien tanpa modul native (mis. Expo Go). Token TTL 20 mnt; halaman publik `/call/<bookingId>` membawa token di query. 503 bila `LIVEKIT_*` kosong |
| `POST /api/session/crisis` | Buka ruang bantuan krisis (gratis, tanpa booking manual) | Pasien: memastikan ada booking "sesi krisis" dengan psikolog assigned/on-call lalu mengembalikan `{bookingId, reused}` (idempotent). Dipakai layar Bantuan Krisis |
| `GET /api/portal/me` | Identitas + peran untuk pengarahan portal | Admin ditentukan allowlist server `ADMIN_EMAILS`; psikolog dari tabel psychologists; pasien dikenali agar diblokir dari portal |
| `GET|POST /api/portal/admin` | Manajemen pengguna & verifikasi psikolog | GET: daftar psikolog (semua status, + signed URL dokumen) + pasien + email + hitungan krisis. POST `set-verification` (verified/rejected + alasan) — verifikasi manual sesuai PRD |
| `POST /api/portal/register` | Pendaftaran psikolog (multipart) | `full_name`, `license_number`, `specialization?`, `education?`, `file?` (PDF/gambar ≤5MB). Dokumen diunggah ke bucket **privat** `license-docs` (hanya path tersimpan; admin melihat via signed URL). Baris `psychologists` dibuat berstatus `pending`; 409 bila sudah terdaftar, 403 bila akun pasien |
| `GET|POST /api/portal/psikolog` | Dashboard & profil psikolog | GET: profil + pasien yang ditangani (dengan **ringkasan AI naratif `ai_summaries`** + sentimen “catatan AI”, keduanya hanya bila consent aktif) + alert krisis (on-call juga melihat `pending`/`escalated` lintas pasien) + booking. POST: `profile`, `oncall` (toggle on-call), `booking-status` (confirmed/completed/cancelled — konfirmasi booking agar sesi bisa dibuka), `alert-ack` (acknowledged/escalated/resolved — menggantikan rancangan `/api/crisis-ack`; memilih `escalated` juga mengirim email ke seluruh psikolog terverifikasi) |
| `GET|POST /api/cron/sweep` | Sweep SLA krisis (scheduler) | Header `Authorization: Bearer <CRON_SECRET>`. Semua alert `pending` > `CRISIS_SLA_MINUTES` (default 15) → `escalated` + email ke semua psikolog terverifikasi. Idempotent. Response `{ok, slaMinutes, escalated, alerts}`. Jadwal: `docs/cron.sql` |
| `GET|POST /api/cron/daily` | Analisis sentimen harian (scheduler) | Header `Authorization: Bearer <CRON_SECRET>`. Untuk tiap pasien yang punya chat hari ini: hitung sentimen (idempotent per tanggal) + perbarui tier. Response `{ok, date, patients, created}` |

---

## `POST /api/companion`

**Status:** ✅ Sudah dibuat

Mengirim pesan pasien ke AI Companion, mendapat balasan sesuai persona
arketipe yang dipilih.

**Request body**
```json
{
  "archetypeId": "guardian",
  "message": "Aku takut keluar rumah hari ini",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response**
```json
{
  "reply": "Aku di sini menemanimu. Mau cerita apa yang bikin takut hari ini?",
  "flagged": false
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `flagged` | `boolean` | `true` kalau pesan pasien mengandung kata kunci krisis. Kalau `true`, klien (mobile/dashboard) wajib memicu penulisan baris baru ke tabel `crisis_alerts` |

**Persistensi:** endpoint ini menyimpan percakapan ke `chat_logs` (pesan user +
balasan companion) dan, bila `flagged`, menulis `crisis_alerts` (+ nickname &
kutipan pemicu) serta memilih psikolog on-call (`crisisContact`).

---

## `POST /api/sentiment`

**Status:** ✅ Sudah dibuat (dipicu otomatis best-effort dari `/api/companion`,
manual, atau terjadwal via `/api/cron/daily`).

Menganalisis kumpulan `chat_logs` pasien pada rentang tanggal tertentu,
menghasilkan skor sentimen untuk ditampilkan di dashboard psikolog.

**Request body (rancangan)**
```json
{
  "patientId": "uuid-pasien",
  "date": "2026-09-16"
}
```

**Response (rancangan)**
```json
{
  "date": "2026-09-16",
  "stabilScore": 62,
  "cemasScore": 38
}
```

**Cara kerja yang direncanakan:** ambil semua baris `chat_logs` milik
`patientId` pada `date` tersebut → kirim ke LLM dengan prompt klasifikasi
sentimen → simpan hasil ke `sentiment_logs` → kembalikan sebagai response.
Bisa dipanggil manual (tombol "refresh" di dashboard) atau dijadwalkan
otomatis tiap akhir hari (cron job/Supabase Edge Function).

---

## `POST /api/crisis-ack` (digantikan)

**Status:** ❌ Digantikan oleh action `alert-ack` di `POST /api/portal/psikolog`
(lihat tabel ringkas). Endpoint terpisah ini tidak dibuat — aksi alert
disatukan di route dashboard psikolog.

Dipanggil dari dashboard psikolog saat mereka menandai sebuah
`crisis_alerts` sebagai sudah ditinjau.

**Request body (rancangan)**
```json
{
  "alertId": "uuid-alert",
  "psychologistId": "uuid-psikolog",
  "status": "acknowledged"
}
```

**Response (rancangan)**
```json
{ "success": true }
```

`status` mengikuti nilai yang sama seperti kolom `status` di tabel
`crisis_alerts`: `acknowledged` / `escalated` / `resolved`.

---

## Sesi pasien ↔ psikolog (chat + suara/video)

Menghubungkan booking ke pengalaman konsultasi nyata (bukan sekadar status).

1. **Konfirmasi** — psikolog menandai booking `confirmed` dari portal (`POST /api/portal/psikolog` action `booking-status`). Booking tukar poin otomatis `confirmed` + `paid` saat dibuat.
2. **Bootstrap** — klien memanggil `GET /api/session?bookingId=` → peran, lawan bicara, `canCall`, `callMode`.
3. **Chat teks** — tabel `session_messages`. Kirim/baca lewat `GET|POST /api/session/messages` (server-side, cek peserta; peran pengirim ditentukan server) sehingga tidak bergantung policy RLS. Mobile & portal juga berlangganan Realtime + polling 5 dtk sebagai pelengkap.
4. **Suara/video** — `POST /api/calls/token {bookingId}` → token LiveKit, room `sesi-<bookingId>`. Pasien memakai `mobile/src/components/call/CallRoom.tsx` (**butuh development build** — tidak jalan di Expo Go). Psikolog memakai portal web `/portal/sesi/<bookingId>` (`livekit-client`). Mode `voice` menampilkan avatar 2D statis psikolog; `video` menampilkan video asli.
5. **Fallback browser (tanpa dev build)** — `POST /api/calls/link {bookingId}` → `{joinUrl}` yang membuka `/call/<bookingId>` di browser (token LiveKit TTL 20 mnt). Dipakai saat klien tidak punya modul native (mis. Expo Go) — panggilan tetap bisa dicoba.
6. **Krisis** — `POST /api/session/crisis` membuat/memakai booking "sesi krisis" gratis dengan psikolog assigned/on-call, lalu mengarahkan ke layar sesi (chat + panggilan).
7. **Notifikasi** — saat pasien membuka ruang, `POST /api/session/notify` mengirim email ke psikolog **sekali** (kolom `bookings.patient_joined_at`), dan dashboard psikolog menampilkan badge “menunggu”. Dashboard juga auto-refresh.
8. **Briefing pra-sesi** — `GET /api/session/summary?bookingId=` menampilkan ringkasan AI + sentimen terbaru di ruang sesi (hanya bila consent pasien aktif). Bila belum ada, psikolog bisa `POST` sekali untuk membuatnya (“generate if missing”, tersimpan — bukan refresh bebas). Berlabel “catatan AI — referensi awal, bukan diagnosis”.

---

## Autentikasi
Semua endpoint **memvalidasi sesi Supabase** di sisi server: request pasien
membawa `Authorization: Bearer <supabase access token>` dan diverifikasi lewat
`supabase.auth.getUser(token)` (`lib/serverAuth.ts` → `requireUser`). Portal
memakai `requirePortalRole` — admin dari allowlist `ADMIN_EMAILS`, psikolog dari
tabel `psychologists`. Endpoint cron (`/api/cron/*`) memakai rahasia
`CRON_SECRET` (server-to-server), bukan sesi pengguna.

## Format Error (berlaku untuk semua endpoint)

```json
{ "error": "Pesan error singkat" }
```
dengan HTTP status code sesuai (400 untuk input tidak valid, 401 untuk
tidak terautentikasi, 500 untuk error server).