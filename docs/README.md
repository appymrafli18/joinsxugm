# Kokoro Cure (sebelumnya AnimaCure)

Platform kesehatan mental yang menghubungkan psikolog berlisensi dengan
pengguna melalui avatar VTuber/anime dan AI di latar belakang —
dikembangkan untuk Hackathon Healthcare FMIPA UGM.

Lihat `docs/PRD_AnimaCure.md` untuk detail lengkap produk, fitur, sistem
triase, protokol krisis, dan roadmap.

## Arsitektur

Dua klien, satu backend:

```
joinsxugm/
├── docs/            Dokumentasi produk (PRD, design, schema, API contract)
├── web/             Next.js — DUA peran:
│   ├── app/portal/      Portal Admin & Psikolog (satu-satunya UI web)
│   └── app/api/         API server yang dipakai aplikasi mobile pasien
└── mobile/          React Native (Expo) — aplikasi pasien
```

- **Pasien** memakai aplikasi `mobile/` (onboarding, Companion AI + TTS/STT,
  misi Quest CBT, consent, marketplace psikolog, panggilan suara/video dengan
  psikolog asli).
- **Admin & Psikolog** memakai `web/` lewat `/portal` — verifikasi STR/SIPP,
  profil publik, dashboard pasien, alert krisis, on-call, dan sesi.
- UI pasien **tidak ada lagi di web**; API server (`web/app/api/*`) tetap
  dipertahankan karena dipakai mobile.
- **Panggilan manusia** memakai LiveKit (voice: avatar 2D statis; video:
  video psikolog asli). AI Companion adalah layanan terpisah.

Backend/data: **Supabase** (database, auth, storage) — satu project yang
sama dipakai mobile dan portal.

## Menjalankan

```
cd web
npm install
npm run dev
node scripts/seed-demo.mjs    # data demo: 4 psikolog + akun admin
```

Isi `web/.env.local` (lihat `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY` (AI Companion — server only)
- `ADMIN_EMAILS` (allowlist admin portal, pisah koma — tambahkan emailmu)
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (opsional; tanpa ini
  panggilan menampilkan pesan "belum dikonfigurasi")

Login demo portal: `demo.admin@kokoro.test` dan
`demo.psikolog1..4@kokoro.test` — password `Demo1234!xyz`.

Aplikasi pasien (React Native/Expo) ada di `mobile/` — isi `mobile/.env`
dengan `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, dan
`EXPO_PUBLIC_API_URL` (alamat server web di atas), lalu `npx expo start -c`.

> Catatan: panggilan suara/video (LiveKit) dan input suara (STT) memakai
> modul native — keduanya **butuh development build** (`npx expo run:ios` /
> `expo run:android` atau EAS build), tidak bisa di Expo Go. Sisa aplikasi
> tetap berjalan normal di Expo Go.

## Dokumen Penting

| Dokumen | Lokasi | Isi |
|---|---|---|
| PRD | `docs/PRD_AnimaCure.md` | Fitur lengkap, model bisnis, sistem triase, protokol krisis, roadmap |
| Design tokens | `docs/design-tokens.md` | Palet warna ungu-VTuber & font — perlu diupdate dari versi cream lama |
| Database schema | `docs/database-schema.md` | Struktur tabel Supabase |
| API contract | `docs/api-contract.md` | Daftar endpoint & format request/response |
| Prompt mockup | `docs/prompt-*.md` | Kumpulan prompt AI image generator untuk tiap halaman |

## Catatan Riwayat (penting untuk konteks)

- Rencana awal memakai Flutter (mobile pasien) + Next.js (dashboard
  psikolog) — sudah digantikan sepenuhnya dengan satu Next.js app
  per keputusan tim terbaru. Kode Flutter lama (jika masih ada di
  riwayat chat/file lama) sudah tidak dipakai.
- Nama produk sempat berubah dari "AnimaCure" ke "Kokoro Cure" seiring
  perubahan arah desain (dari palet cream-peach ke ungu-VTuber).
