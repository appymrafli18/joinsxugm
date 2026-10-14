import { supabase } from "@/lib/supabaseClient";

export type QuestCategory =
  | "indoor_ringan"
  | "outdoor_ringan"
  | "outdoor_sedang"
  | "sosial";

/** Ambang poin untuk 1 sesi konsultasi gratis (angka dari desain). */
// TODO(BE): samakan dengan aturan penukaran poin (bookings.paid_with = 'points').
export const FREE_SESSION_POINTS = 400;

export type QuestMeta =
  | { kind: "timer"; current: number; target: number }
  | { kind: "gps"; label: string }
  | { kind: "route"; label: string }
  | { kind: "report"; label: string };

export type QuestTemplate = {
  id: string;
  category: QuestCategory;
  categoryLabel: string;
  title: string;
  description: string;
  points: number;
  meta: QuestMeta;
};

// TODO(BE): ganti dengan baris tabel `quests` (status 'active') begitu server membuat misi harian.
export const QUEST_TEMPLATES: QuestTemplate[] = [
  {
    id: "indoor-1",
    category: "indoor_ringan",
    categoryLabel: "Indoor Ringan",
    title: "Mulai dari Kamar",
    description: "Buka tirai kamar 10 menit",
    points: 10,
    meta: { kind: "timer", current: 0, target: 10 },
  },
  {
    id: "outdoor-ringan-1",
    category: "outdoor_ringan",
    categoryLabel: "Outdoor Ringan",
    title: "Langkah Pertama",
    description: "Jalan kaki 500m di sekitar rumah",
    points: 20,
    meta: { kind: "gps", label: "GPS" },
  },
  {
    id: "outdoor-sedang-1",
    category: "outdoor_sedang",
    categoryLabel: "Outdoor Sedang",
    title: "Jelajahi Dunia",
    description: "Lari atau jalan ke taman terdekat — 1.5 km",
    points: 40,
    meta: { kind: "route", label: "Preview Rute" },
  },
  {
    id: "sosial-1",
    category: "sosial",
    categoryLabel: "Sosial",
    title: "Terhubung",
    description: "Ngobrol dengan satu orang, minimal 5 menit",
    points: 60,
    meta: { kind: "report", label: "Laporkan ceritamu setelah selesai" },
  },
];

export type PointsResult =
  | { ok: true; points: number }
  | { ok: false; reason: "no_session" | "failed" };

/** Membaca total poin milik pasien yang sedang login (RLS: hanya baris sendiri). */
export async function getTotalPoints(): Promise<PointsResult> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, reason: "no_session" };

    const { data, error } = await supabase
      .from("patients")
      .select("total_points")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (error || !data) return { ok: false, reason: "failed" };
    return { ok: true, points: Number(data.total_points) || 0 };
  } catch {
    return { ok: false, reason: "failed" };
  }
}