"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import {
  EyeIcon,
  EyeOffIcon,
  Field,
  FOCUS_RING,
  INPUT_CLASS,
  LockIcon,
  MailIcon,
  SparkleIcon,
  Spinner,
  UserIcon,
} from "@/components/auth/AuthParts";
import { saveScreeningFromStorage } from "@/lib/profile";
import { signUpWithEmail } from "@/lib/auth";

const HERO_SRC = "/images/illustrations/register_hero.png";
const NEXT_ROUTE = "/pilih-arketipe";
const LOGIN_ROUTE = "/login";
const GREETING = "Hai, salam kenal.";
const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;
const PASSWORD_MIN = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SPARKLES = [
  { className: "left-[14%] top-[36%] h-5 w-5", delay: "0s" },
  { className: "right-[15%] top-[14%] h-4 w-4", delay: "1.2s" },
  { className: "left-[7%] top-[64%] h-3 w-3", delay: "2.1s" },
  { className: "right-[8%] top-[52%] h-5 w-5", delay: "0.6s" },
];

type FieldErrors = {
  nickname?: string;
  email?: string;
  password?: string;
  consent?: string;
};

function describedBy(id: string, error?: string, hint?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function RegisterScreen() {
  const router = useRouter();
  const nicknameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const consentId = useId();
  const nicknameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [heroFailed, setHeroFailed] = useState(false);

  const passwordHint = `Minimal ${PASSWORD_MIN} karakter.`;
  const nicknameHint = "Pakai nama panggilan, bukan nama aslimu.";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedNickname = nickname.trim();
    const trimmedEmail = email.trim();
    const errors: FieldErrors = {};

    if (!trimmedNickname) errors.nickname = "Isi nama panggilanmu dulu ya.";
    else if (trimmedNickname.length < NICKNAME_MIN)
      errors.nickname = `Nama panggilan minimal ${NICKNAME_MIN} karakter.`;

    if (!trimmedEmail) errors.email = "Isi emailmu dulu ya.";
    else if (!EMAIL_PATTERN.test(trimmedEmail)) errors.email = "Format emailnya belum sesuai.";

    if (!password) errors.password = "Buat kata sandimu dulu ya.";
    else if (password.length < PASSWORD_MIN)
      errors.password = `Kata sandi minimal ${PASSWORD_MIN} karakter.`;

    if (!agreed) errors.consent = "Centang persetujuan dulu untuk melanjutkan.";

    setFieldErrors(errors);
    setFormError(null);

    if (errors.nickname) return void nicknameRef.current?.focus();
    if (errors.email) return void emailRef.current?.focus();
    if (errors.password) return void passwordRef.current?.focus();
    if (errors.consent) return void consentRef.current?.focus();

    setIsSubmitting(true);
    const result = await signUpWithEmail({
      nickname: trimmedNickname,
      email: trimmedEmail,
      password,
    });

    if (!result.ok) {
      setFormError(result.message);
      setIsSubmitting(false);
      return;
    }

    if (result.needsEmailConfirmation) {
      setConfirmationEmail(trimmedEmail);
      setIsSubmitting(false);
      return;
    }

    // Gagal menyimpan tidak menghalangi alur; jawaban tetap di storage dan dicoba lagi
    // di halaman pilih arketipe.
    await saveScreeningFromStorage();
    router.replace(NEXT_ROUTE);
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden bg-base font-body text-text">
      {/* Hero */}
      <section className="relative h-[clamp(200px,32dvh,300px)] shrink-0 overflow-hidden bg-gradient-to-b from-guardian-card via-guardian-card to-base">
        <div aria-hidden="true" className="absolute -left-16 top-4 h-52 w-52 rounded-full bg-guardian/25 blur-3xl" />
        <div aria-hidden="true" className="absolute -right-12 top-20 h-44 w-44 rounded-full bg-cta/15 blur-3xl" />

        {!heroFailed && (
          <Image
            src={HERO_SRC}
            alt="Ilustrasi karakter pendamping yang tersenyum malu sambil memegang kartu nama"
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
        {confirmationEmail ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-guardian-card text-guardian shadow-float">
              <MailIcon />
            </span>
            <h1 className="mt-5 font-display text-[24px] leading-tight">Cek emailmu</h1>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-text/75">
              Kami mengirim tautan konfirmasi ke{" "}
              <span className="break-all text-text">{confirmationEmail}</span>. Buka tautannya, lalu
              kembali ke sini dan masuk.
            </p>
            <Link
              href={LOGIN_ROUTE}
              className={`mt-7 flex h-[54px] w-full items-center justify-center rounded-full bg-cta text-base text-white shadow-[0_10px_24px_rgba(227,119,155,0.35)] ${FOCUS_RING}`}
            >
              Ke halaman masuk
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-[26px] leading-tight">Buat akunmu</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-text/70">
              Satu langkah lagi, lalu kamu bisa memilih teman pendampingmu.
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
              <Field
                id={nicknameId}
                label="Nama panggilan"
                icon={<UserIcon />}
                error={fieldErrors.nickname}
                hint={nicknameHint}
              >
                <input
                  id={nicknameId}
                  ref={nicknameRef}
                  type="text"
                  autoComplete="nickname"
                  maxLength={NICKNAME_MAX}
                  placeholder="Mau dipanggil apa?"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.nickname)}
                  aria-describedby={describedBy(nicknameId, fieldErrors.nickname, nicknameHint)}
                  className={INPUT_CLASS}
                />
              </Field>

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
                  aria-describedby={describedBy(emailId, fieldErrors.email)}
                  className={INPUT_CLASS}
                />
              </Field>

              <Field
                id={passwordId}
                label="Kata sandi"
                icon={<LockIcon />}
                error={fieldErrors.password}
                hint={passwordHint}
              >
                <input
                  id={passwordId}
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Buat kata sandi"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={describedBy(passwordId, fieldErrors.password, passwordHint)}
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

              {/* Persetujuan */}
              <div>
                <label htmlFor={consentId} className="flex cursor-pointer items-start gap-3">
                  <input
                    id={consentId}
                    ref={consentRef}
                    type="checkbox"
                    checked={agreed}
                    onChange={(event) => setAgreed(event.target.checked)}
                    aria-invalid={Boolean(fieldErrors.consent)}
                    aria-describedby={fieldErrors.consent ? `${consentId}-error` : undefined}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg shadow-float ring-1 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text/60 ${
                      agreed
                        ? "bg-cta text-white ring-cta"
                        : fieldErrors.consent
                          ? "bg-white ring-[#B04A6A]/60"
                          : "bg-white ring-guardian/30"
                    }`}
                  >
                    {agreed && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[13px] leading-relaxed text-text/80">
                    Aku setuju dengan <strong className="font-normal text-text">Syarat Penggunaan</strong>{" "}
                    dan <strong className="font-normal text-text">Kebijakan Privasi</strong> Vsikolog. Dataku
                    hanya dibagikan ke psikolog atas izinku. Dalam keadaan krisis, sistem dapat
                    menghubungi psikolog on-call dan kontak daruratku.
                  </span>
                </label>
                {fieldErrors.consent && (
                  <p id={`${consentId}-error`} className="mt-2 pl-9 text-xs text-[#B04A6A]">
                    {fieldErrors.consent}
                  </p>
                )}
              </div>

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
                    <span>Membuat akun...</span>
                  </>
                ) : (
                  "Daftar"
                )}
              </button>
            </form>

            <p className="mt-6 pb-2 text-center text-[13px] text-text/75">
              Sudah punya akun?{" "}
              <Link
                href={LOGIN_ROUTE}
                className={`rounded-sm text-text underline decoration-cta decoration-2 underline-offset-4 ${FOCUS_RING}`}
              >
                Masuk
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}