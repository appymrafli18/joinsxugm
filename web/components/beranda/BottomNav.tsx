"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60";

/* ---------- ikon SVG ---------- */

type IconProps = { active: boolean };

function Svg({ active, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function BerandaIcon({ active }: IconProps) {
  return (
    <Svg active={active}>
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z" />
    </Svg>
  );
}

/* Tunas: sesuai desain tab Companion */
function CompanionIcon({ active }: IconProps) {
  return (
    <Svg active={active}>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z" />
      <path d="M12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z" />
    </Svg>
  );
}

/* Gunung: sesuai desain tab Perjalanan */
function PerjalananIcon({ active }: IconProps) {
  return (
    <Svg active={active}>
      <path d="M3 20l6.5-11 4 6.5 2.5-3.5L21 20H3z" />
    </Svg>
  );
}

function ProfilIcon({ active }: IconProps) {
  return (
    <Svg active={active}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </Svg>
  );
}

/* ---------- data tab ---------- */

const TABS = [
  { label: "Beranda", href: "/beranda", Icon: BerandaIcon },
  { label: "Companion", href: "/companion", Icon: CompanionIcon },
  { label: "Perjalanan", href: "/perjalanan", Icon: PerjalananIcon },
  { label: "Profil", href: "/profil", Icon: ProfilIcon },
] as const;

/* ---------- komponen ---------- */

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi utama"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[430px] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul
        className="pointer-events-auto flex items-center justify-around rounded-full bg-white/90 px-2 py-2 shadow-float ring-1 ring-guardian/10 backdrop-blur-lg"
        role="list"
      >
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-0.5 transition-colors duration-200",
                  isActive ? "text-cta" : "text-text/50 hover:text-text/80",
                  FOCUS_RING,
                ].join(" ")}
              >
                <span
                  className={[
                    "grid h-10 w-10 place-items-center rounded-2xl transition-colors duration-200",
                    isActive
                      ? "bg-cta text-white shadow-[0_6px_14px_rgba(227,119,155,0.35)]"
                      : "bg-transparent",
                  ].join(" ")}
                >
                  <tab.Icon active={isActive} />
                </span>
                <span
                  className={[
                    "text-[10px] leading-tight",
                    isActive ? "font-display" : "",
                  ].join(" ")}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}