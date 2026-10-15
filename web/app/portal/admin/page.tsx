"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch, portalSignOut } from "@/lib/portalClient";

type Psychologist = {
  id: string;
  full_name: string;
  license_number: string;
  license_document_url: string | null;
  license_document_signed_url: string | null;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  nickname: string | null;
  education: string | null;
  specialization: string | null;
  price_per_session: number | null;
  is_on_call: boolean;
  created_at: string;
  email: string | null;
};

type Patient = {
  id: string;
  nickname: string;
  archetype_id: string;
  tier: string;
  total_points: number;
  data_sharing_consent: boolean;
  assigned_psychologist_id: string | null;
  created_at: string;
  email: string | null;
};

type AdminData = {
  psychologists: Psychologist[];
  patients: Patient[];
  counts: {
    psychologists: number;
    verified: number;
    pending: number;
    rejected: number;
    patients: number;
    crisisPending: number;
    crisisEscalated: number;
  };
};

const STATUS_STYLE: Record<string, string> = {
  verified: "bg-sage/20 text-[#4F7A57]",
  pending: "bg-sparkle/40 text-[#8A6D2F]",
  rejected: "bg-terracotta/15 text-terracotta",
};

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl2 bg-white p-4 shadow-float">
      <p className="text-[11px] text-text/60">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
    </div>
  );
}

