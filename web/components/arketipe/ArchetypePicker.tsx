"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, type CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  saveScreeningFromStorage,
  saveArchetype,
  type ArchetypeId,
} from "@/lib/profile";
import { SparkleIcon, Spinner } from "@/components/auth/AuthParts";

const IMG_DIR = "/images/pilih-arkatipe";

const ARCHETYPES = [
  {
    id: "guardian" as ArchetypeId,
    name: "The Guardian",
    tagline: "Selalu siaga, selalu ada.",
    img: `${IMG_DIR}/arkatipe_guardian.svg`,
  },
  {
    id: "healer" as ArchetypeId,
    name: "The Healer",
    tagline: "Lembut, hangat, menenangkan.",
    img: `${IMG_DIR}/arkatipe_healer.svg`,
  },
  {
    id: "scholar" as ArchetypeId,
    name: "The Scholar",
    tagline: "Berpikir jernih, melihat lebih jauh.",
    img: `${IMG_DIR}/arkatipe_scholar.svg`,
  },
  {
    id: "companion" as ArchetypeId,
    name: "The Companion",
    tagline: "Berpikir jernih, melihat lebih jauh.",
    img: `${IMG_DIR}/arkatipe_companion.svg`,
  },
] as const;

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60";

/** Warna per arketipe — dipakai untuk border glow & radio dot */
const COLOR: Record<ArchetypeId, { ring: string; bg: string; card: string; dot: string }> = {
  guardian: {
    ring: "ring-guardian",
    bg: "bg-guardian-card",
    card: "bg-guardian-card",
    dot: "bg-guardian",
  },
  healer: {
    ring: "ring-healer",
    bg: "bg-healer-card",
    card: "bg-healer-card",
    dot: "bg-healer",
  },
  scholar: {
    ring: "ring-scholar",
    bg: "bg-scholar-card",
    card: "bg-scholar-card",
    dot: "bg-scholar",
  },
  companion: {
    ring: "ring-companion",
    bg: "bg-companion-card",
    card: "bg-companion-card",
    dot: "bg-companion",
  },
};

/* ---------- dekorasi sparkle ---------- */

const SPARKLES: { className: string; delay: string }[] = [
  { className: "left-[6%] top-[18%] h-5 w-5", delay: "0s" },
  { className: "right-[8%] top-[6%] h-4 w-4", delay: "1.4s" },
  { className: "left-[12%] bottom-[22%] h-3 w-3", delay: "2.2s" },
  { className: "right-[5%] bottom-[32%] h-5 w-5", delay: "0.7s" },
];

/* ---------- komponen ---------- */

