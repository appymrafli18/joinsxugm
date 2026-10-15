# POSE.md — Panduan Generate Pose Ekspresi Avatar

Dokumen ini untuk **desainer / AI image generator**: cara membuat 12 ilustrasi
pose ekspresi Companion (4 arketipe × 3 ekspresi: netral, senang, khawatir)
agar bisa langsung dipakai aplikasi mobile tanpa perubahan kode.

> Status saat ini: `mobile/assets/images/expressions/` berisi **placeholder**
> (salinan gambar arketipe). Ganti file-file itu dengan ilustrasi asli sesuai
> spesifikasi di bawah — kode akan otomatis memakai gambar baru.

---

## 1. Spesifikasi Teknis

| Item | Ketentuan |
|---|---|
| Format | PNG (boleh transparan, boleh memakai latar pastel arketipe) |
| Ukuran | Sisi terpanjang **≥ 1080 px** (disarankan 1080×1260) |
| Komposisi | **Bust-up / setengah badan**, karakter di tengah, framing **sama persis** untuk ketiga ekspresi |
| Berat file | ≤ 1.5 MB per file |
| Nama file | `guardian-netral.png`, `guardian-senang.png`, `guardian-khawatir.png`, dst (lowercase, pakai tanda hubung) |
| Lokasi | `mobile/assets/images/expressions/` |
| Setelah mengganti file | Jalankan ulang `npx expo start -c` (cache aset Metro) |

Nama lengkap 12 file:

```text
expressions/
├── guardian-netral.png     ├── scholar-netral.png
├── guardian-senang.png     ├── scholar-senang.png
├── guardian-khawatir.png   ├── scholar-khawatir.png
├── healer-netral.png       ├── companion-netral.png
├── healer-senang.png       ├── companion-senang.png
├── healer-khawatir.png     └── companion-khawatir.png
```

---

## 2. Deskripsi Karakter (identitas tetap di semua pose)

Ini deskripsi dari ilustrasi yang sudah ada — **jangan diubah** di pose baru,
hanya ekspresinya yang berganti.

| Arketipe | Ciri wajib | Aksesoris pembeda | Warna identitas | Latar kartu |
|---|---|---|---|---|
| **The Guardian** | Perempuan, rambut panjang bergelombang **lavender/ungu**, mata ungu | Headset kecil + mikrofon, memegang **clipboard** ungu, pita ungu dengan bintang emas | `#9B82C4` | `#EDE7F5` |
| **The Healer** | Perempuan, rambut panjang **putih-perak dengan ujung pink lembut**, mata merah-pink | Jepit bunga, memegang **cangkir hangat** dengan dua tangan, cardigan rajut pink | `#E3A8B5` | `#FBEEF1` |
| **The Scholar** | Perempuan, rambut pendek **biru navy gelap**, **kacamata bulat** | Syal mustard, sweater indigo, memegang **buku kecil** dengan bintang | `#7B88C4` | `#EAECF8` |
| **The Companion** | Perempuan, rambut sedang **oranye/peach**, mata amber | **Headphone putih dikalungkan di leher**, hoodie oranye oversized, pose santai (tangan di pipi) | `#F0A868` | `#FDEFE2` |

Gaya visual: **anime modern / VTuber** — lembut, hangat, ada glow/rim light,
sparkle bintang kecil. Bukan 3D, bukan fotorealistik.

---

## 3. Tiga Ekspresi

| Ekspresi | Dipakai saat | Panduan wajah |
|---|---|---|
| **netral** | Balasan tenang / biasa | Senyum tipis menutup mulut, mata lembut, alis rileks |
| **senang** | Balasan ceria / menyemangati | Senyum lebar, mata berbinar (boleh sedikit menyipit), pipi merona |
| **khawatir** | Balasan prihatin / momen krisis | Alis naik mengerut, sudut mulut turun halus, mata lembut penuh empati — **bukan panik/marah** |

---

## 4. Template Prompt (siap pakai)

Gunakan **referensi gambar yang sudah ada** (mis.
`mobile/assets/images/raster/arkatipe_guardian.png`) sebagai *character
reference / image prompt*, lalu ganti bagian `{EXPRESSION}`.

**Template umum:**

```text
Anime VTuber-style character illustration, bust-up half body, centered,
same character as reference: {DESKRIPSI KARAKTER}.
Expression: {EXPRESSION}. Soft pastel background {WARNA LATAR} with tiny
sparkle stars, cozy warm rim light, gentle gradient shading, clean lineart,
high detail eyes, consistent character design, no text, no watermark.
```

**`{EXPRESSION}` per pose:**

- netral → `calm gentle closed-mouth smile, relaxed soft eyes, serene mood`
- senang → `bright cheerful smile, sparkling happy eyes, light blush, joyful mood`
- khawatir → `gentle concerned expression, slightly furrowed brows, soft worried
  empathetic eyes, small frown, caring mood`

**Contoh lengkap — Guardian senang:**

```text
Anime VTuber-style character illustration, bust-up half body, centered,
same character as reference: young woman with long wavy lavender-purple hair,
purple eyes, white blazer, small headset with mic, holding a lavender clipboard,
gold star hairpin, purple ribbon with gold star.
Expression: bright cheerful smile, sparkling happy eyes, light blush, joyful mood.
Soft pastel background #EDE7F5 with tiny sparkle stars, cozy warm rim light,
gentle gradient shading, clean lineart, high detail eyes, consistent character
design, no text, no watermark.
```

**Negative prompt (semua pose):**

```text
text, watermark, signature, extra characters, photorealistic, 3d render,
dark/gloomy colors, distorted face, extra fingers, deformed hands, low quality,
jpeg artifacts
```

---

## 5. Tips Konsistensi

1. **Generate `netral` lebih dulu** per arketipe, lalu pakai hasilnya sebagai
   referensi untuk `senang` & `khawatir` (fitur character reference / img2img).
2. **Seed & aspect ratio sama** untuk ketiga ekspresi satu arketipe.
3. Framing **tidak boleh bergeser** antar pose — hanya wajah yang berubah;
   saat aplikasi berganti pose, kepala terasa diam di tempat.
4. Jangan menambah/menghilangkan aksesoris antar pose (headset tetap ada, dst).
5. Cek hasil di layar: buka tab **Companion** di aplikasi, balasan dengan
   ekspresi berbeda akan menampilkan pose berbeda dengan transisi halus.

---

## 6. Setelah Aset Selesai

1. Timpa 12 file di `mobile/assets/images/expressions/` (nama sama persis).
2. `npx expo start -c` — **tidak ada perubahan kode yang diperlukan**.
3. Verifikasi cepat: kirim pesan biasa (netral) → pesan bersemangat (senang) →
   pesan sedih (khawatir), dan cek avatar berganti pose di tiap balasan.
