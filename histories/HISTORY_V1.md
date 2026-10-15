# HISTORY_V1.md — Rekap Implementasi Kokoro Cure (v1)

Dokumen ini merangkum **seluruh pekerjaan** pada proyek ini: apa yang sudah
diimplementasikan, apa yang sempat terlewat/salah lalu diperbaiki, apa yang
masih kurang, serta temuan penting dari database nyata.

Terakhir diperbarui: 16 Oktober 2026.

---

## 1. Arsitektur saat ini

```
joinsxugm/
├── docs/        PRD, design, design-tokens, schema.sql, api-contract, README
├── web/         Next.js 16 — Portal Admin/Psikolog + API server untuk mobile
│   ├── app/portal/    UI web satu-satunya (login, admin, psikolog, register)
│   └── app/api/       12 endpoint (companion, quests, consent, dll.)
└── mobile/      Expo SDK 57 (React Native) — aplikasi pasien
```

- **Pasien** → `mobile/` (onboarding, Companion AI, misi, marketplace, panggilan).
- **Admin & Psikolog** → `web/` di `/portal`. UI pasien web **sudah dihapus**.
- **Backend bersama**: Supabase (auth, database, storage) + DeepSeek (AI) +
  LiveKit (panggilan manusia). Kredensial AI & panggilan **hanya di server**.

### Peta route

**Web** (`web/app/`):
`portal/` (login + arah peran) · `portal/admin` · `portal/psikolog` ·
`portal/register` · `api/{companion, screening, consent, quests, psychologists,
bookings, sentiment, calls/token, portal/me, portal/admin, portal/psikolog,
portal/register}`

**Mobile** (`mobile/src/app/`):
`index` (splash) · `onboarding` · `login` · `register` · `pilih-arketipe` ·
`(tabs)/{beranda, companion, perjalanan, profil}` · `misi/index` ·
`misi/[questId]` · `psikolog/index` · `psikolog/[id]` · `consent` ·
`sesi/[bookingId]`

---

## 2. Yang sudah diimplementasikan

### 2.1 Mobile — sisi pasien

