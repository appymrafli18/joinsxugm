# API Contract — AnimaCure

Endpoint di-host di `dashboard/` (Next.js API routes), dipanggil oleh
`mobile/` (Flutter) lewat HTTP biasa dan oleh `dashboard/` sendiri lewat
fetch internal. Base URL saat development: `http://localhost:3000`,
setelah deploy: URL Vercel project kamu.

> Status: `/api/companion` sudah diimplementasikan di scaffold. Endpoint
> lain masih rancangan — update bagian "Status" tiap endpoint selesai
> dibuat.

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