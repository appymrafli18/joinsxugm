import { supabase } from './supabase';
import { postJson } from './api';

export type QuestCategory = 'indoor_ringan' | 'outdoor_ringan' | 'outdoor_sedang' | 'sosial';
export const FREE_SESSION_POINTS = 400;
export type QuestMeta =
  | { kind: 'timer'; current: number; target: number }
  | { kind: 'gps'; label: string; targetMeters: number }
  | { kind: 'route'; label: string }
  | { kind: 'report'; label: string };
export type QuestTemplate = { id: string; category: QuestCategory; categoryLabel: string; title: string; description: string; points: number; meta: QuestMeta };
export const QUEST_TEMPLATES: QuestTemplate[] = [
  { id: 'indoor-1', category: 'indoor_ringan', categoryLabel: 'Indoor Ringan', title: 'Mulai dari Kamar', description: 'Buka tirai kamar 10 menit', points: 10, meta: { kind: 'timer', current: 0, target: 10 } },
  { id: 'outdoor-ringan-1', category: 'outdoor_ringan', categoryLabel: 'Outdoor Ringan', title: 'Langkah Pertama', description: 'Jalan kaki 500m di sekitar rumah', points: 20, meta: { kind: 'gps', label: 'GPS', targetMeters: 500 } },
  { id: 'outdoor-sedang-1', category: 'outdoor_sedang', categoryLabel: 'Outdoor Sedang', title: 'Jelajahi Dunia', description: 'Lari atau jalan ke taman terdekat — 1.5 km', points: 40, meta: { kind: 'route', label: 'Preview Rute' } },
  { id: 'sosial-1', category: 'sosial', categoryLabel: 'Sosial', title: 'Terhubung', description: 'Ngobrol dengan satu orang, minimal 5 menit', points: 60, meta: { kind: 'report', label: 'Laporkan ceritamu setelah selesai' } },
];
export type PointsResult = { ok: true; points: number } | { ok: false; reason: 'no_session' | 'failed' };
export async function getTotalPoints(): Promise<PointsResult> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, reason: 'no_session' };
    const { data, error } = await supabase.from('patients').select('total_points').eq('id', userData.user.id).maybeSingle();
    if (error || !data) return { ok: false, reason: 'failed' };
    return { ok: true, points: Number(data.total_points) || 0 };
  } catch { return { ok: false, reason: 'failed' }; }
}

/* ---------- Operasi tulis (semua lewat server — DB read-only untuk klien) ---------- */

export type QuestRow = {
  id: string;
  patient_id: string;
  category: QuestCategory;
  level: number | null;
  title: string;
  status: string;
  points: number;
  route_data: { templateId?: string | null; startedAt?: string | null; distanceMeters?: number } | null;
  social_report: string | null;
  feeling_input: string | null;
  completed_at: string | null;
  created_at: string;
  progress_value: number | null;
  target_value: number | null;
  unit: string | null;
};

export type QuestOpResult<T> = { ok: true; data: T } | { ok: false; message: string };

/** Muat 1 quest milik pasien (SELECT own diizinkan RLS). */
export async function getQuest(questId: string): Promise<QuestRow | null> {
  try {
    const { data } = await supabase.from('quests').select('*').eq('id', questId).maybeSingle();
    return (data as QuestRow | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Mulai/lanjutkan quest dari template — server membuat baris aktif
 * (resume bila sudah ada yang sama kategori+judul).
 */
export async function startQuest(template: QuestTemplate): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const kind =
    template.meta.kind === 'timer' ? 'timer'
    : template.meta.kind === 'report' ? 'report'
    : template.meta.kind === 'gps' ? 'gps'
    : null;
  if (!kind) return { ok: false, message: 'Preview rute segera hadir.' };
  const target =
    template.meta.kind === 'timer' ? template.meta.target
    : template.meta.kind === 'gps' ? template.meta.targetMeters
    : 1;
  const result = await postJson<{ quest: { id: string } }>('/api/quests', {
    action: 'start',
    template: {
      category: template.category,
      title: template.title,
      points: template.points,
      templateId: template.id,
      kind,
      target,
    },
  });
  return result.ok ? { ok: true, id: result.data.quest.id } : { ok: false, message: result.message };
}

/** Simpan progres timer (menit) — ringan, dipanggil berkala. */
export async function updateQuestProgress(questId: string, value: number): Promise<void> {
  await postJson('/api/quests', { action: 'progress', questId, value });
}

/** Tandai quest selesai + terima poin (idempotent di server). */
export async function completeQuest(
  questId: string,
  patch?: { socialReport?: string; feelingInput?: string; distanceMeters?: number },
): Promise<QuestOpResult<{ pointsAwarded: number; totalPoints: number }>> {
  const result = await postJson<{ totalPoints: number; alreadyCompleted?: boolean; quest: { points: number } }>(
    '/api/quests',
    {
      action: 'complete',
      questId,
      socialReport: patch?.socialReport,
      feelingInput: patch?.feelingInput,
      distanceMeters: patch?.distanceMeters,
    },
  );
  if (!result.ok) return { ok: false, message: result.message };
  return {
    ok: true,
    data: {
      pointsAwarded: result.data.alreadyCompleted ? 0 : (result.data.quest?.points ?? 0),
      totalPoints: result.data.totalPoints,
    },
  };
}
