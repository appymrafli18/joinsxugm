"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BottomNav } from "@/components/nav/BottomNav";
import {
  FREE_SESSION_POINTS,
  QUEST_TEMPLATES,
  getTotalPoints,
  type QuestCategory,
  type QuestTemplate,
} from "@/lib/quests";

/*
 * Pemetaan aset. Urutan misi-1/2/3 adalah ASUMSI (tirai, sepatu, peta).
 * Kalau isi file berbeda, cukup tukar path di sini. `sosial: null` memakai ilustrasi bawaan di kode.
 */
const ASSETS = {
  topBg: "/images/misi/asset_top-bg.svg",
  progress: "/images/misi/asset_progress.svg",
  quest: {
    indoor_ringan: "/images/misi/asset_misi-1.svg",
    outdoor_ringan: "/images/misi/asset_misi-2.svg",
    outdoor_sedang: "/images/misi/asset_misi-3.svg",
    sosial: null,
  },
} satisfies {
  topBg: string;
  progress: string;
  quest: Record<QuestCategory, string | null>;
};

const COMING_SOON = "Fitur ini segera tersedia.";
const TOAST_MS = 2400;

type CategoryTheme = {
  card: string;
  border: string;
  tile: string;
  chip: string;
  chipText: string;
  button: string;
  barTrack: string;
  barFill: string;
};

/* Warna ESTIMASI dari desain. Ambil hex pasti dengan eyedropper di Figma, ubah di sini saja. */
const THEMES: Record<QuestCategory, CategoryTheme> = {
  indoor_ringan: {
    card: "#EFE6FB",
    border: "#E2D5F6",
    tile: "#E6DAF8",
    chip: "#E3D6F8",
    chipText: "#7C5BC4",
    button: "#9E7BE2",
    barTrack: "#DCCFF3",
    barFill: "#B79BEB",
  },
  outdoor_ringan: {
    card: "#FDEDE4",
    border: "#F8DCCF",
    tile: "#FBE0D2",
    chip: "#FBD9CB",
    chipText: "#D9674A",
    button: "#F2916B",
    barTrack: "#F8DCCF",
    barFill: "#F2916B",
  },
  outdoor_sedang: {
    card: "#EBF3E7",
    border: "#D9E8D3",
    tile: "#DDEBD6",
    chip: "#D3E6CB",
    chipText: "#4F8A56",
    button: "#6FA06F",
    barTrack: "#D9E8D3",
    barFill: "#6FA06F",
  },
  sosial: {
    card: "#FCE8F0",
    border: "#F7D3E3",
    tile: "#F9DDEA",
    chip: "#F9D3E3",
    chipText: "#D2468A",
    button: "#DB6AA5",
    barTrack: "#F7D3E3",
    barFill: "#DB6AA5",
  },
};

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60";

/* ---------- ikon ---------- */

function StrokeIcon({ children, className = "h-4 w-4" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

const ChevronIcon = ({ className }: { className?: string }) => (
  <StrokeIcon className={className}>
    <path d="m9 6 6 6-6 6" />
  </StrokeIcon>
);

const ClockIcon = () => (
  <StrokeIcon className="h-[18px] w-[18px]">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </StrokeIcon>
);

const PinIcon = () => (
  <StrokeIcon className="h-[18px] w-[18px]">
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </StrokeIcon>
);

const MapIcon = () => (
  <StrokeIcon className="h-[18px] w-[18px]">
    <path d="M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </StrokeIcon>
);

const DocIcon = () => (
  <StrokeIcon className="h-[18px] w-[18px]">
    <path d="M7 3h7l5 5v13H7z" />
    <path d="M14 3v5h5M10 13h6M10 17h6" />
  </StrokeIcon>
);

function StarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
    </svg>
  );
}