export function ArchetypePicker() {
  const router = useRouter();
  const [selected, setSelected] = useState<ArchetypeId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const hasRunRef = useRef(false);

  /* Guard: redirect ke /login kalau belum ada sesi */
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setAuthChecked(true);
    }
    check();
    return () => { cancelled = true; };
  }, [router]);

  /* Saat mount: coba simpan screening yang belum tersimpan */
  useEffect(() => {
    if (!authChecked || hasRunRef.current) return;
    hasRunRef.current = true;
    saveScreeningFromStorage();
  }, [authChecked]);

  async function handleConfirm() {
    if (!selected || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    const ok = await saveArchetype(selected);
    if (ok) {
      router.replace("/beranda");
    } else {
      setError("Gagal menyimpan pilihanmu. Coba lagi ya.");
      setIsSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base" aria-busy="true">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="arketipe-page relative flex min-h-dvh flex-col overflow-x-hidden bg-base pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      {/* Blur blobs dekorasi */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-guardian/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 top-12 h-48 w-48 rounded-full bg-cta/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-healer/10 blur-3xl"
      />

      {/* Sparkle stars */}
      {SPARKLES.map((s, i) => (
        <SparkleIcon
          key={i}
          className={`login-twinkle pointer-events-none absolute text-sparkle ${s.className}`}
          style={{ animationDelay: s.delay } as CSSProperties}
        />
      ))}

      {/* Header */}
      <header className="arketipe-rise relative z-10 px-6 text-center">
        <h1 className="font-display text-[24px] leading-tight">
          Pilih Wujud Pendampingmu
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text/70">
          Kamu bisa menggantinya kapan saja nanti
        </p>
      </header>

      {/* Grid arketipe */}
      <div
        role="radiogroup"
        aria-label="Pilih arketipe pendamping"
        className="arketipe-rise relative z-10 mt-6 grid grid-cols-2 gap-4 px-5"
        style={{ animationDelay: "100ms" } as CSSProperties}
      >
        {ARCHETYPES.map((arch) => {
          const isSelected = selected === arch.id;
          const colors = COLOR[arch.id];
          return (
            <button
              key={arch.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${arch.name} — ${arch.tagline}`}
              onClick={() => {
                setSelected(arch.id);
                setError(null);
              }}
              className={[
                "arketipe-card group relative flex min-h-[44px] flex-col overflow-hidden rounded-xl2 ring-2 transition-all duration-300",
                isSelected
                  ? `${colors.ring} shadow-[0_0_20px_rgba(245,217,166,0.45)] ring-sparkle`
                  : "ring-transparent shadow-float hover:ring-guardian/30",
                colors.card,
                FOCUS_RING,
              ].join(" ")}
            >
              {/* Ilustrasi karakter */}
              <div className="relative aspect-square w-full overflow-hidden rounded-t-xl2">
                <Image
                  src={arch.img}
                  alt={`Ilustrasi ${arch.name}`}
                  fill
                  sizes="(max-width: 430px) 45vw, 190px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  unoptimized
                />
              </div>

              {/* Label */}
              <div className="flex items-start gap-2 px-3 pb-3 pt-2.5">
                {/* Radio dot */}
                <span
                  aria-hidden="true"
                  className={[
                    "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
                    isSelected
                      ? `border-sparkle ${colors.dot}`
                      : "border-text/25 bg-white",
                  ].join(" ")}
                >
                  {isSelected && (
                    <span className="block h-2 w-2 rounded-full bg-white" />
                  )}
                </span>

                <div className="min-w-0 text-left">
                  <p className="text-[13px] font-display leading-tight">{arch.name}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-text/60">
                    {arch.tagline}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Error */}
      <div aria-live="assertive" className="relative z-10 px-6">
        {error && (
          <p
            role="alert"
            className="arketipe-rise mt-4 rounded-xl2 bg-healer-card px-4 py-3 text-center text-[13px] leading-snug text-[#8F3A57]"
          >
            {error}
          </p>
        )}
      </div>

      {/* Tombol CTA */}
      <div
        className="arketipe-rise relative z-10 mt-auto px-6 pt-6"
        style={{ animationDelay: "200ms" } as CSSProperties}
      >
        <button
          type="button"
          disabled={!selected || isSubmitting}
          onClick={handleConfirm}
          className={[
            "flex h-[54px] w-full items-center justify-center gap-2 rounded-full text-base text-white transition-[transform,opacity,background-color] duration-300 active:scale-[0.98]",
            selected
              ? "bg-cta shadow-[0_10px_24px_rgba(227,119,155,0.35)]"
              : "bg-cta/40 cursor-not-allowed",
            "disabled:opacity-70",
            FOCUS_RING,
          ].join(" ")}
        >
          {isSubmitting ? (
            <>
              <Spinner />
              <span>Menyimpan...</span>
            </>
          ) : (
            "Lanjutkan →"
          )}
        </button>
      </div>

      {/* Bintang dekoratif dari aset */}
      <Image
        src={`${IMG_DIR}/asset_bintang.svg`}
        alt=""
        aria-hidden="true"
        width={34}
        height={39}
        className="login-twinkle pointer-events-none absolute right-4 top-[13%]"
        style={{ animationDelay: "0.3s" } as CSSProperties}
        unoptimized
      />
      <Image
        src={`${IMG_DIR}/asset_bintang-2.svg`}
        alt=""
        aria-hidden="true"
        width={26}
        height={45}
        className="login-twinkle pointer-events-none absolute left-3 top-[52%]"
        style={{ animationDelay: "1.8s" } as CSSProperties}
        unoptimized
      />
    </div>
  );
}
