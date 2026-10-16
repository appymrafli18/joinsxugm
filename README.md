# Vsikolog

**Ruang aman berbasis budaya anime sebagai jembatan menuju psikolog berlisensi.**

Vsikolog adalah platform kesehatan mental yang menghubungkan pengguna dengan
psikolog berlisensi melalui **avatar anime (VTuber)** dan **AI Companion** sebagai
lapisan penapis awal. AI **tidak mendiagnosis** dan **tidak menggantikan** tenaga
medis — ia menemani, memantau, dan aktif mengarahkan ke sesi manusia saat dibutuhkan.

> Dibuat untuk **Hackathon Healthcare FMIPA UGM**.

---

## 1. Latar Belakang (ringkas)

- **I-NAMHS:** 1 dari 3 remaja Indonesia (≈15,5 juta) punya masalah kesehatan mental;
  hanya **2,6%** yang mencari layanan.
- **SISDMK (1 Sep 2026):** 1.495 psikiater (≈**1 : 180.000** penduduk; ideal WHO 1 : 30.000).
- Hambatan utama kelompok ini: **takut berhadapan langsung** di lingkungan medis formal.
- Budaya visual anime terbukti memberi rasa aman (interaksi parasosial) —
  **keterkaitan, bukan bukti terapi**; risiko eskapisme dikelola secara sengaja.

Vsikolog mengisi celah yang belum ada: memakai ruang aman anime sebagai **pintu masuk**
yang terstruktur menuju bantuan profesional.

---

## 2. Fitur Utama

**Sisi Pasien (mobile):**
- Onboarding + **kuis skrining GAD-7** (7 item tervalidasi) + pilih 1 dari 4 arketipe avatar.
- **AI Companion** gratis — balasan berpersona, **dibacakan (TTS)**, input suara (**STT**).
- Indikator tier tersembunyi — pasien hanya melihat ajakan natural, bukan angka.
- **Eskalasi krisis otomatis** → dihubungkan ke psikolog on-call (gratis, tanpa booking).
- **Marketplace psikolog** + booking (bayar / tukar poin Quest CBT).
- **Quest CBT** (graded exposure): timer, GPS, laporan sosial → poin → sesi gratis.
- **Sesi dengan psikolog manusia**: **chat teks** + **panggilan suara/video** (LiveKit).

**Sisi Psikolog & Admin (web portal):**
- Pendaftaran psikolog + **verifikasi manual** STR/SIPP oleh admin.
- Dashboard: pasien aktif, sesi terjadwal, **pusat peringatan krisis**, **ringkasan AI**
  berlabel *"referensi awal, bukan diagnosis"*.
- Toggle **on-call**, konfirmasi booking, ruang sesi (chat + panggilan + briefing AI).

---

## 3. Arsitektur

Dua klien, satu backend:

```
joinsxugm/
├── web/       Next.js 16 — DUA peran:
│   ├── app/portal/   UI Admin & Psikolog (satu-satunya UI web)
│   └── app/api/      API server untuk aplikasi mobile pasien
├── mobile/    React Native + Expo (SDK 57) — aplikasi pasien
├── docs/      PRD, schema, API contract, design, SQL
└── histories/ Rekap implementasi, MISMATCH, skrip video demo
```

```
mobile (Expo, pasien) ──HTTP Bearer──┐
                                     ▼
                web Next.js = /portal (UI) + /api/* (server)
                                     │
      ┌───────────┬───────────┬──────┴───────┬────────────┐
  Supabase      DeepSeek     LiveKit       Resend      AsyncStorage
(auth/DB/RLS)  (AI+skor)   (panggilan)   (email krisis) (screening)
```

**Kredensial sensitif (DeepSeek, LiveKit, Resend, service role Supabase) hanya di server.**

---

## 4. Alur Solusi

### 4.1 Alur Pasien (mobile)
1. **Onboarding** → kuis **GAD-7 (7 item)** → jawaban dikirim ke `POST /api/screening`
   → server menghitung skor & **tier** (`low/medium/high`).
