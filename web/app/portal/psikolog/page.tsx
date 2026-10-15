"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { portalFetch, portalSignOut } from "@/lib/portalClient";

type Profile = {
  id: string;
  full_name: string;
  license_number: string;
  license_document_url: string | null;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  nickname: string | null;
  avatar_url: string | null;
  education: string | null;
  specialization: string | null;
  price_per_session: number | null;
  is_on_call: boolean;
};

type PatientRow = {
  id: string;
  nickname: string;
  archetype_id: string;
  tier: string;
  total_points: number;
  data_sharing_consent: boolean;
  assigned_psychologist_id: string | null;
  created_at: string;
  latestSentiment: { stabil: number; cemas: number; date: string } | null;
};

type AlertRow = {
  id: string;
  patient_id: string;
  patient_nickname: string | null;
  trigger_excerpt: string | null;
  status: "pending" | "acknowledged" | "escalated" | "resolved";
  acknowledged_by: string | null;
  created_at: string;
};

type BookingRow = {
  id: string;
  patient_id: string;
  patient_nickname: string | null;
  scheduled_at: string;
  status: string;
  payment_status: string;
  session_mode: string;
  price: number;
  points_used: number;
  duration_minutes: number;
  patient_note: string | null;
};

type DashboardData = {
  profile: Profile;
  patients: PatientRow[];
  alerts: AlertRow[];
  bookings: BookingRow[];
  counts: { patients: number; consented: number; alertsPending: number; alertsEscalated: number; bookingsUpcoming: number };
};

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-sparkle/40 text-[#8A6D2F]",
  acknowledged: "bg-guardian-card text-[#6E4FB5]",
  escalated: "bg-terracotta/15 text-terracotta",
  resolved: "bg-sage/20 text-[#4F7A57]",
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl2 bg-white p-4 shadow-float">
      <p className="text-[11px] text-text/60">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function PortalPsikologPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* Form profil */
  const [nickname, setNickname] = useState("");
  const [fullName, setFullName] = useState("");
  const [education, setEducation] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [price, setPrice] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    let active = true;
    void portalFetch<DashboardData>("/api/portal/psikolog").then((result) => {
      if (!active) return;
      if (!result.ok) {
        if (result.status === 401) {
          router.replace("/portal");
          return;
        }
        setError(result.message);
        return;
      }
      const payload = result.data;
      setData(payload);
      setNickname(payload.profile.nickname ?? "");
      setFullName(payload.profile.full_name ?? "");
      setEducation(payload.profile.education ?? "");
      setSpecialization(payload.profile.specialization ?? "");
      setPrice(payload.profile.price_per_session ? String(payload.profile.price_per_session) : "");
      setAvatarUrl(payload.profile.avatar_url ?? "");
    });
    return () => {
      active = false;
    };
  }, [router]);

  const verified = data?.profile.verification_status === "verified";

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await portalFetch<{ profile: Profile }>("/api/portal/psikolog", {
      method: "POST",
      body: {
        action: "profile",
        nickname,
        full_name: fullName,
        education,
        specialization,
        avatar_url: avatarUrl,
        price_per_session: Number(price) || 0,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setData((current) => (current ? { ...current, profile: result.data.profile } : current));
    setNotice("Profil publik tersimpan.");
  }

  async function toggleOnCall() {
    if (!data || busy) return;
    setBusy(true);
    setError(null);
    const next = !data.profile.is_on_call;
    const result = await portalFetch<{ is_on_call: boolean }>("/api/portal/psikolog", {
      method: "POST",
      body: { action: "oncall", is_on_call: next },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setData({ ...data, profile: { ...data.profile, is_on_call: result.data.is_on_call } });
    setNotice(next ? "Kamu kini menerima notifikasi krisis (on-call)." : "Status on-call dimatikan.");
  }

  async function handleAlert(alert: AlertRow, status: "acknowledged" | "escalated" | "resolved") {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await portalFetch<{ alert: AlertRow }>("/api/portal/psikolog", {
      method: "POST",
      body: { action: "alert-ack", alertId: alert.id, status },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setData((current) =>
      current ? { ...current, alerts: current.alerts.map((a) => (a.id === alert.id ? { ...a, status } : a)) } : current,
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
        <p className="text-sm text-text/60">Memuat dashboard…</p>
      </div>
    );
  }

  const { profile } = data;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Dashboard Psikolog</h1>
          <p className="mt-1 text-[12px] text-text/60">
            {profile.nickname ?? "—"} · {profile.full_name} · STR {profile.license_number}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[11px] ${STATUS_STYLE[profile.verification_status] ?? ""}`}>
            {profile.verification_status}
          </span>
          <button
            type="button"
            onClick={() => void portalSignOut().then(() => router.replace("/portal"))}
            className={`h-10 rounded-full bg-white px-5 text-[12px] shadow-float ring-1 ring-guardian/15 ${FOCUS_RING}`}
          >
            Keluar
          </button>
        </div>
      </header>

      {profile.verification_status === "pending" && (
        <p className="mt-4 rounded-xl2 bg-sparkle/30 px-4 py-3 text-[12px] leading-relaxed">
          Akunmu menunggu verifikasi admin (dokumen STR/SIPP diperiksa manual). Profil publik aktif setelah terverifikasi.
        </p>
      )}
      {profile.verification_status === "rejected" && (
        <p className="mt-4 rounded-xl2 bg-terracotta/10 px-4 py-3 text-[12px] leading-relaxed text-terracotta">
          Verifikasi ditolak{profile.rejection_reason ? `: ${profile.rejection_reason}` : "."} Hubungi admin untuk tindak lanjut.
        </p>
      )}
      {error && <p className="mt-4 rounded-xl2 bg-healer-card px-4 py-3 text-[12px] text-[#8F3A57]">{error}</p>}
      {notice && <p className="mt-4 rounded-xl2 bg-sage/20 px-4 py-3 text-[12px] text-[#4F7A57]">{notice}</p>}

      {/* Statistik */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Pasien ditangani" value={data.counts.patients} />
        <StatCard label="Consent aktif" value={data.counts.consented} />
        <StatCard label="Alert pending" value={data.counts.alertsPending} />
        <StatCard label="Alert escalated" value={data.counts.alertsEscalated} />
        <StatCard label="Sesi terjadwal" value={data.counts.bookingsUpcoming} />
      </section>

      {/* On-call */}
      <section className="mt-6 rounded-xl2 bg-white p-4 shadow-float">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[15px]">Status On-Call</h2>
            <p className="mt-1 text-[11px] text-text/60">
              Saat aktif, kamu menerima peringatan krisis (termasuk pasien yang belum ditugaskan).
            </p>
          </div>
          <button
            type="button"
            disabled={!verified || busy}
            onClick={() => void toggleOnCall()}
            className={`flex h-10 items-center gap-2 rounded-full px-5 text-[12px] shadow-float disabled:opacity-40 ${
              profile.is_on_call ? "bg-cta text-white" : "bg-white ring-1 ring-guardian/20"
            } ${FOCUS_RING}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${profile.is_on_call ? "bg-white" : "bg-text/30"}`} />
            {profile.is_on_call ? "Sedang on-call" : "Nonaktif"}
          </button>
        </div>
      </section>

      {/* Profil publik */}
      <section className="mt-6 rounded-xl2 bg-white p-5 shadow-float">
        <h2 className="font-display text-[15px]">Profil Publik</h2>
        <p className="mt-1 text-[11px] text-text/60">
          Urutan tampil di aplikasi pasien: nama samaran → nama asli + gelar → pendidikan.
        </p>
        <form onSubmit={saveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
            Nama samaran (alias VTuber)
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} required maxLength={40}
              className={`h-11 rounded-xl2 bg-base px-4 text-[13px] ring-1 ring-guardian/20 focus:ring-2 focus:ring-guardian outline-none ${FOCUS_RING}`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
            Nama asli + gelar
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120}
              className={`h-11 rounded-xl2 bg-base px-4 text-[13px] ring-1 ring-guardian/20 focus:ring-2 focus:ring-guardian outline-none ${FOCUS_RING}`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
            Pendidikan
            <input value={education} onChange={(e) => setEducation(e.target.value)} maxLength={200} placeholder="mis. S1 Psikologi UGM · M.Psi. Profesi"
              className={`h-11 rounded-xl2 bg-base px-4 text-[13px] ring-1 ring-guardian/20 focus:ring-2 focus:ring-guardian outline-none ${FOCUS_RING}`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
            Spesialisasi
            <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} maxLength={120} placeholder="mis. Kecemasan sosial"
              className={`h-11 rounded-xl2 bg-base px-4 text-[13px] ring-1 ring-guardian/20 focus:ring-2 focus:ring-guardian outline-none ${FOCUS_RING}`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
            Harga per sesi (Rp)
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="150000"
              className={`h-11 rounded-xl2 bg-base px-4 text-[13px] ring-1 ring-guardian/20 focus:ring-2 focus:ring-guardian outline-none ${FOCUS_RING}`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] text-text/70">
            URL avatar (gambar 2D)
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} maxLength={500} placeholder="https://…"
              className={`h-11 rounded-xl2 bg-base px-4 text-[13px] ring-1 ring-guardian/20 focus:ring-2 focus:ring-guardian outline-none ${FOCUS_RING}`} />
          </label>
          <div className="flex items-end gap-3 sm:col-span-2">
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Pratinjau avatar" className="h-14 w-14 rounded-full object-cover ring-2 ring-guardian/20" />
            )}
            <button
              type="submit"
              disabled={!verified || busy}
              className={`h-11 rounded-full bg-cta px-6 text-[13px] text-white disabled:opacity-40 ${FOCUS_RING}`}
            >
              {busy ? "Menyimpan…" : "Simpan Profil"}
            </button>
            {!verified && <p className="text-[11px] text-text/50">Aktif setelah verifikasi admin.</p>}
          </div>
        </form>
      </section>

      {/* Pusat peringatan krisis */}
      <section className="mt-6">
        <h2 className="font-display text-lg">Pusat Peringatan Krisis</h2>
        <p className="mt-1 text-[12px] text-text/60">Ditampilkan berdasarkan waktu terbaru. Tanggapi sesegera mungkin.</p>
        <div className="mt-3 flex flex-col gap-3">
          {data.alerts.map((alert) => (
            <article key={alert.id} className="rounded-xl2 bg-white p-4 shadow-float">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[14px]">{alert.patient_nickname ?? "Pasien"}</p>
                  <p className="mt-1 text-[11px] text-text/60">{formatTime(alert.created_at)}</p>
                  {alert.trigger_excerpt && (
                    <p className="mt-2 rounded-xl2 bg-base px-3 py-2 text-[12px] italic text-text/80">“{alert.trigger_excerpt}”</p>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] ${STATUS_STYLE[alert.status] ?? ""}`}>{alert.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy || alert.status !== "pending"} onClick={() => void handleAlert(alert, "acknowledged")}
                  className={`h-9 rounded-full bg-cta px-4 text-[12px] text-white disabled:opacity-40 ${FOCUS_RING}`}>Tanggapi</button>
                <button type="button" disabled={busy || alert.status === "resolved"} onClick={() => void handleAlert(alert, "escalated")}
                  className={`h-9 rounded-full bg-terracotta/10 px-4 text-[12px] text-terracotta ring-1 ring-terracotta/30 disabled:opacity-40 ${FOCUS_RING}`}>Eskalasi</button>
                <button type="button" disabled={busy || alert.status === "resolved"} onClick={() => void handleAlert(alert, "resolved")}
                  className={`h-9 rounded-full bg-white px-4 text-[12px] ring-1 ring-sage/40 disabled:opacity-40 ${FOCUS_RING}`}>Selesaikan</button>
              </div>
            </article>
          ))}
          {data.alerts.length === 0 && <p className="text-[12px] text-text/60">Tidak ada alert saat ini. Aman. 🌿</p>}
        </div>
      </section>

      {/* Pasien */}
      <section className="mt-8">
        <h2 className="font-display text-lg">Pasien yang Ditangani</h2>
        <p className="mt-1 text-[12px] text-text/60">
          Ringkasan sentimen berlabel <span className="italic">catatan AI — referensi awal</span>, bukan diagnosis. Selalu lakukan asesmen sendiri.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl2 bg-white shadow-float">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-guardian/10 text-[11px] text-text/60">
                <th className="px-4 py-3">Nama panggilan</th>
                <th className="px-4 py-3">Arketipe</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Consent</th>
                <th className="px-4 py-3">Sentimen terbaru (AI)</th>
              </tr>
            </thead>
            <tbody>
              {data.patients.map((p) => (
                <tr key={p.id} className="border-b border-guardian/5 last:border-0">
                  <td className="px-4 py-3">{p.nickname}</td>
                  <td className="px-4 py-3">{p.archetype_id}</td>
                  <td className="px-4 py-3">{p.tier}</td>
                  <td className="px-4 py-3">{p.data_sharing_consent ? "aktif" : "—"}</td>
                  <td className="px-4 py-3">
                    {p.latestSentiment
                      ? `${p.latestSentiment.date} · stabil ${p.latestSentiment.stabil} / cemas ${p.latestSentiment.cemas}`
                      : p.data_sharing_consent
                        ? "belum ada data"
                        : "menunggu consent"}
                  </td>
                </tr>
              ))}
              {data.patients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-text/60">Belum ada pasien yang ditugaskan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Booking */}
      <section className="mt-8">
        <h2 className="font-display text-lg">Sesi & Booking</h2>
        <div className="mt-3 overflow-x-auto rounded-xl2 bg-white shadow-float">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-guardian/10 text-[11px] text-text/60">
                <th className="px-4 py-3">Pasien</th>
                <th className="px-4 py-3">Jadwal</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Bayar</th>
                <th className="px-4 py-3">Catatan pasien</th>
              </tr>
            </thead>
            <tbody>
              {data.bookings.map((b) => (
                <tr key={b.id} className="border-b border-guardian/5 last:border-0">
                  <td className="px-4 py-3">{b.patient_nickname ?? "—"}</td>
                  <td className="px-4 py-3">{formatTime(b.scheduled_at)}</td>
                  <td className="px-4 py-3">{b.session_mode} · {b.duration_minutes} mnt</td>
                  <td className="px-4 py-3">{b.status}</td>
                  <td className="px-4 py-3">
                    {b.points_used > 0 ? `${b.points_used} poin` : `Rp${(b.price ?? 0).toLocaleString("id-ID")} · ${b.payment_status}`}
                  </td>
                  <td className="px-4 py-3 text-text/70">{b.patient_note ?? "—"}</td>
                </tr>
              ))}
              {data.bookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-text/60">Belum ada booking.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
