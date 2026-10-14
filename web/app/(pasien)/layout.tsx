export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-base">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-base">{children}</div>
    </main>
  );
}