2. Login/daftar → **pilih arketipe** (Guardian/Healer/Scholar/Companion).
3. **AI Companion** — kirim pesan → `POST /api/companion` → balasan + ekspresi (TTS).
4. **Quest CBT** — misi → `POST /api/quests` → poin (anti-cheat di server).
5. **Consent** — aktifkan berbagi data sebelum booking (`POST /api/consent`).
6. **Booking psikolog** — pilih jadwal + mode (video/suara) + bayar/poin (`POST /api/bookings`).
7. **Sesi** (`/sesi/<bookingId>`) — **chat teks** + **panggilan**.

### 4.2 Alur Krisis (keselamatan)
1. `POST /api/companion` mendeteksi kata kunci/ekspresi **"khawatir"** → menulis `crisis_alerts`,
   meng-override tier menjadi `high`, dan memilih **psikolog on-call**.
2. Aplikasi **memaksa redirect** ke **Bantuan Krisis** → "Buka Ruang Bantuan" (`POST /api/session/crisis`).
3. Sesi krisis **gratis, tanpa booking**. Alert yang terlambat → **eskalasi SLA**
   (`/api/cron/sweep`, 15 menit) + email ke seluruh psikolog terverifikasi.
4. Email notifikasi ke psikolog on-call saat krisis terdeteksi (best-effort).

### 4.3 Alur Sesi Pasien ↔ Psikolog
1. Psikolog **konfirmasi** booking di portal (`booking-status`).
2. Pasien membuka `/sesi/<bookingId>` → `GET /api/session` (peran, lawan bicara, izin panggilan).
3. **Chat teks** via `GET|POST /api/session/messages` (server-side; peran ditentukan server).
4. Psikolog membuka `/portal/sesi/<bookingId>` → **briefing Ringkasan AI** (`/api/session/summary`)
   + chat + panggilan.
5. **Panggilan**: `POST /api/calls/token` (dalam app, butuh dev build) atau
   `POST /api/calls/link` → halaman browser `/call/<bookingId>` (fallback Expo Go).
6. Saat pasien membuka ruang → `POST /api/session/notify` (email + badge "menunggu").

### 4.4 Alur Psikolog & Admin (portal web)
- **/portal** → `/api/portal/me` menentukan peran.
- **Admin** (`/portal/admin`): verifikasi psikolog (manual), dokumen via signed URL.
- **Psikolog** (`/portal/psikolog`): profil publik, on-call, pusat krisis
  (acknowledge/escalate/resolve), pasien + ringkasan AI, booking.

---

## 5. Cara Menjalankan

### Prasyarat
- **Node.js 20+**, npm.
- Akun **Supabase** (database + auth + storage).
- **DeepSeek API key** (AI Companion + ringkasan).
- (Opsional) **LiveKit** untuk panggilan suara/video.
- Aplikasi **Expo Go** di HP, atau development build untuk LiveKit/STT.

### 5.1 Backend — Supabase
1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor → New query**, jalankan **seluruh isi** `docs/supabase-setup.sql`
   (membuat tabel `session_messages`, kolom `bookings.patient_joined_at`, dsb.).
   - Referensi schema lengkap: `docs/schema.sql`.
   - (Opsional) jadwal otomatis krisis/sentimen: `docs/cron.sql` (pg_cron + pg_net).
3. Bucket privat `license-docs` dibuat otomatis saat psikolog mengunggah dokumen.

### 5.2 Web (portal + API)
```bash
cd web
npm install
cp .env.example .env.local     # lalu isi nilainya (lihat §6)
npm run dev                    # http://localhost:3000
```
Lalu seed data demo (dari folder `web/`):
```bash
node scripts/seed-demo.mjs     # 4 psikolog + pasien + 4 booking + akun admin
```

### 5.3 Mobile (aplikasi pasien)
```bash
cd mobile
npm install
cp .env.example .env           # isi (lihat §6)
npx expo start -c
```
> **Catatan:** panggilan suara/video (LiveKit) dan input suara (STT) memakai modul
> native → butuh **development build** (`npx expo run:ios` / `expo run:android` / EAS build).
> Sisa aplikasi berjalan normal di **Expo Go**. Untuk panggilan tanpa dev build,
> pakai tombol **"Buka Panggilan di Browser"**.