/** Ilustrasi bawaan untuk misi sosial (belum ada aset di folder misi). */
function ChatArt() {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className="h-full w-full p-2.5">
      <rect x="8" y="10" width="34" height="26" rx="12" fill="#A98BE0" />
      <path d="M16 34l-4 9 11-6z" fill="#A98BE0" />
      <circle cx="18" cy="23" r="2.3" fill="#fff" />
      <circle cx="25" cy="23" r="2.3" fill="#fff" />
      <circle cx="32" cy="23" r="2.3" fill="#fff" />
      <rect x="26" y="28" width="30" height="24" rx="11" fill="#F29BC0" />
      <path d="M46 50l5 8-12-5z" fill="#F29BC0" />
      <circle cx="35" cy="40" r="2.1" fill="#fff" />
      <circle cx="41" cy="40" r="2.1" fill="#fff" />
      <circle cx="47" cy="40" r="2.1" fill="#fff" />
    </svg>
  );
}

/* ---------- kartu misi ---------- */

type QuestCardProps = {
  quest: QuestTemplate;
  index: number;
  onStart: (quest: QuestTemplate) => void;
  onSoon: () => void;
};

function QuestMetaRow({ quest, onSoon }: { quest: QuestTemplate; onSoon: () => void }) {
  const { meta } = quest;
  const theme = THEMES[quest.category];

  if (meta.kind === "timer") {
    const pct = Math.min(100, Math.round((meta.current / meta.target) * 100));
    return (
      <div className="min-w-0 flex-1 text-text/70">
        <p className="flex items-center gap-1.5 text-xs">
          <ClockIcon />
          <span>
            {meta.current} / {meta.target} menit
          </span>
        </p>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full" style={{ background: theme.barTrack }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, minWidth: "6px", background: theme.barFill }}
          />
        </div>
      </div>
    );
  }

  if (meta.kind === "report") {
    return (
      <p className="flex min-w-0 flex-1 items-start gap-1.5 text-xs leading-snug text-text/70">
        <span className="mt-px shrink-0">
          <DocIcon />
        </span>
        <span>{meta.label}</span>
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={onSoon}
      className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md text-left text-xs text-text/70 ${FOCUS_RING}`}
    >
      {meta.kind === "gps" ? <PinIcon /> : <MapIcon />}
      <span className="truncate">{meta.label}</span>
      <ChevronIcon className="h-3.5 w-3.5 shrink-0" />
    </button>
  );
}

function QuestCard({ quest, index, onStart, onSoon }: QuestCardProps) {
  const theme = THEMES[quest.category];
  const art = ASSETS.quest[quest.category];

  return (
    <article
      className="login-rise flex gap-3 rounded-3xl p-4 shadow-float ring-1"
      style={{
        background: theme.card,
        animationDelay: `${120 + index * 70}ms`,
        // @ts-expect-error variabel CSS untuk warna ring
        "--tw-ring-color": theme.border,
      }}
    >
      <div
        className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl"
        style={{ background: theme.tile }}
      >
        {art ? (
          <Image src={art} alt="" fill sizes="72px" className="object-cover" unoptimized />
        ) : quest.category === "sosial" ? (
          <ChatArt />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-xs leading-none"
            style={{ background: theme.chip, color: theme.chipText }}
          >
            {quest.categoryLabel}
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#FBE3B0] px-2.5 py-1 text-xs leading-none text-[#DD6B55]">
            <StarIcon className="h-3.5 w-3.5" />+{quest.points} poin
          </span>
        </div>

        <h2 className="mt-2 font-display text-lg leading-snug">{quest.title}</h2>
        <p className="mt-0.5 text-[13px] leading-snug text-text/80">{quest.description}</p>

        <div className="mt-3 flex items-end justify-between gap-3">
          <QuestMetaRow quest={quest} onSoon={onSoon} />
          <button
            type="button"
            onClick={() => onStart(quest)}
            className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full px-5 text-sm text-white shadow-float transition-transform active:scale-[0.97] ${FOCUS_RING}`}
            style={{ background: theme.button }}
          >
            Mulai
            <ChevronIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

/* ---------- halaman ---------- */

export function MisiScreen() {
  const router = useRouter();
  const [points, setPoints] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    getTotalPoints().then((result) => {
      if (!active) return;
      if (result.ok) setPoints(result.points);
      else if (result.reason === "no_session") router.replace("/login");
      else setLoadFailed(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const handleStart = useCallback(
    (quest: QuestTemplate) => {
      // TODO: arahkan ke alur misi (timer / GPS / laporan) lewat router.push(`/misi/${quest.id}`).
      void quest;
      notify(COMING_SOON);
    },
    [notify],
  );

  const safePoints = points ?? 0;
  const remaining = Math.max(0, FREE_SESSION_POINTS - safePoints);
  const percent = Math.min(100, Math.round((safePoints / FREE_SESSION_POINTS) * 100));

  const progressLabel = loadFailed
    ? "Poinmu belum bisa dimuat"
    : points === null
      ? "Memuat poinmu..."
      : remaining === 0
        ? "Poinmu cukup untuk menukar"
        : `${remaining} poin lagi menuju`;

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-base pb-[140px] font-body text-text">
      {/* Latar atas */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[300px]">
        <Image
          src={ASSETS.topBg}
          alt=""
          fill
          priority
          sizes="(max-width: 430px) 100vw, 430px"
          className="object-cover object-top"
          unoptimized
        />
      </div>

      <div className="relative z-10 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {/* Header */}
        <header className="login-rise flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] leading-tight">Misi Hari Ini</h1>
            <p className="mt-1 text-sm text-[#7B65A8]">Langkah kecil, progres besar</p>
          </div>
          <p
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#FBE3B0] px-4 py-2 text-base text-[#DD6B55] shadow-float"
            aria-label={points === null ? "Poin sedang dimuat" : `${points} poin`}
          >
            <StarIcon className="h-5 w-5" />
            <span>{points === null ? "…" : points} poin</span>
          </p>
        </header>

        {/* Progres menuju konsultasi gratis */}
        <section
          className="login-rise mt-5 flex items-center gap-4 rounded-3xl bg-white/80 p-4 shadow-float ring-1 ring-guardian/15 backdrop-blur-md"
          style={{ animationDelay: "60ms" }}
        >
          <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-guardian-card">
            <Image src={ASSETS.progress} alt="" fill sizes="72px" className="object-cover" unoptimized />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[#7B65A8]">{progressLabel}</p>
            <h2 className="font-display text-base leading-snug">1 Sesi Konsultasi Gratis</h2>
            <div
              role="progressbar"
              aria-label="Progres poin menuju konsultasi gratis"
              aria-valuemin={0}
              aria-valuemax={FREE_SESSION_POINTS}
              aria-valuenow={safePoints}
              className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#E4DAF5]"
            >
              <div
                className="h-full rounded-full bg-linear-to-r from-[#A98BE8] to-[#BFA5F0] transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-text/60">
              {points === null ? "–" : safePoints} / {FREE_SESSION_POINTS} poin
            </p>
          </div>

          <button
            type="button"
            onClick={() => notify("Penukaran poin segera tersedia.")}
            aria-label="Lihat penukaran poin"
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#7B65A8] ${FOCUS_RING}`}
          >
            <ChevronIcon className="h-6 w-6" />
          </button>
        </section>

        {/* Daftar misi */}
        <ul className="mt-4 flex flex-col gap-4">
          {QUEST_TEMPLATES.map((quest, index) => (
            <li key={quest.id}>
              <QuestCard
                quest={quest}
                index={index}
                onStart={handleStart}
                onSoon={() => notify(COMING_SOON)}
              />
            </li>
          ))}
        </ul>
      </div>

      <BottomNav />

      {/* Pemberitahuan singkat */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[104px] z-50 flex justify-center px-4"
      >
        {toast && (
          <p className="rounded-full bg-text/90 px-4 py-2 text-xs text-white shadow-float">{toast}</p>
        )}
      </div>
    </main>
  );
}