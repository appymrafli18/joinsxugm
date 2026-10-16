/**
 * reset-seed.mjs — RESET TOTAL data aplikasi lalu seed ulang dari nol.
 *
 * Jalankan (dari folder `web/`):
 *   node scripts/reset-seed.mjs            # hapus semua baris data → seed ulang
 *   node scripts/reset-seed.mjs --dry-run  # hanya tampilkan jumlah baris
 *   node scripts/reset-seed.mjs --with-auth# ikut hapus AKUN demo (@vsikolog.test/@kokoro.test)
 *
 * ⚠️ DESTRUKTIF: menghapus SELURUH baris pada tabel data (bukan hanya demo).
 *    Akun auth umum tidak dihapus kecuali `--with-auth`.
 *
 * Urutan hapus mengikuti foreign key (anak → induk).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, '..');

function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(join(WEB_DIR, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      env[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, '');
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

const HEADERS = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const WITH_AUTH = args.includes('--with-auth');

/* Urutan: anak dulu, induk terakhir (patuhi FK). */
const TABLES = [
  'session_messages',
  'crisis_alerts',
  'bookings',
  'sentiment_logs',
  'chat_logs',
  'quests',
  'screening_scores',
  'ai_summaries',
  'psychologist_availability',
  'patients',
  'psychologists',
];

async function countRows(table) {
  try {
    const res = await fetch(`${URL}/rest/v1/${table}?select=id&limit=1`, {
      headers: { ...HEADERS, Prefer: 'count=exact' },
    });
    if (!res.ok) return null;
    const cr = res.headers.get('content-range'); // "0-0/123"
    if (!cr) return 0;
    const total = Number(cr.split('/')[1]);
    return Number.isFinite(total) ? total : 0;
  } catch {
    return null;
  }
}

async function deleteAll(table) {
  try {
    const res = await fetch(`${URL}/rest/v1/${table}?id=not.is.null`, {
      method: 'DELETE',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
    });
    if (res.status === 404) return { ok: true, skipped: true }; // tabel tidak ada
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `${res.status} ${text.slice(0, 140)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function deleteDemoAuthUsers() {
  let deleted = 0;
  for (let page = 1; page <= 5; page += 1) {
    const res = await fetch(`${URL}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: HEADERS });
    if (!res.ok) break;
    const data = await res.json();
    const users = data?.users ?? [];
    for (const u of users) {
      const email = String(u.email ?? '');
      const isDemo = /^demo\./i.test(email) && /@(vsikolog|kokoro)\.test$/i.test(email);
      if (!isDemo) continue;
      const del = await fetch(`${URL}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: HEADERS });
      if (del.ok) deleted += 1;
    }
    if (users.length < 200) break;
  }
  return deleted;
}

console.log(DRY_RUN ? '🔎 DRY RUN — tidak ada yang dihapus.\n' : '⚠️  RESET TOTAL data aplikasi…\n');

let totalRows = 0;
const failures = [];
for (const table of TABLES) {
  const count = await countRows(table);
  if (count === null) {
    console.log(`– ${table}: dilewati (tidak ada / bukan tabel)`);
    continue;
  }
  if (DRY_RUN) {
    console.log(`   ${table}: ${count} baris`);
    totalRows += count;
    continue;
  }
  const result = await deleteAll(table);
  if (result.ok) {
    console.log(`✓ ${table}: dihapus (${count} baris)`);
    totalRows += count;
  } else {
    console.log(`✗ ${table}: gagal — ${result.error}`);
    failures.push(table);
  }
}

if (WITH_AUTH && !DRY_RUN) {
  const n = await deleteDemoAuthUsers();
  console.log(`✓ auth: ${n} akun demo dihapus`);
} else if (WITH_AUTH && DRY_RUN) {
  console.log('   auth: (dry-run) akun demo akan dihapus');
}

if (DRY_RUN) {
  console.log(`\nTotal baris data: ${totalRows}`);
  process.exit(0);
}

if (failures.length > 0) {
  console.log(`\n⚠️  Sebagian tabel gagal dihapus: ${failures.join(', ')}. Periksa FK/constraint.`);
}

/* Seed ulang dari nol. */
console.log('\n→ Seed ulang…\n');
const seed = spawnSync(process.execPath, [join(__dirname, 'seed-demo.mjs')], { stdio: 'inherit' });
if (seed.status !== 0) {
  console.error('\n✗ Seed gagal. Jalankan manual: node scripts/seed-demo.mjs');
  process.exit(seed.status ?? 1);
}

console.log('\n✅ Selesai — data ter-reset ke 0 lalu di-seed ulang.');
console.log('Login: demo.pasien@vsikolog.test · demo.psikolog1..4@vsikolog.test · demo.admin@vsikolog.test (Demo1234!xyz)');
