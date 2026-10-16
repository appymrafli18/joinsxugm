"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { portalFetch, portalSignIn, portalSignOut } from "@/lib/portalClient";
import { supabase } from "@/lib/supabaseClient";

type MeResponse = { role: "admin" | "psychologist" | "patient" | null; name: string | null; verificationStatus?: string | null };

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60";

export default function PortalLoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [wrongRole, setWrongRole] = useState<string | null>(null);

  const routeByRole = useCallback(
    async () => {
      const me = await portalFetch<MeResponse>("/api/portal/me");
      if (!me.ok) {
        setChecking(false);
        return;
      }
      if (me.data.role === "admin") {
        router.replace("/portal/admin");
        return;
      }
      if (me.data.role === "psychologist") {
        router.replace("/portal/psikolog");
        return;
      }
      setWrongRole(me.data.role === "patient" ? "Akun ini adalah akun pasien — gunakan aplikasi mobile Vsikolog." : "Akun ini tidak punya akses portal.");
      setChecking(false);
    },
    [router],
  );

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setChecking(false);
        return;
      }
      await routeByRole();
    })();
  }, [routeByRole]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setWrongRole(null);
    setSubmitting(true);
    const result = await portalSignIn(email.trim(), password);
    if (!result.ok) {
      setError(result.message);
      setSubmitting(false);
      return;
    }
    await routeByRole();
    setSubmitting(false);
  }

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-text/60">Memeriksa sesi…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display text-[26px] leading-tight">Portal Vsikolog</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-text/70">
        Khusus Admin dan Psikolog. Pasien menggunakan aplikasi mobile.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-[13px] text-text/80">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nama@email.com"
            className={`h-[50px] rounded-xl2 bg-white px-4 text-base text-text shadow-float outline-none ring-1 ring-guardian/20 focus:ring-2 focus:ring-guardian ${FOCUS_RING}`}
          />
        </label>
        <label className="flex flex-col gap-2 text-[13px] text-text/80">
          Kata sandi
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Kata sandimu"
            className={`h-[50px] rounded-xl2 bg-white px-4 text-base text-text shadow-float outline-none ring-1 ring-guardian/20 focus:ring-2 focus:ring-guardian ${FOCUS_RING}`}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl2 bg-healer-card px-4 py-3 text-[13px] leading-snug text-[#8F3A57]">
            {error}
          </p>
        )}
        {wrongRole && (
          <div className="rounded-xl2 bg-healer-card px-4 py-3 text-[13px] leading-snug text-[#8F3A57]">
            {wrongRole}
            <button
              type="button"
              onClick={() => {
                void portalSignOut().then(() => setWrongRole(null));
              }}
              className={`ml-2 underline decoration-2 underline-offset-2 ${FOCUS_RING}`}
            >
              Keluar
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={`flex h-[54px] items-center justify-center rounded-full bg-cta text-base text-white shadow-[0_10px_24px_rgba(227,119,155,0.35)] transition-transform active:scale-[0.98] disabled:opacity-70 ${FOCUS_RING}`}
        >
          {submitting ? "Masuk…" : "Masuk"}
        </button>
      </form>

      <p className="mt-6 text-center text-[12px] text-text/70">
        Psikolog baru?{" "}
        <a href="/portal/register" className={`underline decoration-cta decoration-2 underline-offset-4 ${FOCUS_RING}`}>
          Daftar & verifikasi STR/SIPP
        </a>
      </p>
    </div>
  );
}