export default function PortalAdminPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void portalFetch<AdminData>("/api/portal/admin").then((result) => {
      if (!active) return;
      if (!result.ok) {
        if (result.status === 401) {
          router.replace("/portal");
          return;
        }
        setError(result.message);
        return;
      }
      setData(result.data);
    });
    return () => {
      active = false;
    };
  }, [router]);

  async function setVerification(psychologist: Psychologist, status: "verified" | "rejected") {
    let reason: string | undefined;
    if (status === "rejected") {
      const input = window.prompt("Alasan penolakan (akan dilihat psikolog):", psychologist.rejection_reason ?? "");
      if (input === null) return;
      reason = input.trim() || undefined;
    }
    setBusyId(psychologist.id);
    const result = await portalFetch<{ psychologist: Psychologist }>("/api/portal/admin", {
      method: "POST",
      body: { action: "set-verification", psychologistId: psychologist.id, status, reason },
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setData((current) =>
      current
        ? {
            ...current,
            psychologists: current.psychologists.map((p) => (p.id === psychologist.id ? { ...p, ...result.data.psychologist } : p)),
            counts: {
              ...current.counts,
              verified: current.psychologists.filter((p) => (p.id === psychologist.id ? false : p.verification_status === "verified")).length + (status === "verified" ? 1 : 0),
              pending: current.psychologists.filter((p) => p.id !== psychologist.id && p.verification_status === "pending").length,
              rejected: current.psychologists.filter((p) => p.id !== psychologist.id && p.verification_status === "rejected").length + (status === "rejected" ? 1 : 0),
            },
          }
        : current,
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-text/70">{error}</p>
        <button
          type="button"
          onClick={() => void portalSignOut().then(() => router.replace("/portal"))}
          className={`mt-6 h-11 rounded-full bg-cta px-6 text-sm text-white ${FOCUS_RING}`}
        >
          Keluar
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-text/60">Memuat data…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Portal Admin</h1>
          <p className="mt-1 text-[12px] text-text/60">Kelola pengguna, verifikasi psikolog, dan pantau krisis.</p>
        </div>
        <button
          type="button"
          onClick={() => void portalSignOut().then(() => router.replace("/portal"))}
          className={`h-10 rounded-full bg-white px-5 text-[12px] shadow-float ring-1 ring-guardian/15 ${FOCUS_RING}`}
        >
          Keluar
        </button>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Psikolog" value={data.counts.psychologists} />
        <StatCard label="Terverifikasi" value={data.counts.verified} />
        <StatCard label="Menunggu" value={data.counts.pending} />
        <StatCard label="Ditolak" value={data.counts.rejected} />
        <StatCard label="Pasien" value={data.counts.patients} />
        <StatCard label="Krisis pending" value={data.counts.crisisPending} />
        <StatCard label="Krisis escalated" value={data.counts.crisisEscalated} />
      </section>

      {error && <p className="mt-4 rounded-xl2 bg-healer-card px-4 py-3 text-[12px] text-[#8F3A57]">{error}</p>}

      {/* Verifikasi psikolog */}
      <section className="mt-8">
        <h2 className="font-display text-lg">Verifikasi Psikolog (manual)</h2>
        <p className="mt-1 text-[12px] text-text/60">
          Periksa nomor STR/SIPP dan dokumen pendukung sebelum menyetujui.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {data.psychologists.map((p) => (
            <article key={p.id} className="rounded-xl2 bg-white p-4 shadow-float">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[15px]">
                    {p.nickname ?? "—"} <span className="text-text/50">·</span> {p.full_name}
                  </p>
                  <p className="mt-1 text-[11px] text-text/60">{p.email ?? "—"}</p>
                  <p className="mt-1 text-[11px] text-text/60">
                    STR/SIPP: <span className="text-text">{p.license_number}</span>
                    {" · "}
                    {p.license_document_signed_url ? (
                      <a href={p.license_document_signed_url} target="_blank" rel="noreferrer" className={`underline decoration-cta decoration-2 underline-offset-2 ${FOCUS_RING}`}>
                        Lihat dokumen
                      </a>
                    ) : (
                      <span className="text-terracotta">dokumen belum diunggah</span>
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-text/60">
                    {[p.education, p.specialization, p.price_per_session ? `Rp${p.price_per_session.toLocaleString("id-ID")}/sesi` : null]
                      .filter(Boolean)
                      .join(" · ") || "Profil publik belum diisi"}
                  </p>
                  {p.verification_status === "rejected" && p.rejection_reason && (
                    <p className="mt-2 text-[11px] text-terracotta">Alasan: {p.rejection_reason}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] ${STATUS_STYLE[p.verification_status]}`}>
                    {p.verification_status}
                  </span>
                  {p.is_on_call && <span className="rounded-full bg-guardian-card px-3 py-1 text-[10px] text-[#6E4FB5]">on-call</span>}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busyId === p.id || p.verification_status === "verified"}
                  onClick={() => void setVerification(p, "verified")}
                  className={`h-9 rounded-full bg-cta px-4 text-[12px] text-white disabled:opacity-40 ${FOCUS_RING}`}
                >
                  Setujui
                </button>
                <button
                  type="button"
                  disabled={busyId === p.id || p.verification_status === "rejected"}
                  onClick={() => void setVerification(p, "rejected")}
                  className={`h-9 rounded-full bg-white px-4 text-[12px] text-terracotta ring-1 ring-terracotta/40 disabled:opacity-40 ${FOCUS_RING}`}
                >
                  Tolak
                </button>
              </div>
            </article>
          ))}
          {data.psychologists.length === 0 && <p className="text-[12px] text-text/60">Belum ada psikolog terdaftar.</p>}
        </div>
      </section>

      {/* Daftar pasien */}
      <section className="mt-8">
        <h2 className="font-display text-lg">Pengguna — Pasien</h2>
        <div className="mt-3 overflow-x-auto rounded-xl2 bg-white shadow-float">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-guardian/10 text-[11px] text-text/60">
                <th className="px-4 py-3">Nama panggilan</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Arketipe</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Poin</th>
                <th className="px-4 py-3">Consent</th>
                <th className="px-4 py-3">Terhubung ke</th>
              </tr>
            </thead>
            <tbody>
              {data.patients.map((p) => (
                <tr key={p.id} className="border-b border-guardian/5 last:border-0">
                  <td className="px-4 py-3">{p.nickname}</td>
                  <td className="px-4 py-3 text-text/70">{p.email ?? "—"}</td>
                  <td className="px-4 py-3">{p.archetype_id}</td>
                  <td className="px-4 py-3">{p.tier}</td>
                  <td className="px-4 py-3">{p.total_points}</td>
                  <td className="px-4 py-3">{p.data_sharing_consent ? "aktif" : "—"}</td>
                  <td className="px-4 py-3 text-text/70">
                    {data.psychologists.find((psy) => psy.id === p.assigned_psychologist_id)?.nickname ?? "—"}
                  </td>
                </tr>
              ))}
              {data.patients.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-text/60">Belum ada pasien.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
