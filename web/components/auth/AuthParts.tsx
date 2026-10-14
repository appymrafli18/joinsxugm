import type { CSSProperties, ReactNode } from "react";

export const INPUT_CLASS =
  "h-full min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-text/35";
export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60";

export function SparkleIcon({ className, style }: { className?: string; style?: CSSProperties }) {
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

export const UserIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
  </Icon>
);

export const MailIcon = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m4 7 8 6 8-6" />
  </Icon>
);

export const LockIcon = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="9" rx="3" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const EyeIcon = () => (
  <Icon>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = () => (
  <Icon>
    <path d="M3 3l18 18" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.3 6.8C3.6 8.6 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1" />
  </Icon>
);

export function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin [animation-duration:1.2s]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type FieldProps = {
  id: string;
  label: string;
  icon: ReactNode;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export function Field({ id, label, icon, error, hint, children }: FieldProps) {
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
      {error ? (
        <p id={`${id}-error`} className="mt-2 pl-1 text-xs text-[#B04A6A]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 pl-1 text-xs text-text/60">
          {hint}
        </p>
      ) : null}
    </div>
  );
}