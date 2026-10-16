import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Notifikasi email krisis (PRD Bagian 9) — SERVER-ONLY, memakai Resend.
 *
 * Tanpa `RESEND_API_KEY` / `NOTIFY_FROM`, pengiriman dilewati dan payload
 * dicatat ke log server (aman untuk dev & E2E: alur keselamatan di DB tetap
 * berjalan, hanya email yang tidak benar-benar terkirim).
 *
 * Aturan penting: semua fungsi di file ini TIDAK pernah melempar error.
 * Kegagalan notifikasi tidak boleh memutus alur krisis.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const MAX_USERS_PER_PAGE = 1000;

export type OutboundEmail = {
  to: string[];
  subject: string;
  html: string;
};

/** true bila pengiriman email benar-benar dikonfigurasi. */
export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_FROM);
}

/** Base URL portal untuk tautan di email (tanpa trailing slash). */
export function portalUrl(): string {
  return (process.env.PORTAL_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/** Kirim email via Resend REST. Return true bila terkirim. Tidak melempar. */
export async function sendEmail(message: OutboundEmail): Promise<boolean> {
  const recipients = message.to.filter(Boolean);
  if (recipients.length === 0) return false;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  if (!apiKey || !from) {
    console.info('[notify] email dilewati (RESEND_API_KEY/NOTIFY_FROM kosong).', {
      to: recipients,
      subject: message.subject,
    });
    return false;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: recipients, subject: message.subject, html: message.html }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[notify] Resend gagal', response.status, detail.slice(0, 200));
      return false;
    }
    return true;
  } catch (error) {
    console.error('[notify] Resend error:', error);
    return false;
  }
}

/**
 * Email akun (auth.users) untuk sekumpulan id — lewat admin API (service role).
 * Tabel `psychologists` tidak menyimpan email, jadi diambil dari Supabase Auth.
 */
export async function resolveUserEmails(
  service: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  const wanted = new Set(ids.filter(Boolean));
  const found = new Map<string, string>();
  if (wanted.size === 0) return found;

  try {
    const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: MAX_USERS_PER_PAGE });
    if (error) {
      console.warn('[notify] gagal memuat daftar user:', error.message);
      return found;
    }
    for (const user of data?.users ?? []) {
      if (wanted.has(user.id) && user.email) found.set(user.id, user.email);
    }
  } catch (error) {
    console.warn('[notify] listUsers error:', error);
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Template email (HTML sederhana, aman di klien email)                */
/* ------------------------------------------------------------------ */

type AlertItem = { nickname: string | null; excerpt: string | null; createdAt: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function ageLabel(createdAt: string): string {
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) return 'baru';
  const minutes = Math.max(0, Math.round((Date.now() - parsed) / 60_000));
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function alertItemsHtml(items: AlertItem[]): string {
  return items
    .map(
      (item) => `
      <div style="border:1px solid #E8E3F5;border-radius:12px;padding:12px 14px;margin:8px 0;">
        <strong>${escapeHtml(item.nickname ?? 'Pasien')}</strong>
        <span style="color:#8A86A0"> · ${escapeHtml(ageLabel(item.createdAt))}</span>
        ${
          item.excerpt
            ? `<p style="margin:8px 0 0;font-style:italic;color:#4A4658">“${escapeHtml(item.excerpt)}”</p>`
            : ''
        }
      </div>`,
    )
    .join('');
}

function emailShell(params: {
  title: string;
  intro: string;
  items: AlertItem[];
  link: string;
  cta: string;
}): string {
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#2D2A3E;line-height:1.5;max-width:560px">
    <h2 style="margin:0 0 6px;font-size:18px">${escapeHtml(params.title)}</h2>
    <p style="margin:0 0 8px;color:#4A4658">${escapeHtml(params.intro)}</p>
    ${alertItemsHtml(params.items)}
    <p style="margin:16px 0 4px">
      <a href="${escapeHtml(params.link)}" style="display:inline-block;background:#7C5CFF;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px">${escapeHtml(params.cta)}</a>
    </p>
    <p style="margin:16px 0 0;color:#8A86A0;font-size:12px">Pesan otomatis dari Vsikolog — jangan balas email ini.</p>
  </div>`;
}

/** Email peringatan ke satu psikolog on-call saat krisis baru terdeteksi. */
export function crisisEmail(params: {
  patientNickname: string | null;
  excerpt: string | null;
  createdAt: string;
  link: string;
}): OutboundEmail {
  return {
    to: [],
    subject: '⚠️ Peringatan krisis — pasien butuh perhatian segera',
    html: emailShell({
      title: 'Peringatan krisis baru',
      intro:
        'AI Companion mendeteksi indikasi risiko tinggi. Kamu dipilih sebagai psikolog on-call untuk pasien ini. Hubungi pasien atau tanggapi alert di dashboard sesegera mungkin.',
      items: [{ nickname: params.patientNickname, excerpt: params.excerpt, createdAt: params.createdAt }],
      link: params.link,
      cta: 'Buka Pusat Peringatan Krisis',
    }),
  };
}

/** Email eskalasi ke tim saat alert lewat SLA (atau di-eskalasi manual). */
export function escalationEmail(params: {
  items: AlertItem[];
  slaMinutes: number;
  link: string;
}): OutboundEmail {
  return {
    to: [],
    subject: `🚨 Eskalasi krisis (${params.items.length}) — belum ditanggapi > ${params.slaMinutes} menit`,
    html: emailShell({
      title: 'Eskalasi krisis',
      intro: `Alert krisis berikut belum ditanggapi melewati batas ${params.slaMinutes} menit dan telah di-eskalasi ke seluruh psikolog terverifikasi. Mohon segera ditindaklanjuti.`,
      items: params.items,
      link: params.link,
      cta: 'Buka Pusat Peringatan Krisis',
    }),
  };
}

/** Email ke psikolog saat pasien membuka ruang sesi (menunggu di ruang). */
export function sessionWaitingEmail(params: {
  patientNickname: string | null;
  scheduledAt: string;
  mode: 'voice' | 'video';
  link: string;
}): OutboundEmail {
  const when = (() => {
    const parsed = Date.parse(params.scheduledAt);
    if (Number.isNaN(parsed)) return params.scheduledAt;
    return new Date(parsed).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  })();
  return {
    to: [],
    subject: `🔔 ${params.patientNickname ?? 'Pasien'} membuka ruang sesi`,
    html: emailShell({
      title: 'Pasien menunggu di ruang sesi',
      intro: `${params.patientNickname ?? 'Pasien'} membuka ruang konsultasi (${params.mode === 'voice' ? 'suara' : 'video'}) untuk jadwal ${when}. Buka ruang sesi untuk menyambut lewat chat atau panggilan.`,
      items: [],
      link: params.link,
      cta: 'Buka Ruang Sesi',
    }),
  };
}