| Area | Detail |
|---|---|
| **Splash** | Logo (raster PNG), cek sesi Supabase → arahkan ke onboarding/beranda/pilih-arketipe |
| **Onboarding** | **Kuis GAD-7** (7 item, skor 0–3, label "Dalam 2 minggu terakhir"), theming per arketipe (3 tema ilustrasi), progres, transisi fade 220/260 ms |
| **Auth** | Login & register Supabase dengan validasi + pesan error ramah; state "cek emailmu" |
| **Pilih arketipe** | 4 kartu (Guardian/Healer/Scholar/Companion), badge perisai warna arketipe, strip label putih, sparkle, CTA rose — sesuai desain lampiran |
| **Navigasi** | 4 tab: **Beranda / Companion / Perjalanan / Profil** + safe area iOS (notch & home indicator) |
| **Companion** | Avatar besar (pose per ekspresi), subtitle melayang + **TTS `id-ID`** (berbunyi walau iPhone mode silent), indikator "sedang berbicara", **tombol replay TTS**, indikator mengetik beranimasi, riwayat chat, **tombol mic (STT)**, back pintar |
| **Companion — kecerdasan** | Balasan **DeepSeek** per persona 4 arketipe + guardrail klinis; telusuran riwayat; krisis → banner jujur (on-call/escalated) + **redirect paksa ke psikolog acak** (mode Bantuan Krisis) |
| **Misi** | Daftar 4 kategori; eksekusi: **timer** (countdown + keep-awake + progres per menit), **laporan diri** (siapa/topik/durasi + perasaan), **GPS outdoor** (jarak haversine real-time, target 500 m); layar selesai + poin |
| **Perjalanan** | Progress poin → sesi gratis, streak, riwayat misi (tanggal + perasaan + poin), misi aktif, **sesi konsultasi + tombol "Masuk Sesi"** |
| **Profil** | Kartu identitas (avatar arketipe), edit **nama panggilan**, **kontak darurat** (nama+telepon), pintasan status consent, **logout** |
| **Marketplace** | Daftar psikolog verified (urutan: **nama samaran → nama asli+gelar → pendidikan**), detail + jadwal (7 hari × 4 jam), metode Transfer/QRIS/**Poin**, catatan, layar sukses |
| **Krisis (mobile)** | Banner 3 varian, redirect paksa, **layar Bantuan Krisis** (psikolog + "gratis tanpa booking" + langkah darurat) |
| **Sesi manusia** | Layar `/sesi/[bookingId]`: **suara → avatar 2D statis + audio psikolog asli**; **video → video psikolog asli (tanpa avatar)**; tombol mic; fallback jelas di Expo Go |
| **STT** | Push/tekan mic → transkrip masuk ke kolom pesan → **dapat diedit** sebelum kirim; audio tidak disimpan |
| **Aset** | 20 SVG Figma → **rasterisasi PNG @1x/2x/3x** (script `scripts/rasterize-assets.js`); 12 file pose ekspresi (placeholder, lihat `mobile/POSE.md`) |

### 2.2 Web — portal Admin & Psikolog

| Area | Detail |
|---|---|
| **Login portal** | Email+sandi Supabase → arah otomatis sesuai peran; akun pasien ditolak dengan arahan ke mobile |
| **Admin** | Statistik (psikolog/verified/pending/ditolak/pasien/krisis), **antrean verifikasi STR/SIPP** (Setujui/Tolak + alasan, **Lihat dokumen via signed URL**), tabel pengguna (psikolog + pasien dengan email, tier, poin, consent, psikolog penanggung) |
| **Registrasi psikolog** | `/portal/register`: sign-up → data diri + nomor STR/SIPP + spesialisasi + pendidikan + **upload dokumen** (PDF/gambar ≤5 MB) → baris `psychologists` status **pending**; dukungan alur konfirmasi email |
| **Dashboard psikolog** | Profil publik (urut nama samaran → nama asli+gelar → pendidikan, spesialisasi, harga, URL avatar), statistik, **toggle on-call**, **Pusat Peringatan Krisis** (Tanggapi/Eskalasi/Selesaikan), daftar pasien + **sentimen berlabel "catatan AI — referensi awal"** (hanya bila consent), daftar sesi/booking |
| **Keamanan peran** | Admin = allowlist server `ADMIN_EMAILS`; psikolog = baris `psychologists`; diperiksa di server (`requirePortalRole`) — bukan data klien |

### 2.3 API server (dipakai mobile + portal)

| Endpoint | Perilaku penting |
|---|---|
| `POST /api/companion` | DeepSeek (fallback Claude/mock dev); deteksi krisis kata kunci; simpan `chat_logs`; krisis → `crisis_alerts` (+nickname + kutipan) + **pilih psikolog on-call acak** (`crisisContact`) + `patients.assigned_psychologist_id` + **override tier high**; **SLA 15 menit** → alert pending otomatis `escalated` (lazy sweep); respons `{reply, flagged, expression, onCall, escalated, crisisContact}`; bila provider AI gagal pada pesan krisis → **balasan krisis statis** agar alur keselamatan tidak putus; analisis sentimen harian dipicu best-effort |
| `POST /api/screening` | Simpan GAD-7 + **hitung tier** (rule-based) — skor tidak dikembalikan ke klien |
| `POST /api/consent` | Set/cabut `data_sharing_consent` (klien tidak punya grant update) |
| `POST /api/quests` | `start/progress/complete`; validasi server: timer (`timer_not_done`), laporan sosial (`report_required`), jarak GPS (`distance_required`/`distance_not_reached`); **poin ditambah server-side & idempotent** |
| `GET /api/psychologists` | Daftar/detail **hanya verified** (klien tidak dapat membaca tabel psychologists — RLS) |
| `POST|GET /api/bookings` | Buat booking (gate consent, tukar poin 400, potong saldo server-side + rollback bila insert gagal); GET daftar sesi + nickname psikolog |
| `POST /api/sentiment` | Analisis DeepSeek → `sentiment_logs` (stabil/cemas 0–100), idempotent per tanggal |
| `POST /api/calls/token` | Token LiveKit per booking (room `sesi-<id>` tanpa PII, grant terverifikasi, TTL 1 jam); hanya pasien/psikolog pemilik (admin boleh); 503 bila `LIVEKIT_*` kosong |
| `GET /api/portal/me` | Peran + nama untuk pengarahan portal |
| `GET|POST /api/portal/admin` | Overview + `set-verification` (verified/rejected + alasan) + signed URL dokumen |
| `GET|POST /api/portal/psikolog` | Dashboard + `profile` + `oncall` + `alert-ack` (acknowledged/escalated/resolved) |
| `POST /api/portal/register` | Registrasi psikolog + upload dokumen ke bucket **privat** `license-docs` |

### 2.4 Mesin tier (PRD Bagian 8) — rule-based transparan
- GAD-7: `<5 low`, `5–14 medium`, `≥15 high`.
- Override krisis: ada `crisis_alerts` aktif **atau** ≥3 pesan ter-flag dalam 7 hari → `high`.
- Tren sentimen: cemas naik 3 hari berturut + skor terakhir ≥65 → minimal `medium`.
- Tier **tidak pernah ditampilkan sebagai angka** ke pasien; hanya memicu kartu ajakan natural di Companion.

### 2.5 Data & tooling
- **Seed demo** `web/scripts/seed-demo.mjs` (idempotent): 4 psikolog verified
  (alias VTuber: **Ayaka, Kaze, Cia, Yoru**; Ayaka & Kaze on-call) + akun admin
  demo. Password demo: `Demo1234!xyz`.
- **Rasterisasi aset** `mobile/scripts/rasterize-assets.js` (SVG Figma → PNG).
- **Dokumen**: `docs/README.md` (arsitektur baru), `docs/api-contract.md`
  (semua endpoint berjalan), `docs/PRD_vsikolog.md` (Adendum STT + sesi manusia +
  portal), `docs/schema.sql` (kolom & CHECK nyata + catatan GRANT),
  `mobile/POSE.md` (spesifikasi 12 pose ekspresi).

---

## 3. Temuan penting dari database nyata (berbeda dari `docs/schema.sql` lama)

1. **Klien read-only untuk operasi sensitif.** Role `authenticated` hanya punya
   GRANT SELECT pada `quests`; INSERT/UPDATE `quests`, `patients.total_points`,
   dan `patients.data_sharing_consent` **ditolak** (anti-cheat/privasi) — semua
   operasi tersebut dipindah ke server. Kolom pasien yang boleh diupdate klien:
   `nickname`, `archetype_id`, `emergency_contact_*`.
2. **`patients.nickname` NOT NULL** (tidak ada di docs lama).
3. **`bookings` enum berbeda**: `status=pending_payment|confirmed|completed|cancelled`
   (tanpa `pending`), `paid_with=money|points`, `payment_status=unpaid|paid|failed`,
   `session_mode=voice|video`, durasi default 50 menit.
4. **`quests_feeling_input_check` rusak**: dari 58 kandidat hanya `'biasa'` diterima.
   Server punya fallback menyimpan perasaan ke `social_report`; SQL perbaikan
   tercatat di `docs/schema.sql`.
5. **`crisis_alerts` punya kolom ekstra** `patient_nickname` & `trigger_excerpt`
   (kini diisi server).
6. **Rata-rata RLS psikolog sangat tertutup**: pasien **tidak** bisa membaca
   daftar psikolog → dilayani server (`/api/psychologists`).

---

## 4. Yang sempat terlewat/salah — dan perbaikannya

| # | Kejadian | Akar masalah | Perbaikan |
|---|---|---|---|
| 1 | Gambar onboarding tidak tampil (web sudah benar) | SVG Figma berisi `<pattern>` + PNG embed; decoder iOS (CoreSVG) tidak mendukung | Rasterisasi semua SVG → PNG @2x/@3x |
| 2 | Restart mobile "dipaksa" ke halaman terakhir | (Bukan bug) Sesi Supabase tersimpan → splash mengarahkan ke beranda | Dijelaskan; ditambah jalur logout (via Profil) |
| 3 | Elemen tertutup notch/home indicator | Safe area belum diterapkan di beberapa layar & BottomNav | `insets.top/bottom` di login/register/beranda/BottomNav + padding scroll |
| 4 | TTS tidak bersuara di iPhone | Mode silent mematikan suara expo-speech | `setAudioModeAsync({playsInSilentMode:true})` + indikator & pesan error |
| 5 | Simpan consent (M2) selalu gagal | Kolom `data_sharing_consent` tidak bisa diupdate klien | Endpoint `/api/consent` (server) |
| 6 | Penulisan quest & poin diblokir | Grant read-only pada `quests` & `total_points` | Endpoint `/api/quests` (server) + idempotensi + rollback poin |
| 7 | "Perjalananmu segera tersedia" & "Koneksi bermasalah" | Toast lama belum disambungkan; `EXPO_PUBLIC_API_URL=localhost` di device fisik | Kartu → `/perjalanan`; env → IP LAN |
| 8 | Complain titik krisis: banner mengklaim "psikolog sudah diberi tahu" padahal belum | Klaim melebihi kemampuan sistem | Teks jujur 3 varian (on-call / tidak ada / escalated) + `onCall`/`escalated` dari server |
| 9 | Kuis screening custom | PRD meminta instrumen tervalidasi | Diganti **GAD-7** (wording perlu tinjauan psikolog) |
| 10 | `feeling_input` gagal disimpan | CHECK constraint rusak (hanya 'biasa') | Fallback ke `social_report` + SQL perbaikan |
| 11 | Timer & laporan quest bisa dicurangi | Validasi hanya di klien | Validasi server (timer/laporan/jarak) + tombol demo hanya `__DEV__` |
| 12 | Navbar mobile tidak sama dengan web | Hanya 2 tab + tombol Profil mati | 4 tab Beranda/Companion/Perjalanan/Profil + halaman Perjalanan & Profil nyata |
| 13 | Tombol back Companion hilang | Waktu jadi tab, back dianggap tak perlu | Back pintar: ada riwayat → kembali; tidak → Beranda |
| 14 | `EXPO_DEEPSEEK_API_KEY` di mobile | Salah kanal (klien tidak boleh punya kunci AI) | Dipindah ke `web/.env.local` sebagai `DEEPSEEK_API_KEY` |
| 15 | `LIVEKIT_*` di `mobile/.env` | Kredensial server salah tempat | Dipindah ke `web/.env.local` |
| 16 | `.env` mobile tanpa newline → kunci Supabase rusak | Penambahan baris digabung | Diperbaiki + verifikasi struktur |
| 17 | Error `expo-speech-recognition` & LiveKit di Expo Go | Keduanya `requireNativeModule` saat import → throw walau ter-catch | Pre-check `requireOptionalNativeModule` / `NativeModules.WebRTCModule` |
| 18 | Izin mikrofon iOS berpotensi hilang | Plugin `expo-audio` `microphonePermission:false` dievaluasi terakhir → menimpa `NSMicrophoneUsageDescription` | Diganti deskripsi nyata + `recordAudioAndroid:true` |
| 19 | **Registrasi psikolog lupa dibuat** | Portal baru punya login, bukan pendaftaran | Halaman `/portal/register` + endpoint + upload dokumen privat |
| 20 | DeepSeek balas kosong pada pesan krisis | Provider mengembalikan konten kosong | Retry tanpa JSON mode + **fallback balasan krisis statis** |
| 21 | Crash `setState` di effect (lint web) | Pola pemanggilan effect tidak sesuai aturan React Compiler | Restrukturisasi ke pola `.then()`/IIFE |
| 22 | Klien mengambil data psikolog langsung | RLS menyaring semua baris | Semua data psikolog via server |
| 23 | MP shield/aset ekspresi belum ada | Aset gambar tidak bisa digenerate | Registry pose + 12 placeholder + panduan `POSE.md` |

---

## 5. Yang masih KURANG / belum selesai

### 5.1 Perlu aksi/aset dari manusia
| Item | Status | Butuh apa |
|---|---|---|
| **12 ilustrasi pose ekspresi** (3 × 4 arketipe) | Placeholder (salinan arketipe) | Desainer — spesifikasi lengkap di `mobile/POSE.md` |
| **Terjemahan & ambang GAD-7** | Fungsional | Tinjauan psikolog berlisensi sebelum dianggap valid klinis |
| **Upload avatar psikolog** | Berbasis URL di portal | Unggah file ke Supabase Storage (bucket publik/terkelola) |
| **Kredensial LiveKit** | ✅ sudah ada di server | Uji panggilan nyata di device |
| **Uji STT & panggilan di device** | Belum diuji | Development build iOS/Android |

### 5.2 Fitur PRD yang belum lengkap
| Area | Belum ada |
|---|---|
| **Krisi (Bagian 9)** | Notifikasi nyata ke psikolog on-call (push/email/SMS/telepon); saat ini hanya baris DB + polling manual di dashboard. Eskalasi ke kontak darurat/hotline juga belum otomatis (teks panduan saja) |
| **Booking** | Aksi psikolog: terima/tolak/reschedule sesi; **ketersediaan jadwal nyata** (sekarang slot generik 7 hari × 4 jam); verifikasi pembayaran manual (upload bukti / konfirmasi admin); invoice/QRIS; auto-`completed` setelah sesi |
| **Sesi manusia** | Penegakan durasi 50 menit, riwayat sesi & catatan psikolog, rekaman (sengaja OFF), kualitas lip-sync/animasi (memang di luar scope) |
| **Tier** | Peninjauan psikolog sebelum kenaikan tier final (PRD Fase 2); kalibrasi misi per-tier |
| **Quest** | Outdoor sedang (rute ala Strava dengan peta) — masih "segera hadir"; GPS saat ini hanya jarak (tanpa peta) dan verifikasi masih mempercayai klien |
| **Marketplace** | Rating/ulasan, filter spesialisasi/harga, jadwal dari kalender psikolog |
| **Profil mobile** | **Ganti arketipe** ("bisa diganti kapan saja" per desain/PRD) belum ada UI-nya; upload avatar sendiri untuk pasien? tidak diperlukan |
| **Admin portal** | Suspend/hapus pengguna, audit log tindakan admin, kelola dokumen reject → minta ulang |
| **Auth** | Reset kata sandi (lupa sandi) di portal & mobile; daftar psikolog via konfirmasi email sudah tertangani UI |
| **Privasi** | Kebijakan retensi data, ekspor/hapus data pasien (PDP), audit consent riwayat |

### 5.3 Utang teknis
- **Jadwal sentimen** masih *lazy* (terpicu saat ada chat) — sebaiknya cron/Edge Function harian.
- **Sweep SLA krisis** juga lazy (terpicu saat ada pesan baru) — sebaiknya cron; tanpa cron, alert bisa "diam" bila pasien tidak mengirim pesan lagi.
- **Tidak ada test otomatis** (Jest/RTL belum di-setup); verifikasi selama ini lewat skrip E2E ad-hoc + tsc/lint/export.
- **Dokumen usang**: `docs/database-schema.md` masih versi lama (Flutter/dashboard), dan bagian "Autentikasi" di `docs/api-contract.md` masih menyatakan endpoint tidak memvalidasi sesi (padahal sekarang **sudah**).
- **`docs/README.md`** menunjuk `PRD_AnimaCure.md` (nama file sebenarnya `PRD_vsikolog.md`).
- **Rate limiting/abuse** pada endpoint publik belum ada.
- **`web/.env.local`** memuat `ADMIN_PASSWORDS` yang tidak dipakai kode mana pun.
- **Seed demo memakai password lemah** `Demo1234!xyz` — wajib dihapus sebelum produksi.
- **`mobile/.env.example`** belum mencerminkan env terbaru? Sudah: hanya `EXPO_PUBLIC_*` (benar).

### 5.4 Catatan keputusan produk (bukan bug)
- Profil publik psikolog **menampilkan nama asli + gelar** (permintaan pemilik proyek), padahal PRD Bagian 6 menyebut publik cukup nama panggilan — perlu dipastikan keputusan ini final (opsi: tampil hanya di mode krisis/detail).
- **Video call = video psikolog asli tanpa avatar**; **voice call = avatar 2D statis** — sesuai keputusan terakhir.
- Teks krisis menyarankan `119`; mitra hotline krisis nasional belum difinalkan (PRD Bagian 9).

---

## 6. Status vs PRD Bagian 6 (MVP Pasien)

| # | Fitur PRD | Status |
|---|---|---|
| 1 | Onboarding + Kuis Screening + Pilih Avatar | ✅ GAD-7 + 4 arketipe (tinjauan klinis pending) |
| 2 | AI Companion (avatar, ekspresi, TTS, subtitle, persona) | ✅ fungsional (pose ekspresi masih placeholder) |
| 3 | Indikator Tier (ajakan natural, tanpa angka) | ✅ kartu ajakan di Companion |
| 4 | Layar Consent | ✅ + gate booking |
| 5 | Daftar Konsultasi (marketplace + booking) | ✅ (jadwal generik, pembayaran manual belum diverifikasi) |
| 6 | Eskalasi Krisis Otomatis | ⚠️ Sebagian — deteksi + alert + kontak acak + SLA, **belum ada notifikasi nyata ke manusia** |
| — | Quest CBT (pelengkap) | ✅ timer, laporan diri, GPS jarak (rute sedang: belum) |
| — | Journey/profil/kontak darurat | ✅ Perjalanan + Profil |
| — | Sesi psikolog manusia (voice/video) | ⚠️ Ada (LiveKit), belum diuji di device |
| — | STT Companion | ⚠️ Ada, belum diuji di device |

Status web: **Portal Admin/Psikolog lengkap untuk MVP**; UI pasien web **dihapus**
sesuai keputusan (API tetap dipertahankan untuk mobile).

---

## 7. Cara menjalankan & memverifikasi

```bash
# Web (portal + API) — server dev tunggal per folder
cd web && npm run dev
node scripts/seed-demo.mjs        # 4 psikolog + admin demo (idempotent)

# Mobile pasien
cd mobile && npx expo start -c    # butuh IP LAN di EXPO_PUBLIC_API_URL
# STT & panggilan: butuh development build
npx expo run:ios   # atau eas build --platform ios --profile development
```

Akun demo (portal): `demo.admin@kokoro.test`,
`demo.psikolog1..4@kokoro.test` — password `Demo1234!xyz`.

Verifikasi yang sudah dijalankan sepanjang pengembangan:
E2E portal (15/15), E2E token panggilan (5/5, lalu diulang 1/1), M1–M4 end-to-end
(companion/consent/quests/bookings/sentiment), smoke web (`/`→`/portal`,
rute pasien 404), `tsc` + `eslint` web & mobile, `expo export` web & iOS.

---

## 8. Rekomendasi prioritas berikutnya

1. **Development build + uji nyata** STT & panggilan voice/video (LiveKit sudah dikonfigurasi).
2. **Notifikasi krisis nyata** (push ke psikolog on-call + eskalasi kontak darurat) + pindahkan SLA/sentimen ke cron.
3. **Selesaikan alur booking**: terima/tolak/reschedule oleh psikolog, bukti pembayaran, ketersediaan jadwal asli.
4. **Ganti arketipe di Profil** (sesuai janji desain "bisa diganti kapan saja").
5. **Aset pose ekspresi** dari desainer (`POSE.md`) → ekspresi avatar benar-benar berganti.
6. **Sinkronkan dokumen usang** (`database-schema.md`, bagian "Autentikasi" api-contract, nama file PRD di README) + hapus `ADMIN_PASSWORDS`.
7. **Test otomatis** minimal untuk endpoint keselamatan (companion krisis, quests, bookings, calls/token) agar regresi tertangkap.

---

*Akhir dokumen.*
