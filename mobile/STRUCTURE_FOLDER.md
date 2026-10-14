# Recommended Folder Structure — React Native (Expo)

> **Dokumen ini adalah panduan struktur folder untuk project React Native berbasis Expo.**
> Cocok dipakai untuk project skala kecil–menengah seperti MVP hackathon, tapi tetap rapi untuk dikembangkan lebih lanjut.
> Contoh penerapan konkret: project **Vsikolog** (mobile app kesehatan mental dengan avatar anime & AI).

---

## 1. Prinsip Dasar

Sebelum melihat struktur, pahami dulu prinsipnya:

1. **Pisahkan UI dari logika.** Screens/routes = tampilan, lib/services = logika.
2. **Kolokasi fitur yang berkaitan.** Komponen yang dipakai satu screen saja taruh dekat screen tersebut.
3. **Folder berdasarkan tanggung jawab**, bukan berdasarkan jenis file semata.
4. **Konsisten penamaan.** Pilih satu konvensi (`kebab-case`, `PascalCase`, `camelCase`) dan pakai di seluruh project.
5. **Jangan over-engineering.** Untuk MVP, hindari monorepo, turborepo, atau micro-frontend.
6. **Mudah dicari.** Nama file harus menggambarkan isinya tanpa perlu buka file.

---

## 2. Struktur Folder Recommended (Expo + Expo Router)

Struktur ini cocok untuk project React Native berbasis **Expo Router** (file-based routing).

```
project-root/
├── app/                          # Semua route / screen (Expo Router)
│   ├── _layout.tsx               # Root layout
│   ├── index.tsx                 # Entry screen
│   ├── +not-found.tsx            # 404 screen
│   │
│   ├── (auth)/                   # Group: auth flow
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   │
│   ├── (tabs)/                   # Group: main app with bottom tabs
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── explore.tsx
│   │   └── profile.tsx
│   │
│   ├── onboarding/               # Stack onboarding
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx
│   │   └── screening.tsx
│   │
│   └── detail/
│       └── [id].tsx              # Dynamic route
│
├── components/                   # Komponen React yang reusable
│   ├── ui/                       # Komponen UI primitif (Button, Input, Card)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Card.tsx
│   ├── common/                   # Komponen gabungan lintas fitur
│   │   ├── Header.tsx
│   │   ├── EmptyState.tsx
│   │   └── LoadingSpinner.tsx
│   └── Avatar.tsx                # Komponen domain-spesifik (flat)
│
├── lib/                          # Logika non-UI, service, helper
│   ├── supabase.ts               # Client setup
│   ├── api.ts                    # Wrapper HTTP
│   ├── tts.ts                    # Wrapper Text-to-Speech
│   ├── storage.ts                # Wrapper AsyncStorage
│   └── formatters.ts             # Fungsi format tanggal, angka, dll
│
├── hooks/                        # Custom React hooks
│   ├── useAuth.ts
│   ├── useChat.ts
│   └── useTheme.ts
│
├── constants/                    # Nilai konstan & konfigurasi
│   ├── colors.ts
│   ├── typography.ts
│   ├── config.ts                 # API URL, feature flags
│   └── personas.ts               # Domain-specific constants
│
├── types/                        # TypeScript type & interface
│   ├── database.ts
│   ├── user.ts
│   └── api.ts
│
├── store/                        # State management global (opsional)
│   ├── authStore.ts              # Kalau pakai Zustand / Redux
│   └── userStore.ts
│
├── utils/                        # Fungsi utilitas murni (pure functions)
│   ├── date.ts
│   ├── validation.ts
│   └── score.ts
│
├── assets/                       # Asset statis
│   ├── images/
│   ├── icons/
│   ├── fonts/
│   └── avatars/
│
├── __tests__/                    # Test file
│   ├── components/
│   └── lib/
│
├── .env                          # Env vars (JANGAN commit)
├── .env.example                  # Template env (commit)
├── .gitignore
├── app.json                      # Konfigurasi Expo
├── package.json
├── tsconfig.json
└── README.md
```

---

## 3. Penjelasan Setiap Folder

### 3.1 `app/` — Routes & Screens
- **Hanya** berisi file yang menjadi route (screen).
- Nama file = nama route (contoh: `login.tsx` → `/login`).
- Folder dalam tanda kurung `(auth)` = **route group**, tidak muncul di URL.
- `_layout.tsx` = layout untuk folder tersebut.
- `[id].tsx` = dynamic route (parameter `id`).