---

## 6. Variabel Environment

**`web/.env.local`**

| Variabel | Wajib | Fungsi |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Kunci publik (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only (operasi sensitif) |
| `DEEPSEEK_API_KEY` | ✅ | AI Companion + sentimen + ringkasan |
| `ADMIN_EMAILS` | ✅ | Allowlist admin portal (pisah koma) |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | opsional | Panggilan suara/video |
| `RESEND_API_KEY` / `NOTIFY_FROM` | opsional | Email notifikasi krisis |
| `PORTAL_URL`, `CRISIS_SLA_MINUTES`, `CRON_SECRET` | opsional | Portal link, SLA, otorisasi cron |
| `SUPABASE_ACCESS_TOKEN` *atau* `SUPABASE_DB_URL` | opsional | Untuk `scripts/apply-sql.mjs` |

**`mobile/.env`**

| Variabel | Wajib | Fungsi |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | URL Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Kunci publik |
| `EXPO_PUBLIC_API_URL` | ✅ | Alamat server web (mis. `http://192.168.x.x:3000` untuk HP fisik) |

---

## 7. Akun Demo

| Peran | Email | Password |
|---|---|---|
| Pasien | `demo.pasien@vsikolog.test` | `Demo1234!xyz` |
| Psikolog | `demo.psikolog1..4@vsikolog.test` | `Demo1234!xyz` |
| Admin | `demo.admin@vsikolog.test` | `Demo1234!xyz` |

(Pastikan `ADMIN_EMAILS` memuat email admin di atas.)

---

## 8. Skrip Berguna (folder `web/`)

| Perintah | Fungsi |
|---|---|
| `node scripts/seed-demo.mjs` | Seed data demo (idempotent) |
| `node scripts/reset-seed.mjs` | **Reset total** (hapus semua baris → 0) lalu seed ulang |
| `node scripts/reset-seed.mjs --dry-run` | Hanya tampilkan jumlah baris |
| `node scripts/reset-seed.mjs --with-auth` | Sekaligus hapus akun demo |
| `node scripts/apply-sql.mjs` | Jalankan SQL (mis. `docs/supabase-setup.sql`) ke Supabase |

---

## 9. Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| Chat sesi: *"tabel session_messages belum ada"* | Jalankan `docs/supabase-setup.sql` di Supabase SQL Editor |
| Chat sesi: *"Gagal mengirim pesan."* | Pastikan `web` di-restart setelah migrasi; cek koneksi DB |
| Panggilan: *"belum dikonfigurasi"* | Isi `LIVEKIT_*` di `web/.env.local` |
| Panggilan tidak jalan di Expo Go | Butuh development build, atau pakai **"Buka Panggilan di Browser"** |
| Login gagal (email belum dikonfirmasi) | Akun demo sudah dikonfirmasi; untuk akun baru, konfirmasi via email |
| Ringkasan AI kosong | Chat Companion ≥3 pesan → portal → "Buat ringkasan sekarang" |

---

## 10. Dokumen Lain

| Dokumen | Isi |
|---|---|
| `docs/PRD_vsikolog.md` | PRD lengkap (fitur, triase, protokol krisis, roadmap) |
| `docs/api-contract.md` | Daftar endpoint & format request/response |
| `docs/database-schema.md` | Struktur tabel Supabase |
| `docs/schema.sql` / `docs/supabase-setup.sql` | Skema & migrasi |
| `docs/design.md` / `docs/design-tokens.md` | Design system |

---

## 11. Batasan & Catatan Jujur

- AI Companion **tidak mendiagnosis**, tidak meresepkan, tidak melakukan MSE/tes psikometri.
- **Panggilan** butuh development build (ada fallback browser).
- **12 pose ekspresi** avatar masih placeholder; **TTS** masih satu suara (MVP).
- **Eskalasi ke kontak darurat/hotline nasional** dan tinjauan psikolog sebelum
  perubahan tier masuk **roadmap Fase 2**.
- Data demo & angka bersifat contoh untuk keperluan hackathon.
