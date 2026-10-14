"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ANSWER_OPTIONS,
  ONBOARDING_QUESTIONS,
  type OnboardingQuestion,
} from "@/lib/questions";

const ANSWER_DELAY_MS = 400;
const NEXT_ROUTE = "/login";
const SCREENING_STORAGE_KEY = "vsikolog:screening-answers";

/** Lengkung bawah ilustrasi: 50% lebar x 11% tinggi (diukur dari desain 390x487). */
const CURVE_RADIUS = "50% 11%";

/**
 * Opsional: tempel isi atribut d="..." dari Figma (Copy as SVG) di sini
 * untuk memakai bentuk lengkung yang persis sama dengan desain.
 * Koordinatnya harus untuk area 390x487. Kosongkan ("") untuk memakai CURVE_RADIUS.
 */
const CURVE_PATH = "";
const HAS_CUSTOM_CURVE = CURVE_PATH.length > 0;

/** Kosongkan ("") setelah SVG diekspor ulang dengan corner radius 0. */
const IMAGE_BLEED_CLASS = "origin-top scale-[1.06]";

type OnboardingTheme = {
  imageAlt: string;
  imageSrc: string;
  showCardSparkle: boolean;
  /** Latar halaman */
  pageBg: string;
  /** Kartu pertanyaan + chip (token "card") */
  card: string;
  /** Warna arketipe (token DEFAULT), dipakai untuk menurunkan warna tombol */
  tone: string;
  /** Titik progres aktif */
  dot: string;
  /** Tombol jawaban terpilih */
  cta: string;
  /** Teks pertanyaan, chip, dan tombol */
  text: string;
};

/*
 * Nilai bertanda "token" diambil dari docs/design-tokens.md.
 * Nilai bertanda "ESTIMASI" ditebak dari screenshot desain.
 * Ambil hex yang pasti dengan eyedropper di Figma, lalu ganti di sini saja.
 */
const THEMES = {
  guardian: {
    imageAlt: "Ilustrasi The Guardian",
    imageSrc: "/images/illustrations/guardian_onboarding.svg",
    showCardSparkle: true,
    pageBg: "#FBF8FD", // token base
    card: "#EDE7F5", // token guardian.card
    tone: "#9B82C4", // token guardian
    dot: "#9B82C4", // token guardian
    cta: "#E3779B", // token cta
    text: "#4A2C73", // ESTIMASI
  },
  healer: {
    imageAlt: "Ilustrasi The Healer",
    imageSrc: "/images/illustrations/healer_onboarding.svg",
    showCardSparkle: false,
    pageBg: "#FFF6F8", // ESTIMASI
    card: "#FBEEF1", // token healer.card
    tone: "#E3A8B5", // token healer
    dot: "#EA5C8A", // ESTIMASI (di desain lebih pekat dari token)
    cta: "#EA5C8A", // ESTIMASI
    text: "#5A2B42", // ESTIMASI
  },
  scholar: {
    imageAlt: "Ilustrasi The Scholar",
    imageSrc: "/images/illustrations/scholar_onboarding.svg",
    showCardSparkle: false,
    pageBg: "#F6F7FC", // ESTIMASI
    card: "#EAECF8", // token scholar.card
    tone: "#7B88C4", // token scholar
    dot: "#5B4B8F", // ESTIMASI (di desain lebih pekat dari token)
    cta: "#5B4B8F", // ESTIMASI
    text: "#2F2B5C", // ESTIMASI
  },
} satisfies Record<"guardian" | "healer" | "scholar", OnboardingTheme>;

function getTheme(archetype: OnboardingQuestion["archetype"]): OnboardingTheme {
  return archetype === "companion" ? THEMES.guardian : THEMES[archetype];
}

const mix = (a: string, pct: number, b: string) =>
  `color-mix(in srgb, ${a} ${pct}%, ${b})`;

const curveStyle: CSSProperties = HAS_CUSTOM_CURVE
  ? { clipPath: "url(#onboarding-curve)" }
  : { borderBottomLeftRadius: CURVE_RADIUS, borderBottomRightRadius: CURVE_RADIUS };

type OnboardingQuestionTemplateProps = {
  isTransitioning: boolean;
  onAnswer: (value: number) => void;
  question: OnboardingQuestion;
  selectedAnswer: number | null;
  step: number;
  theme: OnboardingTheme;
};