**Aturan:**
- Jangan taruh komponen reusable di `app/`.
- Kalau file di `app/` mulai panjang (>200 baris), pecah ke `components/`.

### 3.2 `components/` — Komponen Reusable

Bagi menjadi 2–3 sub-folder:

- **`ui/`** → komponen primitif: `Button`, `Input`, `Card`, `Badge`.
  Tidak tahu apapun soal domain aplikasi.
- **`common/`** → komponen gabungan lintas fitur: `Header`, `EmptyState`.
  Bisa pakai `ui/` di dalamnya.
- **Flat di root `components/`** → komponen domain-spesifik: `Avatar`, `ChatBubble`.

**Kapan taruh di mana?**
- Dipakai 1 screen saja → taruh di `app/` (kolokasi) atau `components/` jika perlu reuse nanti.
- Dipakai 2+ screen → `components/`.

### 3.3 `lib/` — Logika & Service
Semua yang bukan UI dan bukan React component.

- `supabase.ts` → inisialisasi client.
- `api.ts` → wrapper `fetch` dengan base URL & interceptor.
- `tts.ts` → pembungkus Text-to-Speech.
- `storage.ts` → pembungkus AsyncStorage.

**Aturan:**
- File di `lib/` **boleh** di-import dari mana saja.
- File di `lib/` **tidak boleh** mengimpor dari `app/` atau `components/`.

### 3.4 `hooks/` — Custom React Hooks
- Prefix `use` (contoh: `useAuth`, `useChat`).
- Boleh memanggil `lib/`, `constants/`, `store/`.
- Jangan taruh logika UI di sini — hanya logika stateful reusable.

### 3.5 `constants/` — Nilai Konstan
- `colors.ts`, `typography.ts`, `spacing.ts` → design tokens.
- `config.ts` → API URL, feature flags.
- File domain: `personas.ts`, `quests.ts`.

**Aturan:**
- Nilai **tidak berubah** selama runtime.
- Kalau butuh nilai dinamis → taruh di `store/` atau `lib/`.

### 3.6 `types/` — TypeScript Types
- Semua `interface` dan `type` global.
- Bisa juga ditaruh dekat kode yang memakainya (kolokasi) — pilih satu gaya konsisten.
- Kalau type khusus 1 komponen → taruh di file komponennya.

### 3.7 `store/` — Global State (Opsional)
- Untuk MVP, **hindari dulu**. Cukup pakai `useState` + `useContext`.
- Kalau butuh, rekomendasi: **Zustand** (ringan) atau **Redux Toolkit** (kompleks).
- Satu store per domain: `authStore`, `chatStore`.

### 3.8 `utils/` — Pure Functions
- Fungsi murni tanpa side effect: format tanggal, validasi, hitung skor.
- Beda dengan `lib/`: `utils/` = fungsi murni, `lib/` = wrapper service (punya side effect: panggil API, baca storage).

### 3.9 `assets/` — File Statis
- `images/`, `icons/`, `fonts/`.
- Kelompokkan lagi jika banyak: `avatars/guardian/`, `avatars/healer/`.

### 3.10 `__tests__/` — Testing
- Struktur mirror dari `components/` dan `lib/`.
- Pakai **Jest** + **React Native Testing Library**.

---

## 4. Konvensi Penamaan

| Jenis | Konvensi | Contoh |
|---|---|---|
| Screen / route | `kebab-case.tsx` | `choose-avatar.tsx` |
| Komponen | `PascalCase.tsx` | `ChatBubble.tsx` |
| Hook | `use*.ts` | `useAuth.ts` |
| Utility / lib | `camelCase.ts` | `formatDate.ts` |
| Konstanta | `camelCase.ts` atau `UPPER_SNAKE` | `colors.ts`, `API_URL` |
| Tipe | `camelCase.ts` | `user.ts` |
| Asset gambar | `kebab-case.png` | `guardian-neutral.png` |
| Test | `*.test.ts` | `Button.test.tsx` |

---

## 5. Import Alias

Gunakan alias `@/` untuk menghindari path relatif panjang (`../../../`).

**`tsconfig.json`:**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Contoh pemakaian:**
```ts
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';
import Avatar from '@/components/Avatar';
```

**Bonus:** alias per folder kalau project besar:
```json
"paths": {
  "@/*": ["./*"],
  "@components/*": ["./components/*"],
  "@lib/*": ["./lib/*"]
}
```

---

## 6. Struktur Alternatif: Feature-Based

Kalau project tumbuh besar, pertimbangkan **feature-based structure**:

