# Product Requirements Document (PRD)
## Vsikolog — Platform Kesehatan Mental Berbasis Avatar Anime & AI

**Versi:** 2.0 (revisi lengkap untuk tim)
**Konteks:** Hackathon Healthcare — FMIPA UGM
**Catatan:** Dokumen ini TIDAK membahas tech stack/framework (frontend, backend,
database) — itu sudah ditentukan terpisah oleh tim. Dokumen ini fokus ke
fitur, alur, dan kebutuhan teknologi AI secara fungsional.

---

## 1. Ringkasan Eksekutif

Vsikolog adalah platform kesehatan mental yang menghubungkan psikolog
berlisensi dengan pengguna melalui avatar anime (gaya VTuber) dan AI di
latar belakang. Target pengguna adalah individu dengan gejala hikikomori
(penarikan diri sosial ekstrem) dan kecemasan sosial berat, yang sulit
menjangkau layanan kesehatan mental konvensional karena resistensi
terhadap interaksi tatap muka.

**Prinsip inti:** AI berperan sebagai teman pertama dan lapisan triase —
bukan pengganti psikolog. Psikolog manusia berlisensi tetap menjadi
pengambil keputusan klinis final untuk semua kasus yang membutuhkan
penanganan nyata.

**Kenapa ini bisa langsung diimplementasikan:** semua komponennya sudah
ada dan legal dipakai hari ini — psikolog berlisensi yang sudah boleh
praktik, AI percakapan, sistem pembayaran, dan video call. Yang
berkembang seiring waktu adalah skala (jumlah psikolog partner) dan
fitur pelengkap (avatar real-time, dll), bukan fondasi intinya.

---

## 2. Masalah yang Diselesaikan

- Individu dengan hikikomori/kecemasan sosial berat sering menghindari
  terapi karena hambatan psikologis menghadapi interaksi tatap muka
  dengan manusia asing/lingkungan medis formal.
- Mereka sering tidak sadar atau menyangkal seberapa parah kondisinya
  sendiri, sehingga tidak pernah mencari bantuan lebih dulu.
- Psikolog berlisensi jumlahnya terbatas — solusi harus memperluas
  jangkauan mereka secara efisien, bukan menciptakan ketergantungan pada
  AI tanpa pengawasan manusia.
- Transisi dari "tidak melakukan apa-apa" ke "sesi dengan psikolog
  manusia" terlalu jauh/menakutkan sebagai satu lompatan — dibutuhkan
  jembatan bertahap.

**Catatan penting soal urutan sebab-akibat:** masalah inti yang dijawab
langsung oleh inovasi avatar/AI di produk ini adalah **hambatan
psikologis menghadapi tatap muka** — bukan biaya. Biaya adalah **faktor
yang memperparah** masalah ini (psikolog terbatas + sesi berbayar jadi
hambatan tambahan di atas hambatan psikologis yang sudah ada), bukan
masalah utama yang coba dijawab langsung oleh avatar VTuber. Karena itu
solusi dibuat berlapis: AI Companion gratis tanpa batas sebagai jembatan
pertama (menjawab hambatan psikologis), baru layanan berbayar untuk
pendampingan lanjutan (mengelola keterbatasan biaya & kapasitas
psikolog) — lihat Bagian 5.

---

## 3. Tujuan & Metrik Keberhasilan (KPI)

| Tujuan | Metrik |
|---|---|
| Menurunkan hambatan psikologis untuk mulai mencari bantuan | Jumlah pengguna baru yang menyelesaikan onboarding dan memulai chat pertama |
| Menjaga keterlibatan pada dukungan mandiri | Retention rate mingguan AI Companion & Quest CBT |
| Mendorong transisi ke bantuan profesional saat dibutuhkan | % pasien Tier Medium/High yang berhasil booking sesi psikolog |
| Menjamin keselamatan kasus krisis | Waktu rata-rata dari deteksi krisis ke respons psikolog on-call |
| Menjamin privasi pengguna | 0% insiden kebocoran identitas asli pengguna tanpa consent |
| Validitas sistem triase | Kesesuaian tier yang diusulkan AI dengan asesmen psikolog (setelah ditinjau manusia) |

---

## 4. Profil Pengguna

**Pasien:** Individu dengan gejala hikikomori/social withdrawal dan
kecemasan sosial signifikan, memiliki afinitas terhadap budaya visual
anime sebagai zona aman, menunjukkan resistensi terhadap lingkungan
medis konvensional.

