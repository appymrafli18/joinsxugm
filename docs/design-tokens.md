# Design Tokens — Vsikolog

Nilai teknis yang langsung dipakai di kode (Tailwind config). Untuk
alasan/rasional di balik pilihan ini, lihat `docs/design.md`.

## Warna Netral (dipakai di semua halaman)

| Token | Hex | Kegunaan |
|---|---|---|
| `bg-base` | `#FBF8FD` | Latar utama — lavender sangat pucat |
| `text-main` | `#3B2E4A` | Teks utama — plum gelap, pengganti hitam pekat |
| `accent-cta` | `#E3779B` | Tombol CTA utama — rose hangat, konsisten di semua halaman |
| `accent-sparkle` | `#F5D9A6` | Dekorasi sparkle/bintang — emas lembut |

## Warna per Arketipe (identitas karakter)

| Arketipe | Token | Hex | Card background (pucat) |
|---|---|---|---|
| The Guardian | `guardian` | `#9B82C4` | `#EDE7F5` |
| The Healer | `healer` | `#E3A8B5` | `#FBEEF1` |
| The Scholar | `scholar` | `#7B88C4` | `#EAECF8` |
| The Companion | `companion` | `#F0A868` | `#FDEFE2` |

## Warna Fungsional (dari sistem lama, masih relevan)

| Token | Hex | Kegunaan |
|---|---|---|
| `sage` | `#9CAF88` | Indikator positif/stabil (grafik sentimen) |
| `terracotta` | `#C1453B` | Indikator risiko/krisis |

## Tipografi

| Token | Font | Kegunaan |
|---|---|---|
| `font-display` | **Mochiy Pop One** (Regular, satu-satunya weight) | Judul, heading — ukuran besar untuk kesan "bold" |
| `font-body` | **Mochiy Pop One** | Teks isi, label tombol |

Next.js: `import { Mochiy_Pop_One } from "next/font/google"` (weight: "400").

## Radius & Depth

| Token | Nilai | Kegunaan |
|---|---|---|
| `rounded-xl2` | `1.25rem` | Card, tombol, bubble chat |
| `shadow-float` | `0 8px 24px rgba(59,46,74,0.08)` | Shadow lembut di semua card — wajib dipakai, jangan ada elemen flat tanpa shadow (lihat `docs/design.md` soal kenapa depth penting) |

## Implementasi Next.js + Tailwind

```ts
// tailwind.config.ts
colors: {
  base: "#FBF8FD",
  text: "#3B2E4A",
  cta: "#E3779B",
  sparkle: "#F5D9A6",
  guardian: { DEFAULT: "#9B82C4", card: "#EDE7F5" },
  healer: { DEFAULT: "#E3A8B5", card: "#FBEEF1" },
  scholar: { DEFAULT: "#7B88C4", card: "#EAECF8" },
  companion: { DEFAULT: "#F0A868", card: "#FDEFE2" },
  sage: "#9CAF88",
  terracotta: "#C1453B",
},
fontFamily: {
  display: ["var(--font-mochiy)"],
  body: ["var(--font-mochiy)"],
},
borderRadius: { xl2: "1.25rem" },
boxShadow: { float: "0 8px 24px rgba(59,46,74,0.08)" },
```

## Navbar (keputusan final dari design.md)

4 tab: **Beranda / Companion / Misi / Profil**. "Perjalanan" diakses
lewat card di Beranda atau di dalam Profil, bukan tab terpisah.

## Riwayat Perubahan

- **Versi 3** (saat ini) — palet ungu-VTuber per arketipe, font Mochiy
  Pop One, nama produk "Vsikolog". Menggantikan total versi
  cream-peach dengan font Baloo 2.
- Versi 2 — cream/blush/peach/coral, font Baloo 2, nama "AnimaCure".
- Versi 1 — tema gelap "senja digital", font Sora/Kosugi Maru (tidak
  pernah dipakai di implementasi akhir).
