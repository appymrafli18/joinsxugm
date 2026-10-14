"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { ArchetypeId } from "@/lib/profile";
import { SparkleIcon, Spinner } from "@/components/auth/AuthParts";
import { BottomNav } from "@/components/beranda/BottomNav";

/* ---------- konstanta ---------- */

const IMG_DIR = "/images/home";
const HERO_SRC = `${IMG_DIR}/home_asset-hero.svg`;
const MISI_ICON_SRC = `${IMG_DIR}/home_icon-misi.svg`;
const MISI_CARD_SRC = `${IMG_DIR}/home_icon-misi-1.svg`;
const PERJALANAN_SRC = `${IMG_DIR}/home_icon-perjalanan.svg`;

/**
 * Poin untuk 1 sesi konsultasi gratis. Nilai sementara, menunggu keputusan
 * harga final. Idealnya dipindah ke satu file konstanta bersama.
 */
const FREE_SESSION_POINTS = 500;

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60";

/** Sparkle dekorasi */
const SPARKLES: { className: string; delay: string }[] = [
  { className: "right-[12%] top-[4%] h-4 w-4", delay: "0s" },
  { className: "left-[8%] top-[16%] h-3 w-3", delay: "1.5s" },
  { className: "right-[6%] top-[22%] h-5 w-5", delay: "0.8s" },
  { className: "left-[18%] top-[28%] h-3 w-3", delay: "2.3s" },
];

/** Label arketipe, dipakai untuk teks alternatif gambar */
const ARCHETYPE_LABEL: Record<ArchetypeId, string> = {
  guardian: "Guardian",
  healer: "Healer",
  scholar: "Scholar",
  companion: "Companion",
};

/* ---------- tipe data ---------- */

type BerandaData = {
  nickname: string;
  archetypeId: ArchetypeId;
  streak: number;
  questTitle: string | null;
  questProgress: number;
  questTarget: number;
  totalPoints: number;
  journeyPercent: number;
};

type BerandaResult =
  | { status: "ok"; data: BerandaData }
  | { status: "no-session" }
  | { status: "no-archetype" };

/* ---------- ikon inline ---------- */

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function FireIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <path d="M8 16c3.3 0 6-2.5 6-5.9 0-2.4-1.5-4.5-2.4-5.6-.3-.4-.9-.1-.8.3.2 1.1-.2 2.3-1.2 3.2-.2.2-.5.1-.6-.1-.5-1.2-.4-2.9.1-4.5C9.6 1.7 8.3.7 7.1.1c-.4-.2-.8.2-.7.6.4 1.3.2 2.7-.6 3.8C4.3 6.5 2 8.5 2 10.9 2 13.8 4.2 16 8 16z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M8 0l2 5.3H16l-4.4 3.4L13.2 14 8 10.8 2.8 14l1.6-5.3L0 5.3h6L8 0z" />
    </svg>
  );
}

function HeartHandIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

/* ---------- helper ---------- */

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Hitung hari berturut-turut yang punya pesan pasien. */
function computeStreak(createdAts: string[]): number {
  const activeDays = new Set(createdAts.map((c) => dayKey(new Date(c))));
  const cursor = new Date();
  // Hari ini belum ada aktivitas: mulai hitung dari kemarin.
  if (!activeDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ---------- fetch data ---------- */

async function fetchBerandaData(): Promise<BerandaResult> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { status: "no-session" };
  const uid = userData.user.id;

  /* Profil pasien */
  const { data: patient } = await supabase
    .from("patients")
    .select("nickname, archetype_id, total_points")
    .eq("id", uid)
    .maybeSingle();

  if (!patient) return { status: "no-session" };
  if (!patient.archetype_id) return { status: "no-archetype" };

  /* Streak: pesan pasien 60 hari terakhir */
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const { data: chatRows } = await supabase
    .from("chat_logs")
    .select("created_at")
    .eq("patient_id", uid)
    .eq("role", "user")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);

  const streak = computeStreak((chatRows ?? []).map((r) => r.created_at));

  /* Misi aktif terbaru (kolom progres ada di schema v2.1) */
  const { data: quest } = await supabase
    .from("quests")
    .select("title, progress_value, target_value")
    .eq("patient_id", uid)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  /* Perjalanan: progres poin menuju 1 sesi konsultasi gratis */
  const totalPoints = patient.total_points ?? 0;
  const journeyPercent = Math.min(
    100,
    Math.round((totalPoints / FREE_SESSION_POINTS) * 100)
  );

  return {
    status: "ok",
    data: {
      nickname: patient.nickname,
      archetypeId: patient.archetype_id as ArchetypeId,
      streak,
      questTitle: quest?.title ?? null,
      questProgress: quest?.progress_value ?? 0,
      questTarget: quest?.target_value ?? 0,
      totalPoints,
      journeyPercent,
    },
  };
}

