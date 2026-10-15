"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { portalFetch, portalSignOut } from "@/lib/portalClient";
import { supabase } from "@/lib/supabaseClient";

/**
 * Pendaftaran psikolog (PRD Bagian 7 poin 1):
 * data diri + nomor STR/SIPP + dokumen pendukung → status `pending`
 * sampai admin memverifikasi manual.
 */

type MeResponse = { role: "admin" | "psychologist" | "patient" | null; name: string | null };

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60";
const FIELD_CLASS = `h-11 w-full rounded-xl2 bg-white px-4 text-[13px] text-text shadow-float outline-none ring-1 ring-guardian/20 focus:ring-2 focus:ring-guardian ${FOCUS_RING}`;

export default function PortalRegisterPage() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "form" | "profile-only" | "confirm-email" | "blocked">("loading");
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [education, setEducation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setState("form");
        return;
      }
      const me = await portalFetch<MeResponse>("/api/portal/me");
      if (!me.ok) {
        setState("form");
        return;
      }
      if (me.data.role === "psychologist") {
        router.replace("/portal/psikolog");
        return;
      }
      if (me.data.role === "admin") {
        router.replace("/portal/admin");
        return;
      }
      if (me.data.role === "patient") {
        setBlockedMessage("Akun ini terdaftar sebagai pasien. Gunakan email lain untuk mendaftar sebagai psikolog.");
        setState("blocked");
        return;
      }
      /* Login tanpa baris psychologists/patients → lanjutkan pendaftaran. */
      setState("profile-only");
    })();
  }, [router]);

  async function submitRegistration(withSignUp: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      if (withSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signUpError) {
          const message = signUpError.message.toLowerCase();
          setError(
            message.includes("already")
              ? "Email ini sudah terdaftar. Coba masuk lewat portal lalu lanjutkan pendaftaran."
              : "Gagal membuat akun. Periksa email & kata sandi (minimal 6 karakter).",
          );
          setSubmitting(false);
          return;
        }
        if (!data.session) {
          setState("confirm-email");
          setSubmitting(false);
          return;
        }
      }
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
      setSubmitting(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Sesi tidak ditemukan — coba masuk lewat portal lalu lanjutkan pendaftaran.");
      setSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append("full_name", fullName.trim());
    formData.append("license_number", licenseNumber.trim());
    formData.append("specialization", specialization.trim());
    formData.append("education", education.trim());
    if (file) formData.append("file", file);

    try {
      const response = await fetch("/api/portal/register", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const parsed = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(parsed?.error ?? "Pendaftaran gagal. Coba lagi.");
        setSubmitting(false);
        return;
      }
      router.replace("/portal/psikolog");
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const withSignUp = state === "form";
    if (withSignUp) {
      if (!email.trim() || password.length < 6) {
        setError("Isi email dan kata sandi minimal 6 karakter.");
        return;
      }
    }
    if (!fullName.trim() || !licenseNumber.trim()) {
      setError("Nama lengkap dan nomor STR/SIPP wajib diisi.");
      return;
    }
    await submitRegistration(withSignUp);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 py-10">
      <h1 className="font-display text-[24px] leading-tight">Daftar sebagai Psikolog</h1>
      <p className="mt-2 text-[12px] leading-relaxed text-text/70">
        Isi data diri dan nomor STR/SIPP, lalu unggah dokumen pendukung. Akun
        berstatus <span className="text-text">menunggu</span> sampai admin
        memverifikasi dokumenmu secara manual.
      </p>

      {state === "loading" && <p className="mt-8 text-sm text-text/60">Memeriksa sesi…</p>}

      {state === "blocked" && (
        <div className="mt-6 rounded-xl2 bg-healer-card px-4 py-3 text-[13px] leading-snug text-[#8F3A57]">
          {blockedMessage}
          <button
            type="button"
            onClick={() => void portalSignOut().then(() => router.replace("/portal"))}
            className={`ml-2 underline decoration-2 underline-offset-2 ${FOCUS_RING}`}
          >
            Keluar
          </button>
        </div>
      )}

      {state === "confirm-email" && (
        <div className="mt-6 rounded-xl2 bg-guardian-card px-4 py-4 text-[13px] leading-relaxed">
          <p className="font-display text-[15px]">Cek emailmu</p>
          <p className="mt-2 text-text/80">
            Kami mengirim tautan konfirmasi ke <span className="text-text">{email}</span>.
            Setelah dikonfirmasi, <span className="text-text">masuk lewat portal</span> —
            pendaftaran psikolog akan dilanjutkan otomatis dari data yang sama.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/portal")}
            className={`mt-4 h-11 w-full rounded-full bg-cta text-[13px] text-white ${FOCUS_RING}`}
          >
            Ke halaman masuk
          </button>
        </div>
      )}

      {(state === "form" || state === "profile-only") && (
        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
          {state === "form" && (
            <>
              <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
                Email
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className={FIELD_CLASS} />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
                Kata sandi
                <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" className={FIELD_CLASS} />
              </label>
            </>
          )}

          <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
            Nama lengkap + gelar
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="mis. Aya Rahmawati, M.Psi." className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
            Nomor STR / SIPP
            <input required value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="mis. STR-1234567890" className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
            Spesialisasi
            <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="mis. Kecemasan sosial" className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
            Pendidikan
            <input value={education} onChange={(e) => setEducation(e.target.value)} placeholder="mis. S1 Psikologi UGM · M.Psi. Profesi" className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
            Dokumen pendukung (PDF / gambar, maks 5 MB)
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={`w-full rounded-xl2 bg-white px-4 py-2.5 text-[12px] shadow-float ring-1 ring-guardian/20 file:mr-3 file:rounded-full file:border-0 file:bg-guardian-card file:px-4 file:py-1.5 file:text-[12px] ${FOCUS_RING}`}
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl2 bg-healer-card px-4 py-3 text-[12px] leading-snug text-[#8F3A57]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`h-[52px] rounded-full bg-cta text-[14px] text-white shadow-[0_10px_24px_rgba(227,119,155,0.35)] disabled:opacity-60 ${FOCUS_RING}`}
          >
            {submitting ? "Mengirim pendaftaran…" : "Kirim Pendaftaran"}
          </button>
          <p className="text-center text-[11px] text-text/55">
            Sudah punya akun?{" "}
            <a href="/portal" className={`underline decoration-cta decoration-2 underline-offset-4 ${FOCUS_RING}`}>
              Masuk di sini
            </a>
          </p>
        </form>
      )}
    </div>
  );
}
