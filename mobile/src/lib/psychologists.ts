/**
 * Client marketplace psikolog & booking.
 * Semua data psikolog dibaca lewat server (klien tidak diberi akses RLS),
 * dan booking juga dibuat lewat server (gate consent + penukaran poin).
 */
import { getJson, postJson } from './api';

export const FREE_SESSION_POINTS = 400; // samakan dengan web/app/api/bookings/route.ts
export const SESSION_DURATION_MINUTES = 50;

export type Psychologist = {
  id: string;
  nickname: string | null;
  full_name: string | null;
  education: string | null;
  specialization: string | null;
  price_per_session: number | null;
  avatar_url: string | null;
  is_on_call: boolean | null;
};

export type Booking = {
  id: string;
  scheduled_at: string;
  status: string;
  paid_with: string;
  payment_status: string;
  price: number;
  points_used: number;
  duration_minutes: number;
  session_mode: string;
  patient_note: string | null;
};

export type PaymentMethod = 'transfer' | 'qris' | 'points';

export async function fetchPsychologists(): Promise<{ ok: true; data: Psychologist[] } | { ok: false; message: string }> {
  const result = await getJson<{ psychologists: Psychologist[] }>('/api/psychologists');
  return result.ok ? { ok: true, data: result.data.psychologists ?? [] } : { ok: false, message: result.message };
}

export async function fetchPsychologist(id: string): Promise<{ ok: true; data: Psychologist } | { ok: false; message: string }> {
  const result = await getJson<{ psychologist: Psychologist }>(`/api/psychologists?id=${encodeURIComponent(id)}`);
  return result.ok ? { ok: true, data: result.data.psychologist } : { ok: false, message: result.message };
}

export type CreateBookingResult =
  | { ok: true; booking: Booking; psychologistNickname: string | null }
  | { ok: false; message: string; code?: string };

export async function createBooking(input: {
  psychologistId: string;
  scheduledAt: string;
  paymentMethod: PaymentMethod;
  note?: string;
}): Promise<CreateBookingResult> {
  const result = await postJson<{ booking: Booking; psychologist: { nickname: string | null } }>(
    '/api/bookings',
    input,
  );
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return {
    ok: true,
    booking: result.data.booking,
    psychologistNickname: result.data.psychologist?.nickname ?? null,
  };
}

export type BookingListItem = Booking & { psychologist_nickname: string | null };

/** Daftar sesi konsultasi pasien (via server — nama psikolog ikut disertakan). */
export async function fetchBookings(): Promise<{ ok: true; data: BookingListItem[] } | { ok: false; message: string }> {
  const result = await getJson<{ bookings: BookingListItem[] }>('/api/bookings');
  return result.ok ? { ok: true, data: result.data.bookings ?? [] } : { ok: false, message: result.message };
}

/** Label status sesi yang ramah pasien. */
export function bookingStatusLabel(booking: BookingListItem): { label: string; tone: 'pending' | 'ok' | 'done' } {
  if (booking.status === 'cancelled') return { label: 'Dibatalkan', tone: 'done' };
  if (booking.status === 'completed') return { label: 'Selesai', tone: 'done' };
  if (booking.payment_status === 'unpaid') return { label: 'Menunggu pembayaran', tone: 'pending' };
  if (booking.status === 'confirmed') return { label: 'Terkonfirmasi', tone: 'ok' };
  return { label: 'Menunggu konfirmasi', tone: 'pending' };
}

/** Format harga rupiah sederhana dengan fallback kalau Intl tidak tersedia. */
export function formatRupiah(value: number | null | undefined): string {
  const n = Number(value) || 0;
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `Rp${n.toLocaleString('id-ID')}`;
  }
}

export function formatJadwal(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }) + `, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}
