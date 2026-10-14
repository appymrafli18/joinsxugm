"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { signInWithEmail, signOut } from "@/lib/auth";
import { resolvePatientRoute } from "@/lib/profile";
const HERO_SRC = "/images/illustrations/login_hero.png";
const REGISTER_ROUTE = "/register";
const GREETING = "Hai, senang bertemu lagi.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SPARKLES = [
  { className: "left-[14%] top-[34%] h-5 w-5", delay: "0s" },
  { className: "right-[15%] top-[14%] h-4 w-4", delay: "1.2s" },
  { className: "left-[7%] top-[62%] h-3 w-3", delay: "2.1s" },
  { className: "right-[8%] top-[50%] h-5 w-5", delay: "0.6s" },
];

type FieldErrors = { email?: string; password?: string };

/* ---------- ikon ---------- */

function SparkleIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M12 0c.7 6.2 5.8 11.3 12 12-6.2.7-11.3 5.8-12 12-.7-6.2-5.8-11.3-12-12C6.2 11.3 11.3 6.2 12 0z" />
    </svg>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {children}
    </svg>
  );
}

const MailIcon = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m4 7 8 6 8-6" />
  </Icon>
);

const LockIcon = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="9" rx="3" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

const EyeIcon = () => (
  <Icon>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

const EyeOffIcon = () => (
  <Icon>
    <path d="M3 3l18 18" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.3 6.8C3.6 8.6 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1" />
  </Icon>
);

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin [animation-duration:1.2s]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- field ---------- */

type FieldProps = {
  id: string;
  label: string;
  icon: ReactNode;
  error?: string;
  children: ReactNode;
};

function Field({ id, label, icon, error, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block pl-1 text-[13px] text-text/80">
        {label}
      </label>
      <div
        className={`flex h-[54px] items-center gap-3 rounded-xl2 bg-white px-4 shadow-float ring-1 transition-shadow focus-within:ring-2 ${
          error
            ? "ring-[#B04A6A]/60 focus-within:ring-[#B04A6A]"
            : "ring-guardian/20 focus-within:ring-guardian"
        }`}
      >
        <span className="text-guardian">{icon}</span>
        {children}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-2 pl-1 text-xs text-[#B04A6A]">
          {error}
        </p>
      )}
    </div>
  );
}

const INPUT_CLASS =
  "h-full min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-text/35";
const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60";

/* ---------- halaman ---------- */

export function LoginScreen() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedEmail = email.trim();
    const errors: FieldErrors = {};
    if (!trimmedEmail) errors.email = "Isi emailmu dulu ya.";
    else if (!EMAIL_PATTERN.test(trimmedEmail)) errors.email = "Format emailnya belum sesuai.";
    if (!password) errors.password = "Isi kata sandimu dulu ya.";

    setFieldErrors(errors);
    setFormError(null);

    if (errors.email) {
      emailRef.current?.focus();
      return;
    }
    if (errors.password) {
      passwordRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    const result = await signInWithEmail(trimmedEmail, password);

    if (!result.ok) {
      setFormError(result.message);
      setIsSubmitting(false);
      return;
    }

    const destination = await resolvePatientRoute();

    if (!destination.ok) {
      if (destination.reason === "not_patient") {
        await signOut();
        setFormError("Akun ini bukan akun pasien. Kalau kamu psikolog, masuklah lewat dashboard psikolog.");
      } else {
        setFormError("Berhasil masuk, tapi data akunmu belum bisa dimuat. Coba lagi sebentar lagi.");
      }
      setIsSubmitting(false);
      return;
    }

    router.replace(destination.route);
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden bg-base font-body text-text">
      {/* Hero */}
      <section className="relative h-[clamp(250px,42dvh,380px)] shrink-0 overflow-hidden bg-gradient-to-b from-guardian-card via-guardian-card to-base">
        <div aria-hidden="true" className="absolute -left-16 top-4 h-52 w-52 rounded-full bg-guardian/25 blur-3xl" />
        <div aria-hidden="true" className="absolute -right-12 top-24 h-44 w-44 rounded-full bg-cta/15 blur-3xl" />

        {!heroFailed && (
          <Image
            src={HERO_SRC}
            alt="Ilustrasi karakter pendamping yang tersenyum dan melambai"
            fill
            priority
            sizes="(max-width: 430px) 100vw, 430px"
            className="login-float object-cover object-top"
            onError={() => setHeroFailed(true)}
          />
        )}

        {SPARKLES.map((sparkle, index) => (
          <SparkleIcon
            key={index}
            className={`login-twinkle absolute text-sparkle ${sparkle.className}`}
            style={{ animationDelay: sparkle.delay }}
          />
        ))}

        <p className="login-rise absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] z-10 max-w-[52%] rounded-xl2 rounded-tl-md bg-white/90 px-4 py-3 text-[13px] leading-snug shadow-float backdrop-blur-sm">
          {GREETING}
        </p>
      </section>

      {/* Kartu form */}
      <section
        className="login-rise relative z-20 -mt-8 flex flex-1 flex-col rounded-t-[2rem] bg-base px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 shadow-[0_-8px_24px_rgba(59,46,74,0.08)]"
        style={{ animationDelay: "120ms" }}
      >
        <h1 className="font-display text-[26px] leading-tight">Selamat datang kembali</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text/70">
          Masuk untuk melanjutkan perjalananmu.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
          <Field id={emailId} label="Email" icon={<MailIcon />} error={fieldErrors.email}>
            <input
              id={emailId}
              ref={emailRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="nama@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
              className={INPUT_CLASS}
            />
          </Field>

          <Field id={passwordId} label="Kata sandi" icon={<LockIcon />} error={fieldErrors.password}>
            <input
              id={passwordId}
              ref={passwordRef}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Kata sandimu"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? `${passwordId}-error` : undefined}
              className={INPUT_CLASS}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              aria-pressed={showPassword}
              className={`-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-text/55 transition-colors hover:text-text ${FOCUS_RING}`}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </Field>

          <div aria-live="assertive">
            {formError && (
              <p
                role="alert"
                className="rounded-xl2 bg-healer-card px-4 py-3 text-[13px] leading-snug text-[#8F3A57]"
              >
                {formError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-cta text-base text-white shadow-[0_10px_24px_rgba(227,119,155,0.35)] transition-[transform,opacity] duration-200 active:scale-[0.98] disabled:opacity-80 ${FOCUS_RING}`}
          >
            {isSubmitting ? (
              <>
                <Spinner />
                <span>Masuk...</span>
              </>
            ) : (
              "Masuk"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[13px] text-text/75">
          Belum punya akun?{" "}
          <Link
            href={REGISTER_ROUTE}
            className={`text-text underline decoration-cta decoration-2 underline-offset-4 ${FOCUS_RING} rounded-sm`}
          >
            Daftar
          </Link>
        </p>

        <p className="mt-auto flex items-start justify-center gap-2 pt-8 text-center text-xs leading-relaxed text-text/60">
          <span className="mt-0.5 shrink-0 text-guardian">
            <LockIcon />
          </span>
          <span>Percakapanmu bersifat pribadi. Datamu hanya dibagikan ke psikolog atas izinmu.</span>
        </p>
      </section>
    </main>
  );
}