**Psikolog/Psikiater:** Tenaga profesional berlisensi (punya STR/SIPP
aktif) yang ingin menjangkau pasien yang secara sosial terisolasi lewat
kanal alternatif, tanpa mengurangi standar penanganan klinis, dan
bersedia menerima kompensasi per sesi.

*(Bahasa resmi: gunakan istilah klinis/deskriptif netral seperti
"hikikomori", "social withdrawal", "kecemasan sosial berat" — hindari
label informal yang berpotensi menyinggung target pengguna.)*

---

## 5. Model Bisnis

Vsikolog memakai tiga lapis layanan dengan aturan biaya yang berbeda —
ini keputusan yang sengaja dipisah demi keselamatan pasien:

| Lapisan | Biaya | Kapan dipakai |
|---|---|---|
| AI Companion + Quest CBT | **Gratis, tanpa batas** | Semua pengguna, kapan saja |
| Eskalasi Krisis (Tier High) | **Gratis, tanpa gate biaya** | Otomatis saat AI mendeteksi indikasi risiko tinggi |
| Konsultasi Psikolog Terjadwal (Tier Medium) | **Berbayar per sesi**, atau **gratis** lewat penukaran poin Quest CBT | Pasien yang butuh pendampingan rutin, bukan darurat |

**Aturan yang tidak bisa ditawar:** kasus krisis TIDAK PERNAH dihadapkan
pada tembok biaya. Paywall hanya berlaku untuk pendampingan terjadwal/
reguler yang sifatnya bukan darurat. Melanggar aturan ini berisiko
membuat pasien paling rentan justru mundur di momen paling kritis.

---

## 6. Fitur MVP — Sisi Pasien (Mobile App)

Ini yang WAJIB berfungsi untuk demo/peluncuran awal:

1. **Onboarding + Kuis Screening + Pilih Avatar**
   Kuis screening awal (idealnya memakai item dari instrumen
   tervalidasi seperti GAD-7/PHQ-9, bukan kuis buatan sendiri, demi
   validitas klinis), lalu pasien memilih 1 dari 4 arketipe avatar
   pendamping (Guardian, Healer, Scholar, Companion).

2. **AI Companion (gratis, tanpa batas)**
   Ruang aman untuk bicara kapan saja — disajikan sebagai avatar
   VTuber yang terasa hidup, BUKAN antarmuka chatbot teks biasa.
   Avatar ditampilkan besar di layar, ekspresinya berubah mengikuti
   sentimen balasan (netral/senyum/khawatir, dst), dan balasannya
   **dibacakan lewat suara (Text-to-Speech)** sehingga terasa seperti
   avatar benar-benar bicara, bukan sekadar menampilkan teks. Teks
   tetap ditampilkan sebagai subtitle pendukung bagi yang lebih
   nyaman membaca. AI berpersona sesuai arketipe pilihan, memberi
   validasi emosi dan teknik CBT dasar. Ini sumber data utama untuk
   sistem tier (lihat Bagian 8).
   *(Lip-sync penuh dan animasi ekspresi real-time yang mengikuti
   audio secara halus masuk Fase 2 — lihat Bagian 13. Untuk MVP,
   cukup beberapa pose/ekspresi yang di-swap berdasarkan sentimen.)*

3. **Indikator Tier (otomatis, tidak terlihat pasien sebagai skor
   kasar)**
   Pasien tidak perlu tahu angka tier-nya secara eksplisit — yang
   mereka lihat cukup ajakan natural dari AI Companion seperti "Kamu
   perlu ngobrol sama teman saya, dia lebih paham kondisimu" saat tier
   naik ke Medium/High.

4. **Layar Consent (wajib sebelum data dibagikan ke psikolog)**
   Sebelum ringkasan percakapan dibagikan ke psikolog manapun, pasien
   harus menyetujui secara eksplisit lewat layar consent yang jelas.
   Tanpa persetujuan ini, data tidak dibagikan.

5. **Daftar Konsultasi (marketplace psikolog berbayar)**
   Pasien Tier Medium bisa browsing psikolog terverifikasi: avatar
   anime pilihan psikolog, nama panggilan (bukan nama asli), pendidikan,
   spesialisasi, dan harga per sesi. Pasien memilih sendiri lalu
   booking — bukan ditugaskan otomatis, supaya pasien merasa punya
   kendali (penting untuk kelompok dengan kecemasan sosial).

6. **Eskalasi Krisis Otomatis (Tier High, gratis)**
   Kalau AI mendeteksi indikasi risiko tinggi, pasien langsung
   dihubungkan ke psikolog on-call tanpa proses booking/bayar.

**Fitur pelengkap (boleh versi sederhana atau disebut roadmap kalau
waktu terbatas):**