```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types.ts
│   │   └── screens/
│   ├── chat/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   └── quest/
│       └── ...
├── shared/
│   ├── components/
│   ├── hooks/
│   └── utils/
└── app/              # Routes Expo Router
```

**Kelebihan:** semua yang berkaitan satu fitur ada di satu folder.
**Kekurangan:** lebih banyak folder, kurang cocok untuk MVP kecil.

**Rekomendasi:**
- MVP / hackathon → **type-based** (Bagian 2).
- Project jangka panjang → **feature-based** (Bagian 6).

---

## 7. Contoh Konkret: Vsikolog (MVP)

```
Vsikolog/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── onboarding/
│   │   ├── index.tsx
│   │   ├── screening.tsx
│   │   └── choose-avatar.tsx
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── psikolog.tsx
│   │   └── profile.tsx
│   ├── chat/
│   │   └── [persona].tsx
│   ├── consent/
│   │   └── index.tsx
│   ├── quest/
│   │   ├── index.tsx
│   │   └── [questId].tsx
│   └── psikolog/
│       ├── [psikologId].tsx
│       └── booking.tsx
│
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Card.tsx
│   ├── common/
│   │   ├── Header.tsx
│   │   └── EmptyState.tsx
│   ├── Avatar.tsx
│   ├── ChatBubble.tsx
│   ├── QuestCard.tsx
│   ├── PsikologCard.tsx
│   └── TierBadge.tsx
│
├── lib/
│   ├── supabase.ts
│   ├── tts.ts
│   ├── llm.ts
│   ├── crisis.ts
│   ├── tier.ts
│   └── quest.ts
│
├── hooks/
│   ├── useAuth.ts
│   ├── useChat.ts
│   └── useTier.ts
│
├── constants/
│   ├── colors.ts
│   ├── personas.ts
│   ├── quests.ts
│   └── crisisKeywords.ts
│
├── types/
│   ├── database.ts
│   ├── persona.ts
│   └── quest.ts
│
├── utils/
│   ├── date.ts
│   └── score.ts
│
├── assets/
│   ├── avatars/
│   │   ├── guardian-neutral.png
│   │   ├── guardian-happy.png
│   │   └── ...
│   ├── icons/
│   └── images/
│
├── .env
├── .env.example
├── app.json
├── tsconfig.json
└── package.json
```

---

## 8. Best Practices

### 8.1 Prinsip
- **Kolokasi**: taruh file dekat dengan yang memakainya.
- **Satu file satu tanggung jawab**: `Button.tsx` hanya berisi `Button`.
- **Barrel exports**: gunakan `index.ts` di folder besar untuk re-export.
- **Jangan taruh business logic di screen.**
- **Jangan import dari `app/` di `lib/` atau `components/`** — arah import harus satu arah: `app/` → `components/` → `lib/`.

### 8.2 Yang sering salah
- ❌ Semua komponen di satu file `Components.tsx`.
- ❌ Taruh API key di `app/` atau `components/`.
- ❌ Folder `screens/` di dalam `app/` (di Expo Router, `app/` sudah screens).
- ❌ Nama file `ScreenLogin.tsx` (capital + redundant).
- ❌ Import relatif panjang `../../../lib/x`.

### 8.3 Yang benar
- ✅ Satu komponen satu file.
- ✅ Alias `@/lib/...`.
- ✅ Nama file menggambarkan isi.
- ✅ Arah import satu arah: `app` → `components` → `lib` → `utils`.

---

## 9. Konfigurasi Tambahan

### 9.1 `.gitignore`
```
node_modules/
.expo/
.env
.env.local
*.log
.DS_Store
ios/
android/
```

### 9.2 `.env.example`
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=
```

### 9.3 ESLint + Prettier (opsional tapi direkomendasikan)
```bash
npx expo install eslint prettier --dev
```

`.eslintrc.js`:
```js
module.exports = {
  extends: ['expo', 'prettier'],
  rules: {
    'no-unused-vars': 'warn',
  },
};
```

---

## 10. Kapan Struktur Ini Perlu Diubah?

Struktur ini **cukup** untuk:
- Project hackathon.
- MVP 5–20 screen.
- Tim 1–4 orang.

Perlu diubah ke **feature-based** jika:
- Lebih dari 30 screen.
- Tim lebih dari 5 orang.
- Setiap fitur punya domain logic sendiri yang kompleks.
- Butuh code-splitting per fitur.

Perlu diubah ke **monorepo** jika:
- Ada mobile app + web + backend dalam satu repo.
- Butuh share kode antar platform.

---

**Akhir dokumen.**