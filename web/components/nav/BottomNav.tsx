"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      {children}
    </svg>
  );
}

type NavItem = { href: string; label: string; icon: ReactNode };

// Mengikuti design-tokens.md: Beranda / Companion / Misi / Profil.
const ITEMS: NavItem[] = [
  {
    href: "/beranda",
    label: "Beranda",
    icon: (
      <NavIcon>
        <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z" />
      </NavIcon>
    ),
  },
  {
    href: "/companion",
    label: "Companion",
    icon: (
      <NavIcon>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V16h-.5A2.5 2.5 0 0 1 4 13.5z" />
      </NavIcon>
    ),
  },
  {
    href: "/misi",
    label: "Misi",
    icon: (
      <NavIcon>
        <path d="M6 21V4M6 5h11l-2.5 4L17 13H6" />
      </NavIcon>
    ),
  },
  {
    href: "/profil",
    label: "Profil",
    icon: (
      <NavIcon>
        <circle cx="12" cy="8" r="3.8" />
        <path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
      </NavIcon>
    ),
  },
];

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60";

export function BottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul className="mx-auto flex max-w-[430px] items-center justify-between gap-1 rounded-[28px] bg-white/90 p-2 shadow-[0_8px_30px_rgba(59,46,74,0.12)] ring-1 ring-guardian/10 backdrop-blur-md">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs transition-colors ${
                  active ? "bg-guardian-card text-[#6E4FB5]" : "text-text/60 hover:text-text"
                } ${FOCUS_RING}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}