- **Game-CBT Quest Engine** — misi graded exposure bertingkat, dibagi
  4 kategori: indoor ringan (mis. buka tirai 10 menit, self-report +
  timer), outdoor ringan (jalan kaki pendek, lacak GPS), outdoor
  sedang (lari/jalan ke titik tertentu, lacak GPS ala Strava — rute
  dan jarak tervisualisasi), dan sosial (mengobrol dengan orang lain,
  diverifikasi lewat **laporan diri** pasien sendiri setelah selesai —
  siapa/topik singkat/durasi — plus input perasaan setelah menjalani
  misi, BUKAN rekaman video/foto pihak lain, karena merekam orang lain
  tanpa izin melanggar privasi mereka dan menambah tekanan performa
  yang kontraproduktif untuk pasien dengan kecemasan sosial).
  Poin dari misi yang diselesaikan terkumpul dan bisa ditukar dengan
  **1 sesi konsultasi gratis** setelah mencapai ambang tertentu —
  insentif nyata yang memperkuat mekanisme graduasi di luar dorongan
  dari AI Companion saja.
- Halaman progres/journey pribadi, profil & kontak darurat.

---

## 7. Fitur MVP — Sisi Psikolog (Web Dashboard)

1. **Pendaftaran Psikolog**
   Form pendaftaran: data diri, nomor STR/SIPP, spesialisasi, upload
   dokumen pendukung, lalu set profil publik (avatar anime, nama
   panggilan, pendidikan, harga per sesi).

2. **Verifikasi oleh Admin (manusia, bukan otomatis)**
   Psikolog berstatus "pending" sampai admin memverifikasi keaslian
   dokumen secara manual. Status berubah "verified" baru setelah itu —
   ini wajib demi mencegah orang mengaku-aku psikolog tanpa lisensi
   asli.

3. **Dashboard Ringkasan**
   Jumlah pasien aktif, alert krisis pending, sesi terjadwal.

4. **Daftar & Detail Pasien**
   Untuk pasien yang di-assign atau booking sesi: ringkasan AI (bukan
   transkrip mentah) berisi konteks relevan — bukan cuma skor angka,
   tapi juga konteks yang disebut pasien (pola bicara, isu yang
   disebut berulang) karena psikolog kehilangan observasi non-verbal di
   sesi daring.

5. **Pusat Peringatan Krisis**
   Daftar semua alert Tier High lintas pasien, diurutkan berdasarkan
   waktu, dengan status acknowledge/eskalasi/resolved.

6. **Toggle Status On-Call**
   Menentukan siapa menerima notifikasi krisis saat itu juga.

7. **Jadwal/Booking Sesi**
   Terima dan kelola booking dari pasien Tier Medium.

---

## 8. Sistem Tier & Triase

AI **mengusulkan** tier (low/medium/high) — ini bukan diagnosis, dan
untuk kenaikan ke tier medium/high idealnya tetap ada tinjauan psikolog
sebelum status final berubah.

**Sumber data yang digabung:**
1. **Skor screening awal** (idealnya GAD-7/PHQ-9) — penentu tier awal
2. **Tren sentimen berkelanjutan** dari percakapan harian — kenaikan
   skor cemas beberapa hari berturut-turut bisa menaikkan tier meski
   screening awal rendah
3. **Deteksi kata kunci krisis** — override otomatis ke Tier High
   berapapun skor lainnya, tidak perlu menunggu akumulasi data lain

**Kenapa tidak bisa hanya andalkan skor kuis sekali waktu:** ada risiko
*self-reporting bias* — pasien bisa menjawab tidak jujur karena malu,
atau tidak sadar separah apa kondisinya sendiri. Sinyal berkelanjutan
dari percakapan jadi pelengkap penting, bukan cuma snapshot di awal.

---

## 9. Protokol Krisis

1. AI mendeteksi indikasi risiko dari teks pasien (kata kunci, pola
   bicara).
2. Sistem memicu alert prioritas ke psikolog on-call — gratis, tanpa
   proses booking.
3. Jika tidak ada psikolog merespons dalam waktu tertentu, eskalasi
   otomatis ke kontak darurat yang didaftarkan pasien dan/atau hotline
   krisis nasional.
4. Setiap insiden dicatat untuk audit dan perbaikan sistem deteksi.

*(Detail SLA respons dan mitra hotline krisis perlu difinalisasi
bersama pembimbing/psikolog sebelum implementasi produksi.)*

---

## 10. Privasi & Consent

- Identitas asli pasien dipisahkan dari profil publik; mendukung mode
  anonim.
