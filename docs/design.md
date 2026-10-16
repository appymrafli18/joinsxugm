# Design Document — Vsikolog

Dokumen ini menjelaskan **konsep dan alasan** di balik tampilan
Vsikolog — mood, gaya visual, dan rasional tiap halaman. Untuk **nilai
teknis** (hex warna, nama font, radius) lihat `docs/design-tokens.md`
secara terpisah — dokumen itu adalah turunan teknis dari keputusan di
sini, bukan sumber keputusan.

---

## 1. Arah Visual

**Konsep inti: "Konselor VTuber yang hangat."**

Kombinasi dua kesan yang biasanya tidak disandingkan — estetika
VTuber/anime yang kuat (ring light di mata, sparkle, ring
light/glow khas streaming) dipadukan dengan kesan **kompeten dan bisa
dipercaya** (gestur, aksesoris, dan pose yang menandakan sosok
pendamping profesional), bukan sekadar karakter anime generik yang
kebetulan dipakai di app kesehatan.

Ini sengaja dibuat berbeda dari dua arah yang gagal sebelumnya:
- **Terlalu dingin/misterius** — tema ungu gelap generik ala galaxy
  yang justru terasa jauh, bukan aman, untuk pasien dengan kecemasan
  sosial
- **Terlalu generik/tidak berkarakter** — hasil awal yang flat tanpa
  depth, shadow, atau detail premium

Arah final: **ungu lembut sebagai identitas utama**, dipadukan aksen
hangat (rose, emas, coral) per karakter, dengan depth visual (shadow,
gradient, glow) supaya terasa premium dan "hidup" — bukan mockup
template.

---

## 2. Empat Karakter, Empat Palet

Setiap arketipe avatar punya palet warna sendiri yang konsisten dipakai
di semua konteks (halaman pemilihan, chat, dsb) — supaya pasien bisa
mengenali "siapa yang sedang bicara" hanya dari warna, bahkan sebelum
melihat detail karakternya.

| Arketipe | Kepribadian | Warna identitas | Aksesoris pembeda |
|---|---|---|---|
| The Guardian | Sigap, terstruktur, protektif | Ungu (`#9B82C4`) | Headset kecil, clipboard |
| The Healer | Lembut, menenangkan | Rose-emas (`#E3A8B5`) | Jepit bunga, cangkir hangat |
| The Scholar | Analitis, reflektif | Indigo (`#7B88C4`) | Kacamata bulat, buku kecil |
| The Companion | Akrab, santai, ceria | Coral-amber (`#F0A868`) | Headphone dikalungkan di leher |

**Elemen yang masih dipertimbangkan, belum final:** ring light di mata
(ciri khas VTuber) belum konsisten muncul di hasil generate — perlu
diputuskan apakah ini dipertahankan sebagai identitas wajib atau
dilepas karena desain sudah cukup "VTuber" tanpanya.

---

## 3. Alur Halaman & Rasional Desain

### Onboarding (3 pertanyaan screening)
Satu karakter berbeda tampil di tiap pertanyaan (Guardian → Healer →
Scholar), masing-masing dengan background bergradasi sesuai warna
identitasnya. Tujuannya: pasien "berkenalan" dengan beberapa kepribadian
avatar sebelum diminta memilih satu secara sadar di halaman berikutnya
— bukan asal pilih dari static grid tanpa konteks.

Tombol CTA ("Setuju"/warna aksen utama) sengaja **konsisten rose hangat
di semua halaman**, walau karakter dan background berganti — supaya
pasien tetap merasa berada di satu aplikasi yang sama, bukan berpindah
identitas tiap halaman.

### Pemilihan Arketipe
Keempat karakter (termasuk Companion yang baru muncul di sini)
ditampilkan berdampingan dalam grid, dengan card terpilih mendapat
highlight border emas + glow. Gaya ilustrasi keempatnya dijaga konsisten
(proporsi, shading) meski detail outfit/warna berbeda — supaya terasa
"satu keluarga karakter", bukan 4 gaya lepas-lepas.

### Beranda
Companion (karakter yang dipilih pasien) menyapa personal di bagian
atas, diikuti 3 card prioritas: ajakan chat (paling menonjol, dengan
badge streak), misi hari ini, dan progres perjalanan menuju sesi
manusia. Urutan ini sengaja: **ajakan chat selalu paling atas dan paling
besar**, karena itu fitur inti yang paling sering dipakai harian.

Navbar bawah saat ini: Beranda / Misi / Perjalanan / Profil — **catatan
terbuka:** akses cepat ke Companion/chat tidak punya tab sendiri di
navbar, hanya lewat card di Beranda. Perlu diputuskan apakah ini cukup,
atau butuh tab khusus karena chat adalah fitur paling sering dipakai.

### Misi (Quest CBT)
Empat kategori misi graded exposure (indoor ringan → outdoor ringan →
outdoor sedang ala Strava → sosial), masing-masing warna berbeda agar
mudah dibedakan sekilas. Poin dari misi terkumpul menuju reward sesi
konsultasi gratis — progress ini ditonjolkan di bagian atas halaman
supaya pasien selalu sadar seberapa dekat mereka dengan reward nyata.

Sengaja **tidak menampilkan karakter avatar** di halaman ini — fokus ke
daftar aksi, bukan interaksi sosial dengan AI.

### Chat Penuh dengan Companion
Ini halaman paling berbeda dari chat app pada umumnya: avatar jadi
**fokus utama layar** (bukan bubble chat kecil-kecil), balasan muncul
sebagai subtitle melayang di bawah avatar, dan riwayat chat ditaruh
lebih kecil di bawah sebagai pendukung, bukan elemen utama. Ini
menerjemahkan konsep "ngobrol dengan avatar yang hidup dan bicara"
(termasuk rencana TTS) ke dalam layout, bukan sekadar chatbot berbalut
gambar karakter di pojok.

---

## 4. Keputusan Final

- **Ring light di mata: dilepas**, tidak jadi syarat wajib di prompt
  generate karakter — AI image generator sulit konsisten
  menghasilkannya, dan identitas VTuber sudah cukup kuat lewat sparkle,
  gradasi rambut, dan aksesoris khas per karakter.
- **Navbar: Beranda / Companion / Misi / Profil.** Companion dapat tab
  sendiri karena fitur paling sering dipakai harian — tidak cukup
  hanya lewat card di Beranda. "Perjalanan" tidak jadi tab terpisah,
  diakses lewat card di Beranda atau di dalam halaman Profil.
- **Font: Mochiy Pop One** (bukan Baloo 2) — karakter kawaii/Jepang
  lebih kental, lebih mengikat ke identitas VTuber dibanding Baloo 2
  yang playful generik. Catatan teknis: font ini hanya punya 1
  ketebalan (Regular) — kesan "bold" di judul dicapai lewat ukuran
  font yang lebih besar, bukan font-weight.

Nilai teknis dari ketiga keputusan ini (hex warna, nama font persis)
ada di `docs/design-tokens.md`.
