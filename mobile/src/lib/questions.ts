/**
 * Kuis screening awal — item GAD-7 (Generalized Anxiety Disorder-7).
 *
 * GAD-7 adalah instrumen skrining publik yang lazim dipakai; 7 item, skor
 * 0–3 per item (total 0–21). Ambang: 5 ringan, 10 sedang, 15 berat.
 * PRD Bagian 6 meminta item dari instrumen tervalidasi, bukan kuis buatan
 * sendiri — wording Indonesia di bawah adalah terjemahan fungsional dan
 * tetap perlu ditinjau tenaga profesional sebelum produksi.
 */

export type ArchetypeKey = 'guardian' | 'healer' | 'scholar' | 'companion';

export type OnboardingQuestion = {
  text: string;
  archetype: ArchetypeKey;
  characterName: string;
};

/** Rentang waktu standar instrumen: 2 minggu terakhir. */
export const SCREENING_TIMEFRAME_LABEL = 'Dalam 2 minggu terakhir, seberapa sering kamu:';

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  { text: 'Merasa gugup, cemas, atau tegang.', archetype: 'guardian', characterName: 'The Guardian' },
  { text: 'Tidak mampu menghentikan atau mengendalikan rasa khawatir.', archetype: 'healer', characterName: 'The Healer' },
  { text: 'Terlalu mengkhawatirkan berbagai hal.', archetype: 'scholar', characterName: 'The Scholar' },
  { text: 'Sulit untuk santai atau rileks.', archetype: 'companion', characterName: 'The Companion' },
  { text: 'Sangat gelisah sampai sulit duduk tenang.', archetype: 'guardian', characterName: 'The Guardian' },
  { text: 'Menjadi mudah marah atau mudah tersinggung.', archetype: 'healer', characterName: 'The Healer' },
  { text: 'Merasa takut seolah-olah sesuatu yang buruk akan terjadi.', archetype: 'scholar', characterName: 'The Scholar' },
];

/** Opsi jawaban standar GAD-7 (skor 0–3). */
export const ANSWER_OPTIONS = [
  { label: 'Tidak Pernah', value: 0 },
  { label: 'Beberapa Hari', value: 1 },
  { label: 'Lebih dari Separuh Hari', value: 2 },
  { label: 'Hampir Setiap Hari', value: 3 },
];