- Data yang dibagikan ke psikolog adalah **ringkasan AI**, bukan
  transkrip mentah — prinsip minimalisasi data.
- Data sensitif TIDAK PERNAH dibagikan ke psikolog tanpa persetujuan
  eksplisit pasien lewat layar consent (Bagian 6, poin 4).
- Ringkasan yang dikirim ke psikolog harus jelas berstatus "catatan AI
  sebagai referensi awal", bukan fakta pasti — psikolog tetap wajib
  melakukan asesmen sendiri.

---

## 11. Batasan Klinis AI (Out of Scope — Wajib Dipatuhi)

AI Companion secara sadar **tidak pernah** melakukan hal-hal berikut,
karena ini wewenang eksklusif psikolog/psikiater manusia terlatih:

- **Mental Status Examination (MSE)** — menilai penampilan, kontak
  mata, afek, atau gaya bicara secara klinis
- **Tes psikometri formal** — tes IQ (WAIS/WISC), inventori kepribadian
  (MMPI, Big Five formal), tes proyektif
- **Diagnosis banding** — membedakan gejala yang mirip antar kondisi
  berbeda
- **Resep atau perubahan dosis obat psikofarmaka**
- **Klaim diagnosis apapun** terhadap kondisi pasien

AI juga tidak boleh:
- Memfasilitasi konten romantis/fantasi seksual terhadap karakter avatar
- Memperkuat ketergantungan pasien pada AI sebagai pengganti hubungan
  manusia nyata — AI Companion dirancang untuk secara aktif mendorong
  pasien menuju sesi manusia saat relevan, bukan membuat pasien betah
  selamanya hanya dengan AI

---

## 12. Kebutuhan Teknologi AI

Ini kebutuhan fungsional AI yang perlu disiapkan tim AI — bukan
keputusan infrastruktur/framework:

1. **Model percakapan (conversational LLM)** yang bisa diberi system
   prompt untuk memerankan 4 persona berbeda (Guardian, Healer,
   Scholar, Companion) secara konsisten, dengan batasan ketat: tidak
   mendiagnosis, tidak meresepkan, selalu mendorong ke bantuan manusia
   untuk topik berat.

2. **Deteksi indikasi krisis dari teks** — tahap awal bisa berbasis
   kata kunci (daftar frasa terkait self-harm/bunuh diri), dengan
   potensi upgrade ke klasifikasi berbasis model untuk mengurangi
   false negative/positive. Ini komponen paling kritis — butuh
   akurasi tinggi karena konsekuensinya langsung menyangkut
   keselamatan.

3. **Analisis sentimen dari transkrip chat** — mengklasifikasikan
   tingkat stabilitas/kecemasan dari kumpulan pesan pasien dalam
   rentang waktu tertentu, menghasilkan skor yang bisa divisualisasikan
   sebagai tren di dashboard psikolog.

4. **Logika penggabungan skor untuk penentuan tier** — menggabungkan
   skor screening awal, tren sentimen, dan flag kata kunci krisis
   menjadi satu rekomendasi tier (low/medium/high). Ini bisa berupa
   aturan/rule-based di awal (bukan harus model machine learning
   kompleks), asal logikanya transparan dan bisa dijelaskan — penting
   untuk akuntabilitas, karena ini memengaruhi keputusan yang
   menyentuh keselamatan orang.

5. **Peringkasan teks (summarization) untuk psikolog** — mengubah
   riwayat chat jadi ringkasan singkat yang relevan secara klinis
   (konteks, pola yang berulang, nada emosi), bukan cuma angka skor,
   dan bukan transkrip penuh (demi privasi).

6. **Batasan konten bawaan (guardrail) di level prompt/model** — perlu
   dipastikan model yang dipakai tidak menghasilkan output yang
   melanggar Bagian 11 (diagnosis, resep obat, konten romantis/seksual
   terhadap avatar) sekuat apapun pasien memintanya.

7. **Text-to-Speech (TTS)** — mengubah balasan AI Companion jadi suara,
   idealnya dengan karakter suara yang bisa disesuaikan per arketipe
   (empat suara berbeda untuk Guardian/Healer/Scholar/Companion, atau
   minimal satu suara yang konsisten untuk MVP kalau waktu terbatas).
   Ini yang membuat avatar terasa "bicara", bukan cuma menampilkan
   teks — bagian dari pengalaman inti (Level 1+2), bukan pelengkap.

