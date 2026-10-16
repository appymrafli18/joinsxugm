/**
 * apply-sql.mjs — jalankan SQL (DDL/migrasi) ke Supabase dari terminal.
 *
 * PostgREST (service role) TIDAK bisa membuat tabel, jadi skrip ini memakai
 * salah satu dari:
 *   A. SUPABASE_ACCESS_TOKEN  → Supabase Management API (paling gampang)
 *      Buat di: https://supabase.com/dashboard/account/tokens  (prefix `sbp_`)
 *   B. SUPABASE_DB_URL        → koneksi Postgres langsung (butuh paket `pg`)
 *
 * Cara pakai (dari folder `web/`):
 *   node scripts/apply-sql.mjs                       # default: ../docs/session.sql
 *   node scripts/apply-sql.mjs ../docs/schema.sql    # file SQL lain
 *
 * Tambahkan kredensial ke `web/.env.local`, mis.:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxx
 * (project ref diambil otomatis dari NEXT_PUBLIC_SUPABASE_URL)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || '';
const ref = (supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || '';
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN || '';
const dbUrl = process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL || '';

const sqlArg = process.argv[2] || join(WEB_DIR, '..', 'docs', 'supabase-setup.sql');
const sqlPath = resolve(sqlArg);
let sql;
try {
  sql = readFileSync(sqlPath, 'utf8');
} catch {
  console.error(`Tidak bisa membaca file SQL: ${sqlPath}`);
  process.exit(1);
}

async function viaManagementApi() {
  if (!ref) {
    console.error('Tidak bisa menentukan project ref dari NEXT_PUBLIC_SUPABASE_URL.');
    process.exit(1);
  }
  console.log(`→ Supabase Management API (project: ${ref}) menjalankan ${sqlPath}…`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`✗ Gagal (${res.status}): ${text.slice(0, 400)}`);
    process.exit(1);
  }
  console.log('✓ SQL dieksekusi.');
  console.log(text.slice(0, 400));
}

async function viaPg() {
  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.error('Paket `pg` belum terpasang. Jalankan: npm i -D pg  (di folder web/)');
    process.exit(1);
  }
  console.log(`→ Postgres langsung menjalankan ${sqlPath}…`);
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('✓ SQL dieksekusi.');
  } finally {
    await client.end();
  }
}

if (accessToken) {
  await viaManagementApi();
} else if (dbUrl) {
  await viaPg();
} else {
  console.error(
    [
      'Tidak ada kredensial DDL. Pilih salah satu:',
      '',
      '  A) Tambahkan ke web/.env.local:',
      '       SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx   (dari supabase.com/dashboard/account/tokens)',
      '     lalu: node scripts/apply-sql.mjs',
      '',
      '  B) Tambahkan connection string Postgres:',
      '       SUPABASE_DB_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres',
      '     (butuh `npm i -D pg`) lalu: node scripts/apply-sql.mjs',
    ].join('\n'),
  );
  process.exit(1);
}
