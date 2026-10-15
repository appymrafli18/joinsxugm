import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Penyimpanan dokumen lisensi (STR/SIPP) — bucket PRIVAT.
 * Hanya server (service role) yang mengunggah; admin melihat lewat signed URL
 * berumur pendek, bukan tautan publik.
 */
export const LICENSE_BUCKET = 'license-docs';
const SIGNED_URL_TTL_SECONDS = 3600;

const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];
export const MAX_LICENSE_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export function isStoragePath(value: string | null | undefined): value is string {
  return Boolean(value) && !value!.startsWith('http');
}

export async function ensureLicenseBucket(service: SupabaseClient): Promise<void> {
  const { error } = await service.storage.createBucket(LICENSE_BUCKET, { public: false });
  // "already exists" bukan masalah; error lain dicatat pemanggil via upload.
  if (error && !/already exists/i.test(error.message)) {
    console.warn('[licenseStorage] createBucket:', error.message);
  }
}

export async function uploadLicenseDocument(
  service: SupabaseClient,
  userId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  if (file.size > MAX_LICENSE_FILE_BYTES) {
    return { ok: false, message: 'Ukuran dokumen maksimal 5 MB.' };
  }
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    return { ok: false, message: 'Format dokumen harus PDF atau gambar (PNG/JPG/WebP).' };
  }
  await ensureLicenseBucket(service);
  const safeName = (file.name || 'dokumen').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const path = `${userId}/${Date.now()}-${safeName}`;
  const buffer = await file.arrayBuffer();
  const { error } = await service.storage
    .from(LICENSE_BUCKET)
    .upload(path, buffer, { contentType: file.type || 'application/octet-stream', upsert: true });
  if (error) {
    console.error('[licenseStorage] upload:', error.message);
    return { ok: false, message: 'Gagal mengunggah dokumen.' };
  }
  return { ok: true, path };
}

export async function signLicensePath(
  service: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await service.storage
    .from(LICENSE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}