8. **Klasifikasi ekspresi dari balasan AI** — selain skor
   stabil/cemas untuk dashboard psikolog (poin 3), dibutuhkan juga
   sinyal sederhana untuk menentukan ekspresi/pose avatar mana yang
   ditampilkan saat itu, diturunkan dari nada balasan AI Companion
   sendiri — langsung dari metadata yang diminta ke model yang sama
   saat menghasilkan balasan, tidak perlu panggilan/model terpisah.
   **Keputusan MVP: 3 ekspresi per arketipe** — netral, senang,
   khawatir. Artinya butuh 3 pose/gambar × 4 arketipe = 12 asset
   ilustrasi total.

**Yang TIDAK dibutuhkan di MVP** (ini kebutuhan AI untuk Fase 2/roadmap,
bukan sekarang): pengenalan wajah/ekspresi real-time dari kamera
(computer vision) untuk sesi video psikolog, lip-sync otomatis dari
audio, voice modulation real-time, integrasi sensor biometrik (HRV).
Ini di luar scope AI untuk MVP.

---

## 13. Roadmap Fase 2 (Pasca-MVP)

- Sesi video psikolog dengan avatar real-time (face-tracking, voice
  modulation)
- Integrasi sensor smartwatch (HRV) untuk verifikasi keamanan misi
  Quest CBT
- Tinjauan psikolog formal sebelum perubahan tier medium/high
  benar-benar final (bukan langsung otomatis seperti MVP)
- Kepatuhan formal HIPAA/PDP melalui audit resmi
- Perluasan jumlah psikolog partner (model freelance/gig, kemitraan
  fakultas psikologi/UPT BK kampus)
- Payment gateway otomatis (MVP cukup transfer manual/QRIS)

---

## 14. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Kasus krisis terhalang biaya | Aturan tegas: eskalasi krisis selalu gratis (Bagian 5) |
| AI memperkuat ketergantungan/isolasi | AI aktif mendorong ke sesi manusia, bukan membuat betah di AI saja (Bagian 11) |
| Data sensitif dibagikan tanpa izin | Layar consent wajib sebelum data dibagikan ke psikolog (Bagian 10) |
| Psikolog palsu/tidak berlisensi | Verifikasi manual oleh admin, bukan otomatis (Bagian 7) |
| AI overclaim sebagai pengganti psikolog | Batasan eksplisit: tidak MSE, tidak diagnosis banding, tidak tes psikometri formal (Bagian 11) |
| Tier salah karena self-reporting bias | Gabungkan skor awal dengan sinyal berkelanjutan dari percakapan (Bagian 8) |
| Psikolog jadi bottleneck saat user bertambah | Model freelance/gig dan kemitraan kampus di roadmap (Bagian 13) |
| Misi Quest CBT (graded exposure) terlalu memaksa untuk pasien yang belum siap | Tingkat kesulitan misi idealnya disesuaikan dengan tier pasien (low/medium/high), bukan daftar generik sama untuk semua — kalibrasi lebih matang jadi target Fase 2 bersama masukan psikolog |

---

## Adendum (implementasi terkini)

Ditambahkan setelah MVP berjalan — menyesuaikan pembagian kanal:

1. **Website = portal Admin & Psikolog; aplikasi pasien = mobile.**
   Akses portal diperiksa di server (admin lewat allowlist, psikolog lewat
   verifikasi `psychologists`). UI pasien di website dihapus; API server tetap
   dipakai mobile.
2. **Speech-to-Text di Companion (mobile).** Ucapan pasien ditranskripsikan
   untuk *mengisi* kotak pesan; pasien memeriksa/mengedit teks sebelum dikirim
   ke AI. Audio mentah tidak disimpan, dan STT tidak dipakai untuk merekam
   sesi psikolog.
3. **Konsultasi dengan psikolog manusia (mobile).**
   - **Panggilan suara:** pasien melihat **avatar 2D statis** psikolog (gambar
     yang dapat diganti psikolog dari portal); suara & respons sepenuhnya dari
     psikolog asli — bukan AI.
   - **Panggilan video:** menampilkan video psikolog asli; avatar tidak
     ditampilkan selama sesi.
   - AI Companion tidak menghasilkan balasan selama sesi manusia; status sesi
     hanya "tersambung" setelah psikolog benar-benar menerima. Krisis tetap
     gratis tanpa booking.
4. **Verifikasi manual STR/SIPP oleh admin** dan toggle on-call psikolog kini
   berjalan lewat portal web, termasuk acknowledge/escalate/resolve pusat
   peringatan krisis (menggantikan rancangan endpoint `crisis-ack`).

---

*Dokumen ini acuan fitur dan kebutuhan AI untuk tim. Tech stack, skema
database, dan API contract disusun terpisah oleh tim masing-masing.*