function OnboardingQuestionTemplate({
  isTransitioning,
  onAnswer,
  question,
  selectedAnswer,
  step,
  theme,
}: OnboardingQuestionTemplateProps) {
  const buttonBg = mix(theme.card, 85, theme.tone);
  const chipText = mix(theme.text, 75, theme.pageBg);

  return (
    <main
      className="relative flex h-dvh flex-col overflow-hidden font-body"
      style={{ backgroundColor: theme.pageBg, color: theme.text }}
    >
      {HAS_CUSTOM_CURVE && (
        <svg width="0" height="0" aria-hidden="true" className="absolute">
          <defs>
            <clipPath id="onboarding-curve" clipPathUnits="objectBoundingBox">
              <path transform="scale(0.0025641 0.0020534)" d={CURVE_PATH} />
            </clipPath>
          </defs>
        </svg>
      )}

      <svg
        aria-hidden="true"
        viewBox="0 0 390 64"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-14 w-full"
        style={{ color: theme.card }}
      >
        <path
          d="M0 30C70 10 140 8 215 22S345 42 390 22V64H0Z"
          fill="currentColor"
          opacity="0.8"
        />
      </svg>

      <section
        className="relative z-10 h-[min(57.7dvh,124.9vw)] w-full shrink-0 overflow-hidden"
        style={{ backgroundColor: theme.card, ...curveStyle }}
      >
        <div
          className="onboarding-step-content onboarding-step-enter absolute inset-0"
          data-transitioning={isTransitioning}
        >
          <Image
            src={theme.imageSrc}
            alt={theme.imageAlt}
            fill
            className={`object-cover object-top ${IMAGE_BLEED_CLASS}`}
            sizes="(max-width: 430px) 100vw, 430px"
            priority={step === 0}
            unoptimized
          />
        </div>
      </section>

      <section
        className="onboarding-step-content onboarding-step-enter relative z-10 flex min-h-0 flex-1 flex-col items-center px-[22px] pb-[max(2.75rem,calc(env(safe-area-inset-bottom)+1.5rem))]"
        data-transitioning={isTransitioning}
      >
        <div
          className="mt-5 flex gap-2"
          role="img"
          aria-label={`Progres pertanyaan ${step + 1} dari ${ONBOARDING_QUESTIONS.length}`}
        >
          {ONBOARDING_QUESTIONS.map((_, index) => (
            <span
              key={index}
              className={`h-2.5 w-2.5 rounded-full ${index <= step ? "" : "bg-text/15"}`}
              style={index <= step ? { backgroundColor: theme.dot } : undefined}
            />
          ))}
        </div>

        <p
          className="mt-5 rounded-full px-3 py-1 text-xs"
          style={{ backgroundColor: theme.card, color: chipText }}
        >
          Pertanyaan {step + 1} dari {ONBOARDING_QUESTIONS.length}
        </p>

        <div className="mt-4 flex w-full min-h-0 flex-1 items-center">
          <div className="relative w-full">
            {theme.showCardSparkle && (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="absolute -left-1 -top-3 z-10 h-6 w-6 text-sparkle"
              >
                <path d="M12 0c.7 6.2 5.8 11.3 12 12-6.2.7-11.3 5.8-12 12-.7-6.2-5.8-11.3-12-12C6.2 11.3 11.3 6.2 12 0z" />
              </svg>
            )}
            <h1
              id="onboarding-question"
              className="flex min-h-[112px] w-full items-center justify-center rounded-xl2 px-5 py-6 text-center text-[clamp(16px,5vw,20px)] leading-[1.5] shadow-float"
              style={{ backgroundColor: theme.card }}
            >
              {question.text}
            </h1>
          </div>
        </div>

        <div
          className="mt-4 grid w-full grid-cols-3 gap-3"
          role="radiogroup"
          aria-labelledby="onboarding-question"
        >
          {ANSWER_OPTIONS.map((option) => {
            const isSelected = selectedAnswer === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={isTransitioning}
                onClick={() => onAnswer(option.value)}
                className="h-[46px] rounded-full px-2 text-xs shadow-float transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60"
                style={{
                  backgroundColor: isSelected ? theme.cta : buttonBg,
                  color: isSelected ? "#FFFFFF" : theme.text,
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const answersRef = useRef<number[]>([]);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    Object.values(THEMES).forEach((t) => {
      const img = new window.Image();
      img.src = t.imageSrc;
    });

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const question = ONBOARDING_QUESTIONS[step];
  const theme = getTheme(question.archetype);

  function selectAnswer(value: number) {
    if (isTransitioning) {
      return;
    }

    setSelectedAnswer(value);
    answersRef.current = [...answersRef.current, value];
    setIsTransitioning(true);

    timeoutRef.current = window.setTimeout(() => {
      if (step === ONBOARDING_QUESTIONS.length - 1) {
        try {
          sessionStorage.setItem(
            SCREENING_STORAGE_KEY,
            JSON.stringify(answersRef.current),
          );
        } catch {
        }
        // TODO(BE): setelah register berhasil, kirim jawaban ini ke API lalu hapus dari storage.
        router.replace(NEXT_ROUTE);
        return;
      }

      setStep((currentStep) => currentStep + 1);
      setSelectedAnswer(null);
      setIsTransitioning(false);
    }, ANSWER_DELAY_MS);
  }

  return (
    <OnboardingQuestionTemplate
      key={step}
      isTransitioning={isTransitioning}
      onAnswer={selectAnswer}
      question={question}
      selectedAnswer={selectedAnswer}
      step={step}
      theme={theme}
    />
  );
}