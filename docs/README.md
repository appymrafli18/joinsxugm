# Kokoro Cure (sebelumnya AnimaCure)

Platform kesehatan mental yang menghubungkan psikolog berlisensi dengan
pengguna melalui avatar VTuber/anime dan AI di latar belakang —
dikembangkan untuk Hackathon Healthcare FMIPA UGM.

Lihat `docs/PRD_AnimaCure.md` untuk detail lengkap produk, fitur, sistem
triase, protokol krisis, dan roadmap.

## Arsitektur

**Satu Next.js app (React + Tailwind CSS)** melayani dua sisi pengguna
sekaligus — bukan lagi Flutter (mobile) + Next.js (dashboard) terpisah
seperti rencana awal. Satu codebase, satu deployment, satu Tailwind
config (token warna & font yang sama dipakai di semua halaman).

```
animacure/
├── docs/            Dokumentasi produk (PRD, design tokens, data riset, dst)
└── app/             Next.js app — React + Tailwind, FE & BE jadi satu
    ├── (pasien)/        Rute untuk pasien: onboarding, companion, misi, dst
    ├── (psikolog)/      Rute untuk psikolog: dashboard, daftar pasien, alert
    └── api/             API routes (companion, sentiment, dst)
```

Backend: **Supabase** (database, auth, storage) — satu project yang
sama dipakai baik dari sisi pasien maupun psikolog, diakses lewat
`@supabase/supabase-js`.

## Menjalankan

```
cd app
npm install
npm run dev
```

Salin `.env.example` menjadi `.env.local`, isi `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, dan
`ANTHROPIC_API_KEY` sebelum menjalankan.

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
