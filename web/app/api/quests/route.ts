import { createServiceClient, requireUser } from '@/lib/serverAuth';

/**
 * POST /api/quests — satu-satunya jalur tulis tabel quests + poin pasien.
 *
 * DB memberi klien HAK BACA saja untuk quests & patients.total_points
 * (anti-cheat: pasien tidak bisa menambah poin sendiri), sehingga semua
 * transaksi misi diproses di server dengan service role.
 *
 * Actions:
 * - { action:'start', template }      → buat/lanjutkan quest aktif, return baris
 * - { action:'progress', questId, value } → update progress_value (timer tick)
 * - { action:'complete', questId, socialReport?, feelingInput? }
 *      → tandai selesai + tambah poin ke patients.total_points
 */

type StartTemplate = {
  category?: unknown;
  title?: unknown;
  points?: unknown;
  templateId?: unknown;
  kind?: unknown;
  target?: unknown;
};

const CATEGORIES = ['indoor_ringan', 'outdoor_ringan', 'outdoor_sedang', 'sosial'];

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

async function findQuestForUser(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  questId: string,
  userId: string,
) {
  const { data, error } = await service
    .from('quests')
    .select('*')
    .eq('id', questId)
    .maybeSingle();
  if (error) return { error: 'Gagal memuat misi.' as const };
  if (!data || data.patient_id !== userId) return { error: 'Misi tidak ditemukan.', status: 404 as const };
  return { quest: data };
}

/**
 * Update penyelesaian quest, dengan fallback untuk CHECK constraint
 * `quests_feeling_input_check` yang di DB cloud hanya menerima 'biasa'
 * (sisa placeholder — tidak terdokumentasi di docs/schema.sql).
 * Kalau feeling_input ditolak (23514), perasaan dipindahkan ke social_report
 * agar datanya tetap tercatat dan alur demo tidak macet.
 */
