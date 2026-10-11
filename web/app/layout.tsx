import type { Metadata } from "next";
import { Mochiy_Pop_One } from "next/font/google";
import "./globals.css";

const mochiy = Mochiy_Pop_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mochiy",
});

export const metadata: Metadata = {
  title: "Vsikolog",
  description: "Kamu tidak sendiri di sini.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={mochiy.variable}>
      <body className="bg-base text-text font-body">{children}</body>
    </html>
  );
}