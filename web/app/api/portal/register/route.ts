import { requireUser } from '@/lib/serverAuth';
import { createServiceClient } from '@/lib/serverAuth';
import { uploadLicenseDocument } from '@/lib/licenseStorage';

/**
 * POST /api/portal/register — pendaftaran psikolog (PRD Bagian 7 poin 1).
 *
 * Alur: calon psikolog sign-up Supabase (email+password) di halaman
 * /portal/register → panggil endpoint ini dengan Bearer token + data diri
 * (multipart: full_name, license_number, specialization, education, file?).
 * Server membuat baris `psychologists` berstatus `pending` — verifikasi tetap
 * manual oleh admin sebelum profil aktif.
 *
 * Dokumen STR/SIPP diunggah ke bucket privat (license-docs); yang disimpan
 * di DB hanya path-nya, admin melihat lewat signed URL.
 */

const MAX_FIELD = 200;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const user = auth.user;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Body form tidak valid.' }, 400);
  }

  const fullName = String(form.get('full_name') ?? '').trim().slice(0, MAX_FIELD);
  const licenseNumber = String(form.get('license_number') ?? '').trim().slice(0, 100);
  const specialization = String(form.get('specialization') ?? '').trim().slice(0, MAX_FIELD);
  const education = String(form.get('education') ?? '').trim().slice(0, MAX_FIELD);
  if (!fullName || !licenseNumber) {
    return json({ error: 'Nama lengkap dan nomor STR/SIPP wajib diisi.' }, 400);
  }

  const service = createServiceClient();
  if (!service) return json({ error: 'Konfigurasi server belum lengkap.' }, 500);

  /* Cegah duplikasi / salah kanal. */
  const [{ data: existingPsychologist }, { data: existingPatient }] = await Promise.all([
    service.from('psychologists').select('id, verification_status').eq('id', user.id).maybeSingle(),
    service.from('patients').select('id').eq('id', user.id).maybeSingle(),
  ]);
  if (existingPsychologist) {
    return json(
      { error: 'Akun ini sudah terdaftar sebagai psikolog.', verification_status: existingPsychologist.verification_status },
      409,
    );
  }
  if (existingPatient) {
    return json({ error: 'Akun ini adalah akun pasien — gunakan email lain untuk mendaftar sebagai psikolog.' }, 403);
  }

  /* Unggah dokumen (opsional untuk MVP; admin dapat menolak bila tidak ada). */
  let documentPath: string | null = null;
  const file = form.get('file');
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadLicenseDocument(service, user.id, file);
    if (!uploaded.ok) return json({ error: uploaded.message }, 400);
    documentPath = uploaded.path;
  }

  const { data: created, error: insertError } = await service
    .from('psychologists')
    .insert({
      id: user.id,
      full_name: fullName,
      license_number: licenseNumber,
      verification_status: 'pending',
      specialization: specialization || null,
      education: education || null,
      license_document_url: documentPath,
      is_on_call: false,
    })
    .select('id, verification_status')
    .single();
  if (insertError || !created) {
    console.error('[portal/register] gagal insert psychologists:', insertError);
    return json({ error: 'Gagal menyimpan pendaftaran. Coba lagi.' }, 500);
  }

  return json({ ok: true, verification_status: created.verification_status }, 201);
}
