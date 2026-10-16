/**
 * e2e-crisis.mjs — uji alur eskalasi krisis end-to-end (Fase notifikasi).
 *
 * Jalankan (dari folder web/, server dev harus hidup):
 *   npm run dev            # terminal lain
 *   node scripts/e2e-crisis.mjs
 *
 * Yang diuji:
 *   1) Pesan krisis → /api/companion: flagged, alert `pending`, psikolog dipilih.
 *   2) Alert yang lewat SLA di-eskalasi. Bila CRON_SECRET diisi → lewat
 *      /api/cron/sweep (jalur utama). Bila kosong → lewat fallback di
 *      /api/companion. (Pesan pasien di-backdate tanpa menunggu 15 menit.)
 *
 * Idempotent: data uji (chat_logs + crisis_alerts) pasien demo dibersihkan
 * di awal. Akun & baris pasien demo dibuat bila belum ada.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
const DB = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
/* Env dari CLI menang atas .env.local — supaya bisa menunjuk server lain
   (mis. PORTAL_URL=http://localhost:3001 node scripts/e2e-crisis.mjs). */
const API = (process.env.PORTAL_URL || env.PORTAL_URL || 'http://localhost:3000').replace(/\/+$/, '');
const CRON_SECRET = process.env.CRON_SECRET ?? env.CRON_SECRET ?? '';
if (!DB || !SERVICE || !ANON) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY tidak lengkap di .env.local');
  process.exit(1);
}

const ADMIN_HEADERS = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
};

const PATIENT = { email: 'demo.pasien@vsikolog.test', password: 'Demo1234!xyz', nickname: 'Pasien Uji' };
const CRISIS_MESSAGE = 'aku sudah tidak kuat, rasanya ingin mati saja';

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

async function rest(path, method = 'GET', body) {
  const res = await fetch(`${DB}${path}`, {
    method,
    headers: ADMIN_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

async function findUserId(email) {
  for (let page = 1; page <= 3; page += 1) {
    const { data } = await rest(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = data?.users ?? [];
    const found = users.find((u) => u.email === email);
    if (found) return found.id;
    if (users.length < 200) return null;
  }
  return null;
}

async function ensurePatient() {
  let id = await findUserId(PATIENT.email);
  if (!id) {
    const { status, data } = await rest('/auth/v1/admin/users', 'POST', {
      email: PATIENT.email,
      password: PATIENT.password,
      email_confirm: true,
    });
    if (status >= 300 || !data?.id) throw new Error(`gagal buat user pasien: ${status} ${JSON.stringify(data)?.slice(0, 160)}`);
    id = data.id;
  }
  const { data: existing } = await rest(`/rest/v1/patients?id=eq.${id}&select=id`);
  const row = { id, nickname: PATIENT.nickname, archetype_id: 'guardian', tier: 'low' };
  if (Array.isArray(existing) && existing.length > 0) {
    await rest(`/rest/v1/patients?id=eq.${id}`, 'PATCH', { nickname: PATIENT.nickname });
  } else {
    await rest('/rest/v1/patients', 'POST', row);
  }
  return id;
}

async function signInPatient() {
  const res = await fetch(`${DB}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: PATIENT.email, password: PATIENT.password }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new Error(`gagal login pasien: ${res.status} ${JSON.stringify(data)?.slice(0, 160)}`);
  }
  return data.access_token;
}

async function companion(token, message) {
  try {
    const res = await fetch(`${API}/api/companion`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ archetypeId: 'guardian', message }),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch (error) {
    console.error(`\nTidak bisa menghubungi ${API}. Pastikan server dev hidup (npm run dev).\n`, error.message);
    process.exit(2);
  }
}

async function latestAlert(patientId) {
  const { data } = await rest(
    `/rest/v1/crisis_alerts?patient_id=eq.${patientId}&order=created_at.desc&limit=1&select=id,status,created_at,patient_nickname`,
  );
  return Array.isArray(data) ? data[0] ?? null : null;
}

async function main() {
  console.log(`E2E krisis → ${API}\n`);

  const patientId = await ensurePatient();

  /* Bersihkan data uji lama (FK: alerts dulu, baru chat_logs). */
  await rest(`/rest/v1/crisis_alerts?patient_id=eq.${patientId}`, 'DELETE');
  await rest(`/rest/v1/chat_logs?patient_id=eq.${patientId}`, 'DELETE');

  const token = await signInPatient();

  console.log('1. Pesan krisis → /api/companion');
  const first = await companion(token, CRISIS_MESSAGE);
  check('respons 200', first.status === 200);
  check('flagged = true', first.data?.flagged === true);
  check('crisisContact terisi (ada psikolog terverifikasi)', Boolean(first.data?.crisisContact?.id));

  console.log('\n2. Baris crisis_alerts dibuat');
  const alert = await latestAlert(patientId);
  check('alert ada', Boolean(alert?.id));
  check('status awal = pending', alert?.status === 'pending');
  check('nickname pasien tersimpan', alert?.patient_nickname === PATIENT.nickname);

  if (!alert?.id) {
    console.error('\nTidak bisa lanjut tanpa alert. Pastikan ada minimal 1 psikolog terverifikasi (node scripts/seed-demo.mjs).');
    process.exit(1);
  }

  console.log('\n3. Backdate alert agar melewati SLA (tanpa menunggu 15 menit)');
  const twentyMinAgo = new Date(Date.now() - 20 * 60_000).toISOString();
  await rest(`/rest/v1/crisis_alerts?id=eq.${alert.id}`, 'PATCH', { created_at: twentyMinAgo });
  check('created_at ter-backdate', (await latestAlert(patientId))?.created_at?.startsWith(twentyMinAgo.slice(0, 16)));

  console.log('\n4. Eskalasi otomatis');
  if (CRON_SECRET) {
    const res = await fetch(`${API}/api/cron/sweep`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
    const data = await res.json().catch(() => null);
    check('cron/sweep 200', res.status === 200);
    check('escalated >= 1', (data?.escalated ?? 0) >= 1);

    const denied = await fetch(`${API}/api/cron/sweep`);
    check('tanpa secret ditolak (401)', denied.status === 401);
  } else {
    console.log('  (CRON_SECRET kosong → menguji fallback sweep di /api/companion)');
    const second = await companion(token, 'halo, aku masih di sini');
    check('respons 200', second.status === 200);
    check('escalated = true (fallback companion)', second.data?.escalated === true);
  }

  const after = await latestAlert(patientId);
  check('status alert sekarang = escalated', after?.status === 'escalated');

  console.log(`\n${failed === 0 ? '✅' : '❌'} Lulus ${passed}/${passed + failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nE2E gagal:', error.message);
  process.exit(1);
});