/* ---------- komponen utama ---------- */

export function BerandaScreen() {
  const router = useRouter();
  const [data, setData] = useState<BerandaData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const result = await fetchBerandaData();
      if (cancelled) return;
      if (result.status === "no-session") {
        router.replace("/login");
        return;
      }
      if (result.status === "no-archetype") {
        router.replace("/pilih-arketipe");
        return;
      }
      setData(result.data);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base" aria-busy="true">
        <Spinner />
      </div>
    );
  }

  const hasQuest = data.questTitle !== null && data.questTarget > 0;
  const questPercent = hasQuest
    ? Math.min(100, (data.questProgress / data.questTarget) * 100)
    : 0;

  return (
    <div className="relative flex min-h-dvh flex-col bg-base pb-28">
      {/* ====== HERO ====== */}
      <section className="relative h-[clamp(260px,42dvh,360px)] shrink-0 overflow-hidden bg-gradient-to-b from-companion-card via-healer-card/40 to-base">
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 top-4 h-52 w-52 rounded-full bg-guardian/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 top-20 h-44 w-44 rounded-full bg-cta/15 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute left-1/3 top-1/2 h-32 w-32 rounded-full bg-sparkle/20 blur-2xl" />

        {SPARKLES.map((s, i) => (
          <SparkleIcon
            key={i}
            className={`login-twinkle pointer-events-none absolute text-sparkle ${s.className}`}
            style={{ animationDelay: s.delay } as CSSProperties}
          />
        ))}

        {/* Bubble ucapan */}
        <div className="beranda-rise absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] z-10 max-w-[52%] rounded-xl2 rounded-tl-md bg-white/90 px-4 py-3 shadow-float backdrop-blur-sm">
          <p className="text-[13px] leading-snug">
            <span className="font-display text-[15px]">Halo!</span>
            <br />
            Gimana harimu hari ini?
          </p>
        </div>

        {/* Lonceng notifikasi (tampilan saja, belum ada backend) */}
        <button
          type="button"
          aria-label="Notifikasi"
          className={`absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-guardian shadow-float transition-transform active:scale-95 ${FOCUS_RING}`}
        >
          <BellIcon />
          <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-cta ring-2 ring-white" />
        </button>

        {/* Karakter hero.
            TODO: ganti per arketipe saat aset 4 arketipe sudah ada. */}
        <Image
          src={HERO_SRC}
          alt={`Karakter ${ARCHETYPE_LABEL[data.archetypeId]} menyapamu`}
          fill
          priority
          sizes="(max-width: 430px) 100vw, 430px"
          className="login-float object-cover object-top"
          unoptimized
        />
      </section>

      {/* ====== KARTU ====== */}
      <div className="relative z-20 -mt-6 flex flex-col gap-4 px-5">
        {/* --- Ngobrol dengan Companion --- */}
        <Link
          href="/companion"
          className={`beranda-rise group block overflow-hidden rounded-xl2 bg-gradient-to-r from-healer-card via-white to-companion-card/60 p-5 shadow-float ring-1 ring-healer/15 transition-all duration-300 hover:shadow-lg active:scale-[0.985] ${FOCUS_RING}`}
          style={{ animationDelay: "60ms" } as CSSProperties}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {data.streak > 0 ? (
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-cta/15 px-3 py-1 text-[11px] text-cta">
                  <FireIcon />
                  {data.streak} hari beruntun
                </span>
              ) : (
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-guardian/10 px-3 py-1 text-[11px] text-guardian">
                  <FireIcon />
                  Mulai streakmu!
                </span>
              )}

              <h2 className="font-display text-[20px] leading-tight">
                Ngobrol dengan
                <br />
                Companion
              </h2>
              <p className="mt-2 text-[12px] leading-relaxed text-text/65">
                Cerita, curhat, atau sekadar menemani harimu hari ini.
              </p>
            </div>

            <span className="mt-6 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cta text-white shadow-[0_6px_16px_rgba(227,119,155,0.35)] transition-transform duration-300 group-hover:translate-x-0.5">
              <ArrowIcon />
            </span>
          </div>
        </Link>

        {/* --- Misi Hari Ini --- */}
        <Link
          href="/perjalanan"
          className={`beranda-rise group flex items-center gap-4 overflow-hidden rounded-xl2 bg-white p-4 shadow-float ring-1 ring-guardian/10 transition-all duration-300 hover:shadow-lg active:scale-[0.985] ${FOCUS_RING}`}
          style={{ animationDelay: "140ms" } as CSSProperties}
        >
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
            <Image src={MISI_ICON_SRC} alt="" fill sizes="56px" className="object-cover" unoptimized />
          </div>

          <div className="min-w-0 flex-1">
            <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-sparkle/25 px-2 py-0.5 text-[10px] text-companion">
              <StarIcon />
              Quest CBT
            </span>
            <h3 className="font-display text-[15px] leading-tight">Misi Hari Ini</h3>
            <p className="mt-1 text-[11px] leading-snug text-text/60">
              {hasQuest
                ? data.questTitle
                : "Belum ada misi aktif. Yuk mulai satu di Perjalanan."}
            </p>

            {hasQuest && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-guardian/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-guardian to-scholar transition-all duration-500"
                    style={{ width: `${questPercent}%` }}
                  />
                </div>
                <span className="text-[11px] text-text/50">
                  {data.questProgress}/{data.questTarget}
                </span>
              </div>
            )}
          </div>

          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
            <Image src={MISI_CARD_SRC} alt="" fill sizes="64px" className="object-cover" unoptimized />
          </div>

          <span className="shrink-0 text-text/30 transition-colors group-hover:text-text/60">
            <ChevronRight />
          </span>
        </Link>

        {/* --- Perjalananmu --- */}
        <Link
          href="/perjalanan"
          className={`beranda-rise group block overflow-hidden rounded-xl2 bg-gradient-to-r from-guardian-card to-healer-card/60 p-4 shadow-float ring-1 ring-guardian/10 transition-all duration-300 hover:shadow-lg active:scale-[0.985] ${FOCUS_RING}`}
          style={{ animationDelay: "220ms" } as CSSProperties}
        >
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              <Image src={PERJALANAN_SRC} alt="" fill sizes="56px" className="object-cover" unoptimized />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-display text-[15px] leading-tight">Perjalananmu</h3>
              <p className="mt-1 text-[11px] leading-snug text-text/60">
                Setiap langkah kecil juga berarti. Kamu sudah sejauh ini!
              </p>

              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-guardian to-cta transition-all duration-500"
                    style={{ width: `${data.journeyPercent}%` }}
                  />
                </div>
                <span className="text-[11px] text-text/55">{data.journeyPercent}%</span>
              </div>
            </div>

            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/70 text-text/40 transition-colors group-hover:text-text/70">
              <ChevronRight />
            </span>
          </div>
        </Link>

        {/* --- Bicara dengan Psikolog (pintu masuk konsultasi berbayar) --- */}
        <Link
          href="/psikolog"
          className={`beranda-rise group flex items-center gap-3 overflow-hidden rounded-xl2 bg-white p-4 shadow-float ring-1 ring-guardian/10 transition-all duration-300 hover:shadow-lg active:scale-[0.985] ${FOCUS_RING}`}
          style={{ animationDelay: "300ms" } as CSSProperties}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-guardian/10 text-guardian">
            <HeartHandIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[14px] leading-tight">Bicara dengan Psikolog</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-text/60">
              Konsultasi berbayar dengan psikolog profesional.
            </p>
          </div>
          <span className="shrink-0 text-text/30 transition-colors group-hover:text-text/60">
            <ChevronRight />
          </span>
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}