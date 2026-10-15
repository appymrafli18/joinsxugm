/**
 * Deteksi indikasi krisis berbasis kata kunci (MVP — PRD Bagian 12 poin 2).
 * Tahap awal rule-based; upgrade ke klasifikasi model menyusul.
 *
 * DIPAKAI SERVER-SIDE SAJA (route /api/companion) — jangan di-import dari client.
 */
const CRISIS_KEYWORDS = [
  // Bahasa Indonesia
  'bunuh diri',
  'mengakhiri hidup',
  'akhiri hidup',
  'ingin mati',
  'ingin meninggal',
  'ingat mati',
  'tidak ingin hidup',
  'tidak mau hidup',
  'lebih baik mati',
  'mati saja',
  'melukai diri',
  'menyakiti diri',
  'menyakiti diriku',
  'melukai diriku',
  'potong diri',
  'luka sendiri',
  'self harm',
  'self-harm',
  'selfharm',
  'gantung diri',
  'loncat dari gedung',
  'overdosis',
  'minum obat banyak',
  'tidak ada gunanya hidup',
  'tidak berguna hidup',
  'beban orang tua',
  'lebih baik tidak lahir',
  'akhiri semuanya',
  // Bahasa Inggris
  'suicide',
  'kill myself',
  'end my life',
  'want to die',
  'want to kill',
  'self injury',
  'cut myself',
];

/** true kalau teks mengandung indikasi risiko tinggi. */
export function detectCrisis(text: string): boolean {
  const normalized = text.toLowerCase();
  return CRISIS_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
