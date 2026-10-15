/**
 * Mesin tier & triase (PRD Bagian 8) — rule-based MVP yang transparan.
 *
 * Menggabungkan:
 * 1. Skor screening awal (GAD-7, 0–21) — penentu tier awal
 * 2. Tren sentimen berkelanjutan (sentiment_logs) — cemas naik beberapa hari
 *    berturut dapat menaikkan tier meski screening awal rendah
 * 3. Deteksi krisis — override otomatis ke Tier High, tidak menunggu data lain
 *
 * Rule-based sengaja dibuat eksplisit agar bisa diaudit (PRD: transparansi
 * penting karena ini menyentuh keselamatan).
 */

export type Tier = 'low' | 'medium' | 'high';

/** Ambang GAD-7 standar: 5 (ringan), 15 (berat). */
export const GAD7_CUTOFFS = { mild: 5, moderate: 15 } as const;

/** Sinyal berkelanjutan dari percakapan. */
const SIGNAL_WINDOW_DAYS = 7;
const FLAGGED_COUNT_FOR_HIGH = 3;
/** Tren sentimen: cemas naik 3 hari berturut dan level terakhir >= ambang ini. */
export const CEMAS_RISING_THRESHOLD = 65;

export type TierInput = {
  /** Total skor terbaru (0–21 untuk GAD-7). null = belum ada screening. */
  screeningTotal: number | null;
  /** Jumlah pesan pasien ter-flag krisis dalam SIGNAL_WINDOW_DAYS hari. */
  recentFlaggedCount: number;
  /** Ada crisis_alerts aktif (pending/acknowledged/escalated). */
  hasActiveCrisis: boolean;
  /** Cemas meningkat pada 3 hari terakhir (dari sentiment_logs). */
  sentimentRising?: boolean;
  /** Skor cemas terbaru (0–100). */
  latestCemasScore?: number | null;
};

export function computeTier(input: TierInput): Tier {
  /* Override krisis — apa pun skor lainnya (PRD: tanpa tunggu akumulasi). */
  if (input.hasActiveCrisis || input.recentFlaggedCount >= FLAGGED_COUNT_FOR_HIGH) {
    return 'high';
  }

  /* Basis dari skor screening awal. */
  let tier: Tier;
  const total = input.screeningTotal;
  if (total === null) tier = 'low';
  else if (total >= GAD7_CUTOFFS.moderate) tier = 'high';
  else if (total >= GAD7_CUTOFFS.mild) tier = 'medium';
  else tier = 'low';

  /* Tren sentimen: cemas naik beberapa hari berturut → minimal medium. */
  if (
    tier === 'low' &&
    input.sentimentRising &&
    (input.latestCemasScore ?? 0) >= CEMAS_RISING_THRESHOLD
  ) {
    return 'medium';
  }
  return tier;
}

/** Jendela hari yang dipakai untuk menghitung recentFlaggedCount. */
export function signalWindowStartIso(now = new Date()): string {
  const start = new Date(now);
  start.setDate(start.getDate() - SIGNAL_WINDOW_DAYS);
  return start.toISOString();
}
