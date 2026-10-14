"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const SPLASH_DURATION_MS = 2500;
const ONBOARDING_ROUTE = "/onboarding";
const TAGLINE = "Ruang aman untuk ceritamu.";
const LOGO_SRC = "/images/Logo-Splashcreen.svg";
const LOGO_WIDTH = 806;
const LOGO_HEIGHT = 270;

export function SplashScreen() {
  const router = useRouter();
  const hasNavigated = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  const continueToOnboarding = useCallback(() => {
    if (hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    // TODO(BE): cek sesi Supabase; jika sudah login arahkan ke /beranda, jika belum ke /onboarding
    router.replace(ONBOARDING_ROUTE);
  }, [router]);

  useEffect(() => {
    router.prefetch(ONBOARDING_ROUTE);
    timeoutRef.current = window.setTimeout(continueToOnboarding, SPLASH_DURATION_MS);

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [continueToOnboarding, router]);

  return (
    <button
      type="button"
      className="h-dvh w-full overflow-hidden border-0 bg-base px-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-text focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-guardian"
      aria-label="Lanjut ke onboarding"
      onClick={continueToOnboarding}
    >
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="splash-logo-enter">
          <div className="splash-logo-breathe">
            <Image
              src={LOGO_SRC}
              alt="Logo Vsikolog"
              width={LOGO_WIDTH}
              height={LOGO_HEIGHT}
              className="h-auto w-[clamp(160px,50vw,240px)]"
              priority
              unoptimized
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="splash-fade-in font-body text-sm text-text/60">{TAGLINE}</p>
          <div className="flex items-center gap-2" aria-label="Memuat" role="status">
            <span className="splash-loading-dot h-1.5 w-1.5 rounded-full bg-guardian" />
            <span className="splash-loading-dot h-1.5 w-1.5 rounded-full bg-guardian" />
            <span className="splash-loading-dot h-1.5 w-1.5 rounded-full bg-guardian" />
          </div>
        </div>
      </div>
    </button>
  );
}
