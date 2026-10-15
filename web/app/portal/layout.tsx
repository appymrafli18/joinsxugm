export const metadata = {
  title: 'Portal — Vsikolog',
  description: 'Portal Admin & Psikolog Kokoro Cure.',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-dvh bg-base font-body text-text">{children}</main>;
}
