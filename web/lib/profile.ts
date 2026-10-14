import { supabase } from "@/lib/supabaseClient";

export type ArchetypeId = "guardian" | "healer" | "scholar" | "companion";

export const SCREENING_STORAGE_KEY = "vsikolog:screening-answers";

export type RouteResult =
  | { ok: true; route: string }
  | { ok: false; reason: "not_patient" | "failed" };

/** Array jawaban dari onboarding menjadi format tabel: {"q1":2,...} + total. */
function toScreeningPayload(values: number[]) {
  const answers: Record<string, number> = {};
  values.forEach((value, index) => {
    answers[`q${index + 1}`] = value;
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  return { answers, total };
}

/**
 * Menyimpan jawaban kuis dari sessionStorage ke screening_scores.
 * Mengembalikan true jika berhasil atau tidak ada yang perlu disimpan.
 * Kalau gagal, data tetap di storage supaya bisa dicoba lagi.
 */
export async function saveScreeningFromStorage(): Promise<boolean> {
  try {
    const raw = sessionStorage.getItem(SCREENING_STORAGE_KEY);
    if (!raw) return true;

    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every((value) => typeof value === "number" && Number.isFinite(value))
    ) {
      sessionStorage.removeItem(SCREENING_STORAGE_KEY);
      return false;
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;

    const { answers, total } = toScreeningPayload(parsed);
    const { error } = await supabase
      .from("screening_scores")
      .insert({ patient_id: data.user.id, answers, total });
    if (error) return false;

    sessionStorage.removeItem(SCREENING_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Dipakai halaman pilih arketipe. */
export async function saveArchetype(archetype: ArchetypeId): Promise<boolean> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;

    const { data, error } = await supabase
      .from("patients")
      .update({ archetype_id: archetype })
      .eq("id", userData.user.id)
      .select("id");

    return !error && (data?.length ?? 0) === 1;
  } catch {
    return false;
  }
}

/** Setelah login: tentukan halaman tujuan berdasarkan data pasien. */
export async function resolvePatientRoute(): Promise<RouteResult> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, reason: "failed" };

    const { data: patient, error } = await supabase
      .from("patients")
      .select("archetype_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (error) return { ok: false, reason: "failed" };
    if (!patient) return { ok: false, reason: "not_patient" };

    return { ok: true, route: patient.archetype_id ? "/beranda" : "/pilih-arketipe" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Dipakai splash: sudah login ke beranda/pilih arketipe, belum ke onboarding. */
export async function resolveStartRoute(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return "/onboarding";
    const result = await resolvePatientRoute();
    return result.ok ? result.route : "/onboarding";
  } catch {
    return "/onboarding";
  }
}