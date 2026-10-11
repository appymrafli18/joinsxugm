"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_QUESTIONS, ANSWER_OPTIONS, type ArchetypeKey } from "@/lib/questions";

const THEME: Record<ArchetypeKey, { bg: string; card: string; text: string }> = {
  guardian: { bg: "bg-guardian", card: "bg-guardian-card", text: "text-guardian" },
  healer: { bg: "bg-healer", card: "bg-healer-card", text: "text-healer" },
  scholar: { bg: "bg-scholar", card: "bg-scholar-card", text: "text-scholar" },
  companion: { bg: "bg-companion", card: "bg-companion-card", text: "text-companion" },
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const question = ONBOARDING_QUESTIONS[step];
  const theme = THEME[question.archetype];

  function answer(value: number) {
    const next = [...answers, value];
    setAnswers(next);

    if (step < ONBOARDING_QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      // TODO: simpan `next` (jawaban mentah) ke screening_scores via
      // Supabase sebelum redirect, begitu endpoint-nya dibuat.
      router.push("/pilih-arketipe");
    }
  }

  return (
    <main className="min-h-screen bg-base flex flex-col">
      {/* ===== Area karakter — background & warna berganti tiap pertanyaan ===== */}
      <div className={`relative h-[45vh] ${theme.card} rounded-b-[2.5rem] overflow-hidden`}>
        <div className="absolute top-6 left-6">
          <h1 className="font-display text-2xl text-text">Kokoro Cure</h1>
          <p className="font-body text-sm text-text/60 mt-1">Kamu tidak sendiri di sini</p>
        </div>

        {/* Placeholder ilustrasi karakter — ganti src setelah asset digenerate */}
        <img
          src={`/illustrations/${question.archetype}_onboarding.png`}
          alt={question.characterName}
          className="absolute right-0 bottom-0 h-full object-contain object-bottom"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      {/* ===== Kartu pertanyaan ===== */}
      <div className="flex-1 flex flex-col items-center px-6 py-8 -mt-6 bg-base rounded-t-[2rem] shadow-float">
        {/* Progress dots */}
        <div className="flex gap-2 mb-4">
          {ONBOARDING_QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? `w-6 ${theme.bg}` : "w-2 bg-text/15"
              }`}
            />
          ))}
        </div>

        <p className="font-body text-sm text-text/60 mb-6">
          Pertanyaan {step + 1} dari {ONBOARDING_QUESTIONS.length}
        </p>

        <h2 className="font-display text-xl text-text text-center max-w-sm mb-8 leading-relaxed">
          {question.text}
        </h2>

        <div className="flex gap-3 w-full max-w-sm">
          {ANSWER_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => answer(opt.value)}
              className={`flex-1 py-3 rounded-xl2 font-display text-sm text-text shadow-float
                hover:opacity-90 transition
                ${opt.label === "Setuju" ? "bg-cta text-base" : theme.card}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}