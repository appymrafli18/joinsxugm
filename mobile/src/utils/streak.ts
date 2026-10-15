/** Hitung hari berturut-turut yang punya pesan pasien (dipakai Beranda & Perjalanan). */
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function computeStreak(createdAts: string[]): number {
  const activeDays = new Set(createdAts.map((c) => dayKey(new Date(c))));
  const cursor = new Date();
  // Hari ini belum ada aktivitas: mulai hitung dari kemarin.
  if (!activeDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
