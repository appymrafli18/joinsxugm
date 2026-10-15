# API Contract — Kokoro Cure

Endpoint di-host di app Next.js (`web/app/api/`) dan dipanggil oleh aplikasi
pasien (`mobile/`, React Native/Expo) lewat HTTP dengan header
`Authorization: Bearer <supabase access token>`. Base URL saat development:
`http://localhost:3000` (diatur di mobile via `EXPO_PUBLIC_API_URL`).

> Status (implementasi berjalan): `POST /api/companion` ✅, `POST /api/consent` ✅,
> `POST /api/quests` ✅, `GET /api/psychologists` ✅, `POST|GET /api/bookings` ✅,
> `POST /api/screening` ✅, `POST /api/sentiment` ✅, `POST /api/calls/token` ✅,
> `GET /api/portal/me` ✅, `GET|POST /api/portal/admin` ✅,
> `GET|POST /api/portal/psikolog` ✅ (termasuk crisis-ack).
>
> Catatan arsitektur: web kini **hanya portal Admin/Psikolog** (`/portal`);
> API di bawah tetap dipakai aplikasi pasien di `mobile/`.

---

## Endpoint yang sudah berjalan (ringkas)

| Endpoint | Fungsi | Catatan |
|---|---|---|
| `POST /api/companion` | Balasan AI Companion (DeepSeek, fallback Claude/mock dev) + deteksi krisis | Response: `{reply, flagged, expression, onCall, escalated, crisisContact}`. Menulis `chat_logs`; krisis → `crisis_alerts` (+nickname & kutipan pemicu) + override tier high + **pilih psikolog on-call acak** → `crisisContact` + `patients.assigned_psychologist_id`. Alert pending > 15 menit otomatis di-`escalated` (lazy sweep). Bila provider AI gagal pada pesan krisis, dipakai balasan krisis statis agar alur keselamatan tidak putus |
| `POST /api/screening` | Simpan jawaban GAD-7 (7 item, 0–3) | Server menghitung skor + tier (`lib/tier.ts`); skor tidak dikembalikan ke klien |
| `POST /api/consent` | Simpan/cabut persetujuan berbagi data | `patients.data_sharing_consent` + `consent_updated_at` (klien tidak punya grant update) |
| `POST /api/quests` | `action: start / progress / complete` | Validasi server: timer (`timer_not_done`), laporan sosial (`report_required`), jarak GPS (`distance_required`, `distance_not_reached`); poin ditambah server-side & idempotent |
| `GET /api/psychologists` | Daftar/detail psikolog terverifikasi | `?id=` untuk detail; klien tidak dapat membaca tabel psychologists langsung (RLS) |
| `POST /api/bookings` | Buat booking (gate consent, tukar poin) | Constraint DB: `status=pending_payment`, `paid_with=money/points`, `payment_status=unpaid/paid`, `session_mode=video`, 50 menit |
| `GET /api/bookings` | Daftar sesi pasien + nama panggilan psikolog | Dipakai halaman Perjalanan |
| `POST /api/sentiment` | Analisis sentimen harian dari chat_logs → `sentiment_logs` | Body opsional `{date}`. Memakai DeepSeek; dipicu otomatis oleh `/api/companion` (best-effort) atau manual/cron. Hasilnya jadi tren di dashboard & mesin tier |
| `POST /api/calls/token` | Token panggilan LiveKit untuk satu booking | Body `{bookingId}`. Hanya pasien/psikolog pemilik booking (admin boleh). Response `{url, token, mode, psychologist}`; room `sesi-<bookingId>` tanpa PII. 503 bila `LIVEKIT_*` belum diisi |
| `GET /api/portal/me` | Identitas + peran untuk pengarahan portal | Admin ditentukan allowlist server `ADMIN_EMAILS`; psikolog dari tabel psychologists; pasien dikenali agar diblokir dari portal |
| `GET|POST /api/portal/admin` | Manajemen pengguna & verifikasi psikolog | GET: daftar psikolog (semua status, + signed URL dokumen) + pasien + email + hitungan krisis. POST `set-verification` (verified/rejected + alasan) — verifikasi manual sesuai PRD |
| `POST /api/portal/register` | Pendaftaran psikolog (multipart) | `full_name`, `license_number`, `specialization?`, `education?`, `file?` (PDF/gambar ≤5MB). Dokumen diunggah ke bucket **privat** `license-docs` (hanya path tersimpan; admin melihat via signed URL). Baris `psychologists` dibuat berstatus `pending`; 409 bila sudah terdaftar, 403 bila akun pasien |
| `GET|POST /api/portal/psikolog` | Dashboard & profil psikolog | GET: profil + pasien yang ditangani (dengan sentimen “catatan AI”) + alert krisis + booking. POST: `profile`, `oncall` (toggle on-call), `alert-ack` (acknowledged/escalated/resolved — menggantikan rancangan `/api/crisis-ack`) |

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

**Belum dilakukan di scaffold (perlu ditambahkan):** endpoint ini saat ini
tidak menyimpan apapun ke Supabase — hanya memanggil Claude API dan
mengembalikan balasan. Perlu ditambahkan langkah simpan ke `chat_logs`
(dan `crisis_alerts` kalau `flagged`) sebelum return response.

---

## `POST /api/sentiment`

**Status:** ⏳ Belum dibuat

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

## `POST /api/crisis-ack`

**Status:** ⏳ Belum dibuat

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

## Autentikasi

Semua endpoint saat ini **belum memvalidasi sesi Supabase** di sisi
server (langsung percaya `patientId`/`archetypeId` yang dikirim client).
Ini cukup untuk demo MVP, tapi **wajib diperbaiki sebelum dianggap
produk yang aman**: setiap request seharusnya menyertakan Supabase auth
token, lalu endpoint memverifikasi token itu cocok dengan `patientId`
yang diklaim, supaya satu pasien tidak bisa membaca/menulis data pasien
lain.

## Format Error (berlaku untuk semua endpoint)

```json
{ "error": "Pesan error singkat" }
```
dengan HTTP status code sesuai (400 untuk input tidak valid, 401 untuk
tidak terautentikasi, 500 untuk error server).