async function runCompleteUpdate(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  questId: string,
  patch: Record<string, unknown>,
) {
  let result = await service.from('quests').update(patch).eq('id', questId);
  if (result.error?.code === '23514' && typeof patch.feeling_input === 'string') {
    const { feeling_input, ...safePatch } = patch;
    safePatch.social_report = safePatch.social_report
      ? `${safePatch.social_report} — perasaan: ${feeling_input}`
      : `perasaan: ${feeling_input}`;
    console.warn(
      `[quests] quests_feeling_input_check menolak "${feeling_input}" — fallback simpan ke social_report. ` +
        'Jalankan SQL di docs/schema.sql (catatan) untuk memperlebar enum.',
    );
    result = await service.from('quests').update(safePatch).eq('id', questId);
  }
  return result;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Body tidak valid.' }, 400);
  }

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  /* ---------- start ---------- */
  if (body.action === 'start') {
    const t = (body.template ?? {}) as StartTemplate;
    const category = typeof t.category === 'string' ? t.category : '';
    const title = typeof t.title === 'string' ? t.title.trim() : '';
    const points = Number(t.points);
    const kind = t.kind === 'timer' || t.kind === 'report' || t.kind === 'gps' ? t.kind : null;
    const target = Number(t.target);
    if (!CATEGORIES.includes(category) || !title || !Number.isFinite(points) || !kind) {
      return json({ error: 'Template misi tidak valid.' }, 400);
    }

    // Lanjutkan quest aktif dengan kategori+judul sama (resume), kalau ada.
    const { data: existing, error: findError } = await service
      .from('quests')
      .select('*')
      .eq('patient_id', user.id)
      .eq('category', category)
      .eq('title', title)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) return json({ error: 'Gagal memuat misi.' }, 500);
    if (existing) return json({ quest: existing });

    const safeTarget = Number.isFinite(target) && target > 0 ? Math.round(target) : kind === 'timer' ? 10 : kind === 'gps' ? 500 : 1;
    const { data: created, error: insertError } = await service
      .from('quests')
      .insert({
        patient_id: user.id,
        category,
        level: 1,
        title,
        status: 'active',
        points: Math.round(points),
        route_data: {
          templateId: typeof t.templateId === 'string' ? t.templateId : null,
          startedAt: new Date().toISOString(),
        },
        progress_value: 0,
        target_value: safeTarget,
        unit: kind === 'timer' ? 'menit' : kind === 'gps' ? 'meter' : 'laporan',
      })
      .select('*')
      .single();
    if (insertError || !created) {
      console.error('[quests] gagal start:', insertError);
      return json({ error: 'Gagal memulai misi.' }, 500);
    }
    return json({ quest: created }, 201);
  }

  /* ---------- progress ---------- */
  if (body.action === 'progress') {
    const questId = typeof body.questId === 'string' ? body.questId : '';
    const value = Number(body.value);
    if (!questId || !Number.isFinite(value) || value < 0) {
      return json({ error: 'Parameter tidak valid.' }, 400);
    }
    const found = await findQuestForUser(service, questId, user.id);
    if (found.error) return json({ error: found.error }, found.status ?? 500);
    const { error } = await service
      .from('quests')
      .update({ progress_value: Math.round(value) })
      .eq('id', questId);
    if (error) return json({ error: 'Gagal menyimpan progres.' }, 500);
    return json({ ok: true });
  }

  /* ---------- complete ---------- */
  if (body.action === 'complete') {
    const questId = typeof body.questId === 'string' ? body.questId : '';
    if (!questId) return json({ error: 'Parameter tidak valid.' }, 400);
    const found = await findQuestForUser(service, questId, user.id);
    if (found.error) return json({ error: found.error }, found.status ?? 500);
    const quest = found.quest!;

    if (quest.status === 'completed') {
      // Idempotent: sudah pernah diselesaikan — jangan beri poin dua kali.
      const { data: patient } = await service
        .from('patients').select('total_points').eq('id', user.id).maybeSingle();
      return json({ quest, totalPoints: patient?.total_points ?? 0, alreadyCompleted: true });
    }

    /* Validasi anti-curang sebelum poin diberikan (kecuali development untuk demo). */
    const isProduction = process.env.NODE_ENV === 'production';
    if (quest.unit === 'menit') {
      const startedAtRaw = (quest.route_data as { startedAt?: string } | null)?.startedAt;
      const startedAt = startedAtRaw ? Date.parse(startedAtRaw) : NaN;
      const targetSeconds = (quest.target_value ?? 0) * 60;
      const elapsedSeconds = Number.isFinite(startedAt) ? (Date.now() - startedAt) / 1000 : 0;
      if (elapsedSeconds < targetSeconds) {
        if (isProduction) {
          return json(
            { error: 'Waktu misi belum selesai. Tunggu sampai hitungan habis dulu ya.', code: 'timer_not_done' },
            400,
          );
        }
        console.warn(
          `[quests] timer belum selesai (${Math.round(elapsedSeconds)}/${targetSeconds}s) — diizinkan karena dev mode.`,
        );
      }
    }
    if (quest.category === 'sosial') {
      const report = typeof body.socialReport === 'string' ? body.socialReport.trim() : '';
      if (report.length < 10) {
        return json(
          { error: 'Laporan misi wajib diisi (siapa/topik/durasi) sebelum poin diberikan.', code: 'report_required' },
          400,
        );
      }
    }
    if (quest.unit === 'meter') {
      const distance = Number(body.distanceMeters);
      const target = quest.target_value ?? 0;
      if (!Number.isFinite(distance) || distance <= 0) {
        return json(
          { error: 'Data jarak tidak valid. Buka misi lewat aplikasi ya.', code: 'distance_required' },
          400,
        );
      }
      if (distance < target) {
        if (isProduction) {
          return json(
            { error: `Jarak belum mencapai target (${target} m). Lanjut jalan dulu ya.`, code: 'distance_not_reached' },
            400,
          );
        }
        console.warn(`[quests] jarak ${Math.round(distance)}m < target ${target}m — diizinkan karena dev mode.`);
      }
    }

    const patch: Record<string, unknown> = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress_value: quest.target_value ?? 1,
    };
    if (quest.unit === 'meter' && Number.isFinite(Number(body.distanceMeters))) {
      patch.route_data = {
        ...((quest.route_data as Record<string, unknown> | null) ?? {}),
        distanceMeters: Math.round(Number(body.distanceMeters)),
      };
    }
    if (typeof body.socialReport === 'string' && body.socialReport.trim()) {
      patch.social_report = body.socialReport.trim().slice(0, 500);
    }
    if (typeof body.feelingInput === 'string' && body.feelingInput.trim()) {
      patch.feeling_input = body.feelingInput.trim().slice(0, 100);
    }
    const { error: completeError } = await runCompleteUpdate(service, questId, patch);
    if (completeError) {
      console.error('[quests] gagal complete:', completeError);
      return json({ error: 'Gagal menyelesaikan misi.' }, 500);
    }

    /* Tambah poin — transaksi sisi server (klien tidak punya hak update). */
    const { data: patient, error: patientError } = await service
      .from('patients').select('total_points').eq('id', user.id).maybeSingle();
    if (patientError || !patient) return json({ error: 'Gagal memuat poin.' }, 500);
    const totalPoints = (patient.total_points ?? 0) + (quest.points ?? 0);
    const { error: pointsError } = await service
      .from('patients').update({ total_points: totalPoints }).eq('id', user.id);
    if (pointsError) {
      console.error('[quests] gagal tambah poin:', pointsError);
      return json({ error: 'Gagal menambah poin.' }, 500);
    }
    return json({ quest: { ...quest, ...patch }, totalPoints });
  }

  return json({ error: 'Action tidak dikenal.' }, 400);
}
