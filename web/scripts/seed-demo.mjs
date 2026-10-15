/**
 * Seed data demo — psikolog contoh untuk marketplace & alur krisis.
 *
 * Jalankan: node scripts/seed-demo.mjs   (dari folder web/)
 * Idempotent: baris yang sudah ada akan di-update, bukan diduplikasi.
 *
 * Konvensi nickname: nama samaran bergaya VTuber/anime (bukan nama realistik) —
 * ini identitas publik yang dilihat pasien; nama asli + gelar disimpan di
 * full_name dan tampil sebagai baris kedua di aplikasi pasien.
 *
 * Akun demo (untuk login psikolog di masa depan):
 *   email    : demo.psikolog1..4@kokoro.test
 *   password : Demo1234!xyz
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* ---- baca web/.env.local tanpa dependensi ---- */
function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^"|"$/g, '');
    }
  } catch {
    console.error('Tidak bisa membaca web/.env.local');
    process.exit(1);
  }
  return env;
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tidak ada di .env.local');
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
};

async function api(path, method = 'GET', body) {
  const res = await fetch(`${URL}${path}`, {
    method,
    headers: HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const PSYCHOLOGISTS = [
  {
    email: 'demo.psikolog1@kokoro.test',
    full_name: 'Aya Rahmawati, M.Psi.',
    license_number: 'STR-DEMO-0001',
    nickname: 'Ayaka',
    education: 'S1 Psikologi UGM · M.Psi. Profesi',
    specialization: 'Kecemasan sosial',
    price_per_session: 150000,
    is_on_call: true,
  },
  {
    email: 'demo.psikolog2@kokoro.test',
    full_name: 'Bima Nugraha, M.Psi.',
    license_number: 'STR-DEMO-0002',
    nickname: 'Kaze',
    education: 'S2 Psikologi Klinis UI',
    specialization: 'Mood & depresi',
    price_per_session: 175000,
    is_on_call: true,
  },
  {
    email: 'demo.psikolog3@kokoro.test',
    full_name: 'Cinta Larasati, M.Psi.',
    license_number: 'STR-DEMO-0003',
    nickname: 'Cia',
    education: 'S1 Psikologi Unpad',
    specialization: 'Hikikomori & isolasi sosial',
    price_per_session: 160000,
    is_on_call: false,
  },
  {
    email: 'demo.psikolog4@kokoro.test',
    full_name: 'Damar Prasetyo, M.Psi.',
    license_number: 'STR-DEMO-0004',
    nickname: 'Yoru',
    education: 'S2 Profesi Psikologi UNAIR',
    specialization: 'Trauma & stres',
    price_per_session: 200000,
    is_on_call: false,
  },
];

async function findUserByEmail(email) {
  // Halaman demi halaman sampai ketemu (proyek demo: cukup 3 halaman pertama).
  for (let page = 1; page <= 3; page += 1) {
    const { data } = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = data?.users ?? [];
    const found = users.find((u) => u.email === email);
    if (found) return found.id;
    if (users.length < 200) return null;
  }
  return null;
}

async function ensureUser(email) {
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  const { status, data } = await api('/auth/v1/admin/users', 'POST', {
    email,
    password: 'Demo1234!xyz',
    email_confirm: true,
  });
  if (status >= 300 || !data?.id) {
    throw new Error(`gagal membuat user ${email}: ${status} ${JSON.stringify(data)?.slice(0, 160)}`);
  }
  return data.id;
}

let created = 0;
let updated = 0;
for (const psy of PSYCHOLOGISTS) {
  const id = await ensureUser(psy.email);
  const row = {
    id,
    full_name: psy.full_name,
    license_number: psy.license_number,
    verification_status: 'verified',
    nickname: psy.nickname,
    education: psy.education,
    specialization: psy.specialization,
    price_per_session: psy.price_per_session,
    is_on_call: psy.is_on_call,
  };
  const { data: existing } = await api(`/rest/v1/psychologists?id=eq.${id}&select=id`);
  if (Array.isArray(existing) && existing.length > 0) {
    await api(`/rest/v1/psychologists?id=eq.${id}`, 'PATCH', row);
    updated += 1;
    console.log(`↻ update  ${psy.nickname} (${psy.specialization})`);
  } else {
    await api('/rest/v1/psychologists', 'POST', row);
    created += 1;
    console.log(`✓ buat    ${psy.nickname} (${psy.specialization})`);
  }
}

/* Akun admin demo — akses portal lewat allowlist ADMIN_EMAILS di web/.env.local. */
const ADMIN = { email: 'demo.admin@kokoro.test' };
await ensureUser(ADMIN.email);
console.log(`✓ akun    ${ADMIN.email} (admin portal — sudah ada di ADMIN_EMAILS)`);

console.log(`\nSelesai: ${created} baru, ${updated} diperbarui.`);
console.log('Login demo psikolog: demo.psikolog1..4@kokoro.test / Demo1234!xyz');
console.log('Login demo admin  : demo.admin@kokoro.test / Demo1234!xyz');
console.log('On-call: Ayaka & Kaze (dipakai untuk alur krisis).');
