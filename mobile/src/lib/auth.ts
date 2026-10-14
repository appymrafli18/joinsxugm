import { supabase } from './supabase';

export type AuthResult = { ok: true } | { ok: false; message: string };
export type SignUpResult =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; message: string };

const NETWORK_MESSAGE = 'Koneksi sedang bermasalah. Coba lagi sebentar lagi.';

function toSignInMessage(raw: string) {
  const message = raw.toLowerCase();
  if (message.includes('invalid login credentials')) return 'Email atau kata sandi belum cocok. Coba periksa lagi ya.';
  if (message.includes('email not confirmed')) return 'Emailmu belum dikonfirmasi. Cek kotak masuk emailmu dulu ya.';
  if (message.includes('rate limit') || message.includes('too many')) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  if (message.includes('fetch') || message.includes('network')) return NETWORK_MESSAGE;
  return 'Belum berhasil masuk. Coba lagi sebentar lagi.';
}

function toSignUpMessage(raw: string) {
  const message = raw.toLowerCase();
  if (message.includes('already registered') || message.includes('already been registered')) return 'Email ini sudah terdaftar. Coba masuk saja ya.';
  if (message.includes('password') && (message.includes('weak') || message.includes('least'))) return 'Kata sandinya belum cukup kuat. Coba tambah panjang atau campur huruf dan angka.';
  if (message.includes('invalid') && message.includes('email')) return 'Format emailnya belum sesuai.';
  if (message.includes('rate limit') || message.includes('too many')) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  if (message.includes('fetch') || message.includes('network')) return NETWORK_MESSAGE;
  return 'Belum berhasil membuat akun. Coba lagi sebentar lagi.';
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { ok: false, message: toSignInMessage(error.message) } : { ok: true };
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
}

export async function signUpWithEmail(input: { nickname: string; email: string; password: string }): Promise<SignUpResult> {
  try {
    const { data, error } = await supabase.auth.signUp({ email: input.email, password: input.password, options: { data: { nickname: input.nickname } } });
    if (error) return { ok: false, message: toSignUpMessage(error.message) };
    if (data.user && data.user.identities?.length === 0) return { ok: false, message: 'Email ini sudah terdaftar. Coba masuk saja ya.' };
    return { ok: true, needsEmailConfirmation: !data.session };
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
}

export async function signOut() {
  try { await supabase.auth.signOut(); } catch { /* noop */ }
}
